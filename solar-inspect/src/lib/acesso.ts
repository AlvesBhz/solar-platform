// Acesso ao app (T01–T04): sessão, cadastro da equipe, login por usuário ou CPF e aceite de localização.
// Real: Supabase (Edge Function login-vistoria + tabelas VST_ com RLS). Demonstração: dados de exemplo, sem rede.
import { MODO_DEMO, SUPABASE_URL, supabase } from './supabase';
export { MODO_DEMO };
import * as demo from '../mocks/auth';
import { temPendentes } from './fila';
import { limparCacheCampo } from './campo';

export const APP_VERSION = MODO_DEMO ? '0.2.0-demo' : '0.2.0';
export type Perfil = 'ASSESSOR' | 'LIMPEZA' | 'MANUTENCAO' | 'GESTOR' | 'ADMIN';
export type Motivo = 'sem-permissao' | 'inativo' | 'sessao-expirada' | 'offline' | 'sem-localizacao';
// trocarSenha: a senha é provisória (criada ou redefinida pelo ADMIN) e precisa ser trocada antes de seguir
export type AcessoOk = { estado: 'ok'; nome: string; perfil: Perfil; aceiteLocalizacao: boolean; offline: boolean; trocarSenha?: boolean };
export type Acesso = { estado: 'sem-sessao' } | { estado: 'bloqueado'; motivo: Motivo } | AcessoOk;

export const ehGestao = (p: Perfil) => p === 'GESTOR' || p === 'ADMIN';

// Último acesso conferido online: só nome, perfil e aceite (nunca senha nem token). Permite abrir o app
// sem internet por até 72 h; depois disso, ou se o usuário for desativado, é preciso conferir de novo online.
const CACHE = 'inspect.acesso';
const OFFLINE_MAX_MS = 72 * 3600 * 1000;
type Cache = { uid: string; nome: string; perfil: Perfil; aceite: boolean; trocar?: boolean; conferidoEm: number };
const lerCache = (): Cache | null => { try { return JSON.parse(localStorage.getItem(CACHE) ?? 'null'); } catch { return null; } };
const gravarCache = (c: Cache) => { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch { /* sem armazenamento */ } };
/** Perfil do último acesso conferido neste aparelho (para montar menus; quem decide o acesso é o banco). */
export const perfilAtual = (): Perfil | undefined => lerCache()?.perfil;
/** Usuário logado neste aparelho (último acesso conferido). */
export const uidAtual = (): string | undefined => lerCache()?.uid;
const limparCache = () => { try { localStorage.removeItem(CACHE); localStorage.removeItem(TEMPO); } catch { /* sem armazenamento */ } };

// ── validade da sessão no aparelho (o limite do Supabase é do plano pago): 12 h sem uso ou 7 dias desde o login → entra de novo.
// Aparelhos da equipe são compartilhados; assim um celular esquecido não fica com o acesso aberto.
const TEMPO = 'inspect.sessao.tempo';
const INATIVIDADE_MAX_MS = 12 * 3600 * 1000, DURACAO_MAX_MS = 7 * 24 * 3600 * 1000;
type Tempo = { inicio: number; ultimo: number };
const lerTempo = (): Tempo | null => { try { return JSON.parse(localStorage.getItem(TEMPO) ?? 'null'); } catch { return null; } };
const gravarTempo = (t: Tempo) => { try { localStorage.setItem(TEMPO, JSON.stringify(t)); } catch { /* sem armazenamento */ } };
/** Registra uso do app (no máximo uma gravação por minuto). */
export function marcarAtividade(): void {
  const t = lerTempo(), agora = Date.now();
  if (!t) return gravarTempo({ inicio: agora, ultimo: agora });
  if (agora - t.ultimo > 60_000) gravarTempo({ ...t, ultimo: agora });
}
/** A sessão deste aparelho passou do limite de inatividade ou de duração? */
export function sessaoVencida(agora = Date.now()): boolean {
  const t = lerTempo();
  return !!t && (agora - t.ultimo > INATIVIDADE_MAX_MS || agora - t.inicio > DURACAO_MAX_MS);
}

let demoLogado: AcessoOk | null = null;

/** Encerra a sessão no aparelho (token e cache). */
export async function sair(): Promise<void> {
  limparCache();
  limparCacheCampo();
  demoLogado = null;
  if (supabase) await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
}

const ehFalhaDeRede = (e: unknown) => {
  const m = String((e as { message?: string; name?: string })?.message ?? e) + String((e as { name?: string })?.name ?? '');
  return /fetch|network|Retryable|Failed to fetch|Load failed/i.test(m);
};

function offline(uid: string): Acesso {
  const c = lerCache();
  if (c && c.uid === uid && Date.now() - c.conferidoEm < OFFLINE_MAX_MS) {
    return { estado: 'ok', nome: c.nome, perfil: c.perfil, aceiteLocalizacao: c.aceite, offline: true, trocarSenha: !!c.trocar };
  }
  return { estado: 'bloqueado', motivo: 'offline' };
}

/** T01: há sessão válida e o funcionário segue ativo e com acesso? Encerra a sessão se não. */
export async function verificarAcesso(): Promise<Acesso> {
  if (MODO_DEMO || !supabase) return demoLogado ?? { estado: 'sem-sessao' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { estado: 'sem-sessao' };
  if (sessaoVencida()) { await sair(); return { estado: 'sem-sessao' }; }
  marcarAtividade();
  const uid = session.user.id;
  if (!navigator.onLine) return offline(uid);

  // confere o token no servidor (detecta sessão revogada ou vencida sem renovação)
  const { data: u, error: eu } = await supabase.auth.getUser();
  if (eu || !u.user) {
    if (eu && ehFalhaDeRede(eu)) return offline(uid);
    await sair();
    return { estado: 'bloqueado', motivo: 'sessao-expirada' };
  }
  // o RLS só devolve a própria linha
  const { data: eu2, error } = await supabase
    .from('VST_USUARIO').select('NM_USUARIO, TP_PERFIL, SG_ATIVO, DT_ACEITE_LGPD, SG_TROCAR_SENHA').eq('ID_USUARIO', uid).maybeSingle();
  if (error) {
    if (ehFalhaDeRede(error)) return offline(uid);
    await sair();
    return { estado: 'bloqueado', motivo: 'sem-permissao' };
  }
  if (!eu2) { await sair(); return { estado: 'bloqueado', motivo: 'sem-permissao' }; }
  if (!eu2.SG_ATIVO) { await sair(); return { estado: 'bloqueado', motivo: 'inativo' }; }
  const perfil = eu2.TP_PERFIL as Perfil;
  if (perfil !== 'ADMIN') {
    const { count, error: ep } = await supabase
      .from('VST_USUARIO_PROPRIEDADE').select('ID_PROPRIEDADE', { count: 'exact', head: true }).eq('ID_USUARIO', uid);
    if (ep && ehFalhaDeRede(ep)) return offline(uid);
    if (ep || !count) { await sair(); return { estado: 'bloqueado', motivo: 'sem-permissao' }; }
  }
  const a: AcessoOk = { estado: 'ok', nome: eu2.NM_USUARIO, perfil, aceiteLocalizacao: !!eu2.DT_ACEITE_LGPD, offline: false, trocarSenha: !!eu2.SG_TROCAR_SENHA };
  gravarCache({ uid, nome: a.nome, perfil, aceite: a.aceiteLocalizacao, trocar: a.trocarSenha, conferidoEm: Date.now() });
  return a;
}

/** Para onde ir depois de conferir o acesso. A equipe de campo aceita o uso da localização antes de tudo. */
export function destino(a: AcessoOk): string {
  if (a.trocarSenha) return '/conta/senha';
  if (ehGestao(a.perfil)) return '/gestao';
  if (!a.aceiteLocalizacao) return '/permissao-localizacao';
  if (temPendentes()) return '/app/sincronizacao';
  return '/app/unidades';
}

export type ErroLogin = 'credenciais' | 'muitas_tentativas' | 'offline' | 'indisponivel' | 'inativo' | 'sem-permissao';
export type ResultadoLogin = { ok: true; acesso: AcessoOk } | { ok: false; erro: ErroLogin };

/** T02: usuário ou CPF e senha. A resposta de erro do servidor é a mesma para qualquer falha de credencial. */
export async function entrar(login: string, senha: string): Promise<ResultadoLogin> {
  if (!navigator.onLine) return { ok: false, erro: 'offline' };
  if (MODO_DEMO || !supabase) {
    const r = await demo.entrar(login);
    if (!r.ok) return { ok: false, erro: r.reason === 'offline' ? 'offline' : 'credenciais' };
    demoLogado = { estado: 'ok', nome: r.nome, perfil: r.perfil.toUpperCase() as Perfil, aceiteLocalizacao: true, offline: false };
    return { ok: true, acesso: demoLogado };
  }
  let resp: Response;
  try {
    resp = await fetch(`${import.meta.env.VITE_FUNCOES_BASE ?? SUPABASE_URL + '/functions/v1'}/login-vistoria`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login, senha }),
    });
  } catch {
    return { ok: false, erro: navigator.onLine ? 'indisponivel' : 'offline' };
  }
  if (resp.status === 401) return { ok: false, erro: 'credenciais' };
  if (resp.status === 429) return { ok: false, erro: 'muitas_tentativas' };
  if (resp.status !== 200) return { ok: false, erro: resp.status === 400 ? 'credenciais' : 'indisponivel' };
  const corpo = await resp.json().catch(() => null);
  const s = corpo?.sessao;
  if (!s?.access_token || !s?.refresh_token) return { ok: false, erro: 'indisponivel' };
  const { error } = await supabase.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  if (error) return { ok: false, erro: 'indisponivel' };
  gravarTempo({ inicio: Date.now(), ultimo: Date.now() });   // a contagem dos limites recomeça a cada login
  const a = await verificarAcesso();
  if (a.estado === 'ok') return { ok: true, acesso: a };
  if (a.estado === 'bloqueado' && (a.motivo === 'inativo' || a.motivo === 'sem-permissao')) return { ok: false, erro: a.motivo };
  return { ok: false, erro: 'indisponivel' };
}

/** T03: registra no banco o aceite do uso da localização (LGPD). Idempotente. */
export async function registrarAceiteLocalizacao(): Promise<boolean> {
  if (MODO_DEMO || !supabase) return true;
  const { error } = await supabase.rpc('vst_registrar_aceite_lgpd');
  if (error) return false;
  const c = lerCache();
  if (c) gravarCache({ ...c, aceite: true });
  return true;
}

export const SENHA_MIN = 10;
export type ErroSenha = 'atual_incorreta' | 'fraca' | 'vazada' | 'igual' | 'offline' | 'muitas_tentativas' | 'sessao' | 'indisponivel';

/** A senha aparece em vazamentos conhecidos (Have I Been Pwned)? Consulta anônima: só os 5 primeiros caracteres do hash SHA-1
 *  saem do aparelho (k-anonimato). Sem internet ou se o serviço não responder em 4 s, não bloqueia (devolve false). */
export async function senhaVazada(senha: string): Promise<boolean> {
  try {
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(senha)))].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
    const r = await fetch(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`, { headers: { 'Add-Padding': 'true' }, signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return false;
    return (await r.text()).split('\n').some((l) => { const [suf, n] = l.trim().split(':'); return suf === h.slice(5) && Number(n) > 0; });
  } catch { return false; }
}

/** Regras da nova senha (as mesmas das Edge Functions: 10 a 72 bytes) mais letra e número e diferente do usuário. */
export function problemaSenha(nova: string, login = ''): string | null {
  if (nova.length < SENHA_MIN) return `Use pelo menos ${SENHA_MIN} caracteres.`;
  if (new TextEncoder().encode(nova).length > 72) return 'Use no máximo 72 caracteres.';
  if (!/[A-Za-zÀ-ÿ]/.test(nova) || !/\d/.test(nova)) return 'Misture letras e números.';
  if (login && nova.toLowerCase().includes(login.toLowerCase())) return 'Não use o seu usuário na senha.';
  return null;
}

/** T35: confere a senha atual, grava a nova, encerra as sessões dos outros aparelhos e desmarca a senha provisória. */
export async function trocarSenha(atual: string, nova: string): Promise<{ ok: true } | { ok: false; erro: ErroSenha }> {
  if (!navigator.onLine) return { ok: false, erro: 'offline' };
  if (atual === nova) return { ok: false, erro: 'igual' };
  if (problemaSenha(nova)) return { ok: false, erro: 'fraca' };
  if (await senhaVazada(nova)) return { ok: false, erro: 'vazada' };
  if (MODO_DEMO || !supabase) {
    if (demoLogado) demoLogado = { ...demoLogado, trocarSenha: false };
    return { ok: true };
  }
  const { data: { session } } = await supabase.auth.getSession();
  const email = session?.user.email;
  if (!email) return { ok: false, erro: 'sessao' };
  // reautenticação: a troca exige a senha atual mesmo com a sessão aberta (aparelho esquecido desbloqueado)
  const conf = await supabase.auth.signInWithPassword({ email, password: atual });
  if (conf.error) {
    if (ehFalhaDeRede(conf.error)) return { ok: false, erro: 'indisponivel' };
    return { ok: false, erro: conf.error.status === 429 ? 'muitas_tentativas' : 'atual_incorreta' };
  }
  const up = await supabase.auth.updateUser({ password: nova });
  if (up.error) {
    const c = (up.error as { code?: string }).code;
    if (c === 'same_password') return { ok: false, erro: 'igual' };
    if (c === 'weak_password') return { ok: false, erro: 'fraca' };
    return { ok: false, erro: 'indisponivel' };
  }
  await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
  const { error } = await supabase.rpc('vst_senha_trocada');
  if (error) return { ok: false, erro: 'indisponivel' };
  const c = lerCache();
  if (c) gravarCache({ ...c, trocar: false });
  return { ok: true };
}
