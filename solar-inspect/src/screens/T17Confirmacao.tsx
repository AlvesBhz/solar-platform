import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { useOnline } from '../components/NetworkBadge';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { EstadoBadge } from '../components/Status';
import { obterPosicao } from '../lib/imagem';
import { useResumo } from '../lib/useResumo';
import { proximoEstado, registrarEnvio, type Envio } from '../mocks/envios';
import { validarGps } from '../mocks/servidor';
import { descartarRascunho } from '../mocks/vistoria';

/** T17 — Confirmação: resumo, aviso de imutabilidade e envio definitivo com revalidação de presença. */
export default function T17Confirmacao() {
  const { unidadeId = '' } = useParams();
  const online = useOnline();
  const r = useResumo(unidadeId);
  const [etapa, setEtapa] = useState<'revisar' | 'confirmar' | 'enviando'>('revisar');
  const [envio, setEnvio] = useState<Envio | null>(null);
  const base = `/app/vistorias/nova/${unidadeId}`;

  if (envio) return <Enviado e={envio} />;
  if (r.u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!r.rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;
  if (!r.rasc.assinatura) return <Navigate to={`${base}/assinatura`} replace />;

  async function enviar() {
    setEtapa('enviando');
    const { u, tipo, rasc, ocorrencias, sinalizacoes } = r;
    const sinal = [...sinalizacoes];
    // Revalida a presença no envio (GPS); fora do raio é aceito, mas sempre sinalizado.
    if (u!.validacao !== 'qr') {
      const pos = await obterPosicao();
      const g = pos ? await validarGps(unidadeId, pos) : null;
      if (!g?.ok) sinal.push(g ? 'Envio fora do raio' : 'Localização indisponível no envio');
    }
    const e: Envio = {
      id: rasc!.id, unidadeId, unidade: u!.nome, tipo: tipo!.nome, inicio: rasc!.inicio!, fim: new Date().toISOString(),
      status: !online ? 'pendente' : sinal.length ? 'sinalizada' : 'enviada', sinalizacoes: sinal, ocorrencias: ocorrencias.length,
      novoEstado: proximoEstado(rasc!.tipoId, u!.estado, ocorrencias.map((o) => o.gravidade), ocorrencias.length),
      tentativas: online ? 1 : 0, ultimoErro: online ? undefined : 'Sem conexão',
    };
    registrarEnvio(e); // idempotente pelo UUID
    descartarRascunho(); // registro final: não pode mais ser alterado
    setEnvio(e);
  }

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={etapa === 'enviando' ? undefined : `${base}/assinatura`} eyebrow={`${r.u?.nome ?? ''} · ${r.tipo?.nome ?? ''}`} title="Confirmação" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Envio</span>
          <h1 className="screen-title">Enviar vistoria</h1>
        </div>
        <dl className="divide-y divide-line-1 rounded-xl border border-line-1 bg-white text-[0.8125rem]">
          {[
            ['Unidade', r.u?.nome], ['Tipo', r.tipo?.nome], ['Itens', `${r.itens.length} conferidos`],
            ['Ocorrências', String(r.ocorrencias.length)], ['Fotos', String(r.totalFotos)], ['Duração', `${r.minutos} min`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-3 px-4 py-3"><dt className="text-fg-3">{k}</dt><dd className="font-medium text-fg-1">{v}</dd></div>
          ))}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="text-fg-3">Assinatura</dt>
            <dd><img src={r.rasc.assinatura} alt="Assinatura do assessor" width={120} height={48} className="h-10 w-auto" /></dd>
          </div>
        </dl>
        <p className="flex items-start gap-2 rounded-md border border-line-2 bg-white p-3 text-[0.8125rem] text-fg-2">
          <Icon icon="solar:lock-linear" width={18} className="mt-px shrink-0 text-pine" aria-hidden="true" />
          Após o envio, a vistoria se torna um registro final e não poderá ser alterada nem excluída.
        </p>
        {!online && (
          <p className="flex items-start gap-2 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning" role="status">
            <Icon icon="solar:cloud-cross-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />
            Você está offline. A vistoria ficará na fila e será enviada quando a conexão voltar.
          </p>
        )}
      </main>
      <BottomBar>
        {etapa === 'revisar' ? (
          <button type="button" className={btnPrimary} disabled={!r.pronto} onClick={() => setEtapa('confirmar')}>
            <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Enviar definitivamente
          </button>
        ) : (
          <div className="flex flex-col gap-2" role="alertdialog" aria-label="Confirmar envio">
            <p className="text-center text-[0.8125rem] font-medium text-fg-1">Confirmar o envio definitivo?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={btnSecondary} disabled={etapa === 'enviando'} onClick={() => setEtapa('revisar')}>Cancelar</button>
              <button type="button" className={btnPrimary} disabled={etapa === 'enviando'} onClick={enviar}>{etapa === 'enviando' ? 'Enviando…' : 'Confirmar'}</button>
            </div>
          </div>
        )}
      </BottomBar>
    </div>
  );
}

function Enviado({ e }: { e: Envio }) {
  const pend = e.status === 'pendente';
  return (
    <div className="screen flex flex-col bg-cream">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-10">
        <span className={`flex h-16 w-16 items-center justify-center rounded-full border shadow-sm ${pend ? 'border-transparent bg-warning-bg text-warning' : 'border-line-1 bg-white text-available'}`}>
          <Icon icon={pend ? 'solar:cloud-cross-linear' : 'solar:check-circle-linear'} width={32} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-2" role="status">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">{e.unidade} · {e.tipo}</span>
          <h1 className="screen-title">{pend ? 'Salva na fila de envio' : e.status === 'sinalizada' ? 'Enviada para revisão' : 'Vistoria enviada'}</h1>
          <p className="text-[0.8125rem] leading-relaxed text-fg-2">
            {pend ? 'Será enviada automaticamente quando houver conexão.' : 'Registro final gravado.'}
            {e.ocorrencias > 0 && ` ${e.ocorrencias} ocorrência${e.ocorrencias > 1 ? 's' : ''} criada${e.ocorrencias > 1 ? 's' : ''}.`}
          </p>
          {e.sinalizacoes.length > 0 && <p className="flex items-start gap-1.5 text-[0.75rem] text-warning"><Icon icon="solar:shield-warning-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />{e.sinalizacoes.join(' · ')}</p>}
        </div>
        {e.novoEstado && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line-1 bg-white p-4">
            <span className="text-[0.8125rem] text-fg-2">Unidade agora</span>
            <EstadoBadge estado={e.novoEstado} size="md" />
          </div>
        )}
        <div className="flex flex-col gap-3">
          <Link to="/app/unidades" className={btnPrimary}>Voltar às unidades</Link>
          <Link to={pend ? '/app/sincronizacao' : '/app/historico'} className={btnSecondary}>{pend ? 'Ver fila de envio' : 'Ver meu histórico'}</Link>
        </div>
      </main>
    </div>
  );
}
