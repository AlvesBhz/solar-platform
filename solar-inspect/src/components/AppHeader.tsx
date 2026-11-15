import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import NetworkBadge from './NetworkBadge';

/** Cabeçalho das telas do assessor. `back` mostra o botão voltar; `action` ocupa o canto direito ao lado da rede. */
export default function AppHeader({ title, eyebrow, back, action }: { title: string; eyebrow?: string; back?: string; action?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-10 border-b border-line-1 bg-cream pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
        {back && (
          <button
            type="button"
            onClick={() => navigate(back)}
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-1 transition-colors duration-fast hover:bg-white"
            aria-label="Voltar"
          >
            <Icon icon="solar:alt-arrow-left-linear" width={22} aria-hidden="true" />
          </button>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          {eyebrow && <span className="truncate text-[0.625rem] uppercase tracking-[0.24em] text-fg-3">{eyebrow}</span>}
          <span className="truncate text-[0.9375rem] font-medium text-fg-1">{title}</span>
        </div>
        <NetworkBadge />
        {action}
      </div>
    </header>
  );
}
