import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { BotoesResposta, CampoObservacao, FotoReferencia, GradeEvidencias, ListaRequisitos, SeletorGravidade, Contagem } from '../components/Evidencia';
import { btnPrimary } from '../components/ScreenShell';
import { divergente, requisitos } from '../lib/evidencia';
import { useItem } from '../lib/useItem';
import { RESPOSTAS_OK } from '../mocks/checklist';

/** T11 — Detalhe do item: referência e evidências. Se for problema, só gravidade e foto (observação é opcional). */
export default function T11DetalheItem() {
  const { unidadeId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const { u, tipo, rasc, fotos, ctx, resposta, obs, responder, observar, remover, gravidade, definirGravidade, carregado, contar, qtd } = useItem(unidadeId, itemId);
  const [obsAberta, setObsAberta] = useState(false);
  const base = `/app/vistorias/nova/${unidadeId}`;

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;
  if (rasc.tipoId === 'saida') return <Navigate to={`${base}/item/${itemId}/comparar`} replace />; // saída usa a T13
  if (carregado && !ctx) return <Navigate to={`${base}/checklist`} replace />;   // item fora do checklist

  const reqs = ctx ? requisitos(ctx.item, resposta, obs, fotos.length, qtd) : [];
  const completo = !!ctx && !!resposta && reqs.every((r) => r.ok);   // só com o item carregado (regras conhecidas)
  const div = divergente(resposta);
  const positivo = tipo?.respostas.find((x) => RESPOSTAS_OK.includes(x) && x !== 'N/A') ?? 'OK';
  const negativo = tipo?.respostas.find((x) => divergente(x)) ?? 'Problema';

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

            {div ? (
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-error px-3 py-1.5 text-[0.75rem] font-medium text-error">
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
                  {resposta}
                </span>
                <button type="button" onClick={() => responder(positivo)} className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4">Não é problema: marcar {positivo}</button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line-1 bg-white py-1 pl-4 pr-2">
                <span className="text-[0.8125rem] text-fg-2">Como está este item?</span>
                <BotoesResposta resposta={resposta} positivo={positivo} temNA={tipo.respostas.includes('N/A')} nome={ctx.item.nome} onOk={() => responder(positivo)} onNao={() => responder(negativo)} onNA={() => responder('N/A')} />
              </div>
            )}

            {ctx.item.qtde !== undefined && resposta && resposta !== 'N/A' && <Contagem esperado={ctx.item.qtde} valor={qtd} onChange={contar} positivo={!div} />}
            {div && <SeletorGravidade valor={gravidade} onChange={definirGravidade} travado={ctx.item.critico} />}
            {div && ctx.item.critico && (
              <p className="-mt-3 flex items-start gap-2 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning">
                <Icon icon="solar:danger-triangle-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />
                Item crítico: pode bloquear a unidade.
              </p>
            )}

            <section className="flex flex-col gap-2">
              <h2 className="flex items-center justify-between ui-secao">
                {div ? 'Fotos do problema' : 'Evidências'} <span className="font-mono text-fg-3">{fotos.length}</span>
              </h2>
              <GradeEvidencias fotos={fotos} novaFoto={`${base}/item/${itemId}/foto`} onRemover={remover} />
            </section>

            {obsAberta || obs ? (
              <CampoObservacao valor={obs} onChange={observar} obrigatoria={false} />
            ) : (
              <button type="button" onClick={() => setObsAberta(true)} className="inline-flex min-h-11 items-center gap-1.5 self-start text-[0.8125rem] text-pine">
                <Icon icon="solar:add-circle-linear" width={16} aria-hidden="true" /> Adicionar observação (opcional)
              </button>
            )}

            {resposta && <ListaRequisitos itens={reqs} />}
          </>
        )}
      </main>

      <BottomBar>
        <button type="button" className={btnPrimary} disabled={!completo} onClick={() => navigate(`${base}/checklist`)}>
          <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Concluir item
        </button>
      </BottomBar>
    </div>
  );
}
