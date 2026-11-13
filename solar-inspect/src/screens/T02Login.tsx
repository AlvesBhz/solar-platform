import { Icon } from '@iconify/react';
import { FormEvent, useState } from 'react';
import { LockupHorizontal, Seal } from '../components/Logo';
import NetworkBadge, { useOnline } from '../components/NetworkBadge';
import { APP_VERSION, requestLoginLink, type LoginResult } from '../mocks/auth';

const ERRORS: Record<Exclude<LoginResult, { ok: true }>['reason'] | 'invalid', string> = {
  invalid: 'Informe um e-mail válido.',
  not_found: 'E-mail não cadastrado. Fale com o administrador.',
  inactive: 'Usuário inativo. O acesso foi bloqueado pelo administrador.',
  offline: 'Sem conexão. Conecte-se à internet para entrar.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const btnBase =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-md px-6 text-xs font-semibold uppercase tracking-[0.1em] transition duration-base';

/** T02 — Login: autenticação por e-mail (mockup, sem banco). Bloqueia usuário inativo. */
export default function T02Login() {
  const online = useOnline();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!EMAIL_RE.test(email.trim())) return setError(ERRORS.invalid);
    setLoading(true);
    const res = await requestLoginLink(email);
    setLoading(false);
    if (res.ok) setSentTo(email.trim().toLowerCase());
    else setError(ERRORS[res.reason]);
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
        <div className="flex items-center justify-between gap-4">
          <span className="lg:invisible"><LockupHorizontal size="clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)" /></span>
          <NetworkBadge />
        </div>

        <section className="mx-auto flex w-full max-w-sm flex-col justify-center gap-8">
          {sentTo ? (
            <div className="flex flex-col gap-6" role="status">
              <Icon icon="solar:check-circle-linear" width={40} className="text-available" aria-hidden="true" />
              <div className="flex flex-col gap-3">
                <h1 className="screen-title">Verifique seu e-mail</h1>
                <p className="text-sm leading-relaxed text-fg-2 [overflow-wrap:anywhere]">
                  Enviamos um link de acesso para <strong className="font-medium text-fg-1">{sentTo}</strong>. Toque no link para entrar.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setSentTo(null); setEmail(''); }}
                className={`${btnBase} border border-line-2 text-fg-1 hover:border-fg-1`}
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Acesso</span>
                <h1 className="screen-title">Entrar</h1>
                <p className="text-sm leading-relaxed text-fg-2">Informe seu e-mail para receber o link de acesso.</p>
              </div>

              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
                <label className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-[0.08em] text-fg-2">E-mail</span>
                  <div className="relative">
                    <Icon icon="solar:letter-linear" width={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      placeholder="voce@exemplo.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!error}
                      aria-describedby={error ? 'login-error' : undefined}
                      disabled={loading}
                      className={`min-h-12 w-full rounded-md border bg-white py-3 pl-11 pr-3 text-fg-1 shadow-sm transition-colors duration-fast placeholder:text-fg-4 focus:border-pine focus:outline-none ${error ? 'border-error' : 'border-line-2'}`}
                    />
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
                      Receber link de acesso
                      <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              <p className="border-t border-line-1 pt-5 text-xs leading-relaxed text-fg-3">
                <span className="text-fg-2">Mockup · contas de teste:</span>{' '}
                <span className="font-mono [overflow-wrap:anywhere]">assessor@solar.dev, gestor@solar.dev, inativo@solar.dev</span>
              </p>
            </>
          )}
        </section>

        <p className="text-center font-mono text-[0.6875rem] text-fg-3">v{APP_VERSION}</p>
      </div>
    </main>
  );
}
