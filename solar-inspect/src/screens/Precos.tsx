import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chips, Seletor } from '../components/Filtros';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { hoje } from '../lib/campo';
import {
  MOTIVOS, REAL, ajusteDe, brl, brlCurto, calcularEstadia, carregarMes, dataCurta, dataLonga, diaDe, diaSemana, fimPacote, listarPacotes, mesAno, noites, noon, pacotesDe, removerAjustes, salvarAjustes, salvarPacote, somar, tarifaDe,
  type Dia, type Estadia, type Hospedes, type Noite, type Pacote, type Unidade,
} from '../lib/precos';
import { useUnidades } from '../lib/usePrecos';
import { usePerfilPermitido } from '../lib/useAdmin';

export const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-[0.875rem] text-fg-1 placeholder:text-fg-4 focus:border-pine focus:outline-none';
export const rot = 'flex flex-col gap-1.5 text-[0.75rem] uppercase tracking-[0.06em] text-fg-2';
export const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/\./g, '').replace(',', '.')));
export const PERFIS_PRECO: 'ADMIN'[] = ['ADMIN']; // preços são dados do site: só o administrador, como as Propriedades

/** Faixa no topo das telas de preço, só na demonstração (link sem banco): nada do que se faz ali chega ao site. */
export function AvisoPrototipo() {
  if (REAL) return null;                                   // ligado ao banco: não é mais protótipo
  return (
    <p role="note" className="flex items-start gap-2 rounded-md border border-line-2 bg-warning-bg px-3 py-2 text-[0.75rem] text-fg-2">
      <Icon icon="solar:info-circle-linear" width={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <span><strong className="font-medium text-fg-1">Protótipo.</strong> Os valores abaixo são de exemplo e nada do que for alterado aqui chega ao site de reservas.</span>
    </p>
  );
}

const ucf = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
export const Carregando = () => <div className={`${card} h-40 animate-pulse`} aria-busy="true" />;
export const Falha = ({ tentar, texto = 'Não foi possível carregar os preços. Verifique a conexão.' }: { tentar: () => void; texto?: string }) => (
  <div role="alert" className={`${card} flex flex-col items-start gap-3 p-4 text-[0.8125rem] text-error`}>
    {texto}
    <button type="button" className={`${btnSecondary} !w-auto`} onClick={tentar}>Tentar de novo</button>
  </div>
);
export const SemChale = () => <p className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhum chalé ativo para configurar preços.</p>;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** Dias do mês em grade de domingo a sábado (null = célula vazia). */
function gradeDoMes(mes: string): (string | null)[] {
  const d = noon(mes);
  const ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const vazios = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return [...Array(vazios).fill(null), ...Array.from({ length: ult }, (_, i) => `${mes.slice(0, 8)}${String(i + 1).padStart(2, '0')}`)];
}
const primeiroDia = (s: string) => `${s.slice(0, 8)}01`;
const mudarMes = (mes: string, n: number) => { const d = noon(mes); d.setMonth(d.getMonth() + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; };

function descricaoDia(x: Dia) {
  return [
    `${noon(x.data).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', weekday: 'long' })}`,
    x.valor === null ? 'sem tarifa' : brl(x.valor), `mínimo ${x.minNoites} ${x.minNoites === 1 ? 'noite' : 'noites'}`,
    x.ocupacao ? x.ocupacao.rotulo : '', x.fechado ? 'fechado para venda' : '', x.ajustado ? 'com ajuste' : '', x.pacotes.length ? `só pacote ${x.pacotes[0].nome}` : '',
  ].filter(Boolean).join(', ');
}

/** Agrupa datas (ordenadas) em trechos seguidos: ["24/dez a 27/dez", "31/dez"]. */
function trechos(ds: string[]) {
  const r: [string, string][] = [];
  ds.forEach((d) => { const u = r[r.length - 1]; if (u && somar(u[1], 1) === d) u[1] = d; else r.push([d, d]); });
  return r.map(([a, b]) => (a === b ? dataCurta(a) : `${dataCurta(a)} a ${dataCurta(b)}`));
}

/** T38 — Calendário de preços: o mês como o cliente vê no site. Marque os dias, mude a diária e o mínimo de noites e salve. Pacotes de datas especiais logo abaixo. */
export function T38Calendario() {
  const perfil = usePerfilPermitido(PERFIS_PRECO);
  const [params] = useSearchParams();
  const h = hoje();
  const [mes, setMes] = useState(primeiroDia(/^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? `${params.get('mes')}-01` : h));
  const [modo, setModo] = useState<'dias' | 'intervalo'>('dias');
  const [sel, setSel] = useState<string[]>([]);
  const [ancora, setAncora] = useState<string | null>(null);   // intervalo: primeiro dia tocado, aguardando o último
  const [, rever] = useState(0);
  const [carga, setCarga] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const un = useUnidades(!!perfil);
  const uid = un.atual?.id;
  const carregar = () => {
    if (uid === undefined) return Promise.resolve();
    setCarga((c) => (c === 'ok' ? c : 'carregando'));          // recarga depois de salvar não pisca a tela
    return carregarMes(uid, mes).then(() => { setCarga('ok'); rever((n) => n + 1); }).catch(() => setCarga('erro'));
  };
  useEffect(() => { void carregar(); }, [uid, mes]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!perfil) return null;

  const grade = gradeDoMes(mes);
  const dias = grade.filter((x): x is string => !!x).map(diaDe);
  const valores = dias.map((x) => x.valor).filter((v): v is number => v !== null);
  const resumo = {
    faixa: valores.length ? `${brl(Math.min(...valores))} a ${brl(Math.max(...valores))}` : 'sem tarifa',
    ajustadas: dias.filter((x) => x.ajustado).length, fechadas: dias.filter((x) => x.fechado).length, ocupadas: dias.filter((x) => x.ocupacao).length,
  };
  const limpar = () => { setSel([]); setAncora(null); };

  function escolher(d: string) {
    if (modo === 'dias') return setSel((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d].sort()));
    if (!ancora) { setSel([d]); return setAncora(d); }
    const [a, b] = d < ancora ? [d, ancora] : [ancora, d];
    setSel(Array.from({ length: noites(a, b) + 1 }, (_, i) => somar(a, i)));
    setAncora(null);
  }

  return (
    <GestaoShell eyebrow="Administração" titulo="Calendário de preços">
      <AvisoPrototipo />
      {un.erro || carga === 'erro' ? <Falha tentar={() => { un.erro ? un.tentarDeNovo() : void carregar(); }} /> : !un.lista ? <Carregando /> : !un.atual ? <SemChale /> : (<>
      <div className="flex flex-wrap items-center gap-3">
        <Seletor rotulo="Chalé" valor={String(un.atual.id)} onChange={(v) => { un.escolher(v); limpar(); }} opcoes={un.opcoes} icone="solar:home-2-linear" className="min-w-0 sm:w-64" />
        <Chips rotulo="Como selecionar" valor={modo} onChange={(v) => { setModo(v); limpar(); }}
          opcoes={[{ valor: 'dias', label: 'Dias avulsos' }, { valor: 'intervalo', label: 'Intervalo' }]} />
      </div>

      <div className={`grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start ${sel.length ? 'max-lg:pb-[27rem]' : ''}`}>
        <section className={`${card} flex min-w-0 flex-col gap-3 p-4`} aria-label="Calendário">
          <div className="flex items-center justify-between gap-2">
            <button type="button" aria-label="Mês anterior" title="Mês anterior" onClick={() => setMes(mudarMes(mes, -1))} className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream">
              <Icon icon="solar:alt-arrow-left-linear" width={20} aria-hidden="true" />
            </button>
            <div className="flex flex-col items-center">
              <h2 className="font-serif text-[1.125rem] font-medium text-fg-1" aria-live="polite">{ucf(mesAno(mes))}</h2>
              {primeiroDia(h) !== mes && <button type="button" onClick={() => setMes(primeiroDia(h))} className="text-[0.6875rem] uppercase tracking-[0.12em] text-pine underline underline-offset-4">Ir para hoje</button>}
            </div>
            <button type="button" aria-label="Próximo mês" title="Próximo mês" onClick={() => setMes(mudarMes(mes, 1))} className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream">
              <Icon icon="solar:alt-arrow-right-linear" width={20} aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={mesAno(mes)} aria-multiselectable="true">
            {SEMANA.map((s) => <span key={s} className="py-1 text-center text-[0.6875rem] text-fg-3" role="columnheader">{s}</span>)}
            {grade.map((d, i) => {
              if (!d) return <span key={`v${i}`} aria-hidden="true" />;
              const x = diaDe(d);
              const passado = d < h;
              const marcado = sel.includes(d);
              const fds = [0, 5, 6].includes(noon(d).getDay());
              const pac = x.pacotes.length > 0;
              return (
                <button key={d} type="button" role="gridcell" disabled={passado} onClick={() => escolher(d)} aria-label={descricaoDia(x)} aria-selected={marcado} data-dia={d}
                  className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 text-center transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-35
                    ${marcado ? 'border-pine bg-pine/10 ring-1 ring-pine' : pac ? 'border-pine/30 bg-pine/5 hover:border-pine' : 'border-transparent hover:border-line-2 hover:bg-cream'}
                    ${x.fechado ? 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--border-1)_5px_6px)]' : ''}`}>
                  {marcado && <Icon icon="solar:check-circle-bold" width={12} className="absolute right-0.5 top-0.5 text-pine" aria-hidden="true" />}
                  <span className={`text-[0.75rem] leading-none ${d === h ? 'font-semibold text-pine underline underline-offset-4' : 'text-fg-2'}`}>{Number(d.slice(8))}</span>
                  {x.valor === null
                    ? <span className="font-mono text-[0.6875rem] text-fg-4">—</span>
                    : <span className={`font-mono text-[0.75rem] leading-none ${x.fechado || x.ocupacao ? 'text-fg-4 line-through' : fds ? 'font-semibold text-fg-1' : 'text-fg-2'}`}>{brlCurto(x.valor)}</span>}
                  <span className="flex h-3 items-center gap-1 text-[0.5625rem] leading-none text-fg-3">
                    {x.fechado ? <Icon icon="solar:forbidden-circle-linear" width={11} aria-hidden="true" />
                      : x.ocupacao ? <span className={x.ocupacao.tipo === 'reserva' ? 'text-pine' : 'text-warning'}>{x.ocupacao.tipo === 'reserva' ? 'reserva' : x.ocupacao.tipo === 'bloqueio' ? 'bloq.' : 'pré'}</span>
                      : pac ? <Icon icon="solar:ticket-linear" width={11} className="text-pine" aria-hidden="true" />
                      : x.minNoites > 2 ? <span className="hidden sm:inline">mín. {x.minNoites}</span> : null}
                    {x.ajustado && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />}
                    {!x.fechado && !x.ocupacao && !pac && x.minNoites > 2 && <span className="sm:hidden">{x.minNoites}n</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-1 pt-3 text-[0.6875rem] text-fg-3" aria-label="Legenda">
            <li className="flex items-center gap-1.5"><span className="font-mono font-semibold text-fg-1">1,7k</span> fim de semana</li>
            <li className="flex items-center gap-1.5"><span className="font-mono text-fg-2">800</span> domingo a quinta</li>
            <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" /> dia com ajuste</li>
            <li className="flex items-center gap-1.5"><Icon icon="solar:ticket-linear" width={12} className="text-pine" aria-hidden="true" /> só vende pacote</li>
            <li className="flex items-center gap-1.5"><span className="font-mono text-fg-4 line-through">800</span> ocupado ou fechado</li>
            <li className="flex items-center gap-1.5"><span className="font-mono"><span className="sm:hidden">3n</span><span className="hidden sm:inline">mín. 3</span></span> mínimo de noites (fora do padrão)</li>
          </ul>
        </section>

        {/* No celular o painel abre por baixo, fixo, e o calendário continua no mesmo lugar; no computador fica ao lado. */}
        <aside className={`${card} flex min-w-0 flex-col gap-4 p-4 ${sel.length ? 'max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-40 max-lg:max-h-[min(27rem,75dvh)] max-lg:overflow-y-auto max-lg:rounded-b-none max-lg:rounded-t-2xl max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] max-lg:shadow-[0_-8px_24px_rgba(0,0,0,0.12)]' : ''}`}
          aria-label="Ajuste dos dias">
          {!sel.length ? (
            <>
              <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">{ucf(mesAno(mes))}</h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8125rem]">
                <dt className="text-fg-3">Faixa de preço</dt><dd className="text-right font-mono text-fg-1">{resumo.faixa}</dd>
                <dt className="text-fg-3">Noites com ajuste</dt><dd className="text-right font-mono text-fg-1">{resumo.ajustadas || '—'}</dd>
                <dt className="text-fg-3">Noites fechadas</dt><dd className="text-right font-mono text-fg-1">{resumo.fechadas || '—'}</dd>
                <dt className="text-fg-3">Noites ocupadas</dt><dd className="text-right font-mono text-fg-1">{resumo.ocupadas || '—'}</dd>
              </dl>
              <p className="rounded-md bg-cream p-3 text-[0.8125rem] text-fg-2">
                {modo === 'dias' ? 'Toque nos dias que quer mudar (toque de novo para desmarcar). Depois informe a diária e o mínimo de noites e salve.' : 'Toque no primeiro e no último dia do intervalo. O ajuste vale para todas as noites entre eles.'}
              </p>
              <p className="text-[0.75rem] text-fg-3">O valor padrão de cada período vem das <Link to="/admin/tarifas" className="text-pine underline underline-offset-4">tarifas</Link>. O ajuste de um dia vale mais do que a tarifa.</p>
            </>
          ) : (
            <PainelAjuste key={sel.join()} unidade={un.atual.id} noites={sel} aguardaFim={!!ancora} onFechar={limpar} onSalvo={carregar} />
          )}
        </aside>
      </div>

      <Pacotes unidade={un.atual.id} onMudou={carregar} />
      </>)}
    </GestaoShell>
  );
}

function PainelAjuste({ unidade, noites: ns, aguardaFim, onFechar, onSalvo }: { unidade: number; noites: string[]; aguardaFim: boolean; onFechar: () => void; onSalvo: () => Promise<void> | void }) {
  const um = ns.length === 1;
  const x = diaDe(ns[0]);
  const a = um ? ajusteDe(ns[0]) : null;
  const t = tarifaDe(ns[0]);
  const [valor, setValor] = useState(a?.valor != null ? String(a.valor).replace('.', ',') : '');
  const [min, setMin] = useState(a?.minNoites != null ? String(a.minNoites) : '');
  const [fechado, setFechado] = useState(!!a?.fechado);
  const [semChegada, setSemChegada] = useState(!!a?.semChegada);
  const [semSaida, setSemSaida] = useState(!!a?.semSaida);
  const [obs, setObs] = useState(a?.obs ?? '');
  const [mais, setMais] = useState(!!(a?.fechado || a?.semChegada || a?.semSaida || a?.obs));
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const comAjuste = ns.filter((d) => ajusteDe(d)).length;
  const ocupadas = ns.filter((d) => diaDe(d).ocupacao).length;
  const comPacote = ns.some((d) => pacotesDe(d).length);
  const passou = ns.some((d) => d < hoje());
  const quais = trechos(ns);
  const mexeu = <T,>(f: (v: T) => void) => (v: T) => { f(v); setMsg(null); };

  async function salvar() {
    setOcupado(true);
    const r = await salvarAjustes(unidade, ns, { valor: num(valor), minNoites: num(min), fechado, semChegada, semSaida, obs: obs.trim() });
    if (!r.ok) { setOcupado(false); return setMsg({ t: r.erro, erro: true }); }
    await onSalvo(); setOcupado(false);
    setMsg({ t: `Salvo. ${ns.length} ${um ? 'noite atualizada' : 'noites atualizadas'} no site.` });
  }
  async function remover() {
    setOcupado(true);
    const r = await removerAjustes(unidade, ns);
    if (!r.ok) { setOcupado(false); return setMsg({ t: r.erro, erro: true }); }
    setValor(''); setMin(''); setFechado(false); setSemChegada(false); setSemSaida(false); setObs('');
    await onSalvo(); setOcupado(false);
    setMsg({ t: 'Ajuste removido: volta a valer a tarifa.' });
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[1.125rem] font-medium text-fg-1">{um ? `${ucf(diaSemana(ns[0]))}, ${dataCurta(ns[0])}` : `${ns.length} noites selecionadas`}</h2>
          <p className="text-[0.75rem] text-fg-3 [overflow-wrap:anywhere]">{um ? 'Noite que começa neste dia' : quais.length > 3 ? `${quais.slice(0, 3).join(', ')} e mais ${quais.length - 3}` : quais.join(', ')}{aguardaFim ? ' · toque no último dia' : ''}</p>
        </div>
        <button type="button" aria-label="Fechar painel" title="Fechar painel" onClick={onFechar} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-2 hover:bg-cream">
          <Icon icon="solar:close-circle-linear" width={20} aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-fg-3">Tarifa</dt><dd className="text-right text-fg-1">{t ? t.nome : <span className="text-warning">sem tarifa</span>}</dd>
        {um && <><dt className="text-fg-3">Diária hoje</dt><dd className="text-right font-mono text-fg-1">{x.valor === null ? '—' : brl(x.valor)}</dd></>}
        {um && x.ocupacao && <><dt className="text-fg-3">Situação</dt><dd className="text-right text-warning">{x.ocupacao.rotulo}</dd></>}
      </dl>
      {ocupadas > 0 && <p role="note" className="flex items-start gap-2 text-[0.75rem] text-fg-2"><Icon icon="solar:danger-circle-linear" width={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />{um ? 'Há reserva ou bloqueio nesta noite.' : `${ocupadas} das noites têm reserva ou bloqueio.`} O ajuste vale só para vendas novas; reservas feitas não mudam de valor.</p>}
      {comPacote && <p role="note" className="flex items-start gap-2 text-[0.75rem] text-fg-2"><Icon icon="solar:ticket-linear" width={16} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />Há pacote nessas noites: o site vende só o pacote, pelo valor dele. A diária aqui vale se o pacote for desativado.</p>}
      {passou && <p role="alert" className="text-[0.75rem] text-error">Há noites que já passaram: o ajuste não se aplica a elas.</p>}

      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void salvar(); }} noValidate>
        <div className="grid grid-cols-2 gap-3">
          <label className={rot}>Diária (R$)
            <input inputMode="decimal" className={campo} value={valor} onChange={(e) => mexeu(setValor)(e.target.value)} placeholder={t ? `tarifa · ${brlCurto(x.valor ?? t.valorNoite)}` : 'ex.: 1700'} />
          </label>
          <label className={rot}>Mínimo de noites
            <input inputMode="numeric" className={campo} value={min} onChange={(e) => mexeu(setMin)(e.target.value)} placeholder={t ? `tarifa · ${t.minNoites}` : 'ex.: 3'} />
          </label>
        </div>
        <p className="text-[0.75rem] text-fg-3">Em branco, vale a tarifa. O site não deixa reservar menos noites que o mínimo e avisa o cliente.</p>
        <button type="button" className="flex min-h-11 items-center gap-1.5 self-start text-[0.8125rem] text-pine" aria-expanded={mais} onClick={() => setMais(!mais)}>
          <Icon icon={mais ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} width={16} aria-hidden="true" />Mais opções{fechado || semChegada || semSaida || obs ? ' (em uso)' : ''}
        </button>
        {mais && (
          <div className="flex flex-col gap-1 rounded-md bg-cream px-3 py-2">
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={fechado} onChange={(e) => mexeu(setFechado)(e.target.checked)} />Fechar para venda</label>
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={semChegada} onChange={(e) => mexeu(setSemChegada)(e.target.checked)} />Não aceitar chegada nestes dias</label>
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={semSaida} onChange={(e) => mexeu(setSemSaida)(e.target.checked)} />Não aceitar saída nestes dias</label>
            <label className={`${rot} pb-1`}>Observação
              <input className={campo} value={obs} onChange={(e) => mexeu(setObs)(e.target.value)} placeholder="ex.: Natal 2026" maxLength={80} />
            </label>
          </div>
        )}
        {comAjuste > 0 && !um && <p className="text-[0.75rem] text-fg-3">{comAjuste} {comAjuste === 1 ? 'noite já tem' : 'noites já têm'} ajuste: salvar substitui.</p>}
        {msg && (
          <p role={msg.erro ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-md border p-3 text-[0.8125rem] ${msg.erro ? 'border-error text-error' : 'border-available bg-white font-medium text-available'}`}>
            <Icon icon={msg.erro ? 'solar:danger-circle-linear' : 'solar:check-circle-bold'} width={18} className="shrink-0" aria-hidden="true" />{msg.t}
          </p>
        )}
        <div className="flex flex-wrap gap-3 max-lg:sticky max-lg:-bottom-4 max-lg:-mx-4 max-lg:border-t max-lg:border-line-1 max-lg:bg-white max-lg:px-4 max-lg:py-3">
          <button type="submit" className={`${btnPrimary} max-sm:flex-1 sm:!w-auto`} disabled={aguardaFim || passou || ocupado}><Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />{ocupado ? 'Salvando…' : 'Salvar'}</button>
          {comAjuste > 0 && <button type="button" className={`${btnSecondary} max-sm:flex-1 sm:!w-auto`} disabled={ocupado} onClick={() => void remover()}><Icon icon="solar:trash-bin-minimalistic-linear" width={18} aria-hidden="true" />Remover ajuste</button>}
        </div>
      </form>
    </>
  );
}

type FormPacote = { id?: number; nome: string; checkin: string; noites: string; total: string; ativo: boolean };
const PACOTE_VAZIO: FormPacote = { nome: '', checkin: '', noites: '', total: '', ativo: true };

/** Pacotes de datas especiais: preço final por check-in e número de noites (ex.: Natal 24/12 · 3 noites R$ 2.400 · 4 noites R$ 2.900). */
function Pacotes({ unidade, onMudou }: { unidade: number; onMudou: () => Promise<void> | void }) {
  const [l, setL] = useState<Pacote[] | null>(null);
  const [erro, setErro] = useState(false);
  const [f, setF] = useState<FormPacote | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const carregar = () => { setErro(false); return listarPacotes(unidade).then(setL).catch(() => setErro(true)); };
  useEffect(() => { void carregar(); }, [unidade]); // eslint-disable-line react-hooks/exhaustive-deps
  const futuros = (l ?? []).filter((p) => fimPacote(p) > hoje());
  const grupos = futuros.reduce<Map<string, Pacote[]>>((m, p) => m.set(`${p.ativo}|${p.checkin}|${p.nome}`, [...(m.get(`${p.ativo}|${p.checkin}|${p.nome}`) ?? []), p]), new Map());
  const set = (k: keyof FormPacote) => (v: string | boolean) => { setF((x) => x && { ...x, [k]: v }); setMsg(null); };

  async function gravar(p: Omit<Pacote, 'id'> & { id?: number }, ok: string) {
    setOcupado(true);
    const r = await salvarPacote(unidade, p);
    if (!r.ok) { setOcupado(false); return setMsg({ t: r.erro, erro: true }); }
    await carregar(); await onMudou(); setOcupado(false);
    setF(null); setMsg({ t: ok });
  }
  const salvar = () => f && void gravar({ id: f.id, nome: f.nome, checkin: f.checkin, noites: Number(f.noites), total: num(f.total) ?? 0, ativo: f.ativo }, 'Pacote salvo. Já vale no site.');

  return (
    <section className={`${card} flex min-w-0 flex-col gap-4 p-4`} aria-label="Pacotes">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-serif text-[1.125rem] font-medium text-fg-1"><Icon icon="solar:ticket-linear" width={20} className="text-pine" aria-hidden="true" />Pacotes</h2>
          <p className="text-[0.75rem] text-fg-3">Preço final para um check-in e um número de noites. Nas noites do pacote o site vende só as opções cadastradas e oferece a opção mais longa a quem escolher a mais curta.</p>
        </div>
        {!f && <button type="button" className={`${btnSecondary} !w-auto`} onClick={() => { setF({ ...PACOTE_VAZIO }); setMsg(null); }}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Novo pacote</button>}
      </div>

      {msg && (
        <p role={msg.erro ? 'alert' : 'status'} className={`flex items-center gap-2 rounded-md border p-3 text-[0.8125rem] ${msg.erro ? 'border-error text-error' : 'border-available font-medium text-available'}`}>
          <Icon icon={msg.erro ? 'solar:danger-circle-linear' : 'solar:check-circle-bold'} width={18} className="shrink-0" aria-hidden="true" />{msg.t}
        </p>
      )}

      {f && (
        <form className="flex flex-col gap-3 rounded-md border border-line-2 p-3" onSubmit={(e) => { e.preventDefault(); salvar(); }} noValidate aria-label={f.id ? 'Alterar pacote' : 'Novo pacote'}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={rot}>Nome<input className={campo} value={f.nome} onChange={(e) => set('nome')(e.target.value)} placeholder="ex.: Natal 2026" maxLength={60} /></label>
            <label className={rot}>Check-in<input type="date" className={campo} value={f.checkin} min={hoje()} onChange={(e) => set('checkin')(e.target.value)} /></label>
            <label className={rot}>Noites<input inputMode="numeric" className={campo} value={f.noites} onChange={(e) => set('noites')(e.target.value)} placeholder="ex.: 3" /></label>
            <label className={rot}>Valor total (R$)<input inputMode="decimal" className={campo} value={f.total} onChange={(e) => set('total')(e.target.value)} placeholder="ex.: 2400" /></label>
          </div>
          {f.checkin && Number(f.noites) >= 1 && <p className="text-[0.75rem] text-fg-3">Check-out em {dataLonga(somar(f.checkin, Number(f.noites)))}. O valor é para os adultos inclusos na tarifa; criança e adulto extra somam por noite e a taxa de limpeza continua à parte.</p>}
          <p className="text-[0.75rem] text-fg-3">Para dar mais de uma opção (3 e 4 noites), cadastre um pacote para cada, com o mesmo check-in.</p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={`${btnPrimary} max-sm:flex-1 sm:!w-auto`} disabled={ocupado}><Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />{ocupado ? 'Salvando…' : 'Salvar pacote'}</button>
            <button type="button" className={`${btnSecondary} max-sm:flex-1 sm:!w-auto`} disabled={ocupado} onClick={() => { setF(null); setMsg(null); }}>Cancelar</button>
          </div>
        </form>
      )}

      {erro ? <Falha texto="Não foi possível carregar os pacotes." tentar={() => void carregar()} /> : !l ? <div className="h-16 animate-pulse rounded-md bg-cream" aria-busy="true" /> : grupos.size === 0 ? (
        <p className="rounded-md border border-dashed border-line-2 p-4 text-center text-[0.8125rem] text-fg-2">Nenhum pacote cadastrado.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {[...grupos.values()].map((g) => (
            <li key={`${g[0].ativo}${g[0].checkin}${g[0].nome}`} className={`flex flex-col gap-2 rounded-md border border-line-1 p-3 ${g[0].ativo ? '' : 'opacity-60'}`}>
              <p className="flex flex-wrap items-baseline gap-x-2 text-[0.875rem]"><span className="font-medium text-fg-1">{g[0].nome}</span><span className="text-fg-3">check-in {ucf(diaSemana(g[0].checkin))}, {dataCurta(g[0].checkin)}</span>{!g[0].ativo && <span className="text-[0.75rem] text-fg-3">· inativo</span>}</p>
              <ul className="flex flex-col divide-y divide-line-1">
                {g.map((p, i) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="text-[0.8125rem] text-fg-2">{p.noites} {p.noites === 1 ? 'noite' : 'noites'} · saída {dataCurta(fimPacote(p))}
                      {i > 0 && g[i - 1].ativo && <span className="ml-1.5 text-[0.75rem] text-pine">+ {brl(p.total - g[i - 1].total)} pela {p.noites - g[i - 1].noites === 1 ? 'noite extra' : 'diferença'}</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-[0.875rem] font-medium text-fg-1">{brl(p.total)}</span>
                      <button type="button" aria-label={`Alterar ${p.nome}, ${p.noites} noites`} title="Alterar" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream"
                        onClick={() => { setF({ id: p.id, nome: p.nome, checkin: p.checkin, noites: String(p.noites), total: String(p.total).replace('.', ','), ativo: p.ativo }); setMsg(null); }}>
                        <Icon icon="solar:pen-linear" width={18} aria-hidden="true" />
                      </button>
                      <button type="button" disabled={ocupado} className="min-h-11 rounded-md px-2 text-[0.75rem] text-pine underline underline-offset-4 disabled:opacity-40"
                        onClick={() => void gravar({ ...p, ativo: !p.ativo }, p.ativo ? 'Pacote desativado: as noites voltam à diária.' : 'Pacote ativado.')}>{p.ativo ? 'Desativar' : 'Ativar'}</button>
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────

function Contador({ rotulo, dica, valor, min, max, onChange }: { rotulo: string; dica?: string; valor: number; min: number; max: number; onChange: (n: number) => void }) {
  const b = 'flex h-11 w-11 items-center justify-center rounded-full border border-line-2 text-[1.125rem] text-fg-1 transition-colors duration-fast hover:border-fg-1 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0"><p className="text-[0.875rem] text-fg-1">{rotulo}</p>{dica && <p className="text-[0.75rem] text-fg-3">{dica}</p>}</div>
      <div className="flex items-center gap-2">
        <button type="button" className={b} aria-label={`Menos ${rotulo.toLowerCase()}`} title={`Menos ${rotulo.toLowerCase()}`} disabled={valor <= min} onClick={() => onChange(valor - 1)}>−</button>
        <span className="w-6 text-center font-mono text-[0.9375rem]" aria-live="polite">{valor}</span>
        <button type="button" className={b} aria-label={`Mais ${rotulo.toLowerCase()}`} title={`Mais ${rotulo.toLowerCase()}`} disabled={valor >= max} onClick={() => onChange(valor + 1)}>+</button>
      </div>
    </div>
  );
}

const proximaSexta = () => { let d = hoje(); while (noon(d).getDay() !== 5) d = somar(d, 1); return d; };

/** T40 — Simulador de preço: a mesma conta do site (calcular_estadia), noite a noite, para conferir uma tarifa ou um ajuste antes de contar com ele. Não grava nada. */
export function T40Simulador() {
  const perfil = usePerfilPermitido(PERFIS_PRECO);
  const [entrada, setEntrada] = useState(proximaSexta);
  const [saida, setSaida] = useState(() => somar(proximaSexta(), 2));
  const [h, setH] = useState<Hospedes>({ adultos: 2, criancas: 0, criancasMaiores: 0, bebes: 0 });
  const un = useUnidades(!!perfil);
  const u = un.atual;
  const [r, setR] = useState<Estadia | null>(null);
  const [erro, setErro] = useState(false);
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!u) return;
    let vivo = true; setErro(false);
    const t = setTimeout(() => { calcularEstadia(u, entrada, saida, h).then((x) => vivo && setR(x)).catch(() => vivo && setErro(true)); }, REAL ? 250 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [u, entrada, saida, h, vez]);
  if (!perfil) return null;
  const set = (k: keyof Hospedes) => (n: number) => setH({ ...h, [k]: n });
  const outros = (u?.maxCriancas ?? 0) - h.criancas - h.criancasMaiores - h.bebes;
  const mudarEntrada = (v: string) => { setEntrada(v); if (v && (!saida || saida <= v)) setSaida(somar(v, 2)); };

  return (
    <GestaoShell eyebrow="Administração" titulo="Simulador de preço">
      <AvisoPrototipo />
      {un.erro ? <Falha tentar={un.tentarDeNovo} /> : !un.lista ? <Carregando /> : !u ? <SemChale /> : (
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
        <form className={`${card} flex flex-col gap-4 p-4`} onSubmit={(e) => e.preventDefault()} aria-label="Dados da estadia">
          <Seletor rotulo="Chalé" valor={String(u.id)} onChange={(v) => { un.escolher(v); setH({ adultos: 2, criancas: 0, criancasMaiores: 0, bebes: 0 }); }} opcoes={un.opcoes} icone="solar:home-2-linear" />
          <div className="grid grid-cols-2 gap-3">
            <label className={rot}>Entrada<input type="date" className={campo} value={entrada} min={hoje()} onChange={(e) => mudarEntrada(e.target.value)} /></label>
            <label className={rot}>Saída<input type="date" className={campo} value={saida} min={entrada ? somar(entrada, 1) : hoje()} onChange={(e) => setSaida(e.target.value)} /></label>
          </div>
          <div className="flex flex-col gap-3 border-t border-line-1 pt-3">
            <Contador rotulo="Adultos" dica={`até ${u.maxAdultos}`} valor={h.adultos} min={1} max={u.maxAdultos} onChange={set('adultos')} />
            <Contador rotulo="Crianças de 5 a 8 anos" valor={h.criancas} min={0} max={h.criancas + Math.max(outros, 0)} onChange={set('criancas')} />
            <Contador rotulo="Crianças de 9 a 13 anos" valor={h.criancasMaiores} min={0} max={h.criancasMaiores + Math.max(outros, 0)} onChange={set('criancasMaiores')} />
            <Contador rotulo="Até 4 anos" dica="não pagam, mas ocupam vaga" valor={h.bebes} min={0} max={h.bebes + Math.max(outros, 0)} onChange={set('bebes')} />
          </div>
          <p className="text-[0.75rem] text-fg-3">O chalé comporta {u.maxHospedes} hóspedes: {u.maxAdultos} adultos e até {u.maxCriancas} crianças ou bebês. Estadia de 1 a {u.maxNoites} noites.</p>
        </form>

        <section className="flex min-w-0 flex-col gap-4" aria-label="Resultado" aria-live="polite">
          {erro ? <Falha texto="Não foi possível calcular agora. Verifique a conexão." tentar={() => setVez((n) => n + 1)} /> : !r ? <Carregando /> : (<>
          <div className={`${card} flex flex-col gap-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`inline-flex items-center gap-1.5 text-[0.8125rem] font-medium ${r.disponivel ? 'text-available' : 'text-warning'}`}>
                <Icon icon={r.disponivel ? 'solar:check-circle-linear' : 'solar:danger-circle-linear'} width={18} aria-hidden="true" />
                {r.disponivel ? 'Venda liberada no site' : 'O site não vende esta estadia'}
              </span>
              {r.noites > 0 && <span className="text-[0.75rem] text-fg-3">{r.noites} {r.noites === 1 ? 'noite' : 'noites'}{r.minNoites ? ` · mínimo ${r.minNoites}` : ''}</span>}
            </div>
            {r.motivo && <p className="text-[0.8125rem] text-fg-2">{MOTIVOS[r.motivo]}{r.motivo === 'capacidade' ? ` Até ${u.maxAdultos} adultos, ${u.maxCriancas} crianças e ${u.maxHospedes} hóspedes.` : r.motivo === 'estadia_longa' ? ` Máximo de ${u.maxNoites} noites.` : ''} {(r.motivo === 'min_noites' || r.motivo === 'sem_chegada' || r.motivo === 'sem_saida' || r.motivo === 'fechado') && <Link to={`/admin/precos?mes=${entrada.slice(0, 7)}`} className="text-pine underline underline-offset-4">Ver no calendário</Link>}{r.motivo === 'sem_tarifa' && <Link to="/admin/tarifas" className="text-pine underline underline-offset-4">Ver tarifas</Link>}</p>}
            {r.detalhe.length > 0 && (
              <>
                <TabelaResp<Noite> rows={r.detalhe} cols={[
                  { h: 'Noite', principal: true, r: (n) => <span>{ucf(diaSemana(n.data))}, {dataCurta(n.data)}</span> },
                  { h: 'Tarifa', r: (n) => <span className="text-fg-2">{n.tarifa ?? <span className="text-warning">sem tarifa</span>}{n.ajustada && <span className="ml-1.5 rounded-full bg-warning-bg px-2 py-0.5 text-[0.6875rem] text-warning">{n.obs || 'ajuste'}</span>}</span> },
                  { h: 'Valor da noite', r: (n) => <span className="font-mono">{n.tarifa || n.ajustada ? brl(n.base) : '—'}</span> },
                  { h: 'Extras', r: (n) => <span className="font-mono text-fg-2">{n.extras ? `+ ${brl(n.extras)}` : '—'}</span> },
                  { h: 'Total da noite', r: (n) => <span className="font-mono font-medium">{n.tarifa || n.ajustada ? brl(n.total) : '—'}</span> },
                ]} />
                <dl className="ml-auto flex w-full max-w-sm flex-col gap-1.5 text-[0.8125rem]">
                  <div className="flex justify-between gap-3"><dt className="text-fg-3">Hospedagem</dt><dd className="font-mono text-fg-1">{brl(r.hospedagem)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-fg-3">Taxa de limpeza</dt><dd className="font-mono text-fg-1">{r.taxaLimpeza ? brl(r.taxaLimpeza) : 'não cobra'}</dd></div>
                  <div className="flex justify-between gap-3 border-t border-line-1 pt-2 text-[0.9375rem]"><dt className="font-medium text-fg-1">Total</dt><dd className="font-mono font-semibold text-fg-1">{brl(r.total)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-fg-3">Sinal pelo Pix ({u.percentualSinal}%)</dt><dd className="font-mono text-fg-1">{brl(r.sinal)}</dd></div>
                </dl>
              </>
            )}
          </div>
          <p className="text-[0.75rem] text-fg-3">A conta é a do site: vale o ajuste do dia e, sem ele, a tarifa de maior prioridade. Aqui é só conferência: nada é reservado nem gravado.</p>
          </>)}
        </section>
      </div>
      )}
    </GestaoShell>
  );
}
