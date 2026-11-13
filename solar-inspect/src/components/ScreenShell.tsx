import type { ReactNode } from 'react';
import { APP_VERSION } from '../mocks/auth';
import { LockupHorizontal } from './Logo';
import NetworkBadge from './NetworkBadge';

/** Moldura das telas de acesso (T03, T04): marca + rede no topo, conteúdo centralizado, versão no rodapé. */
export default function ScreenShell({ children }: { children: ReactNode }) {
  return (
    <main className="screen safe-pad grid grid-rows-[auto_1fr_auto] gap-8 bg-cream">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <LockupHorizontal size="clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem)" />
        <NetworkBadge />
      </div>
      <section className="mx-auto flex w-full max-w-sm flex-col justify-center gap-8">{children}</section>
      <p className="text-center font-mono text-[0.6875rem] text-fg-3">v{APP_VERSION}</p>
    </main>
  );
}

export const btnPrimary =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-pine px-6 text-xs font-semibold uppercase tracking-[0.1em] text-white shadow-md transition duration-base hover:-translate-y-0.5 hover:bg-pine-deep disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60';
export const btnSecondary =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-line-2 px-6 text-xs font-semibold uppercase tracking-[0.1em] text-fg-1 transition-colors duration-base hover:border-fg-1';

/** Ícone em disco suave — destaque visual do estado da tela. */
export function StateIcon({ icon, tone = 'pine' }: { icon: ReactNode; tone?: 'pine' | 'available' | 'warning' | 'error' }) {
  const tones = {
    pine: 'bg-white text-pine border-line-1',
    available: 'bg-white text-available border-line-1',
    warning: 'bg-warning-bg text-warning border-transparent',
    error: 'bg-white text-error border-line-1',
  };
  return <span className={`flex h-16 w-16 items-center justify-center rounded-full border shadow-sm ${tones[tone]}`}>{icon}</span>;
}
