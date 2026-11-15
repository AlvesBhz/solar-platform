import { Icon } from '@iconify/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { divergente, itemCompleto } from '../lib/evidencia';
import { BotoesResposta } from '../components/Evidencia';
import { RESPOSTAS_OK, checklistDa, type Item } from '../mocks/checklist';
import { contarFotosPorItem } from '../mocks/fotos';
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
  const [nFotos, setNFotos] = useState<Record<string, number>>({});
  const navigate = useNavigate();

  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    listarTiposAtivos().then((ts) => setTipo(ts.find((t) => t.id === rasc?.tipoId) ?? null));
  }, [unidadeId, rasc?.tipoId]);
  useEffect(() => { if (rasc?.id) contarFotosPorItem(rasc.id).then(setNFotos); }, [rasc?.id]);

  const ambientes = useMemo(() => (u ? checklistDa(u) : []), [u]);
  const todos = ambientes.flatMap((a) => a.itens);
  const completo = (i: Item) => itemCompleto(i, rasc?.respostas[i.id], rasc?.obs?.[i.id], nFotos[i.id] ?? 0);
  const respondidos = todos.filter(completo).length;
  const divergentes = todos.filter((i) => divergente(rasc?.respostas[i.id])).length;
  const pct = todos.length ? Math.round((respondidos / todos.length) * 100) : 0;

  // Volta do detalhe do item: reabre o ambiente e a posição em que o usuário estava.
  // A aba do ambiente selecionado fica sempre visível: a faixa rola até centralizá-la (e recentraliza quando os ícones carregam).
  const abas = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const n = abas.current;
    if (!n) return;
    const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const centralizar = (suave: boolean) => {
      const a = n.querySelector<HTMLElement>('[role=tab][aria-selected=true]');
      if (!a) return;
      n.scrollTo({ left: Math.max(0, a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2), behavior: suave && !reduz ? 'smooth' : 'auto' });
    };
    centralizar(true);
    let largura = n.scrollWidth;
    const ro = new ResizeObserver(() => { if (n.scrollWidth !== largura) { largura = n.scrollWidth; centralizar(false); } });
    n.querySelectorAll('[role=tab]').forEach((a) => ro.observe(a));
    const t = setTimeout(() => ro.disconnect(), 2000);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [idx, ambientes]);

  const restaurou = useRef(false);
  useEffect(() => {
    if (!ambientes.length || restaurou.current) return;
    restaurou.current = true;
    const i = ambientes.findIndex((a) => a.id === rasc?.ambAtual);
    if (i > 0) setIdx(i);
    const alvo = rasc?.ultimoItem;
    if (alvo) setTimeout(() => document.getElementById(`item-${alvo}`)?.scrollIntoView({ block: 'center' }), 80);
  }, [ambientes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ambiente completo: segue sozinho (uma vez por ambiente) para o próximo que ainda tem pendência;
  // se não restar nenhum, abre o resumo.
  useEffect(() => {
    const a = ambientes[idx];
    if (!rasc || !a || rasc.avancou?.[a.id]) return;
    const completa = (x: typeof a) => x.itens.every((i) => itemCompleto(i, rasc.respostas[i.id], rasc.obs?.[i.id], nFotos[i.id] ?? 0));
    if (!completa(a)) return;
    const t = setTimeout(() => {
      const prox = [...ambientes.slice(idx + 1), ...ambientes.slice(0, idx)].find((x) => !completa(x));
      setRasc(salvarRascunho({ ...(lerRascunho(unidadeId) ?? rasc), avancou: { ...rasc.avancou, [a.id]: true }, ambAtual: (prox ?? a).id, ultimoItem: undefined }));
      if (!prox) return navigate(`/app/vistorias/nova/${unidadeId}/resumo`);
      setIdx(ambientes.indexOf(prox));
      window.scrollTo({ top: 0 });
    }, 600);
    return () => clearTimeout(t);
  }, [rasc, nFotos, idx, ambientes]); // eslint-disable-line react-hooks/exhaustive-deps

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  // Sem presença validada não há checklist (CA-02).
  if (!rasc?.inicio) return <Navigate to={`/app/vistorias/nova/${unidadeId}/presenca`} replace />;

  const amb = ambientes[idx];
  const feitos = (itens: Item[]) => itens.filter(completo).length;
  const detalhe = (itemId: string) => `/app/vistorias/nova/${unidadeId}/item/${itemId}${rasc.tipoId === 'saida' ? '/comparar' : ''}`;

  // Grava no armazenamento ANTES de qualquer navegação: uma atualização de estado pendente se perde se a tela trocar logo depois.
  const gravar = (f: (r: Rascunho) => Partial<Rascunho>) => { const r = lerRascunho(unidadeId)!; setRasc(salvarRascunho({ ...r, ...f(r) })); };
  const irPara = (i: number) => { setIdx(i); gravar(() => ({ ambAtual: ambientes[i].id, ultimoItem: undefined })); };
  const marcar = (itemId: string) => gravar(() => ({ ambAtual: amb.id, ultimoItem: itemId }));

  function responder(itemId: string, valor: string) {
    // Gravação incremental: cada toque salva o rascunho no aparelho.
    gravar((r) => ({ respostas: { ...r.respostas, [itemId]: valor }, ambAtual: amb.id, ultimoItem: itemId }));
    // Divergência exige foto e observação: abre o detalhe do item na hora.
    if (divergente(valor)) navigate(detalhe(itemId));
    // Foto obrigatória: abre a câmera na hora (sem foto o ambiente nunca fecha); volta direto ao checklist.
    else if (todos.find((i) => i.id === itemId)?.foto && valor !== 'N/A' && !nFotos[itemId]) navigate(`/app/vistorias/nova/${unidadeId}/item/${itemId}/foto?de=checklist`);
  }

  // Mapeia as respostas do tipo para os controles compactos: ✓ (positiva), ✗ (divergência) e N/A.
  const positivo = tipo?.respostas.find((x) => RESPOSTAS_OK.includes(x) && x !== 'N/A') ?? 'OK';
  const negativos = tipo?.respostas.filter((x) => divergente(x)) ?? [];
  const temNA = !!tipo?.respostas.includes('N/A');
  const negar = (itemId: string) => {
    // Uma só divergência (ex.: Problema, Precisa intervenção): marca e abre o detalhe.
    // Várias (Saída: Danificado/Faltando/Com defeito): abre a comparação para escolher.
    if (negativos.length === 1) return responder(itemId, negativos[0]);
    marcar(itemId);
    navigate(detalhe(itemId));
  };
  const fotografar = (itemId: string) => { marcar(itemId); navigate(`/app/vistorias/nova/${unidadeId}/item/${itemId}/foto?de=checklist`); };
  const tudoOk = () => {
    const pend = amb.itens.filter((i) => !rasc.respostas[i.id]);
    if (!pend.length) return;
    gravar((r) => ({ respostas: { ...r.respostas, ...Object.fromEntries(pend.map((i) => [i.id, positivo])) }, ambAtual: amb.id }));
  };
  const ambCompleto = !!amb && feitos(amb.itens) === amb.itens.length;
  const semResposta = amb ? amb.itens.filter((i) => !rasc.respostas[i.id]).length : 0;

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`/app/unidades/${unidadeId}`} eyebrow={`${u?.nome ?? ''} · ${tipo?.nome ?? ''}`} title="Checklist" />

      {/* Progresso + ambientes */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.75rem)] z-[9] border-b border-line-1 bg-cream">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pb-3 pt-3">
          <div className="flex items-center justify-between gap-3 text-[0.75rem]">
            <span className="text-fg-2"><span className="font-mono font-medium text-fg-1">{respondidos}/{todos.length}</span> itens completos</span>
            <span className="inline-flex items-center gap-1 text-fg-3" role="status">
              <Icon icon="solar:diskette-linear" width={14} aria-hidden="true" />
              {rasc.salvoEm ? `Salvo no aparelho · ${new Date(rasc.salvoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Rascunho'}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da vistoria">
            <div className="h-full origin-left rounded-full bg-pine transition-transform duration-base" style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div ref={abas} className="relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-2" role="tablist" aria-label="Ambientes">
              {ambientes.map((a, i) => {
                const ok = feitos(a.itens) === a.itens.length;
                const atual = i === idx;
                return (
                  <button key={a.id} type="button" role="tab" aria-selected={atual} onClick={() => irPara(i)}
                    className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-[0.8125rem] transition-colors duration-fast ${atual ? 'border-pine bg-pine text-white' : 'border-line-2 bg-white text-fg-2'}`}>
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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-5">
        {!u || !tipo || !amb ? (
          <div className="h-64 animate-pulse rounded-2xl border border-line-1 bg-white" />
        ) : (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-col">
                <span className="text-[0.625rem] uppercase tracking-[0.24em] text-fg-3">Ambiente {idx + 1} de {ambientes.length}</span>
                <h1 className="font-serif text-[1.625rem] font-medium leading-tight text-fg-1">{amb.nome}</h1>
              </div>
              {semResposta > 0 && (
                <button type="button" onClick={tudoOk} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line-2 bg-white px-3.5 text-[0.75rem] font-medium text-available transition-colors duration-fast hover:border-available">
                  <Icon icon="solar:check-read-linear" width={16} aria-hidden="true" /> Tudo OK
                </button>
              )}
            </div>

            {ambCompleto && !rasc.avancou?.[amb.id] && (
              <p className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[0.8125rem] font-medium text-available shadow-sm" role="status">
                <Icon icon="solar:check-circle-bold" width={18} aria-hidden="true" /> {amb.nome} concluída · seguindo…
              </p>
            )}

            <ul className="divide-y divide-line-1 overflow-hidden rounded-2xl border border-line-1 bg-white shadow-sm" role="tabpanel" aria-label={amb.nome}>
              {amb.itens.map((item) => {
                const r = rasc.respostas[item.id];
                return (
                  <LinhaItem
                    key={item.id}
                    item={item}
                    resposta={r}
                    positivo={positivo}
                    temNA={temNA}
                    completo={completo(item)}
                    nFotos={nFotos[item.id] ?? 0}
                    obs={!!rasc.obs?.[item.id]}
                    detalhe={detalhe(item.id)}
                    onOk={() => responder(item.id, positivo)}
                    onNao={() => negar(item.id)}
                    onNA={() => responder(item.id, 'N/A')}
                    onFoto={() => fotografar(item.id)}
                    onAbrir={() => marcar(item.id)}
                  />
                );
              })}
            </ul>
            <p className="text-center text-[0.6875rem] text-fg-3">Deslize o item → para <span className="text-available">OK</span> ou ← para <span className="text-error">problema</span></p>

            {idx < ambientes.length - 1 && (
              <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1 self-center text-[0.8125rem] text-pine" onClick={() => { irPara(idx + 1); window.scrollTo({ top: 0 }); }}>
                Pular para {ambientes[idx + 1].nome} <Icon icon="solar:alt-arrow-right-linear" width={16} aria-hidden="true" />
              </button>
            )}
          </>
        )}
      </main>

      <BottomBar>
        <p className="text-center text-[0.75rem] text-fg-3">
          {respondidos < todos.length ? `${todos.length - respondidos} itens pendentes` : 'Todos os itens completos'}
          {divergentes > 0 && <span className="text-error"> · {divergentes} divergência{divergentes > 1 ? 's' : ''}</span>}
        </p>
        <button type="button" className={btnPrimary} disabled={!todos.length || respondidos < todos.length} onClick={() => navigate(`/app/vistorias/nova/${unidadeId}/resumo`)}>
          Revisar e enviar <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
        </button>
      </BottomBar>
    </div>
  );
}

type LinhaProps = {
  item: Item; resposta?: string; positivo: string; temNA: boolean; completo: boolean; nFotos: number; obs: boolean; detalhe: string;
  onOk: () => void; onNao: () => void; onNA: () => void; onFoto: () => void; onAbrir: () => void;
};

/** Linha do item: ✓ / ✗ / N/A compactos + gesto de deslizar (→ OK, ← problema). */
function LinhaItem({ item, resposta, positivo, temNA, completo, nFotos, obs, detalhe, onOk, onNao, onNA, onFoto, onAbrir }: LinhaProps) {
  const [dx, setDx] = useState(0);
  const toque = useRef<{ x: number; y: number; arrastando: boolean } | null>(null);
  const LIMITE = 72;
  const ok = resposta === positivo;
  const na = resposta === 'N/A';
  const nao = divergente(resposta);

  function inicio(e: React.PointerEvent) { toque.current = { x: e.clientX, y: e.clientY, arrastando: false }; }
  function mover(e: React.PointerEvent) {
    const t = toque.current;
    if (!t) return;
    const ddx = e.clientX - t.x;
    if (!t.arrastando) {
      if (Math.abs(ddx) < 10 || Math.abs(ddx) < Math.abs(e.clientY - t.y) * 1.5) return; // rolagem vertical continua livre
      t.arrastando = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    setDx(Math.max(-110, Math.min(110, ddx)));
  }
  function fim() {
    if (toque.current?.arrastando) { if (dx > LIMITE) onOk(); else if (dx < -LIMITE) onNao(); }
    toque.current = null;
    setDx(0);
  }

  const pendente = resposta && !completo;
  return (
    <li id={`item-${item.id}`} className="relative scroll-mt-52">
      {/* Fundo revelado pelo gesto */}
      <div className="absolute inset-0 flex items-center justify-between px-5" aria-hidden="true">
        <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-available" style={{ opacity: Math.max(0, dx) / LIMITE }}><Icon icon="solar:check-circle-bold" width={22} />OK</span>
        <span className="flex items-center gap-1.5 text-[0.75rem] font-semibold uppercase tracking-[0.1em] text-error" style={{ opacity: Math.max(0, -dx) / LIMITE }}>Problema<Icon icon="solar:close-circle-bold" width={22} /></span>
      </div>

      <div
        onPointerDown={inicio} onPointerMove={mover} onPointerUp={fim} onPointerCancel={fim}
        onDragStart={(e) => e.preventDefault()}
        className={`relative flex select-none flex-col gap-1.5 bg-white px-4 py-3 [touch-action:pan-y] ${toque.current?.arrastando ? '' : 'transition-transform duration-base'}`}
        style={{ transform: `translateX(${dx}px)` }}
      >
        <div className="flex items-center gap-3">
          <Link to={detalhe} onClick={onAbrir} draggable={false} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
            <span className={`text-[0.875rem] leading-snug ${resposta ? 'text-fg-2' : 'font-medium text-fg-1'}`}>{item.nome}</span>
            {(item.critico || item.foto) && (
              <span className="mt-0.5 flex items-center gap-2.5 text-[0.6875rem] text-fg-3">
                {item.critico && <span className="inline-flex items-center gap-1 text-error"><Icon icon="solar:danger-triangle-linear" width={12} aria-hidden="true" />Crítico</span>}
                {item.foto && <span className="inline-flex items-center gap-1"><Icon icon="solar:camera-linear" width={12} aria-hidden="true" />{nFotos ? `${nFotos} foto${nFotos > 1 ? 's' : ''}` : 'Foto'}</span>}
              </span>
            )}
          </Link>

          <BotoesResposta resposta={resposta} positivo={positivo} temNA={temNA} nome={item.nome} onOk={onOk} onNao={onNao} onNA={onNA} />
        </div>

        {/* Pendências e evidências, só quando existem */}
        {pendente && (
          nao ? (
            <Link to={detalhe} onClick={onAbrir} className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full text-[0.75rem] font-medium text-error">
              <Icon icon="solar:danger-circle-linear" width={14} aria-hidden="true" /> Detalhar problema: gravidade e foto <Icon icon="solar:alt-arrow-right-linear" width={14} aria-hidden="true" />
            </Link>
          ) : (
            <button type="button" onClick={onFoto} className="inline-flex min-h-9 items-center gap-1.5 self-start rounded-full bg-warning-bg px-3 text-[0.75rem] font-medium text-warning">
              <Icon icon="solar:camera-linear" width={14} aria-hidden="true" /> Tirar foto obrigatória
            </button>
          )
        )}
        {completo && nao && (
          <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-fg-3">
            <Icon icon="solar:check-circle-linear" width={12} className="text-available" aria-hidden="true" /> {resposta} · {nFotos} foto{nFotos > 1 ? 's' : ''}{obs ? ' · observação' : ''}
          </span>
        )}
      </div>
    </li>
  );
}
