import { Icon } from '@iconify/react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary } from '../components/ScreenShell';
import { GravidadeTag } from '../components/Status';
import { useResumo } from '../lib/useResumo';

/** T15 — Resumo: contagens, problemas e duração; leva de volta a cada pendência. */
export default function T15Resumo() {
  const { unidadeId = '' } = useParams();
  const navigate = useNavigate();
  const { u, tipo, rasc, pronto, itens, pendentes, ocorrencias, totalFotos, minutos, sinalizacoes } = useResumo(unidadeId);
  const base = `/app/vistorias/nova/${unidadeId}`;
  const det = (id: string) => `${base}/item/${id}${rasc?.tipoId === 'saida' ? '/comparar' : ''}`;

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`${base}/checklist`} eyebrow={`${u?.nome ?? ''} · ${tipo?.nome ?? ''}`} title="Resumo" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Revisão</span>
          <h1 className="screen-title">Resumo da vistoria</h1>
        </div>

        {!pronto ? <div className="h-40 animate-pulse rounded-xl border border-line-1 bg-white" /> : (
          <>
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Num label="Itens completos" v={`${itens.length - pendentes.length}/${itens.length}`} alerta={pendentes.length > 0} />
              <Num label="Divergências" v={String(ocorrencias.length)} alerta={ocorrencias.length > 0} />
              <Num label="Fotos" v={String(totalFotos)} />
              <Num label="Duração" v={`${minutos} min`} alerta={sinalizacoes.length > 0} />
            </dl>

            {sinalizacoes.length > 0 && (
              <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
                <Icon icon="solar:shield-warning-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />
                Será enviada como <strong className="font-medium">Sinalizada</strong> para revisão: {sinalizacoes.join(', ')}.
              </p>
            )}

            {pendentes.length > 0 && (
              <Secao titulo="Pendências" n={pendentes.length}>
                {pendentes.map(({ item, ambiente }) => (
                  <Linha key={item.id} to={det(item.id)} icon="solar:danger-circle-linear" tom="text-warning" titulo={item.nome} sub={ambiente.nome} acao="Resolver" />
                ))}
              </Secao>
            )}

            <Secao titulo="Ocorrências que serão criadas" n={ocorrencias.length}>
              {ocorrencias.length === 0 ? (
                <li className="flex items-center gap-2 p-4 text-[0.8125rem] text-fg-2"><Icon icon="solar:check-circle-linear" width={18} className="text-available" aria-hidden="true" />Nenhuma divergência registrada.</li>
              ) : ocorrencias.map((o) => (
                <li key={o.item.id}>
                  <Link to={`${base}/item/${o.item.id}/ocorrencia?volta=resumo`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-cream">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <GravidadeTag g={o.gravidade} />
                      <span className="truncate text-[0.875rem] text-fg-1">{o.item.nome}</span>
                      <span className="truncate text-[0.75rem] text-fg-3">{o.descricao || 'Sem descrição'}</span>
                    </div>
                    <Icon icon="solar:alt-arrow-right-linear" width={18} className="shrink-0 text-fg-3" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </Secao>
          </>
        )}
      </main>
      <BottomBar>
        {pendentes.length > 0 && <p className="text-center text-[0.75rem] text-fg-3">Resolva as pendências para continuar.</p>}
        <button type="button" className={btnPrimary} disabled={!pronto || pendentes.length > 0} onClick={() => navigate(`${base}/assinatura`)}>
          Assinar <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
        </button>
      </BottomBar>
    </div>
  );
}

function Num({ label, v, alerta }: { label: string; v: string; alerta?: boolean }) {
  return (
    <div className="rounded-xl border border-line-1 bg-white p-3">
      <dt className="text-[0.625rem] uppercase tracking-[0.08em] text-fg-3">{label}</dt>
      <dd className={`font-mono text-lg font-medium tabular-nums ${alerta ? 'text-warning' : 'text-fg-1'}`}>{v}</dd>
    </div>
  );
}
export function Secao({ titulo, n, children }: { titulo: string; n: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center justify-between font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">{titulo}<span className="font-mono text-fg-3">{n}</span></h2>
      <ul className="divide-y divide-line-1 overflow-hidden rounded-xl border border-line-1 bg-white">{children}</ul>
    </section>
  );
}
function Linha({ to, icon, tom, titulo, sub, acao }: { to: string; icon: string; tom: string; titulo: string; sub: string; acao: string }) {
  return (
    <li>
      <Link to={to} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors duration-fast hover:bg-cream">
        <Icon icon={icon} width={18} className={`shrink-0 ${tom}`} aria-hidden="true" />
        <span className="flex min-w-0 flex-1 flex-col"><span className="truncate text-[0.875rem] text-fg-1">{titulo}</span><span className="text-[0.75rem] text-fg-3">{sub}</span></span>
        <span className="text-[0.75rem] text-pine">{acao}</span>
      </Link>
    </li>
  );
}
