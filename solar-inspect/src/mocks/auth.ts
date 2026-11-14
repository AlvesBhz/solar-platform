// MOCKUP: sem banco de dados. Substituir por Supabase Auth nas próximas etapas.
export const APP_VERSION = '0.1.0-mock';

type MockUser = { email: string; nome: string; ativo: boolean };

const USERS: MockUser[] = [
  { email: 'assessor@solar.dev', nome: 'Assessor Demo', ativo: true },
  { email: 'gestor@solar.dev', nome: 'Gestor Demo', ativo: true },
  { email: 'admin@solar.dev', nome: 'Admin Demo', ativo: true },
  { email: 'inativo@solar.dev', nome: 'Usuário Inativo', ativo: false },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** T01: sem sessão persistida no mockup → sempre segue para o login. */
export async function checkSession(): Promise<{ hasSession: boolean; pendingSync: number }> {
  await wait(700);
  return { hasSession: false, pendingSync: 0 };
}

export type LoginResult =
  | { ok: true; nome: string }
  | { ok: false; reason: 'not_found' | 'inactive' | 'offline' };

/** T02: simula o envio do link de acesso por e-mail. */
export async function requestLoginLink(email: string): Promise<LoginResult> {
  await wait(900);
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  const user = USERS.find((u) => u.email === email.trim().toLowerCase());
  if (!user) return { ok: false, reason: 'not_found' };
  if (!user.ativo) return { ok: false, reason: 'inactive' };
  return { ok: true, nome: user.nome };
}
