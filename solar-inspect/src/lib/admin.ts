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
export type Resultado = { ok: true; id?: number } | { ok: false; erro: string };

// mensagens para os erros do banco e das funções
const ERROS: Record<string, string> = {
  ultimo_admin: 'É preciso manter ao menos um administrador ativo.',
  login_em_uso: 'Esse usuário já existe.', cpf_em_uso: 'Esse CPF já está cadastrado.', cpf_invalido: 'CPF inválido.',
  login_invalido: 'Usuário: 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra.',
  senha_invalida: 'A senha precisa ter de 8 a 72 caracteres.', nome_invalido: 'Informe o nome completo.',
  propriedade_obrigatoria: 'Escolha ao menos uma pousada para este perfil.', sem_permissao: 'Só o administrador pode fazer isso.',
  usuario_inexistente: 'Usuário não encontrado.', tipo_do_site: 'Entrada e Saída são usadas pelo site: não mudam de código nem de comportamento e não podem ser desativadas.', perfil_sem_permissao: 'Seu perfil não pode fazer isso.',
  // preços (T38–T41)
  tarifa_sobreposta: 'O período se sobrepõe a outra tarifa ativa na mesma prioridade. Mude a prioridade ou as datas.',
  tarifa_invalida: 'Confira a tarifa: nome, datas (a última noite não pode ser antes da primeira), valores, percentuais de 0 a 100 e mínimo de noites.',
  tarifa_inexistente: 'Tarifa não encontrada.', unidade_inexistente: 'Chalé não encontrado.', data_passada: 'Noites que já passaram não podem ser ajustadas.',
  pacote_repetido: 'Já existe um pacote ativo com esse check-in e esse número de noites.',
  pacote_sobreposto: 'As noites se sobrepõem a outro pacote com check-in diferente. Opções do mesmo pacote precisam ter o mesmo check-in.',
  pacote_inexistente: 'Pacote não encontrado.', noites_invalidas: 'O pacote tem de 1 a 30 noites.', valor_invalido: 'Informe o valor total do pacote.', data_invalida: 'Informe a data de check-in.',
  ajuste_invalido: 'Confira o ajuste: o valor não pode ser negativo e o mínimo de noites é 1 ou mais.', periodo_invalido: 'Período inválido.',
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

// ── T30 ambientes e itens (gestão). Nada é apagado: desativar tira do checklist e preserva o histórico das vistorias.
export type Item = { id: number; idAmbiente: number; nome: string; orientacao: string | null; critico: boolean; fotoObrigatoria: boolean; qtdeEsperada: number | null; ordem: number; ativo: boolean };
export type Ambiente = { id: number; idUnidade: number; nome: string; ordem: number; ativo: boolean; itens: Item[] };
const demoAmb: Ambiente[] = [{ id: 1, idUnidade: 1, nome: 'Banheiro', ordem: 1, ativo: true, itens: [{ id: 1, idAmbiente: 1, nome: 'Torneira e pia', orientacao: 'Abrir e fechar; ver se pinga.', critico: true, fotoObrigatoria: true, qtdeEsperada: null, ordem: 1, ativo: true }] }];

export async function listarAmbientes(idUnidade: number): Promise<Ambiente[]> {
  if (MODO_DEMO || !supabase) return demoAmb.filter((a) => a.idUnidade === idUnidade);
  const a = await supabase.from('VST_AMBIENTE').select('ID_AMBIENTE, ID_UNIDADE, NM_AMBIENTE, NO_ORDEM, SG_ATIVO').eq('ID_UNIDADE', idUnidade).order('NO_ORDEM').order('ID_AMBIENTE');
  if (a.error) throw new Error(a.error.message);
  const ids = (a.data ?? []).map((x) => x.ID_AMBIENTE);
  const i = ids.length ? await supabase.from('VST_ITEM').select('ID_ITEM, ID_AMBIENTE, NM_ITEM, DS_ORIENTACAO, SG_CRITICO, SG_FOTO_OBRIGATORIA, QTDE_ESPERADA, NO_ORDEM, SG_ATIVO').in('ID_AMBIENTE', ids).order('NO_ORDEM').order('ID_ITEM') : { data: [], error: null };
  if (i.error) throw new Error(i.error.message);
  return (a.data ?? []).map((x) => ({
    id: Number(x.ID_AMBIENTE), idUnidade: Number(x.ID_UNIDADE), nome: x.NM_AMBIENTE, ordem: x.NO_ORDEM, ativo: x.SG_ATIVO,
    itens: (i.data ?? []).filter((y) => y.ID_AMBIENTE === x.ID_AMBIENTE).map((y) => ({ id: Number(y.ID_ITEM), idAmbiente: Number(y.ID_AMBIENTE), nome: y.NM_ITEM, orientacao: y.DS_ORIENTACAO, critico: y.SG_CRITICO, fotoObrigatoria: y.SG_FOTO_OBRIGATORIA, qtdeEsperada: y.QTDE_ESPERADA, ordem: y.NO_ORDEM, ativo: y.SG_ATIVO })),
  }));
}
const nomeOk = (n: string) => n.trim().length >= 2 && n.trim().length <= 80;
async function gravar(tabela: string, chave: string, id: number | null, dados: Record<string, unknown>): Promise<Resultado> {
  if (MODO_DEMO || !supabase) return { ok: true };
  const r = id === null ? await supabase.from(tabela).insert(dados).select(chave) : await supabase.from(tabela).update(dados).eq(chave, id).select(chave);
  if (r.error) return { ok: false, erro: mensagem(r.error.message) };
  const linha = (r.data ?? [])[0] as unknown as Record<string, unknown> | undefined;
  return linha ? { ok: true, id: Number(linha[chave]) } : { ok: false, erro: 'Seu perfil não pode alterar este chalé.' };
}
export async function salvarAmbiente(a: { id: number | null; idUnidade: number; nome: string; ordem: number; ativo: boolean }): Promise<Resultado> {
  if (!nomeOk(a.nome)) return { ok: false, erro: 'Nome do ambiente: 2 a 80 caracteres.' };
  return gravar('VST_AMBIENTE', 'ID_AMBIENTE', a.id, { ...(a.id === null ? { ID_UNIDADE: a.idUnidade } : {}), NM_AMBIENTE: a.nome.trim(), NO_ORDEM: a.ordem, SG_ATIVO: a.ativo });
}
export async function salvarItem(i: Omit<Item, 'id'> & { id: number | null }): Promise<Resultado> {
  if (!nomeOk(i.nome)) return { ok: false, erro: 'Nome do item: 2 a 80 caracteres.' };
  if (i.qtdeEsperada !== null && (!Number.isInteger(i.qtdeEsperada) || i.qtdeEsperada < 0 || i.qtdeEsperada > 999)) return { ok: false, erro: 'Quantidade esperada: número inteiro de 0 a 999 (ou vazio).' };
  return gravar('VST_ITEM', 'ID_ITEM', i.id, {
    ...(i.id === null ? { ID_AMBIENTE: i.idAmbiente } : {}), NM_ITEM: i.nome.trim(), DS_ORIENTACAO: i.orientacao?.trim() || null, SG_CRITICO: i.critico,
    SG_FOTO_OBRIGATORIA: i.fotoObrigatoria, QTDE_ESPERADA: i.qtdeEsperada, NO_ORDEM: i.ordem, SG_ATIVO: i.ativo,
  });
}
/** Troca a ordem de dois registros vizinhos (ambientes ou itens). */
export async function trocarOrdem(tabela: 'VST_AMBIENTE' | 'VST_ITEM', a: { id: number; ordem: number }, b: { id: number; ordem: number }): Promise<Resultado> {
  const chave = tabela === 'VST_AMBIENTE' ? 'ID_AMBIENTE' : 'ID_ITEM';
  const oa = a.ordem === b.ordem ? b.ordem + 1 : b.ordem;
  const r1 = await gravar(tabela, chave, a.id, { NO_ORDEM: oa });
  if (!r1.ok) return r1;
  return gravar(tabela, chave, b.id, { NO_ORDEM: a.ordem });
}

// ── T31 tipos de vistoria (só ADMIN altera o tipo; a lista de itens de cada tipo é da gestão)
export type Comportamento = 'ENTRADA' | 'SAIDA' | 'ROTINA' | 'MANUTENCAO';
export type Tipo = { id: number; codigo: string; nome: string; comportamento: Comportamento; periodicidade: 'DIARIA' | 'SEMANAL' | 'MENSAL' | null;
  exigeEntrada: boolean; exigeAssinatura: boolean; ativo: boolean; perfis: Perfil[] };
export const DO_SITE = ['ENTRADA', 'SAIDA'];
const demoTipos: Tipo[] = [{ id: 1, codigo: 'ENTRADA', nome: 'Entrada', comportamento: 'ENTRADA', periodicidade: null, exigeEntrada: false, exigeAssinatura: false, ativo: true, perfis: ['ASSESSOR'] }];
export async function listarTipos(): Promise<Tipo[]> {
  if (MODO_DEMO || !supabase) return demoTipos;
  const { data, error } = await supabase.from('VST_TIPO_VISTORIA')
    .select('ID_TIPO_VISTORIA, CD_TIPO_VISTORIA, NM_TIPO_VISTORIA, TP_COMPORTAMENTO, TP_PERIODICIDADE, SG_EXIGE_ENTRADA, SG_EXIGE_ASSINATURA, SG_ATIVO, DS_PERFIS').order('ID_TIPO_VISTORIA');
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({ id: Number(t.ID_TIPO_VISTORIA), codigo: t.CD_TIPO_VISTORIA, nome: t.NM_TIPO_VISTORIA, comportamento: t.TP_COMPORTAMENTO, periodicidade: t.TP_PERIODICIDADE,
    exigeEntrada: t.SG_EXIGE_ENTRADA, exigeAssinatura: t.SG_EXIGE_ASSINATURA, ativo: t.SG_ATIVO, perfis: t.DS_PERFIS }));
}
export function validarTipo(t: Omit<Tipo, 'id'>, novo: boolean): string[] {
  const e: string[] = [];
  if (novo && !/^[A-Z0-9_]{2,40}$/.test(t.codigo)) e.push('Código: 2 a 40 letras MAIÚSCULAS, números ou _ (ex.: ROTINA_MENSAL).');
  if (t.nome.trim().length < 2 || t.nome.trim().length > 60) e.push('Nome: 2 a 60 caracteres.');
  if (t.comportamento === 'ROTINA' && !t.periodicidade) e.push('Rotina precisa de periodicidade.');
  if (t.perfis.length === 0) e.push('Escolha ao menos um perfil de campo que faz este tipo.');
  return e;
}
export async function salvarTipo(id: number | null, t: Omit<Tipo, 'id'>): Promise<Resultado> {
  const erros = validarTipo(t, id === null);
  if (erros.length) return { ok: false, erro: erros[0] };
  const dados = { NM_TIPO_VISTORIA: t.nome.trim(), TP_COMPORTAMENTO: t.comportamento, TP_PERIODICIDADE: t.comportamento === 'ROTINA' ? t.periodicidade : null,
    SG_EXIGE_ENTRADA: t.exigeEntrada, SG_EXIGE_ASSINATURA: t.exigeAssinatura, SG_ATIVO: t.ativo, DS_PERFIS: t.perfis };
  return gravar('VST_TIPO_VISTORIA', 'ID_TIPO_VISTORIA', id, id === null ? { ...dados, CD_TIPO_VISTORIA: t.codigo } : dados);
}
export async function itensDoTipo(idTipo: number): Promise<number[]> {
  if (MODO_DEMO || !supabase) return [];
  const { data, error } = await supabase.from('VST_TIPO_VISTORIA_ITEM').select('ID_ITEM').eq('ID_TIPO_VISTORIA', idTipo);
  if (error) throw new Error(error.message);
  return (data ?? []).map((x) => Number(x.ID_ITEM));
}
export async function alternarItemNoTipo(idTipo: number, idItem: number, incluir: boolean): Promise<Resultado> {
  if (MODO_DEMO || !supabase) return { ok: true };
  const r = incluir
    ? await supabase.from('VST_TIPO_VISTORIA_ITEM').insert({ ID_TIPO_VISTORIA: idTipo, ID_ITEM: idItem }).select('ID_ITEM')
    : await supabase.from('VST_TIPO_VISTORIA_ITEM').delete().eq('ID_TIPO_VISTORIA', idTipo).eq('ID_ITEM', idItem).select('ID_ITEM');
  if (r.error) return { ok: false, erro: mensagem(r.error.message) };
  return (r.data ?? []).length ? { ok: true } : { ok: false, erro: 'Seu perfil não pode alterar este checklist.' };
}

// ── ligação item ↔ tipo de vistoria (o app só oferece um tipo que tenha itens)
/** Para cada item, em quais tipos de vistoria ele entra. */
export async function tiposDosItens(): Promise<Record<number, number[]>> {
  if (MODO_DEMO || !supabase) return {};
  const { data, error } = await supabase.from('VST_TIPO_VISTORIA_ITEM').select('ID_TIPO_VISTORIA, ID_ITEM').limit(5000);
  if (error) throw new Error(error.message);
  const m: Record<number, number[]> = {};
  for (const r of data ?? []) (m[Number(r.ID_ITEM)] ??= []).push(Number(r.ID_TIPO_VISTORIA));
  return m;
}
/** Deixa o item exatamente nos tipos pedidos (inclui os que faltam, tira os que sobram). */
export async function definirTiposDoItem(idItem: number, desejados: number[], atuais: number[]): Promise<Resultado> {
  for (const t of desejados.filter((x) => !atuais.includes(x))) { const r = await alternarItemNoTipo(t, idItem, true); if (!r.ok) return r; }
  for (const t of atuais.filter((x) => !desejados.includes(x))) { const r = await alternarItemNoTipo(t, idItem, false); if (!r.ok) return r; }
  return { ok: true };
}
/** Inclui os itens em todos os tipos informados, sem repetir o que já existe. */
export async function incluirItensNosTipos(idsItens: number[], idsTipos: number[]): Promise<Resultado> {
  if (MODO_DEMO || !supabase || !idsItens.length || !idsTipos.length) return { ok: true };
  const linhas = idsItens.flatMap((i) => idsTipos.map((t) => ({ ID_TIPO_VISTORIA: t, ID_ITEM: i })));
  const { error } = await supabase.from('VST_TIPO_VISTORIA_ITEM').upsert(linhas, { onConflict: 'ID_TIPO_VISTORIA,ID_ITEM', ignoreDuplicates: true });
  return error ? { ok: false, erro: mensagem(error.message) } : { ok: true };
}
