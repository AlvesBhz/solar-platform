import { Icon } from '@iconify/react';
import { useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LockupHorizontal } from './Logo';
import NetworkBadge from './NetworkBadge';

let ultimoScroll = 0; // a moldura remonta a cada tela: guarda a posição para a barra deslizar em vez de pular

const MENU = [
  { to: '/gestao', icon: 'solar:widget-linear', label: 'Dashboard', end: true },
  { to: '/gestao/unidades', icon: 'solar:home-2-linear', label: 'Unidades' },
  { to: '/gestao/vistorias', icon: 'solar:clipboard-check-linear', label: 'Vistorias' },
  { to: '/gestao/ocorrencias', icon: 'solar:danger-triangle-linear', label: 'Ocorrências' },
  { to: '/admin/propriedades', icon: 'solar:buildings-2-linear', label: 'Propriedades', admin: true },
  { to: '/admin/checklists', icon: 'solar:layers-minimalistic-linear', label: 'Ambientes e itens', admin: true },
  { to: '/admin/tipos', icon: 'solar:clipboard-list-linear', label: 'Tipos de vistoria', admin: true },
  { to: '/admin/presenca', icon: 'solar:qr-code-linear', label: 'GPS e QR Code', admin: true },
  { to: '/admin/usuarios', icon: 'solar:users-group-rounded-linear', label: 'Usuários', admin: true },
  { to: '/admin/auditoria', icon: 'solar:shield-check-linear', label: 'Auditoria', admin: true },
];

/** Moldura de gestão/admin: responsiva para desktop e tablet (menu lateral) e utilizável no celular. */
export default function GestaoShell({ titulo, eyebrow, acoes, children }: { titulo: string; eyebrow?: string; acoes?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const nav = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const n = nav.current;
    if (!n || n.scrollWidth <= n.clientWidth) return; // no desktop o menu é vertical
    const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const centralizar = (suave: boolean) => {
      const a = n.querySelector<HTMLElement>('[aria-current="page"]');
      if (!a) return;
      const alvo = Math.max(0, a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2);
      n.scrollTo({ left: alvo, behavior: suave && !reduz ? 'smooth' : 'auto' });
      ultimoScroll = alvo;
    };
    n.scrollLeft = ultimoScroll;
    centralizar(true);
    // Os ícones carregam depois do primeiro desenho e mudam a largura dos itens: recentraliza.
    let largura = n.scrollWidth;
    const ro = new ResizeObserver(() => { if (n.scrollWidth !== largura) { largura = n.scrollWidth; centralizar(false); } });
    n.querySelectorAll('a').forEach((a) => ro.observe(a));
    const t = setTimeout(() => ro.disconnect(), 2000);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [pathname]);
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3 text-[0.8125rem] transition-colors duration-fast ${isActive ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`;
  return (
    <div className="screen bg-cream lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="on-dark bg-pine-deep text-white lg:sticky lg:top-0 lg:flex lg:h-[100svh] lg:flex-col lg:gap-6 lg:p-4">
        <div className="hidden px-2 pt-2 lg:block">
          <LockupHorizontal size="1.25rem" claro />
        </div>
        <nav ref={nav} className="relative flex gap-1 overflow-x-auto px-[45vw] py-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:p-0 [&::-webkit-scrollbar]:hidden" aria-label="Gestão">
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
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{acoes}<NetworkBadge /></div>
        </header>
        <main className="flex flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] pb-24 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

export type Col<T> = { h: string; r: (x: T) => ReactNode; principal?: boolean };

/** Tabela a partir de 768 px; no celular cada linha vira um cartão (sem rolagem lateral). */
export function TabelaResp<T>({ cols, rows }: { cols: Col<T>[]; rows: T[] }) {
  const tit = cols.find((c) => c.principal) ?? cols[0];
  return (
    <>
      <div className={`${card} hidden overflow-x-auto md:block`}>
        <table className="w-full">
          <thead className="border-b border-line-1"><tr>{cols.map((c) => <th key={c.h} className={th}>{c.h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line-1">{rows.map((x, i) => <tr key={i} className="hover:bg-cream">{cols.map((c) => <td key={c.h} className={td}>{c.r(x)}</td>)}</tr>)}</tbody>
        </table>
      </div>
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((x, i) => (
          <li key={i} className={`${card} flex flex-col gap-2 p-4`}>
            <div className="text-[0.9375rem] font-medium text-fg-1 [overflow-wrap:anywhere]">{tit.r(x)}</div>
            <dl className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-[0.8125rem]">
              {cols.filter((c) => c !== tit).map((c) => (
                <div key={c.h} className="flex items-baseline justify-between gap-3"><dt className="shrink-0 text-fg-3">{c.h}</dt><dd className="min-w-0 text-right text-fg-1 [overflow-wrap:anywhere]">{c.r(x)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export const card = 'rounded-xl border border-line-1 bg-white';
export const th = 'px-4 py-2.5 text-left text-[0.6875rem] font-normal uppercase tracking-[0.08em] text-fg-3';
export const td = 'px-4 py-3 text-[0.8125rem] text-fg-1';
