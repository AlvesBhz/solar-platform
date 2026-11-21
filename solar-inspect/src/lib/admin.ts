/* eslint-disable @typescript-eslint/no-explicit-any */
// Dados da administração (T28–T33). Real: Supabase com RLS (só ADMIN/gestão alteram) e Edge Functions para login e senha.
// Demonstração: dados em memória, sem rede.
import { MODO_DEMO, SUPABASE_URL, supabase } from './supabase';
import type { Perfil } from './acesso';

export const PERFIS: { valor: Perfil; label: string }[] = [
  { valor: 'ASSESSOR', label: 'Vistoria' }, { valor: 'LIMPEZA', label: 'Limpeza' }, { valor: 'MANUTENCAO', label: 'Manutenção' },
  { valor: 'GESTOR', label: 'Gestor' }, { valor: 'ADMIN', label: 'Administrador' },
];
export const rotuloPerfil = (p: string) => PERFIS.find((x) => x.valor === p)?.label ?? p;

export type Propriedade = {
  id_propriedade: number; nm_propriedade: string; qtde_unidades: number; tp_validacao: 'QR' | 'GPS' | 'QR_E_GPS';
  vl_latitude: number | null; vl_longitude: number | null; qtde_raio_metros: number; qtde_precisao_max_metros: number; qtde_minutos_min_vistoria: number;
};
export type Usuario = { id: string; nome: string; login: string; cpf: string | null; perfil: Perfil; ativo: boolean; props: number[] };
export type Resultado = { ok: true } | { ok: false; erro: string };

// mensagens para os erros do banco e das funções
const ERROS: Record<string, string> = {
  ultimo_admin: 'É preciso manter ao menos um administrador ativo.',
  login_em_uso: 'Esse usuário já existe.', cpf_em_uso: 'Esse CPF já está cadastrado.', cpf_invalido: 'CPF inválido.',
  login_invalido: 'Usuário: 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra.',
  senha_invalida: 'A senha precisa ter de 8 a 72 caracteres.', nome_invalido: 'Informe o nome completo.',
  propriedade_obrigatoria: 'Escolha ao menos uma pousada para este perfil.', sem_permissao: 'Só o administrador pode fazer isso.',
  usuario_inexistente: 'Usuário não encontrado.', perfil_sem_permissao: 'Seu perfil não pode fazer isso.',
};
export const mensagem = (codigo?: string, padrao = 'Não foi possível salvar agora. Tente de novo.') =>
  (codigo && (ERROS[codigo] ?? (/duplicate key|unique/i.test(codigo) ? 'Já existe um registro com esse nome.' : undefined))) || padrao;

// ── demonstração
const demo = {
  props: [
    { id_propriedade: 1, nm_propriedade: 'Solar do Espinhaço', qtde_unidades: 1, tp_validacao: 'QR_E_GPS', vl_latitude: -19.0847, vl_longitude: -43.5967, qtde_raio_metros: 100, qtde_precisao_max_metros: 50, qtde_minutos_min_vistoria: 10 },
  ] as Propriedade[],
  usuarios: [
    { id: 'd1', nome: 'Ana Souza', login: 'ana', cpf: '52998224725', perfil: 'ASSESSOR', ativo: true, props: [1] },
    { id: 'd2', nome: 'Gestor Demo', login: 'gestor', cpf: null, perfil: 'GESTOR', ativo: true, props: [1] },
    { id: 'd3', nome: 'Admin Demo', login: 'admin', cpf: null, perfil: 'ADMIN', ativo: true, props: [] },
  ] as Usuario[],
};

export async function listarPropriedades(): Promise<Propriedade[]> {
  if (MODO_DEMO || !supabase) return demo.props;
  const { data, error } = await supabase.rpc('vst_propriedades');
  if (error) throw new Error(error.message);
  return data as Propriedade[];
}

export async function listarUsuarios(): Promise<Usuario[]> {
  if (MODO_DEMO || !supabase) return demo.usuarios;
  const [u, up] = await Promise.all([
    supabase.from('VST_USUARIO').select('ID_USUARIO, NM_USUARIO, CD_LOGIN, CD_CPF, TP_PERFIL, SG_ATIVO').order('NM_USUARIO'),
    supabase.from('VST_USUARIO_PROPRIEDADE').select('ID_USUARIO, ID_PROPRIEDADE'),
  ]);
  if (u.error || up.error) throw new Error((u.error ?? up.error)!.message);
  return (u.data ?? []).map((r) => ({
    id: r.ID_USUARIO, nome: r.NM_USUARIO, login: r.CD_LOGIN, cpf: r.CD_CPF, perfil: r.TP_PERFIL, ativo: r.SG_ATIVO,
    props: (up.data ?? []).filter((x) => x.ID_USUARIO === r.ID_USUARIO).map((x) => Number(x.ID_PROPRIEDADE)),
  }));
}

// Edge Functions com o login de quem chama (só ADMIN passa lá dentro)
async function funcao(nome: string, corpo: unknown): Promise<Resultado & { dados?: unknown }> {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) return { ok: false, erro: 'Sessão expirada. Entre novamente.' };
  try {
    const r = await fetch(`${import.meta.env.VITE_FUNCOES_BASE ?? SUPABASE_URL + '/functions/v1'}/${nome}`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(corpo),
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, dados: j } : { ok: false, erro: j.mensagem ?? mensagem(j.erro) };
  } catch {
    return { ok: false, erro: 'Sem conexão. Tente de novo.' };
  }
}

export type NovoUsuario = { nome: string; login: string; cpf: string; perfil: Perfil; senha: string; props: number[] };
export async function criarUsuario(n: NovoUsuario): Promise<Resultado> {
  if (MODO_DEMO || !supabase) {
    if (demo.usuarios.some((u) => u.login === n.login)) return { ok: false, erro: mensagem('login_em_uso') };
    demo.usuarios = [...demo.usuarios, { id: 'd' + Date.now(), nome: n.nome, login: n.login, cpf: n.cpf || null, perfil: n.perfil, ativo: true, props: n.props }];
    return { ok: true };
  }
  return funcao('criar-usuario', { nm_usuario: n.nome, cd_login: n.login, cd_cpf: n.cpf || null, tp_perfil: n.perfil, senha: n.senha, ids_propriedade: n.perfil === 'ADMIN' ? [] : n.props });
}

export async function redefinirSenha(login: string, senha: string): Promise<Resultado> {
  if (MODO_DEMO || !supabase) return { ok: true };
  return funcao('redefinir-senha', { cd_login: login, senha });
}

/** Salva perfil, status, nome e pousadas. As pousadas mudam só o necessário (inclui as novas, retira as removidas). */
export async function salvarUsuario(antes: Usuario, depois: Pick<Usuario, 'nome' | 'perfil' | 'ativo' | 'props'>): Promise<Resultado> {
  const props = depois.perfil === 'ADMIN' ? antes.props : depois.props;
  if (depois.perfil !== 'ADMIN' && props.length === 0) return { ok: false, erro: mensagem('propriedade_obrigatoria') };
  if (depois.nome.trim().length < 3) return { ok: false, erro: mensagem('nome_invalido') };
  if (MODO_DEMO || !supabase) {
    demo.usuarios = demo.usuarios.map((u) => (u.id === antes.id ? { ...u, ...depois, nome: depois.nome.trim(), props } : u));
    return { ok: true };
  }
  const { error } = await supabase.from('VST_USUARIO')
    .update({ NM_USUARIO: depois.nome.trim(), TP_PERFIL: depois.perfil, SG_ATIVO: depois.ativo }).eq('ID_USUARIO', antes.id);
  if (error) return { ok: false, erro: mensagem(error.message) };
  const novas = props.filter((p) => !antes.props.includes(p)), saem = antes.props.filter((p) => !props.includes(p));
  if (novas.length) {
    const r = await supabase.from('VST_USUARIO_PROPRIEDADE').insert(novas.map((p) => ({ ID_USUARIO: antes.id, ID_PROPRIEDADE: p })));
    if (r.error) return { ok: false, erro: mensagem(r.error.message) };
  }
  if (saem.length) {
    const r = await supabase.from('VST_USUARIO_PROPRIEDADE').delete().eq('ID_USUARIO', antes.id).in('ID_PROPRIEDADE', saem);
    if (r.error) return { ok: false, erro: mensagem(r.error.message) };
  }
  return { ok: true };
}

// ── T28/T29 configuração de presença da pousada (VST_PROPRIEDADE). Mesmas regras dos CHECKs do banco.
export type ConfigPresenca = { tp_validacao: Propriedade['tp_validacao']; vl_latitude: number | null; vl_longitude: number | null; qtde_raio_metros: number; qtde_precisao_max_metros?: number; qtde_minutos_min_vistoria?: number };
export function validarPresenca(c: ConfigPresenca): string[] {
  const e: string[] = [];
  if ((c.vl_latitude === null) !== (c.vl_longitude === null)) e.push('Informe latitude e longitude juntas (ou deixe as duas vazias).');
  if (c.vl_latitude !== null && (isNaN(c.vl_latitude) || Math.abs(c.vl_latitude) > 90)) e.push('Latitude inválida (-90 a 90).');
  if (c.vl_longitude !== null && (isNaN(c.vl_longitude) || Math.abs(c.vl_longitude) > 180)) e.push('Longitude inválida (-180 a 180).');
  if (!Number.isInteger(c.qtde_raio_metros) || c.qtde_raio_metros < 10 || c.qtde_raio_metros > 1000) e.push('Raio entre 10 e 1.000 m.');
  if (c.qtde_precisao_max_metros !== undefined && (!Number.isInteger(c.qtde_precisao_max_metros) || c.qtde_precisao_max_metros < 5 || c.qtde_precisao_max_metros > 500)) e.push('Precisão máxima entre 5 e 500 m.');
  if (c.qtde_minutos_min_vistoria !== undefined && (!Number.isInteger(c.qtde_minutos_min_vistoria) || c.qtde_minutos_min_vistoria < 0 || c.qtde_minutos_min_vistoria > 240)) e.push('Tempo mínimo entre 0 e 240 minutos.');
  if (c.tp_validacao !== 'QR' && c.vl_latitude === null) e.push('Para validar por GPS, informe o ponto (latitude e longitude).');
  return e;
}
export async function salvarConfigPropriedade(id: number, c: Required<ConfigPresenca>): Promise<Resultado> {
  const erros = validarPresenca(c);
  if (erros.length) return { ok: false, erro: erros[0] };
  if (MODO_DEMO || !supabase) { demo.props = demo.props.map((p) => (p.id_propriedade === id ? { ...p, ...c } : p)); return { ok: true }; }
  const { error } = await supabase.from('VST_PROPRIEDADE').upsert({
    ID_PROPRIEDADE: id, TP_VALIDACAO: c.tp_validacao, VL_LATITUDE: c.vl_latitude, VL_LONGITUDE: c.vl_longitude, QTDE_RAIO_METROS: c.qtde_raio_metros,
    QTDE_PRECISAO_MAX_METROS: c.qtde_precisao_max_metros, QTDE_MINUTOS_MIN_VISTORIA: c.qtde_minutos_min_vistoria,
  }, { onConflict: 'ID_PROPRIEDADE' });
  return error ? { ok: false, erro: mensagem(error.message) } : { ok: true };
}
export const VALIDACOES: { valor: Propriedade['tp_validacao']; label: string }[] = [
  { valor: 'QR_E_GPS', label: 'QR e GPS' }, { valor: 'QR', label: 'Só QR' }, { valor: 'GPS', label: 'Só GPS' },
];

// ── T33 presença por chalé (VST_UNIDADE): vazio herda da pousada. QR só pelas funções (gestão).
export type Herdavel = Propriedade['tp_validacao'] | null;
export type UnidadePresenca = {
  id: number; nome: string; codigo: string; idPropriedade: number; pousada: string; situacao: string; andar: string | null; versaoQr: number;
  efetivo: { tp_validacao: Propriedade['tp_validacao']; vl_latitude: number | null; vl_longitude: number | null; qtde_raio_metros: number };
  proprio: { tp_validacao: Herdavel; vl_latitude: number | null; vl_longitude: number | null; qtde_raio_metros: number | null };
};
export async function listarUnidadesPresenca(): Promise<UnidadePresenca[]> {
  if (MODO_DEMO || !supabase) return [{ id: 1, nome: 'Casa do Mirante', codigo: 'casa-do-mirante', idPropriedade: 1, pousada: 'Solar do Espinhaço', situacao: 'LIBERADO', andar: 'Térreo', versaoQr: 1,
    efetivo: { tp_validacao: 'QR_E_GPS', vl_latitude: -19.0849, vl_longitude: -43.5969, qtde_raio_metros: 60 }, proprio: { tp_validacao: null, vl_latitude: -19.0849, vl_longitude: -43.5969, qtde_raio_metros: 60 } }];
  const [u, v] = await Promise.all([
    supabase.rpc('vst_unidades'),
    supabase.from('VST_UNIDADE').select('ID_UNIDADE, DS_ANDAR, TP_VALIDACAO, VL_LATITUDE, VL_LONGITUDE, QTDE_RAIO_METROS, NO_VERSAO_QR'),
  ]);
  if (u.error || v.error) throw new Error((u.error ?? v.error)!.message);
  return (u.data as Record<string, any>[]).map((x) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    const p = (v.data ?? []).find((r) => Number(r.ID_UNIDADE) === Number(x.id_unidade));
    return {
      id: Number(x.id_unidade), nome: x.nm_unidade, codigo: x.cd_unidade, idPropriedade: Number(x.id_propriedade), pousada: x.nm_propriedade, situacao: x.tp_situacao,
      andar: x.ds_andar, versaoQr: p?.NO_VERSAO_QR ?? 1,
      efetivo: { tp_validacao: x.tp_validacao, vl_latitude: x.vl_latitude, vl_longitude: x.vl_longitude, qtde_raio_metros: x.qtde_raio_metros },
      proprio: { tp_validacao: p?.TP_VALIDACAO ?? null, vl_latitude: p?.VL_LATITUDE ?? null, vl_longitude: p?.VL_LONGITUDE ?? null, qtde_raio_metros: p?.QTDE_RAIO_METROS ?? null },
    };
  });
}
export function validarPresencaUnidade(c: UnidadePresenca['proprio'], pousada?: Propriedade): string[] {
  const e: string[] = [];
  if ((c.vl_latitude === null) !== (c.vl_longitude === null)) e.push('Informe latitude e longitude juntas (ou deixe as duas vazias para usar o ponto da pousada).');
  if (c.vl_latitude !== null && (isNaN(c.vl_latitude) || Math.abs(c.vl_latitude) > 90)) e.push('Latitude inválida (-90 a 90).');
  if (c.vl_longitude !== null && (isNaN(c.vl_longitude) || Math.abs(c.vl_longitude) > 180)) e.push('Longitude inválida (-180 a 180).');
  if (c.qtde_raio_metros !== null && (!Number.isInteger(c.qtde_raio_metros) || c.qtde_raio_metros < 10 || c.qtde_raio_metros > 1000)) e.push('Raio entre 10 e 1.000 m (ou vazio para usar o da pousada).');
  const tp = c.tp_validacao ?? pousada?.tp_validacao ?? 'QR_E_GPS';
  if (tp !== 'QR' && c.vl_latitude === null && (pousada?.vl_latitude ?? null) === null) e.push('Para validar por GPS, defina o ponto do chalé ou o da pousada.');
  return e;
}
export async function salvarPresencaUnidade(id: number, c: UnidadePresenca['proprio'], andar: string): Promise<Resultado> {
  if (MODO_DEMO || !supabase) return { ok: true };
  const dados = { TP_VALIDACAO: c.tp_validacao, VL_LATITUDE: c.vl_latitude, VL_LONGITUDE: c.vl_longitude, QTDE_RAIO_METROS: c.qtde_raio_metros, DS_ANDAR: andar.trim() || null, DT_ATUALIZACAO: new Date().toISOString() };
  let r = await supabase.from('VST_UNIDADE').update(dados).eq('ID_UNIDADE', id).select('ID_UNIDADE');
  if (!r.error && (r.data ?? []).length === 0) {
    // chalé novo do site sem linha de configuração: a função de QR cria a linha (só gestão) e o UPDATE é refeito
    const q = await supabase.rpc('vst_obter_qr', { p_id_unidade: id });
    if (q.error) return { ok: false, erro: mensagem(q.error.message) };
    r = await supabase.from('VST_UNIDADE').update(dados).eq('ID_UNIDADE', id).select('ID_UNIDADE');
  }
  if (r.error) return { ok: false, erro: mensagem(r.error.message) };
  return (r.data ?? []).length ? { ok: true } : { ok: false, erro: 'Seu perfil não pode alterar este chalé.' };
}
export async function qrDaUnidade(id: number, rotacionar = false): Promise<{ ok: true; codigo: string; versao: number } | { ok: false; erro: string }> {
  if (MODO_DEMO || !supabase) return { ok: true, codigo: 'demo' + (rotacionar ? Date.now() : ''), versao: 1 };
  const { data, error } = await supabase.rpc(rotacionar ? 'vst_rotacionar_qr' : 'vst_obter_qr', { p_id_unidade: id });
  if (error) return { ok: false, erro: mensagem(error.message) };
  const linha = Array.isArray(data) ? data[0] : data;
  return linha ? { ok: true, codigo: linha.cd_hash_qr, versao: linha.no_versao_qr } : { ok: false, erro: 'Chalé não encontrado.' };
}
