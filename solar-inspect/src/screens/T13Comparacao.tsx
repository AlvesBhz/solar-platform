import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { CampoObservacao, GradeEvidencias, ListaRequisitos, SeletorResposta } from '../components/Evidencia';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { formatarData } from '../components/Status';
import { divergente, requisitos } from '../lib/evidencia';
import { useItem } from '../lib/useItem';

/** T13 — Comparação entrada × saída: foto anterior e atual lado a lado, com status. Exige entrada vinculada. */
export default function T13Comparacao() {
  const { unidadeId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const { u, tipo, rasc, fotos, ctx, resposta, obs, responder, observar, remover } = useItem(unidadeId, itemId);
  const base = `/app/vistorias/nova/${unidadeId}`;
  const atual = fotos[fotos.length - 1];
  const [urlAtual, setUrlAtual] = useState<string>();

  useEffect(() => {
    if (!atual) return setUrlAtual(undefined);
    const url = URL.createObjectURL(atual.blob);
    setUrlAtual(url);
    return () => URL.revokeObjectURL(url);
  }, [atual]);

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;
  if (rasc.tipoId !== 'saida') return <Navigate to={`${base}/item/${itemId}`} replace />;
  if (u && !ctx) return <Navigate to={`${base}/checklist`} replace />;

  const semEntrada = !!u && !u.entradaVinculadaId;
  const reqs = ctx ? requisitos(ctx.item, resposta, obs, fotos.length) : [];
  const completo = !!resposta && reqs.every((r) => r.ok);

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`${base}/checklist`} eyebrow={ctx ? `${u?.nome} · ${ctx.ambiente.nome}` : 'Saída'} title="Comparação entrada × saída" />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        {!ctx || !tipo || !u ? (
          <div className="h-48 animate-pulse rounded-xl border border-line-1 bg-white" aria-busy="true" />
        ) : semEntrada ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line-2 px-6 py-10 text-center" role="alert">
            <Icon icon="solar:danger-circle-linear" width={32} className="text-warning" aria-hidden="true" />
            <p className="text-[0.9375rem] font-medium text-fg-1">Comparação indisponível</p>
            <p className="max-w-xs text-[0.8125rem] text-fg-2">A vistoria de saída exige uma vistoria de entrada vinculada a esta estadia.</p>
            <Link to={`/app/unidades/${unidadeId}`} className={`${btnSecondary} sm:w-auto`}>Voltar à unidade</Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Saída · {ctx.ambiente.nome}</span>
              <h1 className="screen-title">{ctx.item.nome}</h1>
            </div>

            {/* Antes × agora */}
            <section className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2" aria-label="Comparação de fotos">
              <Painel rotulo="Na entrada" detalhe={u.ultima ? formatarData(u.ultima.data) : 'Entrada vinculada'}>
                {ctx.ambiente.ref ? (
                  <img src={ctx.ambiente.ref} alt={`Foto da entrada: ${ctx.item.nome}`} width={1200} height={675} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : (
                  <Vazio icon={ctx.ambiente.icon} texto="Entrada sem foto deste item" />
                )}
              </Painel>
              <Painel rotulo="Agora" detalhe={atual ? new Date(atual.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Pendente'} destaque>
                {urlAtual ? (
                  <img src={urlAtual} alt={`Foto atual: ${ctx.item.nome}`} width={1200} height={900} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <Link to={`${base}/item/${itemId}/foto`} className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-cream text-[0.8125rem] text-pine transition-colors duration-fast hover:bg-white">
                    <Icon icon="solar:camera-linear" width={28} aria-hidden="true" />
                    Fotografar o estado atual
                  </Link>
                )}
              </Painel>
            </section>
            <p className="-mt-3 flex items-start gap-1.5 text-[0.6875rem] text-fg-3">
              <Icon icon="solar:info-circle-linear" width={14} className="mt-px shrink-0" aria-hidden="true" />
              Mockup: a foto da entrada é simulada com a foto de referência do ambiente.
            </p>

            <section className="flex flex-col gap-2">
              <h2 className="text-xs uppercase tracking-[0.08em] text-fg-2">Comparado à entrada, o item está</h2>
              <SeletorResposta opcoes={tipo.respostas} valor={resposta} onChange={responder} rotulo={`Estado de ${ctx.item.nome} na saída`} />
            </section>

            <CampoObservacao valor={obs} onChange={observar} obrigatoria={divergente(resposta)} />

            {fotos.length > 0 && (
              <section className="flex flex-col gap-2">
                <h2 className="flex items-center justify-between text-xs uppercase tracking-[0.08em] text-fg-2">
                  Evidências da saída <span className="font-mono text-fg-3">{fotos.length}</span>
                </h2>
                <GradeEvidencias fotos={fotos} novaFoto={`${base}/item/${itemId}/foto`} onRemover={remover} />
              </section>
            )}

            {resposta && <ListaRequisitos itens={reqs} />}
          </>
        )}
      </main>

      {!semEntrada && (
        <BottomBar>
          <button type="button" className={btnPrimary} disabled={!completo} onClick={() => navigate(`${base}/checklist`)}>
            <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Concluir item
          </button>
        </BottomBar>
      )}
    </div>
  );
}

function Painel({ rotulo, detalhe, destaque, children }: { rotulo: string; detalhe: string; destaque?: boolean; children: React.ReactNode }) {
  return (
    <figure className={`overflow-hidden rounded-xl border bg-white ${destaque ? 'border-pine' : 'border-line-1'}`}>
      {children}
      <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-[0.75rem]">
        <span className={`font-medium uppercase tracking-[0.08em] ${destaque ? 'text-pine' : 'text-fg-2'}`}>{rotulo}</span>
        <span className="truncate font-mono text-fg-3">{detalhe}</span>
      </figcaption>
    </figure>
  );
}

function Vazio({ icon, texto }: { icon: string; texto: string }) {
  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-cream text-fg-3">
      <Icon icon={icon} width={28} aria-hidden="true" />
      <span className="text-[0.75rem]">{texto}</span>
    </div>
  );
}
