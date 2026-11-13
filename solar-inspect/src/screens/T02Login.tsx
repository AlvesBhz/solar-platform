import { Icon } from '@iconify/react';
import { FormEvent, useState } from 'react';
import { LockupHorizontal } from '../components/Logo';
import NetworkBadge, { useOnline } from '../components/NetworkBadge';
import { APP_VERSION, requestLoginLink, type LoginResult } from '../mocks/auth';

const ERRORS: Record<Exclude<LoginResult, { ok: true }>['reason'] | 'invalid', string> = {
  invalid: 'Informe um e-mail válido.',
  not_found: 'E-mail não cadastrado. Fale com o administrador.',
  inactive: 'Usuário inativo. O acesso foi bloqueado pelo administrador.',
  offline: 'Sem conexão. Conecte-se à internet para entrar.',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    <main className="screen safe-pad flex flex-col items-center bg-cream">
      <div className="flex w-full max-w-md justify-end"><NetworkBadge /></div>

      <section className="my-auto flex w-full max-w-md flex-col gap-8 py-8">
        <header className="flex flex-col items-center gap-4">
          <LockupHorizontal />
          <p className="text-xs uppercase tracking-[0.32em] text-fg-3">Vistorias</p>
        </header>

        <div className="rounded-2xl border border-line-1 bg-white p-[clamp(1.25rem,4vw,2rem)] shadow-md">
          {sentTo ? (
            <div className="flex flex-col items-center gap-4 text-center" role="status">
              <Icon icon="solar:check-circle-linear" width={48} className="text-available" aria-hidden="true" />
              <h1 className="text-lg font-medium text-fg-1">Link de acesso enviado</h1>
              <p className="text-sm text-fg-2 [overflow-wrap:anywhere]">
                Abra o e-mail enviado para <strong className="text-fg-1">{sentTo}</strong> e toque no link para entrar.
              </p>
              <button
                type="button"
                onClick={() => { setSentTo(null); setEmail(''); }}
                className="min-h-12 w-full rounded-md border border-line-2 px-6 text-xs font-semibold uppercase tracking-[0.1em] text-fg-1 transition-colors duration-base hover:bg-cream"
              >
                Usar outro e-mail
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h1 className="text-lg font-medium text-fg-1">Entrar</h1>
                <p className="text-sm text-fg-2">Informe seu e-mail para receber o link de acesso.</p>
              </div>

              <label className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-[0.08em] text-fg-2">E-mail</span>
                <div className="relative">
                  <Icon icon="solar:letter-linear" width={20} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    placeholder="voce@solardoespinhaco.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={!!error}
                    aria-describedby={error ? 'login-error' : undefined}
                    disabled={loading}
                    className={`min-h-12 w-full rounded-md border bg-white py-3 pl-11 pr-3 text-fg-1 placeholder:text-fg-4 focus:border-pine focus:outline-none ${error ? 'border-error' : 'border-line-2'}`}
                  />
                </div>
              </label>

              {error && (
                <p id="login-error" role="alert" className="flex items-start gap-2 text-sm text-error">
                  <Icon icon="solar:danger-circle-linear" width={20} className="shrink-0" aria-hidden="true" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !online}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-pine px-6 text-xs font-semibold uppercase tracking-[0.1em] text-white transition duration-base hover:-translate-y-0.5 hover:bg-pine-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
                    Enviando…
                  </>
                ) : (
                  <>
                    Receber link de acesso
                    <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
                  </>
                )}
              </button>

              {!online && (
                <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-sm text-warning" role="status">
                  <Icon icon="solar:info-circle-linear" width={20} className="shrink-0" aria-hidden="true" />
                  Você está offline. O login exige conexão.
                </p>
              )}
            </form>
          )}
        </div>

        <aside className="rounded-lg border border-dashed border-line-2 p-4 text-xs text-fg-3">
          <p className="mb-1 font-semibold uppercase tracking-[0.08em]">Mockup · contas de teste</p>
          <p className="font-mono [overflow-wrap:anywhere]">assessor@solar.dev · gestor@solar.dev · inativo@solar.dev</p>
        </aside>
      </section>

      <p className="font-mono text-xs text-fg-3">v{APP_VERSION}</p>
    </main>
  );
}
