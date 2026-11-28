import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chips, Seletor } from '../components/Filtros';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { hoje } from '../lib/campo';
import { DIAS_PADRAO, SEMANA_ISO, alternarTarifa, brl, dataLonga, listarTarifas, obterTarifa, rotuloDias, salvarTarifa, somar, tarifaDe, validarTarifa, type Tarifa } from '../lib/precos';
import { useUnidades } from '../lib/usePrecos';
import { usePerfilPermitido } from '../lib/useAdmin';
import { AbasPrecos, AvisoPrototipo, Carregando, Falha, SemChale, campo, num, rot } from './Precos';

type Filtro = 'todas' | 'ativas' | 'inativas';
const ultimaNoite = (t: Tarifa) => somar(t.fim, -1);

/** T39 — Tarifas por período: o valor-base de cada época. Só o ADMIN altera; desativar tira de venda sem perder o histórico. */
export function T39Tarifas() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const [ts, setTs] = useState<Tarifa[] | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [erro, setErro] = useState('');
  const [falhou, setFalhou] = useState(false);
  const un = useUnidades(!!perfil);
  const uid = un.atual?.id;
  const carregar = () => {
    if (uid === undefined) return Promise.resolve();
    setFalhou(false);
    return listarTarifas(uid).then(setTs).catch(() => setFalhou(true));
  };
  useEffect(() => { setTs(null); void carregar(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!perfil) return null;

  const vigente = tarifaDe(hoje())?.id;
  const lista = (ts ?? []).filter((t) => filtro === 'todas' || (filtro === 'ativas') === t.ativo);
  async function alternar(id: number) {
    setErro('');
    const r = await alternarTarifa(id);
    if (!r.ok) return setErro(r.erro);
    void carregar();
  }

  return (
    <GestaoShell eyebrow="Cadastros · Site" titulo="Preços"
      acoes={<Link to="/admin/tarifas/nova" className={`${btnPrimary} !w-auto`}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Nova tarifa</Link>}>
      <AbasPrecos />
      <AvisoPrototipo />
      <p className="max-w-3xl text-[0.8125rem] text-fg-3">
        Cada tarifa vale para um período e define o valor da noite para o casal. Quando duas tarifas cobrem a mesma noite, vale a de <strong className="font-medium text-fg-2">maior prioridade</strong>.
        Um ajuste de um dia, feito no <Link to="/admin/precos" className="text-pine underline underline-offset-4">calendário de preços</Link>, vale mais do que qualquer tarifa.
      </p>
      {un.erro || falhou ? <Falha tentar={() => { un.erro ? un.tentarDeNovo() : void carregar(); }} /> : !un.lista ? <Carregando /> : !un.atual ? <SemChale /> : (<>
      <div className="flex flex-wrap items-center gap-3">
        <Seletor rotulo="Chalé" valor={String(un.atual.id)} onChange={un.escolher} opcoes={un.opcoes} icone="solar:home-2-linear" className="min-w-0 sm:w-64" />
        <Chips rotulo="Situação" valor={filtro} onChange={setFiltro} opcoes={[{ valor: 'todas', label: 'Todas' }, { valor: 'ativas', label: 'Ativas' }, { valor: 'inativas', label: 'Inativas' }]} />
      </div>
      {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
      {!ts ? <Carregando />
        : lista.length === 0 ? <p className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhuma tarifa neste filtro.</p>
        : (
          <TabelaResp<Tarifa> rows={lista} cols={[
            { h: 'Tarifa', principal: true, r: (t) => (<>
              <Link to={`/admin/tarifas/${t.id}`} className="font-medium text-pine underline-offset-4 hover:underline">{t.nome}</Link>
              <div className="text-[0.75rem] text-fg-3">Prioridade {t.prioridade}{t.id === vigente && <span className="ml-2 rounded-full bg-available/10 px-2 py-0.5 text-[0.6875rem] text-available">vale hoje</span>}</div>
            </>) },
            { h: 'Período', r: (t) => <span className="text-fg-2">{dataLonga(t.ini)} a {dataLonga(ultimaNoite(t))}</span> },
            { h: 'Valor da noite', r: (t) => (
              <span className="flex flex-col items-end gap-0.5 md:items-start">
                {t.valorFds === null || t.diasFds.length === 0 ? <span><span className="font-mono">{brl(t.valorNoite)}</span> <span className="text-[0.75rem] text-fg-3">todos os dias</span></span> : (<>
                  {t.diasFds.length < 7 && <span><span className="font-mono">{brl(t.valorNoite)}</span> <span className="text-[0.75rem] text-fg-3">{rotuloDias([1, 2, 3, 4, 5, 6, 7].filter((d) => !t.diasFds.includes(d)))}</span></span>}
                  <span><span className="font-mono">{brl(t.valorFds)}</span> <span className="text-[0.75rem] text-fg-3">{rotuloDias(t.diasFds)}</span></span>
                </>)}
              </span>) },
            { h: 'Mínimo', r: (t) => `${t.minNoites} ${t.minNoites === 1 ? 'noite' : 'noites'}` },
            { h: 'Situação', r: (t) => (
              <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                <span className={`inline-flex items-center gap-1 text-[0.75rem] font-medium ${t.ativo ? 'text-available' : 'text-fg-3'}`}><Icon icon={t.ativo ? 'solar:check-circle-linear' : 'solar:forbidden-circle-linear'} width={16} aria-hidden="true" />{t.ativo ? 'Ativa' : 'Inativa'}</span>
                <button type="button" onClick={() => void alternar(t.id)} className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4">{t.ativo ? 'Desativar' : 'Ativar'}</button>
              </span>) },
          ]} />
        )}
      </>)}
    </GestaoShell>
  );
}

const vazia = (): Omit<Tarifa, 'id'> => ({
  nome: '', ini: hoje(), fim: somar(hoje(), 30), prioridade: 1, valorNoite: 800, valorFds: 1700, adultosInclusos: 2, adultoExtra: 0,
  pcCrianca: 30, pcCriancaMaior: 100, pcBebe: 0, minNoites: 2, ativo: true, diasFds: [...DIAS_PADRAO],
});

const TODOS = [1, 2, 3, 4, 5, 6, 7];
const PRIORIDADES = [
  { v: 0, l: '0 · Base (o ano todo)' }, { v: 1, l: '1 · Temporada' }, { v: 2, l: '2 · Feriado ou evento' },
  ...[3, 4, 5, 6, 7, 8, 9].map((v) => ({ v, l: String(v) })),
];
const curto = 'min-h-10 w-full rounded-md border border-line-2 bg-white px-3 text-[0.875rem] text-fg-1 placeholder:text-fg-4 focus:border-pine focus:outline-none disabled:bg-cream disabled:text-fg-4';
const rotC = 'flex min-w-0 flex-col gap-1 text-[0.6875rem] uppercase tracking-[0.06em] text-fg-2';
const secao = 'font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2';

/** Dias da semana (domingo a sábado) como caixinhas de marcar. */
function Dias({ marcados, onTrocar, rotulo }: { marcados: number[]; onTrocar: (iso: number) => void; rotulo: string }) {
  return (
    <div role="group" aria-label={rotulo} className="flex flex-wrap gap-1">
      {SEMANA_ISO.map((d) => {
        const on = marcados.includes(d.iso);
        return (
          <label key={d.iso} title={d.nome} className={`flex h-10 w-10 cursor-pointer select-none items-center justify-center rounded-full border text-[0.8125rem] font-medium transition-colors duration-fast has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine ${on ? 'border-pine bg-pine text-white' : 'border-line-2 bg-white text-fg-3 hover:border-fg-3'}`}>
            <input type="checkbox" className="sr-only" checked={on} onChange={() => onTrocar(d.iso)} aria-label={`${d.nome} (${rotulo})`} />{d.curto}
          </label>
        );
      })}
    </div>
  );
}

/** T41 — Formulário de tarifa: período, valores por dia da semana, crianças e mínimo de noites. Mostra um exemplo de conta antes de salvar. */
export function T41FormTarifa() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const navigate = useNavigate();
  const { id } = useParams();
  const nova = id === 'nova';
  const [t, setT] = useState<Omit<Tarifa, 'id'> & { id?: number }>(vazia);
  const [ate, setAte] = useState(() => somar(vazia().fim, -1));
  const [v2, setV2] = useState('');                       // segundo valor (texto do campo)
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const un = useUnidades(!!perfil);
  const uid = un.atual?.id;
  useEffect(() => {
    if (uid === undefined) return;
    // carrega as tarifas do chalé (a conferência de sobreposição usa a lista) e, na edição, abre a escolhida
    listarTarifas(uid).then(() => {
      if (nova) { setV2('1700'); return setPronto(true); }
      const x = obterTarifa(Number(id));
      if (!x) return setErro('Tarifa não encontrada neste chalé.');
      const semV2 = x.valorFds === null;
      setT({ ...x, diasFds: semV2 ? [] : x.diasFds }); setAte(ultimaNoite(x)); setV2(semV2 ? '' : String(x.valorFds).replace('.', ',')); setPronto(true);
    }).catch(() => setErro('Não foi possível carregar a tarifa. Verifique a conexão.'));
  }, [uid, id, nova]);
  if (!perfil) return null;

  const dias1 = TODOS.filter((d) => !t.diasFds.includes(d));
  const temV2 = t.diasFds.length > 0;
  const atual = { ...t, fim: ate ? somar(ate, 1) : '', valorFds: temV2 ? num(v2) ?? -1 : null, diasFds: temV2 ? t.diasFds : [...DIAS_PADRAO] };
  const erros = validarTarifa(atual).map((e) => e.replace('Valor de fim de semana inválido.', 'Informe o valor da noite dos dias do segundo grupo.'));
  if (temV2 && dias1.length === 0 && !erros.length) erros.push('Deixe ao menos um dia no primeiro valor, ou desmarque os dias do segundo.');
  const campoNum = (k: 'valorNoite' | 'adultoExtra' | 'pcCrianca' | 'pcCriancaMaior' | 'pcBebe' | 'adultosInclusos' | 'minNoites', extra = {}) =>
    ({ inputMode: 'decimal' as const, className: curto, value: String(t[k]).replace('.', ','), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setT({ ...t, [k]: num(e.target.value) ?? 0 }), ...extra });
  // um dia sai de um grupo e entra no outro
  const trocar = (iso: number) => setT({ ...t, diasFds: t.diasFds.includes(iso) ? t.diasFds.filter((d) => d !== iso) : [...t.diasFds, iso] });

  // exemplo: casal + 1 criança de 5 a 8 anos
  const porPessoa = (v: number) => (t.adultosInclusos >= 1 ? v / t.adultosInclusos : v);
  const exemplo = (v: number) => v + Math.round(porPessoa(v) * t.pcCrianca) / 100;

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (erros.length) return;
    setSalvando(true); setErro('');
    const r = await salvarTarifa(uid!, atual);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro);
    navigate('/admin/tarifas');
  }

  return (
    <GestaoShell eyebrow="Cadastros · Site · Preços" titulo={nova ? 'Nova tarifa' : t.nome || 'Tarifa'}>
      <AvisoPrototipo />
      {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
      {un.erro ? <Falha tentar={un.tentarDeNovo} /> : un.lista && !un.atual ? <SemChale /> : !pronto && !erro ? <Carregando /> : null}
      {pronto && un.atual && (
        <form className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,46rem)_minmax(0,18rem)] xl:items-start" onSubmit={salvar} noValidate>
          <div className={`${card} flex min-w-0 flex-col gap-5 p-4 sm:p-5`}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_9.5rem_9.5rem]">
              <label className={`${rotC} col-span-2 sm:col-span-1`}>Nome
                <input className={curto} value={t.nome} onChange={(e) => setT({ ...t, nome: e.target.value })} placeholder="ex.: Alta temporada de julho" maxLength={60} />
              </label>
              <label className={rotC}>Data início<input type="date" className={curto} value={t.ini} onChange={(e) => setT({ ...t, ini: e.target.value })} /></label>
              <label className={rotC}>Data fim<input type="date" className={curto} value={ate} min={t.ini} onChange={(e) => setAte(e.target.value)} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[9.5rem_minmax(0,15rem)]">
              <label className={rotC}>Mínimo de noites<input {...campoNum('minNoites', { inputMode: 'numeric' })} /></label>
              <label className={rotC}>Prioridade
                <select className={curto} value={t.prioridade} onChange={(e) => setT({ ...t, prioridade: Number(e.target.value) })}>
                  {(PRIORIDADES.some((p) => p.v === t.prioridade) ? PRIORIDADES : [...PRIORIDADES, { v: t.prioridade, l: String(t.prioridade) }]).map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </label>
              <p className="col-span-2 text-[0.75rem] text-fg-3">Prioridade decide qual tarifa vale quando duas cobrem a mesma data: vale a de número maior. Ex.: a Base (0) cobre o ano; a de Carnaval (2) passa por cima dela só nos dias do Carnaval.</p>
            </div>

            <fieldset className="flex flex-col gap-3 border-t border-line-1 pt-4">
              <legend className={`${secao} float-left mb-1 w-full`}>Valor da noite para o casal (R$)</legend>
              <p className="text-[0.75rem] text-fg-3">Marque os dias de cada valor. Tocar num dia passa ele de um valor para o outro.</p>
              <div className="flex flex-wrap items-end gap-3">
                <Dias marcados={dias1} onTrocar={trocar} rotulo="dias do valor 1" />
                <label className={`${rotC} w-44`}>{rotuloDias(dias1)}<input {...campoNum('valorNoite')} aria-label={`Valor da noite: ${rotuloDias(dias1)}`} /></label>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Dias marcados={t.diasFds} onTrocar={trocar} rotulo="dias do valor 2" />
                <label className={`${rotC} w-44`}>{temV2 ? rotuloDias(t.diasFds) : 'sem segundo valor'}
                  <input inputMode="decimal" className={curto} value={temV2 ? v2 : ''} disabled={!temV2} placeholder={temV2 ? 'ex.: 1700' : '—'} onChange={(e) => setV2(e.target.value)} aria-label={`Valor da noite: ${rotuloDias(t.diasFds)}`} />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-[9.5rem_11rem]">
                <label className={rotC}>Adultos inclusos<input {...campoNum('adultosInclusos', { inputMode: 'numeric' })} /></label>
                <label className={rotC}>Adulto extra (R$/noite)<input {...campoNum('adultoExtra')} /></label>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3 border-t border-line-1 pt-4">
              <legend className={`${secao} float-left mb-1 w-full`}>Crianças: % do valor por pessoa</legend>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-[7.5rem_7.5rem_7.5rem]">
                <label className={rotC}>Até 4 anos<input {...campoNum('pcBebe')} aria-label="Até 4 anos (%)" /></label>
                <label className={rotC}>5 a 8 anos<input {...campoNum('pcCrianca')} aria-label="5 a 8 anos (%)" /></label>
                <label className={rotC}>9 a 13 anos<input {...campoNum('pcCriancaMaior')} aria-label="9 a 13 anos (%)" /></label>
              </div>
              <p className="text-[0.75rem] text-fg-3">De 14 anos em diante conta como adulto. Valor por pessoa = valor da noite ÷ adultos inclusos.</p>
            </fieldset>

            <label className="flex min-h-11 items-center gap-2 border-t border-line-1 pt-4 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={t.ativo} onChange={(e) => setT({ ...t, ativo: e.target.checked })} />Tarifa ativa (à venda no site)</label>

            {erros.length > 0 && <ul className="flex flex-col gap-1 text-[0.8125rem] text-warning" role="alert">{erros.map((x) => <li key={x} className="flex items-start gap-1.5"><Icon icon="solar:danger-circle-linear" width={16} className="mt-0.5 shrink-0" aria-hidden="true" />{x}</li>)}</ul>}
            <div className="flex flex-wrap gap-3">
              <button type="button" className={`${btnSecondary} max-sm:flex-1 sm:!w-auto`} onClick={() => navigate('/admin/tarifas')}>Cancelar</button>
              <button type="submit" className={`${btnPrimary} max-sm:flex-1 sm:!w-auto`} disabled={erros.length > 0 || salvando}><Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />{salvando ? 'Salvando…' : 'Salvar tarifa'}</button>
            </div>
          </div>

          <aside className={`${card} flex flex-col gap-3 p-4`} aria-label="Exemplo de conta">
            <h2 className={secao}>Exemplo de conta</h2>
            <p className="text-[0.75rem] text-fg-3">{un.atual.nome} · casal com 1 criança de 5 a 8 anos, por noite.</p>
            <dl className="flex flex-col gap-1.5 text-[0.8125rem]">
              {dias1.length > 0 && <div className="flex justify-between gap-3"><dt className="text-fg-3">{rotuloDias(dias1)}</dt><dd className="font-mono text-fg-1">{brl(exemplo(t.valorNoite))}</dd></div>}
              {temV2 && <div className="flex justify-between gap-3"><dt className="text-fg-3">{rotuloDias(t.diasFds)}</dt><dd className="font-mono text-fg-1">{brl(exemplo(num(v2) ?? 0))}</dd></div>}
            </dl>
            <p className="text-[0.75rem] text-fg-3">Confira também no <Link to="/admin/simulador" className="text-pine underline underline-offset-4">simulador de preço</Link> depois de salvar.</p>
          </aside>
        </form>
      )}
    </GestaoShell>
  );
}
