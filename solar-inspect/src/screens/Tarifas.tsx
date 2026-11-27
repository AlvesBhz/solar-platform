import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Chips, Seletor } from '../components/Filtros';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { hoje } from '../lib/campo';
import { alternarTarifa, brl, dataLonga, listarTarifas, obterTarifa, salvarTarifa, somar, tarifaDe, validarTarifa, type Tarifa } from '../lib/precos';
import { useUnidades } from '../lib/usePrecos';
import { usePerfilPermitido } from '../lib/useAdmin';
import { AvisoPrototipo, Carregando, Falha, SemChale, campo, num, rot } from './Precos';

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
    <GestaoShell eyebrow="Administração" titulo="Tarifas"
      acoes={<Link to="/admin/tarifas/nova" className={`${btnPrimary} !w-auto`}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Nova tarifa</Link>}>
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
            { h: 'Dom a qui', r: (t) => <span className="font-mono">{brl(t.valorNoite)}</span> },
            { h: 'Sex a dom', r: (t) => <span className="font-mono">{brl(t.valorFds ?? t.valorNoite)}</span> },
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
  pcCrianca: 30, pcCriancaMaior: 100, pcBebe: 0, minNoites: 2, ativo: true,
});

/** T41 — Formulário de tarifa: período, valores, crianças e mínimo de noites. Mostra um exemplo de conta para conferir antes de salvar. */
export function T41FormTarifa() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const navigate = useNavigate();
  const { id } = useParams();
  const nova = id === 'nova';
  const [t, setT] = useState<Omit<Tarifa, 'id'> & { id?: number }>(vazia);
  const [ate, setAte] = useState(() => somar(vazia().fim, -1));
  const [fdsIgual, setFdsIgual] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);
  const un = useUnidades(!!perfil);
  const uid = un.atual?.id;
  useEffect(() => {
    if (uid === undefined) return;
    // carrega as tarifas do chalé (a conferência de sobreposição usa a lista) e, na edição, abre a escolhida
    listarTarifas(uid).then(() => {
      if (nova) return setPronto(true);
      const x = obterTarifa(Number(id));
      if (!x) return setErro('Tarifa não encontrada neste chalé.');
      setT(x); setAte(ultimaNoite(x)); setFdsIgual(x.valorFds === null); setPronto(true);
    }).catch(() => setErro('Não foi possível carregar a tarifa. Verifique a conexão.'));
  }, [uid, id, nova]);
  if (!perfil) return null;

  const atual = { ...t, fim: ate ? somar(ate, 1) : '', valorFds: fdsIgual ? null : t.valorFds };
  const erros = validarTarifa(atual);
  const campoNum = (k: 'valorNoite' | 'valorFds' | 'adultoExtra' | 'pcCrianca' | 'pcCriancaMaior' | 'pcBebe' | 'adultosInclusos' | 'minNoites' | 'prioridade') =>
    ({ inputMode: 'decimal' as const, className: campo, value: t[k] === null ? '' : String(t[k]).replace('.', ','), onChange: (e: React.ChangeEvent<HTMLInputElement>) => setT({ ...t, [k]: num(e.target.value) ?? 0 }) });

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
    <GestaoShell eyebrow="Administração" titulo={nova ? 'Nova tarifa' : t.nome || 'Tarifa'}>
      <AvisoPrototipo />
      {erro && <p role="alert" className="text-sm text-error">{erro}</p>}
      {un.erro ? <Falha tentar={un.tentarDeNovo} /> : un.lista && !un.atual ? <SemChale /> : !pronto && !erro ? <Carregando /> : null}
      {pronto && un.atual && (
        <form className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:items-start" onSubmit={salvar} noValidate>
          <div className={`${card} grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-5 sm:grid-cols-2`}>
            <label className={`${rot} sm:col-span-2`}>Nome
              <input className={campo} value={t.nome} onChange={(e) => setT({ ...t, nome: e.target.value })} placeholder="ex.: Alta temporada de julho" maxLength={60} />
            </label>
            <label className={rot}>Primeira noite<input type="date" className={campo} value={t.ini} onChange={(e) => setT({ ...t, ini: e.target.value })} /></label>
            <label className={rot}>Última noite<input type="date" className={campo} value={ate} min={t.ini} onChange={(e) => setAte(e.target.value)} /></label>
            <label className={rot}>Prioridade
              <input inputMode="numeric" className={campo} value={String(t.prioridade)} onChange={(e) => setT({ ...t, prioridade: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
              <span className="normal-case tracking-normal text-fg-3">Maior número ganha quando duas tarifas cobrem a mesma noite.</span>
            </label>
            <label className={rot}>Mínimo de noites<input {...campoNum('minNoites')} inputMode="numeric" /></label>

            <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2 sm:col-span-2">Valor da noite para o casal (R$)</h2>
            <label className={rot}>Domingo a quinta<input {...campoNum('valorNoite')} /></label>
            <label className={rot}>Sexta a domingo
              <input {...campoNum('valorFds')} value={fdsIgual ? '' : t.valorFds === null ? '' : String(t.valorFds).replace('.', ',')} disabled={fdsIgual} placeholder={fdsIgual ? 'igual ao da semana' : ''} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem] sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-pine" checked={fdsIgual} onChange={(e) => { setFdsIgual(e.target.checked); setT({ ...t, valorFds: e.target.checked ? null : t.valorNoite }); }} />Sexta a domingo custa o mesmo que o resto da semana</label>
            <label className={rot}>Adultos inclusos no valor<input {...campoNum('adultosInclusos')} inputMode="numeric" /></label>
            <label className={rot}>Adulto extra, por noite (R$)<input {...campoNum('adultoExtra')} /></label>

            <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2 sm:col-span-2">Crianças: percentual do valor por pessoa</h2>
            <label className={rot}>Até 4 anos (%)<input {...campoNum('pcBebe')} /></label>
            <label className={rot}>5 a 8 anos (%)<input {...campoNum('pcCrianca')} /></label>
            <label className={rot}>9 a 13 anos (%)<input {...campoNum('pcCriancaMaior')} /></label>
            <p className="text-[0.75rem] text-fg-3 sm:col-span-2">A partir de 14 anos a pessoa conta como adulto. O valor por pessoa é o valor da noite dividido pelos adultos inclusos.</p>

            <label className="flex min-h-11 items-center gap-2 text-[0.875rem] sm:col-span-2"><input type="checkbox" className="h-5 w-5 accent-pine" checked={t.ativo} onChange={(e) => setT({ ...t, ativo: e.target.checked })} />Tarifa ativa (à venda no site)</label>

            {erros.length > 0 && <ul className="flex flex-col gap-1 text-[0.8125rem] text-warning sm:col-span-2" role="alert">{erros.map((x) => <li key={x} className="flex items-start gap-1.5"><Icon icon="solar:danger-circle-linear" width={16} className="mt-0.5 shrink-0" aria-hidden="true" />{x}</li>)}</ul>}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <button type="button" className={`${btnSecondary} !w-auto`} onClick={() => navigate('/admin/tarifas')}>Cancelar</button>
              <button type="submit" className={`${btnPrimary} !w-auto`} disabled={erros.length > 0 || salvando}><Icon icon="solar:diskette-linear" width={18} aria-hidden="true" />{salvando ? 'Salvando…' : 'Salvar tarifa'}</button>
            </div>
          </div>

          <aside className={`${card} flex flex-col gap-3 p-4`} aria-label="Exemplo de conta">
            <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Exemplo de conta</h2>
            <p className="text-[0.75rem] text-fg-3">{un.atual.nome}</p>
            <p className="text-[0.75rem] text-fg-3">Casal com 1 criança de 5 a 8 anos, por noite.</p>
            <dl className="flex flex-col gap-1.5 text-[0.8125rem]">
              <div className="flex justify-between gap-3"><dt className="text-fg-3">Domingo a quinta</dt><dd className="font-mono text-fg-1">{brl(exemplo(t.valorNoite))}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-fg-3">Sexta a domingo</dt><dd className="font-mono text-fg-1">{brl(exemplo(fdsIgual ? t.valorNoite : t.valorFds ?? t.valorNoite))}</dd></div>
            </dl>
            <p className="text-[0.75rem] text-fg-3">Confira também no <Link to="/admin/simulador" className="text-pine underline underline-offset-4">simulador de preço</Link> depois de salvar.</p>
          </aside>
        </form>
      )}
    </GestaoShell>
  );
}
