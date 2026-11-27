import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Chips, Seletor } from '../components/Filtros';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { hoje } from '../lib/campo';
import {
  MOTIVOS, REAL, ajusteDe, brl, brlCurto, calcularEstadia, carregarMes, dataCurta, diaDe, diaSemana, mesAno, noites, noon, removerAjustes, salvarAjustes, somar, tarifaDe,
  type Dia, type Estadia, type Hospedes, type Noite, type Unidade,
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
    x.ocupacao ? x.ocupacao.rotulo : '', x.fechado ? 'fechado para venda' : '', x.ajustado ? 'com ajuste' : '',
  ].filter(Boolean).join(', ');
}

/** T38 — Calendário de preços: o mês como o cliente vê no site. Clique em um dia (ou intervalo) para ajustar valor, mínimo de noites e fechamento. */
export function T38Calendario() {
  const perfil = usePerfilPermitido(PERFIS_PRECO);
  const [params] = useSearchParams();
  const h = hoje();
  const [mes, setMes] = useState(primeiroDia(/^\d{4}-\d{2}$/.test(params.get('mes') ?? '') ? `${params.get('mes')}-01` : h));
  const [modo, setModo] = useState<'dia' | 'intervalo'>('dia');
  const [sel, setSel] = useState<{ ini: string; fim: string } | null>(null);
  const [aguardaFim, setAguardaFim] = useState(false);
  const [, rever] = useState(0);
  const [carga, setCarga] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const un = useUnidades(!!perfil);
  const uid = un.atual?.id;
  const painel = useRef<HTMLElement>(null);
  useEffect(() => { if (sel && matchMedia('(max-width: 1023px)').matches) painel.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [sel]);
  const carregar = () => {
    if (uid === undefined) return Promise.resolve();
    setCarga('carregando');
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
  const noitesSel = sel ? Array.from({ length: noites(sel.ini, sel.fim) + 1 }, (_, i) => somar(sel.ini, i)) : [];

  function escolher(d: string) {
    if (modo === 'dia') return setSel({ ini: d, fim: d });
    if (!aguardaFim || !sel) { setSel({ ini: d, fim: d }); return setAguardaFim(true); }
    setSel(d < sel.ini ? { ini: d, fim: sel.ini } : { ini: sel.ini, fim: d });
    setAguardaFim(false);
  }

  return (
    <GestaoShell eyebrow="Administração" titulo="Calendário de preços">
      <AvisoPrototipo />
      {un.erro || carga === 'erro' ? <Falha tentar={() => { un.erro ? un.tentarDeNovo() : void carregar(); }} /> : !un.lista ? <Carregando /> : !un.atual ? <SemChale /> : (<>
      <div className="flex flex-wrap items-center gap-3">
        <Seletor rotulo="Chalé" valor={String(un.atual.id)} onChange={(v) => { un.escolher(v); setSel(null); setAguardaFim(false); }} opcoes={un.opcoes} icone="solar:home-2-linear" className="min-w-0 sm:w-64" />
        <Chips rotulo="O que selecionar" valor={modo} onChange={(v) => { setModo(v); setSel(null); setAguardaFim(false); }}
          opcoes={[{ valor: 'dia', label: 'Um dia' }, { valor: 'intervalo', label: 'Intervalo' }]} />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:items-start">
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

          <div className="grid grid-cols-7 gap-1" role="grid" aria-label={mesAno(mes)}>
            {SEMANA.map((s) => <span key={s} className="py-1 text-center text-[0.6875rem] text-fg-3" role="columnheader">{s}</span>)}
            {grade.map((d, i) => {
              if (!d) return <span key={`v${i}`} aria-hidden="true" />;
              const x = diaDe(d);
              const passado = d < h;
              const dentro = !!sel && d >= sel.ini && d <= sel.fim;
              const ponta = !!sel && (d === sel.ini || d === sel.fim);
              const fds = [0, 5, 6].includes(noon(d).getDay());
              return (
                <button key={d} type="button" role="gridcell" disabled={passado} onClick={() => escolher(d)} aria-label={descricaoDia(x)} aria-selected={dentro}
                  className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 py-1 text-center transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-35
                    ${ponta ? 'border-pine bg-pine/10' : dentro ? 'border-pine/40 bg-pine/5' : 'border-transparent hover:border-line-2 hover:bg-cream'}
                    ${x.fechado ? 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,var(--border-1)_5px_6px)]' : ''}`}>
                  <span className={`text-[0.75rem] leading-none ${d === h ? 'font-semibold text-pine underline underline-offset-4' : 'text-fg-2'}`}>{Number(d.slice(8))}</span>
                  {x.valor === null
                    ? <span className="font-mono text-[0.6875rem] text-fg-4">—</span>
                    : <span className={`font-mono text-[0.75rem] leading-none ${x.fechado || x.ocupacao ? 'text-fg-4 line-through' : fds ? 'font-semibold text-fg-1' : 'text-fg-2'}`}>{brlCurto(x.valor)}</span>}
                  <span className="flex h-3 items-center gap-1 text-[0.5625rem] leading-none text-fg-3">
                    {x.fechado ? <Icon icon="solar:forbidden-circle-linear" width={11} aria-hidden="true" />
                      : x.ocupacao ? <span className={x.ocupacao.tipo === 'reserva' ? 'text-pine' : 'text-warning'}>{x.ocupacao.tipo === 'reserva' ? 'reserva' : x.ocupacao.tipo === 'bloqueio' ? 'bloq.' : 'pré'}</span>
                      : x.minNoites > 2 ? <span className="hidden sm:inline">mín. {x.minNoites}</span> : null}
                    {x.ajustado && <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />}
                    {!x.fechado && !x.ocupacao && x.minNoites > 2 && <span className="sm:hidden">{x.minNoites}n</span>}
                  </span>
                </button>
              );
            })}
          </div>

          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line-1 pt-3 text-[0.6875rem] text-fg-3" aria-label="Legenda">
            <li className="flex items-center gap-1.5"><span className="font-mono font-semibold text-fg-1">1,7k</span> fim de semana</li>
            <li className="flex items-center gap-1.5"><span className="font-mono text-fg-2">800</span> domingo a quinta</li>
            <li className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" /> dia com ajuste</li>
            <li className="flex items-center gap-1.5"><span className="font-mono text-fg-4 line-through">800</span> ocupado ou fechado</li>
            <li className="flex items-center gap-1.5"><span className="font-mono"><span className="sm:hidden">3n</span><span className="hidden sm:inline">mín. 3</span></span> mínimo de noites (fora do padrão)</li>
          </ul>
        </section>

        <aside ref={painel} className={`${card} flex min-w-0 flex-col gap-4 p-4`} aria-label="Ajuste do dia">
          {!sel ? (
            <>
              <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">{ucf(mesAno(mes))}</h2>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-[0.8125rem]">
                <dt className="text-fg-3">Faixa de preço</dt><dd className="text-right font-mono text-fg-1">{resumo.faixa}</dd>
                <dt className="text-fg-3">Noites com ajuste</dt><dd className="text-right font-mono text-fg-1">{resumo.ajustadas || '—'}</dd>
                <dt className="text-fg-3">Noites fechadas</dt><dd className="text-right font-mono text-fg-1">{resumo.fechadas || '—'}</dd>
                <dt className="text-fg-3">Noites ocupadas</dt><dd className="text-right font-mono text-fg-1">{resumo.ocupadas || '—'}</dd>
              </dl>
              <p className="rounded-md bg-cream p-3 text-[0.8125rem] text-fg-2">
                {modo === 'dia' ? 'Toque em um dia para ajustar o valor, o mínimo de noites ou fechar a venda.' : 'Toque no primeiro e no último dia do intervalo. O ajuste vale para todas as noites escolhidas.'}
              </p>
              <p className="text-[0.75rem] text-fg-3">O valor padrão de cada período vem das <Link to="/admin/tarifas" className="text-pine underline underline-offset-4">tarifas</Link>. O ajuste de um dia vale mais do que a tarifa.</p>
            </>
          ) : (
            <PainelAjuste key={`${sel.ini}-${sel.fim}`} unidade={un.atual.id} noites={noitesSel} aguardaFim={aguardaFim} onFechar={() => { setSel(null); setAguardaFim(false); }} onSalvo={carregar} />
          )}
        </aside>
      </div>
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
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const comAjuste = ns.filter((d) => ajusteDe(d)).length;
  const ocupadas = ns.filter((d) => diaDe(d).ocupacao).length;
  const passou = ns.some((d) => d < hoje());

  async function salvar() {
    const r = await salvarAjustes(unidade, ns, { valor: num(valor), minNoites: num(min), fechado, semChegada, semSaida, obs: obs.trim() });
    if (!r.ok) return setMsg({ t: r.erro, erro: true });
    setMsg({ t: `Ajuste salvo em ${ns.length} ${um ? 'noite' : 'noites'}.` }); await onSalvo();
  }
  async function remover() {
    const r = await removerAjustes(unidade, ns);
    if (!r.ok) return setMsg({ t: r.erro, erro: true });
    setValor(''); setMin(''); setFechado(false); setSemChegada(false); setSemSaida(false); setObs('');
    setMsg({ t: 'Ajuste removido: volta a valer a tarifa.' }); await onSalvo();
  }

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-[1.125rem] font-medium text-fg-1">{um ? `${diaSemana(ns[0])}, ${dataCurta(ns[0])}` : `${dataCurta(ns[0])} a ${dataCurta(ns[ns.length - 1])}`}</h2>
          <p className="text-[0.75rem] text-fg-3">{um ? 'Noite que começa neste dia' : `${ns.length} noites`}{aguardaFim ? ' · toque no último dia' : ''}</p>
        </div>
        <button type="button" aria-label="Fechar painel" title="Fechar painel" onClick={onFechar} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fg-2 hover:bg-cream">
          <Icon icon="solar:close-circle-linear" width={20} aria-hidden="true" />
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[0.8125rem]">
        <dt className="text-fg-3">Tarifa</dt><dd className="text-right text-fg-1">{t ? t.nome : <span className="text-warning">sem tarifa</span>}</dd>
        {um && <><dt className="text-fg-3">Valor hoje</dt><dd className="text-right font-mono text-fg-1">{x.valor === null ? '—' : brl(x.valor)}</dd></>}
        {um && x.ocupacao && <><dt className="text-fg-3">Situação</dt><dd className="text-right text-warning">{x.ocupacao.rotulo}</dd></>}
      </dl>
      {ocupadas > 0 && <p role="note" className="flex items-start gap-2 text-[0.75rem] text-fg-2"><Icon icon="solar:danger-circle-linear" width={16} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />{um ? 'Há reserva ou bloqueio nesta noite.' : `${ocupadas} das noites têm reserva ou bloqueio.`} O ajuste vale só para vendas novas; reservas feitas não mudam de valor.</p>}
      {passou && <p role="alert" className="text-[0.75rem] text-error">Há noites que já passaram: o ajuste não se aplica a elas.</p>}

      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void salvar(); }} noValidate>
        <label className={rot}>Valor da noite (R$)
          <input inputMode="decimal" className={campo} value={valor} onChange={(e) => setValor(e.target.value)} placeholder={t ? `usar a tarifa · ${brl(x.valor ?? t.valorNoite)}` : 'ex.: 1700'} />
        </label>
        <label className={rot}>Mínimo de noites
          <input inputMode="numeric" className={campo} value={min} onChange={(e) => setMin(e.target.value)} placeholder={t ? `usar a tarifa · ${t.minNoites}` : 'ex.: 3'} />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={fechado} onChange={(e) => setFechado(e.target.checked)} />Fechar para venda</label>
        <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={semChegada} onChange={(e) => setSemChegada(e.target.checked)} />Não aceitar chegada neste dia</label>
        <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={semSaida} onChange={(e) => setSemSaida(e.target.checked)} />Não aceitar saída neste dia</label>
        <label className={rot}>Observação
          <input className={campo} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="ex.: Natal 2026" maxLength={80} />
        </label>
        {comAjuste > 0 && !um && <p className="text-[0.75rem] text-fg-3">{comAjuste} {comAjuste === 1 ? 'noite já tem' : 'noites já têm'} ajuste: salvar substitui.</p>}
        {msg && <p role={msg.erro ? 'alert' : 'status'} className={`text-[0.8125rem] ${msg.erro ? 'text-error' : 'text-available'}`}>{msg.t}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={`${btnPrimary} !w-auto`} disabled={aguardaFim || passou}><Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />Salvar ajuste</button>
          {comAjuste > 0 && <button type="button" className={`${btnSecondary} !w-auto`} onClick={() => void remover()}><Icon icon="solar:trash-bin-minimalistic-linear" width={18} aria-hidden="true" />Remover ajuste</button>}
        </div>
      </form>
    </>
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
