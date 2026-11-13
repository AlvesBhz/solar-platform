import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { RESPOSTAS_OK, checklistDa, type Item } from '../mocks/checklist';
import { listarTiposAtivos, obterUnidade, type TipoVistoria, type Unidade } from '../mocks/unidades';
import { lerRascunho, salvarRascunho, type Rascunho } from '../mocks/vistoria';

/** T10 — Checklist: executa por ambiente, na ordem física, salvando cada resposta no aparelho. */
export default function T10Checklist() {
  const { unidadeId = '' } = useParams();
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [tipo, setTipo] = useState<TipoVistoria | null>(null);
  const [rasc, setRasc] = useState<Rascunho | null>(() => lerRascunho(unidadeId));
  const [idx, setIdx] = useState(0);
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    listarTiposAtivos().then((ts) => setTipo(ts.find((t) => t.id === rasc?.tipoId) ?? null));
  }, [unidadeId, rasc?.tipoId]);

  const ambientes = useMemo(() => (u ? checklistDa(u) : []), [u]);
  const todos = ambientes.flatMap((a) => a.itens);
  const respondidos = todos.filter((i) => rasc?.respostas[i.id]).length;
  const divergentes = todos.filter((i) => { const r = rasc?.respostas[i.id]; return r && !RESPOSTAS_OK.includes(r); }).length;
  const pct = todos.length ? Math.round((respondidos / todos.length) * 100) : 0;

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  // Sem presença validada não há checklist (CA-02).
  if (!rasc?.inicio) return <Navigate to={`/app/vistorias/nova/${unidadeId}/presenca`} replace />;

  const amb = ambientes[idx];
  const feitos = (itens: Item[]) => itens.filter((i) => rasc.respostas[i.id]).length;

  function responder(itemId: string, valor: string) {
    // Gravação incremental: cada toque salva o rascunho no aparelho.
    setRasc((r) => salvarRascunho({ ...r!, respostas: { ...r!.respostas, [itemId]: valor } }));
  }

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`/app/unidades/${unidadeId}`} eyebrow={`${u?.nome ?? ''} · ${tipo?.nome ?? ''}`} title="Checklist" />

      {/* Progresso + ambientes */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.75rem)] z-[9] border-b border-line-1 bg-cream">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3 text-[0.75rem]">
            <span className="text-fg-2"><span className="font-mono font-medium text-fg-1">{respondidos}/{todos.length}</span> itens</span>
            <span className="inline-flex items-center gap-1 text-fg-3" role="status">
              <Icon icon="solar:diskette-linear" width={14} aria-hidden="true" />
              {rasc.salvoEm ? `Salvo no aparelho · ${new Date(rasc.salvoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Rascunho'}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da vistoria">
            <div className="h-full origin-left rounded-full bg-pine transition-transform duration-base" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2" role="tablist" aria-label="Ambientes">
              {ambientes.map((a, i) => {
                const ok = feitos(a.itens) === a.itens.length;
                const atual = i === idx;
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={atual}
                    onClick={() => setIdx(i)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] transition-colors duration-fast ${
                      atual ? 'border-pine bg-pine text-white' : 'border-line-2 bg-white text-fg-2'
                    }`}
                  >
                    <Icon icon={ok ? 'solar:check-circle-linear' : a.icon} width={16} className={!atual && ok ? 'text-available' : ''} aria-hidden="true" />
                    {a.nome}
                    <span className={`font-mono text-[0.6875rem] ${atual ? 'text-white/70' : 'text-fg-3'}`}>{feitos(a.itens)}/{a.itens.length}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-5">
        {!u || !tipo || !amb ? (
          [0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-line-1 bg-white" />)
        ) : (
          <>
            <h1 className="sr-only">{amb.nome}</h1>
            <ul className="flex flex-col gap-3" role="tabpanel">
              {amb.itens.map((item) => {
                const r = rasc.respostas[item.id];
                const diverge = r && !RESPOSTAS_OK.includes(r);
                return (
                  <li key={item.id} className={`flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm ${diverge ? 'border-warning' : 'border-line-1'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[0.875rem] font-medium text-fg-1">{item.nome}</span>
                      {r && !diverge && <Icon icon="solar:check-circle-linear" width={18} className="shrink-0 text-available" aria-label="Respondido" />}
                    </div>
                    {(item.critico || item.foto) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.6875rem] uppercase tracking-[0.08em]">
                        {item.critico && <span className="inline-flex items-center gap-1 text-error"><Icon icon="solar:danger-triangle-linear" width={14} aria-hidden="true" />Crítico</span>}
                        {item.foto && <span className="inline-flex items-center gap-1 text-fg-3"><Icon icon="solar:camera-linear" width={14} aria-hidden="true" />Foto obrigatória</span>}
                      </div>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(5.5rem,100%),1fr))] gap-2" role="radiogroup" aria-label={`Resposta para ${item.nome}`}>
                      {tipo.respostas.map((op) => {
                        const sel = r === op;
                        const neg = !RESPOSTAS_OK.includes(op);
                        return (
                          <button
                            key={op}
                            type="button"
                            role="radio"
                            aria-checked={sel}
                            onClick={() => responder(item.id, op)}
                            className={`min-h-11 rounded-md border px-2 text-[0.8125rem] transition-colors duration-fast ${
                              sel ? (neg ? 'border-warning bg-warning-bg font-medium text-warning' : 'border-pine bg-pine font-medium text-white') : 'border-line-2 text-fg-2 hover:border-fg-3'
                            }`}
                          >
                            {op}
                          </button>
                        );
                      })}
                    </div>
                    {diverge && (
                      <p className="flex items-start gap-2 text-[0.75rem] text-warning">
                        <Icon icon="solar:camera-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />
                        Divergência: foto e observação serão exigidas (T11 · Detalhe do item).
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
            {idx < ambientes.length - 1 && (
              <button type="button" className={`${btnSecondary} mt-2`} onClick={() => { setIdx(idx + 1); window.scrollTo({ top: 0 }); }}>
                Próximo ambiente: {ambientes[idx + 1].nome} <Icon icon="solar:alt-arrow-right-linear" width={18} aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </main>

      <BottomBar>
        {aviso ? (
          <p className="flex items-start gap-2 text-[0.75rem] text-fg-2" role="status">
            <Icon icon="solar:info-circle-linear" width={16} className="mt-px shrink-0 text-pine" aria-hidden="true" />
            Mockup: a próxima etapa (T15 · Resumo) ainda não foi implementada.
          </p>
        ) : (
          <p className="text-center text-[0.75rem] text-fg-3">
            {respondidos < todos.length ? `${todos.length - respondidos} itens pendentes` : 'Todos os itens respondidos'}
            {divergentes > 0 && ` · ${divergentes} divergência${divergentes > 1 ? 's' : ''}`}
          </p>
        )}
        <button type="button" className={btnPrimary} disabled={!todos.length || respondidos < todos.length} onClick={() => setAviso(true)}>
          Revisar e enviar <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
        </button>
      </BottomBar>
    </div>
  );
}
