import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary } from '../components/ScreenShell';
import { EstadoBadge, GravidadeTag, VALIDACAO, formatarData } from '../components/Status';
import { obterUnidade, type Unidade } from '../mocks/unidades';

const ORDEM_GRAVIDADE = { critica: 0, media: 1, baixa: 2 };

/** T06 — Detalhe da unidade (assessor): estado, ocorrências abertas e última vistoria. Inicia a T07. */
export default function T06DetalheUnidade() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [u, setU] = useState<Unidade | null | undefined>(null);

  useEffect(() => { obterUnidade(id).then(setU); }, [id]);

  // Não encontrada ou sem acesso: não revelar dados (CA-01).
  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;

  const v = u && VALIDACAO[u.validacao];
  const ocorrencias = u ? [...u.ocorrencias].sort((a, b) => ORDEM_GRAVIDADE[a.gravidade] - ORDEM_GRAVIDADE[b.gravidade]) : [];

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back="/app/unidades" eyebrow={u?.propriedade ?? 'Unidade'} title={u?.nome ?? 'Carregando…'} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        {!u ? (
          <div className="flex flex-col gap-4" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl border border-line-1 bg-white" />)}
          </div>
        ) : (
          <>
            {/* Identificação + estado */}
            <section className="flex flex-col gap-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">{u.tipo}{u.andar ? ` · ${u.andar}` : ''}</span>
                  <h1 className="screen-title [overflow-wrap:anywhere]">{u.nome}</h1>
                </div>
                <EstadoBadge estado={u.estado} size="md" />
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <Info icon={v!.icon} label="Validação" value={v!.label} />
                <Info icon="solar:home-2-linear" label="Ambientes" value={String(u.ambientes)} />
              </dl>
            </section>

            {/* Ocorrências abertas */}
            <section className="flex flex-col gap-3" aria-labelledby="oc-titulo">
              <h2 id="oc-titulo" className="flex items-center justify-between text-xs font-medium uppercase tracking-[0.08em] text-fg-2">
                Ocorrências abertas
                <span className="font-mono text-fg-3">{ocorrencias.length}</span>
              </h2>
              {ocorrencias.length === 0 ? (
                <p className="flex items-center gap-2 rounded-xl border border-line-1 bg-white p-4 text-sm text-fg-2">
                  <Icon icon="solar:check-circle-linear" width={20} className="text-available" aria-hidden="true" />
                  Nenhuma ocorrência aberta.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {ocorrencias.map((o) => (
                    <li
                      key={o.id}
                      className={`flex flex-col gap-2 rounded-xl border bg-white p-4 ${o.gravidade === 'critica' ? 'border-error' : 'border-line-1'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <GravidadeTag g={o.gravidade} />
                        <span className="inline-flex items-center gap-1 text-xs text-fg-3">
                          <Icon icon="solar:calendar-linear" width={16} aria-hidden="true" />
                          Prazo {new Date(o.prazo + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[0.8125rem] text-fg-1">{o.descricao}</p>
                      <p className="text-xs text-fg-3">{o.ambiente}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Última vistoria */}
            <section className="flex flex-col gap-3" aria-labelledby="uv-titulo">
              <h2 id="uv-titulo" className="text-xs font-medium uppercase tracking-[0.08em] text-fg-2">Última vistoria</h2>
              {u.ultima ? (
                <div className="flex items-start gap-3 rounded-xl border border-line-1 bg-white p-4">
                  <Icon icon="solar:clipboard-check-linear" width={24} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="text-sm font-medium text-fg-1">{u.ultima.tipo}</p>
                    <p className="text-xs text-fg-3">{formatarData(u.ultima.data)} · {u.ultima.assessor}</p>
                  </div>
                  {u.ultima.sinalizada ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                      <Icon icon="solar:shield-warning-linear" width={16} aria-hidden="true" /> Sinalizada
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-available">
                      <Icon icon="solar:check-circle-linear" width={16} aria-hidden="true" /> Enviada
                    </span>
                  )}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-line-2 p-4 text-sm text-fg-3">Nenhuma vistoria registrada.</p>
              )}
            </section>
          </>
        )}
      </main>

      {u && (
        <BottomBar>
          <button type="button" className={btnPrimary} onClick={() => navigate(`/app/vistorias/nova/${u.id}`)}>
            <Icon icon="solar:clipboard-list-linear" width={18} aria-hidden="true" /> Iniciar vistoria
          </button>
        </BottomBar>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line-1 bg-white p-3">
      <Icon icon={icon} width={20} className="shrink-0 text-pine" aria-hidden="true" />
      <div className="flex min-w-0 flex-col">
        <dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-fg-3">{label}</dt>
        <dd className="truncate text-sm font-medium text-fg-1">{value}</dd>
      </div>
    </div>
  );
}
