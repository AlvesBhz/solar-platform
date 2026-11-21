// Acesso ao app (T01–T04): sessão, cadastro da equipe, login por usuário ou CPF e aceite de localização.
// Real: Supabase (Edge Function login-vistoria + tabelas VST_ com RLS). Demonstração: dados de exemplo, sem rede.
import { MODO_DEMO, SUPABASE_URL, supabase } from './supabase';
export { MODO_DEMO };
import * as demo from '../mocks/auth';
import { listarEnvios } from '../mocks/envios';

export const APP_VERSION = MODO_DEMO ? '0.2.0-demo' : '0.2.0';
export type Perfil = 'ASSESSOR' | 'LIMPEZA' | 'MANUTENCAO' | 'GESTOR' | 'ADMIN';
export type Motivo = 'sem-permissao' | 'inativo' | 'sessao-expirada' | 'offline' | 'sem-localizacao';
export type AcessoOk = { estado: 'ok'; nome: string; perfil: Perfil; aceiteLocalizacao: boolean; offline: boolean };
export type Acesso = { estado: 'sem-sessao' } | { estado: 'bloqueado'; motivo: Motivo } | AcessoOk;

export const ehGestao = (p: Perfil) => p === 'GESTOR' || p === 'ADMIN';

// Último acesso conferido online: só nome, perfil e aceite (nunca senha nem token). Permite abrir o app
// sem internet por até 72 h; depois disso, ou se o usuário for desativado, é preciso conferir de novo online.
const CACHE = 'inspect.acesso';
const OFFLINE_MAX_MS = 72 * 3600 * 1000;
type Cache = { uid: string; nome: string; perfil: Perfil; aceite: boolean; conferidoEm: number };
const lerCache = (): Cache | null => { try { return JSON.parse(localStorage.getItem(CACHE) ?? 'null'); } catch { return null; } };
const gravarCache = (c: Cache) => { try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch { /* sem armazenamento */ } };
const limparCache = () => { try { localStorage.removeItem(CACHE); } catch { /* sem armazenamento */ } };

let demoLogado: AcessoOk | null = null;

/** Encerra a sessão no aparelho (token e cache). */
export async function sair(): Promise<void> {
  limparCache();
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
    return { estado: 'ok', nome: c.nome, perfil: c.perfil, aceiteLocalizacao: c.aceite, offline: true };
  }
  return { estado: 'bloqueado', motivo: 'offline' };
}

/** T01: há sessão válida e o funcionário segue ativo e com acesso? Encerra a sessão se não. */
export async function verificarAcesso(): Promise<Acesso> {
  if (MODO_DEMO || !supabase) return demoLogado ?? { estado: 'sem-sessao' };
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { estado: 'sem-sessao' };
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
    .from('VST_USUARIO').select('NM_USUARIO, TP_PERFIL, SG_ATIVO, DT_ACEITE_LGPD').eq('ID_USUARIO', uid).maybeSingle();
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
  const a: AcessoOk = { estado: 'ok', nome: eu2.NM_USUARIO, perfil, aceiteLocalizacao: !!eu2.DT_ACEITE_LGPD, offline: false };
  gravarCache({ uid, nome: a.nome, perfil, aceite: a.aceiteLocalizacao, conferidoEm: Date.now() });
  return a;
}

/** Para onde ir depois de conferir o acesso. A equipe de campo aceita o uso da localização antes de tudo. */
export function destino(a: AcessoOk): string {
  if (ehGestao(a.perfil)) return '/gestao';
  if (!a.aceiteLocalizacao) return '/permissao-localizacao';
  if (listarEnvios().some((e) => e.status === 'pendente')) return '/app/sincronizacao';
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
