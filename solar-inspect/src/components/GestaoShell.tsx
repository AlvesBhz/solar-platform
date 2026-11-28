import { Icon } from '@iconify/react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LockupHorizontal } from './Logo';
import { MODO_DEMO, perfilAtual, sair } from '../lib/acesso';
import NetworkBadge from './NetworkBadge';
import { contarPendencias } from '../lib/pendencias';

// Quatro áreas, sempre visíveis: Gestão (pendências e consultas), Vistoria (campo), Administração (cadastros que configuram
// as vistorias) e Site (dados do site de reservas). A área atual aparece no topo de toda tela e fica marcada no menu.
// No computador é o menu lateral; no celular, uma barra fixa embaixo com as áreas.
export const AREAS = {
  gestao: { nome: 'Gestão', curto: 'Gestão', desc: 'Pendências e consultas', icon: 'solar:widget-2-linear', to: '/gestao' },
  vistoria: { nome: 'Vistoria', curto: 'Vistoria', desc: 'Fazer vistoria em campo', icon: 'solar:clipboard-list-linear', to: '/app/unidades' },
  admin: { nome: 'Administração', curto: 'Admin', desc: 'Cadastros que configuram as vistorias', icon: 'solar:settings-linear', to: '/admin' },
  site: { nome: 'Site', curto: 'Site', desc: 'Dados do site de reservas', icon: 'solar:buildings-2-linear', to: '/admin/site' },
} as const;
export type Area = keyof typeof AREAS;
const GRUPOS = {
  pendencias: { nome: '', area: 'gestao' },
  consultar: { nome: 'Consultar', area: 'gestao' },
  vistoriar: { nome: '', area: 'vistoria' },
  inspect: { nome: '', area: 'admin' },
  site: { nome: '', area: 'site' },
} as const;
type Grupo = keyof typeof GRUPOS;
export type ItemMenu = { to: string; icon: string; label: string; desc: string; grupo: Grupo; end?: boolean; so?: string; ativo?: string[] };
export const MENU: ItemMenu[] = [
  { to: '/gestao', icon: 'solar:danger-triangle-linear', label: 'Pendências', desc: 'O que precisa da sua ação', grupo: 'pendencias', end: true },
  { to: '/gestao/painel', icon: 'solar:widget-2-linear', label: 'Visão geral', desc: 'Indicadores e situação das unidades', grupo: 'consultar' },
  { to: '/gestao/unidades', icon: 'solar:home-2-linear', label: 'Unidades', desc: 'Estado de cada unidade e histórico', grupo: 'consultar' },
  { to: '/gestao/vistorias', icon: 'solar:clipboard-check-linear', label: 'Vistorias', desc: 'Todas as vistorias, filtro e relatório', grupo: 'consultar' },
  { to: '/gestao/ocorrencias', icon: 'solar:danger-circle-linear', label: 'Ocorrências', desc: 'Abertas e resolvidas, com prazo e responsável', grupo: 'consultar' },
  { to: '/admin/auditoria', icon: 'solar:shield-check-linear', label: 'Auditoria', desc: 'Quem fez o quê e quando', grupo: 'consultar', so: 'ADMIN' },
  { to: '/app/unidades', icon: 'solar:clipboard-list-linear', label: 'Fazer vistoria', desc: 'Escolher a unidade e começar', grupo: 'vistoriar' },
  { to: '/admin/checklists', icon: 'solar:layers-minimalistic-linear', label: 'Ambientes e itens', desc: 'O que se confere em cada unidade', grupo: 'inspect' },
  { to: '/admin/tipos', icon: 'solar:settings-linear', label: 'Tipos de vistoria', desc: 'Entrada, saída, limpeza e manutenção', grupo: 'inspect', so: 'ADMIN' },
  { to: '/admin/presenca', icon: 'solar:qr-code-linear', label: 'GPS e QR Code', desc: 'Como se comprova a presença na unidade', grupo: 'inspect' },
  { to: '/admin/usuarios', icon: 'solar:users-group-rounded-linear', label: 'Usuários', desc: 'Quem acessa e com qual perfil', grupo: 'inspect', so: 'ADMIN' },
  { to: '/admin/propriedades', icon: 'solar:buildings-2-linear', label: 'Propriedades', desc: 'Pousadas e unidades do site', grupo: 'site', so: 'ADMIN' },
  { to: '/admin/precos', icon: 'solar:tag-price-linear', label: 'Preços', desc: 'Calendário, tarifas, pacotes e simulador', grupo: 'site', so: 'ADMIN', ativo: ['/admin/precos', '/admin/pacotes', '/admin/tarifas', '/admin/simulador'] },
];
export const GRUPO_NOME = (g: Grupo) => GRUPOS[g].nome || AREAS[GRUPOS[g].area].nome;
// o menu mostra só o que o perfil pode abrir (as telas e o banco conferem de novo)
export const menuDo = (p?: string) => MENU.filter((m) => !m.so || m.so === p || (MODO_DEMO && !p));

const SITE = ['/admin/site', '/admin/propriedades', '/admin/precos', '/admin/tarifas', '/admin/simulador', '/admin/pacotes'];
/** Área a que a rota pertence. */
export function areaDe(path: string): Area | null {
  if (path.startsWith('/app')) return 'vistoria';
  if (path.startsWith('/gestao') || path.startsWith('/admin/auditoria')) return 'gestao';
  if (SITE.some((x) => path.startsWith(x))) return 'site';
  if (path.startsWith('/admin')) return 'admin';
  return null;
}
/** Selo da área no topo da tela (ícone + nome): mostra onde você está. */
export function SeloArea({ area }: { area: Area }) {
  const a = AREAS[area];
  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-pine/25 bg-pine/[0.08] px-2.5 py-1 text-[0.625rem] font-medium uppercase tracking-[0.16em] text-pine" data-area={area}>
      <Icon icon={a.icon} width={14} aria-hidden="true" />{a.nome}
    </span>
  );
}

/** Moldura de gestão/admin: menu lateral no computador e no tablet; barra fixa embaixo no celular. */
export default function GestaoShell({ titulo, eyebrow, acoes, children }: { titulo: string; eyebrow?: string; acoes?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pend, setPend] = useState<number | null>(null);
  useEffect(() => { let vivo = true; void contarPendencias(pathname === '/gestao').then((n) => vivo && setPend(n)); return () => { vivo = false; }; }, [pathname]);
  const menu = menuDo(perfilAtual());
  const area = areaDe(pathname);
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 shrink-0 items-center gap-2.5 rounded-md px-3 text-[0.8125rem] transition-colors duration-fast ${isActive ? 'bg-white/10 font-medium text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'}`;
  return (
    <div className="screen bg-cream lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="on-dark hidden bg-pine-deep text-white print:hidden lg:sticky lg:top-0 lg:flex lg:h-[100svh] lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-4 lg:[scrollbar-width:thin]">
        <div className="hidden px-2 pt-2 lg:block">
          <LockupHorizontal size="1.25rem" claro />
        </div>
        <nav className="flex flex-col gap-1" aria-label="Menu">
          {menu.map((m, k) => (
            <div key={m.to} className="contents">
              {GRUPOS[m.grupo].area !== (menu[k - 1] && GRUPOS[menu[k - 1].grupo].area) && (
                <span className={`mt-3 flex items-center gap-2 rounded-md px-3 py-1.5 text-[0.625rem] uppercase tracking-[0.24em] first:mt-0 ${GRUPOS[m.grupo].area === area ? 'bg-white/10 text-white' : 'text-white/55'}`} data-grupo={GRUPOS[m.grupo].area}>
                  <Icon icon={AREAS[GRUPOS[m.grupo].area].icon} width={14} aria-hidden="true" />{AREAS[GRUPOS[m.grupo].area].nome}
                </span>
              )}
              {GRUPOS[m.grupo].nome && m.grupo !== menu[k - 1]?.grupo && <span className="px-3 pt-2 text-[0.625rem] uppercase tracking-[0.16em] text-white/40">{GRUPOS[m.grupo].nome}</span>}
              <NavLink to={m.to} end={m.end} className={({ isActive }) => link({ isActive: isActive || !!m.ativo?.some((x) => pathname.startsWith(x)) })}>
                <Icon icon={m.icon} width={18} aria-hidden="true" />{m.label}
                {m.to === '/gestao' && !!pend && <span className="ml-auto rounded-full bg-error px-1.5 text-[0.6875rem] font-semibold text-white">{pend}<span className="sr-only"> pendências</span></span>}
              </NavLink>
            </div>
          ))}
        </nav>
        <NavLink to="/conta/senha" className="mt-auto hidden min-h-11 items-center gap-2.5 rounded-md px-3 text-[0.8125rem] text-white/70 hover:text-white lg:flex">
          <Icon icon="solar:lock-keyhole-linear" width={18} aria-hidden="true" /> Trocar senha
        </NavLink>
        <button type="button" onClick={async () => { await sair(); navigate('/login', { replace: true }); }} className="hidden min-h-11 items-center gap-2.5 rounded-md px-3 text-[0.8125rem] text-white/70 hover:text-white lg:flex">
          <Icon icon="solar:logout-2-linear" width={18} aria-hidden="true" /> Sair
        </button>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex flex-wrap items-end justify-between gap-3 print:hidden px-[max(1rem,env(safe-area-inset-left))] pb-4 pt-6 lg:px-8">
          <div className="flex min-w-0 flex-col gap-1">
            {area ? <SeloArea area={area} /> : eyebrow && <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">{eyebrow}</span>}
            <h1 className="screen-title">{titulo}</h1>
          </div>
          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{acoes}<NetworkBadge />
            <NavLink to="/conta/senha" aria-label="Trocar senha" title="Trocar senha" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-white lg:hidden">
              <Icon icon="solar:lock-keyhole-linear" width={20} aria-hidden="true" />
            </NavLink>
            <button type="button" aria-label="Sair" title="Sair" onClick={async () => { await sair(); navigate('/login', { replace: true }); }} className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-white lg:hidden">
              <Icon icon="solar:logout-2-linear" width={20} aria-hidden="true" />
            </button>
          </div>
        </header>
        <main className="flex flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] pb-28 lg:px-8 lg:pb-24">{children}</main>
      </div>
      <BarraAreas pend={pend} />
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

/** Barra das áreas no pé da tela (celular). Também aparece na Vistoria para gestor e administrador (`sempre`: inclusive no computador,
 *  onde as telas de campo não têm o menu lateral). `pend`: contador já carregado; sem ele, a barra busca. */
export function BarraAreas({ pend: pendDado, sempre = false }: { pend?: number | null; sempre?: boolean }) {
  const { pathname } = useLocation();
  const [pendBusca, setPendBusca] = useState<number | null>(null);
  useEffect(() => { if (pendDado !== undefined) return; let vivo = true; void contarPendencias().then((n) => vivo && setPendBusca(n)); return () => { vivo = false; }; }, [pendDado, pathname]);
  const pend = pendDado !== undefined ? pendDado : pendBusca;
  const menu = menuDo(perfilAtual());
  const area = areaDe(pathname);
  const areas = (Object.keys(AREAS) as Area[]).filter((x) => x === 'vistoria' || menu.some((m) => GRUPOS[m.grupo].area === x));
  return (
    <nav aria-label="Áreas" className={`fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t border-line-1 bg-white px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden ${sempre ? 'lg:px-[max(1rem,calc(50%-18rem))]' : 'lg:hidden'}`}>
        {areas.map((id) => {
          const a = AREAS[id], atual = area === id;
          return (
            <Link key={id} to={a.to} aria-current={atual ? 'page' : undefined} aria-label={a.nome + (id === 'gestao' && pend ? `, ${pend} pendências` : '')}
              className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[0.6875rem] ${atual ? 'font-semibold text-pine' : 'text-fg-3'}`}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${atual ? 'bg-pine/10' : ''}`}><Icon icon={a.icon} width={20} aria-hidden="true" /></span>
              <span className="max-w-full truncate px-0.5" aria-hidden="true">{a.curto}</span>
              {id === 'gestao' && !!pend && <span className="absolute left-1/2 top-1 ml-2 min-w-[1.125rem] rounded-full bg-error px-1 text-center text-[0.625rem] font-semibold leading-[1.125rem] text-white">{pend}<span className="sr-only"> pendências</span></span>}
            </Link>
          );
        })}
      </nav>
  );
}
