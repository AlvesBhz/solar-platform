// MOCKUP: sem banco de dados. Substituir por Supabase Auth nas próximas etapas.
export const APP_VERSION = '0.1.0-mock';

export type Perfil = 'assessor' | 'gestor' | 'admin';
type MockUser = { usuario: string; cpf: string; nome: string; perfil: Perfil; ativo: boolean };

const USERS: MockUser[] = [
  { usuario: 'ana', cpf: '52998224725', nome: 'Ana Souza', perfil: 'assessor', ativo: true },
  { usuario: 'gestor', cpf: '11144477735', nome: 'Gestor Demo', perfil: 'gestor', ativo: true },
  { usuario: 'admin', cpf: '12345678909', nome: 'Admin Demo', perfil: 'admin', ativo: true },
  { usuario: 'inativo', cpf: '39053344705', nome: 'Usuário Inativo', perfil: 'assessor', ativo: false },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** T01: sem sessão persistida no mockup → sempre segue para o login. */
export async function checkSession(): Promise<{ hasSession: boolean; pendingSync: number }> {
  await wait(700);
  return { hasSession: false, pendingSync: 0 };
}

export type LoginResult =
  | { ok: true; nome: string; perfil: Perfil }
  | { ok: false; reason: 'not_found' | 'inactive' | 'offline' };

/** T02: entra com usuário ou CPF (mockup; sem senha). Na versão real, exige um segundo fator. */
export async function entrar(identificador: string): Promise<LoginResult> {
  await wait(700);
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  const id = identificador.trim().toLowerCase();
  const user = USERS.find((u) => u.usuario === id || u.cpf === id.replace(/\D/g, ''));
  if (!user) return { ok: false, reason: 'not_found' };
  if (!user.ativo) return { ok: false, reason: 'inactive' };
  return { ok: true, nome: user.nome, perfil: user.perfil };
}
