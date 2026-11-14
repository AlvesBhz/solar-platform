import { Icon } from '@iconify/react';
import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { GradeEvidencias } from '../components/Evidencia';
import { btnPrimary } from '../components/ScreenShell';
import { divergente } from '../lib/evidencia';
import { useItem } from '../lib/useItem';
import type { Gravidade } from '../mocks/unidades';
import { salvarRascunho } from '../mocks/vistoria';

const GRAVIDADES: { id: Gravidade; label: string; icon: string; desc: string; cls: string }[] = [
  { id: 'baixa', label: 'Baixa', icon: 'solar:info-circle-linear', desc: 'Não afeta a estadia', cls: 'border-pine bg-pine text-white' },
  { id: 'media', label: 'Média', icon: 'solar:danger-circle-linear', desc: 'Resolver antes da próxima estadia', cls: 'border-warning bg-warning-bg text-warning' },
  { id: 'critica', label: 'Crítica', icon: 'solar:danger-triangle-linear', desc: 'Impede a entrega da unidade', cls: 'border-error bg-white text-error ring-1 ring-error' },
];

/** T14 — Ocorrência: detalha a divergência (descrição, gravidade, fotos). Uma por item: sem duplicidade. */
export default function T14Ocorrencia() {
  const { unidadeId = '', itemId = '' } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const { u, rasc, fotos, ctx, resposta, obs, remover } = useItem(unidadeId, itemId);
  const base = `/app/vistorias/nova/${unidadeId}`;
  const existente = rasc?.ocorrencias?.[itemId];
  const [grav, setGrav] = useState<Gravidade | null>(existente?.gravidade ?? null);
  const [desc, setDesc] = useState(existente?.descricao ?? obs);

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  if (!rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;
  if (rasc && !divergente(resposta)) return <Navigate to={`${base}/item/${itemId}`} replace />;

  const g = grav ?? (ctx?.item.critico ? 'critica' : 'media');
  const voltar = new URLSearchParams(search).get('volta') === 'resumo' ? `${base}/resumo` : `${base}/item/${itemId}${rasc.tipoId === 'saida' ? '/comparar' : ''}`;

  function salvar() {
    salvarRascunho({ ...rasc!, ocorrencias: { ...(rasc!.ocorrencias ?? {}), [itemId]: { gravidade: g, descricao: desc.trim() } } });
    navigate(voltar);
  }

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={voltar} eyebrow={ctx ? `${u?.nome} · ${ctx.ambiente.nome}` : 'Ocorrência'} title="Ocorrência" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-warning">{existente ? 'Editar ocorrência' : 'Nova ocorrência'} · {resposta}</span>
          <h1 className="screen-title">{ctx?.item.nome ?? '…'}</h1>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs uppercase tracking-[0.08em] text-fg-2">Gravidade</legend>
          {GRAVIDADES.map((o) => {
            const sel = g === o.id;
            return (
              <label key={o.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors duration-fast ${sel ? o.cls : 'border-line-1 bg-white text-fg-2 hover:border-fg-3'}`}>
                <input type="radio" name="grav" className="sr-only" checked={sel} onChange={() => setGrav(o.id)} />
                <Icon icon={o.icon} width={20} aria-hidden="true" />
                <span className="flex flex-col">
                  <span className="text-[0.875rem] font-medium">{o.label}</span>
                  <span className={`text-[0.75rem] ${sel && o.id === 'baixa' ? 'text-white/80' : 'opacity-80'}`}>{o.desc}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <label className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-[0.08em] text-fg-2">Descrição</span>
          <textarea rows={4} maxLength={500} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="O que aconteceu, onde e o que precisa ser feito."
            className={`w-full rounded-md border bg-white p-3 text-fg-1 shadow-sm placeholder:text-fg-4 focus:border-pine focus:outline-none ${desc.trim() ? 'border-line-2' : 'border-warning'}`} />
        </label>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-[0.08em] text-fg-2">Fotos da ocorrência</h2>
          <GradeEvidencias fotos={fotos} novaFoto={`${base}/item/${itemId}/foto`} onRemover={remover} />
        </section>
      </main>
      <BottomBar>
        <button type="button" className={btnPrimary} disabled={!desc.trim() || fotos.length === 0} onClick={salvar}>
          <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Salvar ocorrência
        </button>
      </BottomBar>
    </div>
  );
}
