import { Icon } from '@iconify/react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { CampoObservacao, FotoReferencia, GradeEvidencias, ListaRequisitos, SeletorResposta } from '../components/Evidencia';
import { btnPrimary } from '../components/ScreenShell';
import { divergente, requisitos } from '../lib/evidencia';
import { useItem } from '../lib/useItem';

/** T11 — Detalhe do item: referência, resposta e observação. Divergência exige evidência. */
export default function T11DetalheItem() {
  const { unidadeId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const { u, tipo, rasc, fotos, ctx, resposta, obs, responder, observar, remover } = useItem(unidadeId, itemId);
  const base = `/app/vistorias/nova/${unidadeId}`;

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;
  if (rasc.tipoId === 'saida') return <Navigate to={`${base}/item/${itemId}/comparar`} replace />; // saída usa a T13
  if (u && !ctx) return <Navigate to={`${base}/checklist`} replace />;

  const reqs = ctx ? requisitos(ctx.item, resposta, obs, fotos.length) : [];
  const completo = reqs.every((r) => r.ok);
  const div = divergente(resposta);

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`${base}/checklist`} eyebrow={ctx ? `${u?.nome} · ${ctx.ambiente.nome}` : 'Item'} title="Detalhe do item" />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        {!ctx || !tipo ? (
          <div className="h-48 animate-pulse rounded-xl border border-line-1 bg-white" aria-busy="true" />
        ) : (
          <>
            <FotoReferencia src={ctx.ambiente.ref} legenda={ctx.ambiente.nome} icon={ctx.ambiente.icon} />

            <div className="flex flex-col gap-2">
              <h1 className="screen-title">{ctx.item.nome}</h1>
              {(ctx.item.critico || ctx.item.foto) && (
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] uppercase tracking-[0.08em]">
                  {ctx.item.critico && <span className="inline-flex items-center gap-1 text-error"><Icon icon="solar:danger-triangle-linear" width={14} aria-hidden="true" />Crítico</span>}
                  {ctx.item.foto && <span className="inline-flex items-center gap-1 text-fg-3"><Icon icon="solar:camera-linear" width={14} aria-hidden="true" />Foto obrigatória</span>}
                </div>
              )}
            </div>

            <section className="flex flex-col gap-2">
              <h2 className="text-xs uppercase tracking-[0.08em] text-fg-2">Resposta</h2>
              <SeletorResposta opcoes={tipo.respostas} valor={resposta} onChange={responder} rotulo={`Resposta para ${ctx.item.nome}`} />
              {div && ctx.item.critico && (
                <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
                  <Icon icon="solar:danger-triangle-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />
                  Item crítico: esta divergência gera ocorrência e pode bloquear a unidade.
                </p>
              )}
            </section>

            <CampoObservacao valor={obs} onChange={observar} obrigatoria={div} />

            <section className="flex flex-col gap-2">
              <h2 className="flex items-center justify-between text-xs uppercase tracking-[0.08em] text-fg-2">
                Evidências <span className="font-mono text-fg-3">{fotos.length}</span>
              </h2>
              <GradeEvidencias fotos={fotos} novaFoto={`${base}/item/${itemId}/foto`} onRemover={remover} />
            </section>

            {resposta && <ListaRequisitos itens={reqs} />}
          </>
        )}
      </main>

      <BottomBar>
        <button type="button" className={btnPrimary} disabled={!completo || !resposta} onClick={() => navigate(`${base}/checklist`)}>
          <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Concluir item
        </button>
      </BottomBar>
    </div>
  );
}
