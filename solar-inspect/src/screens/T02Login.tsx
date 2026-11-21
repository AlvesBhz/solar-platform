import { Icon } from '@iconify/react';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Seal } from '../components/Logo';
import NetworkBadge, { useOnline } from '../components/NetworkBadge';
import { cpfValido, formatarCpf, pareceCpf } from '../lib/cpf';
import { APP_VERSION, destino, entrar, MODO_DEMO, type ErroLogin } from '../lib/acesso';

const ERRORS: Record<ErroLogin | 'invalid' | 'cpf' | 'senha', string> = {
  invalid: 'Informe seu usuário ou CPF.',
  cpf: 'CPF inválido. Confira os números.',
  senha: 'Informe sua senha.',
  credenciais: 'Usuário ou CPF e senha não conferem.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  offline: 'Sem conexão. Conecte-se à internet para entrar.',
  indisponivel: 'Não foi possível entrar agora. Tente de novo em instantes.',
  inativo: 'Usuário inativo.',
  'sem-permissao': 'Sem permissão de acesso.',
};

const btnBase =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-xs font-semibold uppercase tracking-[0.1em] transition duration-base';

/** T02 — Login: usuário ou CPF e senha (Edge Function login-vistoria). Erro genérico, sem revelar quem existe. */
export default function T02Login() {
  const navigate = useNavigate();
  const online = useOnline();
  const [id, setId] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (id.trim().length < 3) return setError(ERRORS.invalid);
    if (pareceCpf(id) && !cpfValido(id)) return setError(ERRORS.cpf);
    if (!MODO_DEMO && !senha) return setError(ERRORS.senha);
    setLoading(true);
    const res = await entrar(id, senha);
    setLoading(false);
    setSenha('');                                   // a senha nunca fica na tela depois da tentativa
    if (res.ok) return navigate(destino(res.acesso), { replace: true });
    if (res.erro === 'inativo' || res.erro === 'sem-permissao') return navigate(`/acesso-indisponivel?motivo=${res.erro}`, { replace: true });
    setError(ERRORS[res.erro]);
  }


  return (
    <main className="screen grid bg-cream lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Painel de marca — só em telas largas (gestão em desktop/tablet) */}
      <aside className="on-dark bg-pine-gradient hidden flex-col justify-between p-[clamp(2.5rem,4vw,4rem)] text-white lg:flex">
        <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-white/70">Solar do Espinhaço</span>
        <div className="flex flex-col items-center gap-8">
          <Seal size="clamp(11rem, 6rem + 8vw, 15rem)" />
          <div className="flex items-center gap-4 text-white/70">
            <span className="h-px w-8 bg-white/30" aria-hidden="true" />
            <span className="text-[0.6875rem] uppercase tracking-[0.32em]">Vistorias</span>
            <span className="h-px w-8 bg-white/30" aria-hidden="true" />
          </div>
        </div>
        <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-white/70">Lapinha · Minas Gerais · Brasil</span>
      </aside>

      <div className="safe-pad grid grid-rows-[auto_1fr_auto] gap-8 lg:px-[clamp(3rem,6vw,6rem)]">
        <div className="flex justify-end">
          <NetworkBadge />
        </div>

        <section className="mx-auto flex w-full max-w-sm flex-col justify-center gap-8">
          {/* Marca no celular: selo SE menor + "Vistorias" (no desktop fica no painel lateral) */}
          <div className="flex flex-col items-center gap-4 pb-2 lg:hidden">
              <Seal size="clamp(6.75rem, 6rem + 3vw, 7.5rem)" />
              <div className="flex items-center gap-3 text-fg-3">
                <span className="h-px w-6 bg-line-2" aria-hidden="true" />
                <span className="text-[0.6875rem] uppercase tracking-[0.32em]">Vistorias</span>
                <span className="h-px w-6 bg-line-2" aria-hidden="true" />
              </div>
          </div>
          <>
              <div className="flex flex-col gap-3">
                <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Acesso</span>
                <h1 className="screen-title">Entrar</h1>
                <p className="text-[0.8125rem] leading-relaxed text-fg-2">Informe seu usuário ou CPF e a senha.</p>
              </div>

              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.08em] text-fg-2">Usuário ou CPF</span>
                  <div className="relative">
                    <Icon icon="solar:user-rounded-linear" width={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                    <input
                      id="login-id"
                      type="text"
                      inputMode="text"
                      autoComplete="username"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="seu.usuario ou 000.000.000-00"
                      value={id}
                      // CPF ganha máscara enquanto digita; usuário (com letras) fica como está.
                      onChange={(e) => setId(pareceCpf(e.target.value) ? formatarCpf(e.target.value) : e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? 'login-error' : undefined}
                      disabled={loading}
                      className={`min-h-12 w-full rounded-md border bg-white py-3 pl-11 pr-3 text-fg-1 shadow-sm transition-colors duration-fast placeholder:text-fg-4 focus:border-pine focus:outline-none ${error ? 'border-error' : 'border-line-2'}`}
                    />
                  </div>
                </label>

                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.08em] text-fg-2">Senha</span>
                  <div className="relative">
                    <Icon icon="solar:lock-keyhole-linear" width={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                    <input
                      id="login-senha"
                      type={verSenha ? 'text' : 'password'}
                      autoComplete="current-password"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={128}
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? 'login-error' : undefined}
                      disabled={loading}
                      className={`min-h-12 w-full rounded-md border bg-white py-3 pl-11 pr-12 text-fg-1 shadow-sm transition-colors duration-fast placeholder:text-fg-4 focus:border-pine focus:outline-none ${error ? 'border-error' : 'border-line-2'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setVerSenha((v) => !v)}
                      aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={verSenha}
                      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-fg-3 hover:text-fg-1"
                    >
                      <Icon icon={verSenha ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width={20} aria-hidden="true" />
                    </button>
                  </div>
                </label>

                {error && (
                  <p id="login-error" role="alert" className="flex items-start gap-2 text-sm text-error">
                    <Icon icon="solar:danger-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />
                    {error}
                  </p>
                )}

                {!online && (
                  <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-sm text-warning" role="status">
                    <Icon icon="solar:info-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />
                    Você está offline. O login exige conexão.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !online}
                  className={`${btnBase} bg-pine text-white shadow-md hover:-translate-y-0.5 hover:bg-pine-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {loading ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                      Enviando
                    </>
                  ) : (
                    <>
                      Entrar
                      <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              {MODO_DEMO ? (
                <p className="border-t border-line-1 pt-5 text-xs leading-relaxed text-fg-3">
                  <span className="text-fg-2">Demonstração · contas de teste (qualquer senha):</span>{' '}
                  <span className="font-mono [overflow-wrap:anywhere]">ana (campo), gestor e admin (gestão). CPF da Ana: 529.982.247-25</span>
                </p>
              ) : (
                <p className="border-t border-line-1 pt-5 text-xs leading-relaxed text-fg-3">Esqueceu a senha? Peça ao administrador para redefinir.</p>
              )}
          </>
        </section>

        <p className="text-center font-mono text-[0.6875rem] text-fg-3">v{APP_VERSION}</p>
      </div>
    </main>
  );
}
