import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LockupHorizontal } from './Logo';
import NetworkBadge from './NetworkBadge';

const MENU = [
  { to: '/gestao', icon: 'solar:widget-linear', label: 'Dashboard', end: true },
  { to: '/gestao/unidades', icon: 'solar:home-2-linear', label: 'Unidades' },
  { to: '/gestao/vistorias', icon: 'solar:clipboard-check-linear', label: 'Vistorias' },
  { to: '/gestao/ocorrencias', icon: 'solar:danger-triangle-linear', label: 'Ocorrências' },
  { to: '/admin/propriedades', icon: 'solar:buildings-2-linear', label: 'Propriedades', admin: true },
  { to: '/admin/usuarios', icon: 'solar:users-group-rounded-linear', label: 'Usuários', admin: true },
  { to: '/admin/auditoria', icon: 'solar:shield-check-linear', label: 'Auditoria', admin: true },
];

/** Moldura de gestão/admin: responsiva para desktop e tablet (menu lateral) e utilizável no celular. */
export default function GestaoShell({ titulo, eyebrow, acoes, children }: { titulo: string; eyebrow?: string; acoes?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3 text-[0.8125rem] transition-colors duration-fast ${isActive ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`;
  return (
    <div className="screen bg-cream lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="on-dark bg-pine-deep text-white lg:sticky lg:top-0 lg:flex lg:h-[100svh] lg:flex-col lg:gap-6 lg:p-4">
        <div className="hidden px-2 pt-2 lg:block">
          <LockupHorizontal size="1.25rem" claro />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden" aria-label="Gestão">
          {MENU.map((m, i) => (
            <div key={m.to} className="contents">
              {m.admin && !MENU[i - 1]?.admin && <span className="hidden px-3 pb-1 pt-4 text-[0.625rem] uppercase tracking-[0.24em] text-white/50 lg:block">Administração</span>}
              <NavLink to={m.to} end={m.end} className={link}><Icon icon={m.icon} width={18} aria-hidden="true" />{m.label}</NavLink>
            </div>
          ))}
        </nav>
        <button type="button" onClick={() => navigate('/login')} className="mt-auto hidden min-h-11 items-center gap-2.5 rounded-md px-3 text-[0.8125rem] text-white/70 hover:text-white lg:flex">
          <Icon icon="solar:logout-2-linear" width={18} aria-hidden="true" /> Sair
        </button>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] pb-4 pt-6 lg:px-8">
          <div className="flex min-w-0 flex-col gap-1">
            {eyebrow && <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">{eyebrow}</span>}
            <h1 className="screen-title">{titulo}</h1>
          </div>
          <div className="flex items-center gap-2">{acoes}<NetworkBadge /></div>
        </header>
        <main className="flex flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] pb-24 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export const card = 'rounded-xl border border-line-1 bg-white';
export const th = 'px-4 py-2.5 text-left text-[0.6875rem] font-normal uppercase tracking-[0.08em] text-fg-3';
export const td = 'px-4 py-3 text-[0.8125rem] text-fg-1';
