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
