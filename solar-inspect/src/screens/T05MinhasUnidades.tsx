import { Icon } from '@iconify/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { useOnline } from '../components/NetworkBadge';
import { btnSecondary } from '../components/ScreenShell';
import { ESTADOS, EstadoBadge, formatarData } from '../components/Status';
import { listarUnidades, type EstadoUnidade, type Unidade } from '../mocks/unidades';

type Filtro = 'todos' | EstadoUnidade;
const ORDEM_FILTROS: Filtro[] = ['todos', 'liberado', 'em_limpeza', 'ocupado', 'bloqueado', 'manutencao'];

/** T05 — Minhas unidades: lista as unidades permitidas ao assessor, com busca, filtros e aviso offline. */
export default function T05MinhasUnidades() {
  const navigate = useNavigate();
  const online = useOnline();
  const [dados, setDados] = useState<Unidade[] | null>(null);
  const [erro, setErro] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [propriedade, setPropriedade] = useState('todas');

  const carregar = useCallback(() => {
    setErro(false);
    setDados(null);
    listarUnidades().then(setDados).catch(() => setErro(true));
  }, []);
  useEffect(carregar, [carregar]);

  const propriedades = useMemo(() => [...new Set((dados ?? []).map((u) => u.propriedade))], [dados]);
  const base = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (dados ?? []).filter(
      (u) => (propriedade === 'todas' || u.propriedade === propriedade) && (!q || `${u.nome} ${u.propriedade}`.toLowerCase().includes(q)),
    );
  }, [dados, busca, propriedade]);
  const lista = filtro === 'todos' ? base : base.filter((u) => u.estado === filtro);
  const contagem = (f: Filtro) => (f === 'todos' ? base.length : base.filter((u) => u.estado === f).length);

  return (
    <div className="screen bg-cream">
      <AppHeader
        eyebrow="Vistorias"
        title="Minhas unidades"
        action={
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-2 transition-colors duration-fast hover:bg-white"
            aria-label="Sair"
          >
            <Icon icon="solar:logout-2-linear" width={22} aria-hidden="true" />
          </button>
        }
      />

      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-[max(env(safe-area-inset-bottom),2rem)] pt-5">
        {!online && (
          <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-sm text-warning" role="status">
            <Icon icon="solar:cloud-cross-linear" width={20} className="shrink-0" aria-hidden="true" />
            Você está offline. Exibindo os dados salvos no aparelho.
          </p>
        )}

        {/* Busca + propriedade */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar unidade</span>
            <Icon icon="solar:magnifer-linear" width={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
            <input
              type="search"
              placeholder="Buscar unidade ou propriedade"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="min-h-12 w-full rounded-md border border-line-2 bg-white py-3 pl-11 pr-3 text-fg-1 shadow-sm placeholder:text-fg-4 focus:border-pine focus:outline-none"
            />
          </label>
          {propriedades.length > 1 && (
            <label className="relative sm:w-56">
              <span className="sr-only">Propriedade</span>
              <Icon icon="solar:buildings-2-linear" width={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
              <select
                value={propriedade}
                onChange={(e) => setPropriedade(e.target.value)}
                className="min-h-12 w-full appearance-none rounded-md border border-line-2 bg-white py-3 pl-11 pr-3 text-fg-1 shadow-sm focus:border-pine focus:outline-none"
              >
                <option value="todas">Todas as propriedades</option>
                {propriedades.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
          )}
        </div>

        {/* Filtros por estado — rolagem horizontal contida no próprio trilho */}
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="Filtrar por estado">
          <div className="flex w-max gap-2">
            {ORDEM_FILTROS.map((f) => {
              const ativo = filtro === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setFiltro(f)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition-colors duration-fast ${ativo ? 'border-pine bg-pine text-white' : 'border-line-2 bg-white text-fg-2 hover:border-fg-3'}`}
                >
                  {f !== 'todos' && <Icon icon={ESTADOS[f].icon} width={16} aria-hidden="true" />}
                  {f === 'todos' ? 'Todas' : ESTADOS[f].label}
                  <span className={`font-mono text-xs ${ativo ? 'text-white/70' : 'text-fg-3'}`}>{dados ? contagem(f) : '–'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Estados da consulta: carregando, erro, vazio, sucesso */}
        {erro ? (
          <Aviso icon="solar:danger-circle-linear" tom="text-error" titulo="Não foi possível carregar" texto="Verifique a conexão e tente novamente.">
            <button type="button" className={`${btnSecondary} sm:w-auto`} onClick={carregar}>
              <Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /> Tentar novamente
            </button>
          </Aviso>
        ) : !dados ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-3" aria-busy="true" aria-label="Carregando unidades">
            {[0, 1, 2, 3].map((i) => <li key={i} className="h-32 animate-pulse rounded-xl border border-line-1 bg-white" />)}
          </ul>
        ) : dados.length === 0 ? (
          <Aviso icon="solar:home-2-linear" tom="text-fg-3" titulo="Nenhuma unidade atribuída" texto="Você ainda não tem acesso a nenhuma propriedade. Fale com o administrador." />
        ) : lista.length === 0 ? (
          <Aviso icon="solar:magnifer-linear" tom="text-fg-3" titulo="Nada encontrado" texto="Ajuste a busca ou os filtros.">
            <button type="button" className={`${btnSecondary} sm:w-auto`} onClick={() => { setBusca(''); setFiltro('todos'); setPropriedade('todas'); }}>
              Limpar filtros
            </button>
          </Aviso>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(18rem,100%),1fr))] gap-3">
            {lista.map((u) => <CartaoUnidade key={u.id} u={u} />)}
          </ul>
        )}
      </main>
    </div>
  );
}

function CartaoUnidade({ u }: { u: Unidade }) {
  const abertas = u.ocorrencias.length;
  const critica = u.ocorrencias.some((o) => o.gravidade === 'critica');
  return (
    <li>
      <Link
        to={`/app/unidades/${u.id}`}
        className="flex h-full flex-col gap-4 rounded-xl border border-line-1 bg-white p-4 shadow-sm transition duration-base hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-[0.6875rem] uppercase tracking-[0.08em] text-fg-3">{u.tipo}{u.andar ? ` · ${u.andar}` : ''}</span>
            <span className="truncate text-lg font-medium text-fg-1">{u.nome}</span>
            <span className="truncate text-sm text-fg-2">{u.propriedade}</span>
          </div>
          <EstadoBadge estado={u.estado} />
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-line-1 pt-3 text-xs text-fg-3">
          <span className={`inline-flex items-center gap-1.5 ${abertas ? (critica ? 'text-error' : 'text-warning') : ''}`}>
            <Icon icon={abertas ? 'solar:danger-triangle-linear' : 'solar:check-circle-linear'} width={16} aria-hidden="true" />
            {abertas ? `${abertas} ocorrência${abertas > 1 ? 's' : ''} aberta${abertas > 1 ? 's' : ''}` : 'Sem ocorrências'}
          </span>
          <span className="inline-flex items-center gap-1 truncate">
            {u.ultima ? formatarData(u.ultima.data) : 'Sem vistoria'}
            <Icon icon="solar:alt-arrow-right-linear" width={16} className="shrink-0" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </li>
  );
}

export function Aviso({ icon, tom, titulo, texto, children }: { icon: string; tom: string; titulo: string; texto: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-2 px-6 py-10 text-center" role="status">
      <Icon icon={icon} width={32} className={tom} aria-hidden="true" />
      <p className="text-base font-medium text-fg-1">{titulo}</p>
      <p className="max-w-xs text-sm text-fg-2">{texto}</p>
      {children}
    </div>
  );
}
