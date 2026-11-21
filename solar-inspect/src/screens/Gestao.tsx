import { Icon } from '@iconify/react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Chips, Seletor } from '../components/Filtros';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { ESTADOS, EstadoBadge, GravidadeTag, VALIDACAO, formatarData } from '../components/Status';
import { qrDaUnidade } from '../lib/admin';
import { hoje, type UnidadeCampo } from '../lib/campo';
import {
  alterarSituacao, bloquearPorOcorrencia, csvVistorias, detalheVistoria, emAberto, listarOcorrencias, listarVistorias, tratarOcorrencia, unidadesGestao, vistoriasDeHoje,
  type DetalheV, type FiltroV, type OcorrenciaG, type Resposta, type StatusOc, type StatusV, type VistoriaG,
} from '../lib/gestao';
import type { EstadoUnidade } from '../mocks/unidades';

const ORD = { critica: 0, media: 1, baixa: 2 };
const STATUS_OC: Record<StatusOc, { label: string; icon: string; cls: string }> = {
  aberta: { label: 'Aberta', icon: 'solar:danger-circle-linear', cls: 'text-warning' },
  em_tratamento: { label: 'Em tratamento', icon: 'solar:clock-circle-linear', cls: 'text-pine' },
  resolvida: { label: 'Resolvida', icon: 'solar:check-circle-linear', cls: 'text-available' },
  cancelada: { label: 'Cancelada', icon: 'solar:close-circle-linear', cls: 'text-fg-3' },
};
const STATUS_V: Record<StatusV, { label: string; cls: string }> = {
  agendada: { label: 'Agendada', cls: 'text-fg-2' }, em_andamento: { label: 'Em andamento', cls: 'text-pine' },
  concluida: { label: 'Concluída', cls: 'text-available' }, cancelada: { label: 'Cancelada', cls: 'text-fg-3' },
};
const RESP: Record<Resposta['resposta'], { label: string; cls: string }> = {
  OK: { label: 'OK', cls: 'text-available' }, PROBLEMA: { label: 'Problema', cls: 'text-error' }, NAO_SE_APLICA: { label: 'N/A', cls: 'text-fg-3' },
};
const StatusOcTag = ({ s }: { s: StatusOc }) => <span className={`inline-flex items-center gap-1 text-[0.75rem] font-medium ${STATUS_OC[s].cls}`}><Icon icon={STATUS_OC[s].icon} width={16} aria-hidden="true" />{STATUS_OC[s].label}</span>;
const StatusVTag = ({ v }: { v: VistoriaG }) => (
  <span className={`text-[0.75rem] font-medium ${v.sinalizacoes.length ? 'text-warning' : STATUS_V[v.status].cls}`}>{STATUS_V[v.status].label}{v.sinalizacoes.length ? ' · sinalizada' : ''}</span>
);
const dia = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00' : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const Carregando = () => <div className={`${card} h-40 animate-pulse`} aria-busy="true" />;
const Falha = ({ tentar }: { tentar: () => void }) => (
  <div role="alert" className={`${card} flex flex-col items-start gap-3 p-4 text-[0.8125rem] text-error`}>
    Não foi possível carregar os dados. Verifique a conexão.
    <button type="button" className={`${btnSecondary} w-auto`} onClick={tentar}>Tentar de novo</button>
  </div>
);
const Aviso = ({ msg, erro }: { msg: string; erro?: boolean }) => <p role={erro ? 'alert' : 'status'} className={`rounded-md border bg-white p-3 text-[0.8125rem] ${erro ? 'border-error text-error' : 'border-line-1 text-available'}`}>{msg}</p>;
const Titulo = ({ children }: { children: React.ReactNode }) => <h2 className="flex items-center justify-between font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">{children}</h2>;

/** Carrega dados do banco com estado de erro e recarga. */
function useCarga<T>(f: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [erro, setErro] = useState(false);
  const carregar = useCallback(() => { setErro(false); f().then(setDados).catch(() => setErro(true)); }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(carregar, [carregar]);
  return { dados, erro, carregar };
}

/** T20 — Painel: situação das unidades, ocorrências em aberto e vistorias de hoje. */
export function T20Dashboard() {
  const c = useCarga(() => Promise.all([unidadesGestao(), listarOcorrencias(), vistoriasDeHoje()]));
  const [prop, setProp] = useState('');
  const [us, ocs, hojeV] = c.dados ?? [[], [], []];
  const props = [...new Set(us.map((u) => u.propriedade))];
  const lista = us.filter((u) => !prop || u.propriedade === prop);
  const ids = new Set(lista.map((u) => u.id));
  const ocsF = ocs.filter((o) => emAberto(o) && ids.has(o.unidadeId)).sort((a, b) => ORD[a.gravidade] - ORD[b.gravidade]);
  const vHoje = hojeV.filter((v) => ids.has(v.unidadeId) && v.status !== 'cancelada');

  return (
    <GestaoShell eyebrow="Gestão" titulo="Visão operacional">
      {props.length > 1 && <Chips rotulo="Propriedade" valor={prop} onChange={setProp} opcoes={[{ valor: '', label: 'Todas' }, ...props.map((p) => ({ valor: p, label: p, icone: 'solar:buildings-2-linear' }))]} />}
      {c.erro ? <Falha tentar={c.carregar} /> : !c.dados ? <Carregando /> : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Unidades', lista.length, ''],
              ['Liberadas', lista.filter((u) => u.estado === 'liberado').length, 'text-available'],
              ['Ocorrências abertas', ocsF.length, ocsF.some((o) => o.gravidade === 'critica') ? 'text-error' : ocsF.length ? 'text-warning' : ''],
              ['Vistorias hoje', `${vHoje.filter((v) => v.status === 'concluida').length}/${vHoje.length}`, ''],
            ].map(([l, v, cl]) => (
              <div key={l as string} className={`${card} p-4`}><dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-fg-3">{l}</dt><dd className={`font-mono text-2xl font-medium tabular-nums ${cl || 'text-fg-1'}`}>{v}</dd></div>
            ))}
          </dl>
          <section className={`${card} p-4`}>
            <h2 className="mb-3 font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Situação das unidades</h2>
            <div className="flex h-3 overflow-hidden rounded-full bg-line-1" aria-hidden="true">
              {(Object.keys(ESTADOS) as EstadoUnidade[]).map((e) => { const n = lista.filter((u) => u.estado === e).length; return n ? <span key={e} className={ESTADOS[e].cls.includes('available') ? 'bg-available' : ESTADOS[e].cls.includes('error') ? 'bg-error' : ESTADOS[e].cls.includes('warning') ? 'bg-warning' : e === 'em_limpeza' ? 'bg-pine' : 'bg-line-2'} style={{ flex: n }} /> : null; })}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(ESTADOS) as EstadoUnidade[]).map((e) => <li key={e} className="inline-flex items-center gap-2"><EstadoBadge estado={e} /><span className="font-mono text-[0.75rem] text-fg-2">{lista.filter((u) => u.estado === e).length}</span></li>)}
            </ul>
          </section>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <section className="flex flex-col gap-2">
              <Titulo>Ocorrências prioritárias <Link to="/gestao/ocorrencias" className="normal-case tracking-normal text-pine">Ver todas</Link></Titulo>
              <ul className={`${card} divide-y divide-line-1`}>
                {ocsF.slice(0, 5).map((o) => (
                  <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-cream">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5"><GravidadeTag g={o.gravidade} /><span className="truncate text-[0.8125rem] text-fg-1">{o.descricao}</span><span className="text-[0.75rem] text-fg-3">{o.unidade} · {o.ambiente} · desde {dia(o.abertura)}</span></div>
                    <StatusOcTag s={o.status} />
                  </Link></li>
                ))}
                {ocsF.length === 0 && <li className="p-4 text-[0.8125rem] text-fg-2">Nenhuma ocorrência aberta.</li>}
              </ul>
            </section>
            <section className="flex flex-col gap-2">
              <Titulo>Vistorias de hoje <Link to={`/gestao/vistorias?de=${hoje()}&ate=${hoje()}`} className="normal-case tracking-normal text-pine">Ver lista</Link></Titulo>
              <ul className={`${card} divide-y divide-line-1`}>
                {vHoje.slice(0, 8).map((v) => (
                  <li key={v.id}><Link to={`/gestao/vistorias/${v.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-cream">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5"><span className="truncate text-[0.8125rem] font-medium text-fg-1">{v.unidade} · {v.tipo}</span><span className="text-[0.75rem] text-fg-3">{v.responsavel ?? 'Sem responsável'}</span></div>
                    <StatusVTag v={v} />
                  </Link></li>
                ))}
                {vHoje.length === 0 && <li className="p-4 text-[0.8125rem] text-fg-2">Nenhuma vistoria para hoje.</li>}
              </ul>
            </section>
          </div>
        </>
      )}
    </GestaoShell>
  );
}

/** T21 — Unidades: situação, ocorrências em aberto e última vistoria. */
export function T21Unidades() {
  const c = useCarga(() => Promise.all([unidadesGestao(), listarOcorrencias()]));
  const [q, setQ] = useState('');
  const [est, setEst] = useState('');
  const [us, ocs] = c.dados ?? [[], []];
  const lista = us.filter((u) => (!est || u.estado === est) && `${u.nome} ${u.propriedade}`.toLowerCase().includes(q.toLowerCase()));
  const nOc = (id: string) => ocs.filter((o) => o.unidadeId === id && emAberto(o)).length;
  return (
    <GestaoShell eyebrow="Gestão" titulo="Unidades">
      <div className="flex flex-col gap-3">
        <input type="search" placeholder="Buscar unidade ou propriedade" value={q} onChange={(e) => setQ(e.target.value)} className="min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-fg-1 placeholder:text-fg-4" aria-label="Buscar" />
        <Chips rotulo="Situação" valor={est} onChange={setEst} opcoes={[{ valor: '', label: 'Todas' }, ...(Object.keys(ESTADOS) as EstadoUnidade[]).map((e) => ({ valor: e as string, label: ESTADOS[e].label, icone: ESTADOS[e].icon }))]} />
      </div>
      {c.erro ? <Falha tentar={c.carregar} /> : !c.dados ? <Carregando /> : lista.length === 0 ? <p className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhuma unidade neste filtro.</p> : (
        <TabelaResp rows={lista} cols={[
          { h: 'Unidade', principal: true, r: (u) => (<><Link to={`/gestao/unidades/${u.id}`} className="font-medium text-pine underline-offset-4 hover:underline">{u.nome}</Link><div className="text-[0.75rem] text-fg-3">{u.tipo}</div></>) },
          { h: 'Propriedade', r: (u) => u.propriedade },
          { h: 'Situação', r: (u) => <EstadoBadge estado={u.estado} /> },
          { h: 'Ocorrências', r: (u) => <span className="font-mono">{nOc(u.id) || '—'}</span> },
          { h: 'Última vistoria', r: (u) => <span className="text-fg-2">{u.ultima ? `${u.ultima.tipo} · ${formatarData(u.ultima.data)}` : '—'}</span> },
        ]} />
      )}
    </GestaoShell>
  );
}

/** QR da porta: imprimir o atual ou gerar um novo (invalida as etiquetas antigas). */
function PainelQr({ u }: { u: UnidadeCampo }) {
  const [qr, setQr] = useState<{ img: string; versao: number } | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  async function abrir(rotacionar: boolean) {
    setMsg(null); setConfirmar(false);
    const r = await qrDaUnidade(Number(u.id), rotacionar);
    if (!r.ok) return setMsg({ t: r.erro, erro: true });
    setQr({ img: await QRCode.toDataURL(r.codigo, { margin: 2, width: 320, errorCorrectionLevel: 'M' }), versao: r.versao });
    if (rotacionar) setMsg({ t: 'Novo QR gerado: as etiquetas antigas deixaram de valer. Imprima e troque a etiqueta da porta.' });
  }
  return (
    <div className={`${card} flex flex-col gap-3 p-4`}>
      <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">QR Code da porta</h2>
      {msg && <Aviso msg={msg.t} erro={msg.erro} />}
      {qr ? (
        <figure className="flex flex-col items-center gap-2">
          <img src={qr.img} alt={`QR Code de ${u.nome}`} width={200} height={200} className="h-48 w-48" />
          <figcaption className="text-center text-[0.75rem] text-fg-3">{u.nome} · versão {qr.versao}</figcaption>
          <button type="button" className={`${btnSecondary} print:hidden`} onClick={() => window.print()}><Icon icon="solar:printer-linear" width={18} aria-hidden="true" />Imprimir</button>
        </figure>
      ) : (
        <button type="button" className={btnSecondary} onClick={() => abrir(false)}><Icon icon="solar:qr-code-linear" width={18} aria-hidden="true" />Mostrar QR para imprimir</button>
      )}
      {!confirmar ? (
        <button type="button" className="min-h-11 text-[0.75rem] text-error underline underline-offset-4 print:hidden" onClick={() => setConfirmar(true)}>Gerar novo QR (etiqueta perdida ou copiada)</button>
      ) : (
        <div className="flex flex-col gap-2 print:hidden" role="alertdialog" aria-label="Confirmar novo QR">
          <p className="text-[0.75rem] text-fg-2">A etiqueta atual deixa de valer na hora. Continuar?</p>
          <div className="grid grid-cols-2 gap-2"><button type="button" className={btnSecondary} onClick={() => setConfirmar(false)}>Cancelar</button><button type="button" className={btnPrimary} onClick={() => abrir(true)}>Gerar</button></div>
        </div>
      )}
    </div>
  );
}

/** T22 — Unidade (gestão): ocorrências, vistorias, situação e QR. */
export function T22DetalheUnidade() {
  const { id = '' } = useParams();
  const c = useCarga(() => Promise.all([unidadesGestao(), listarOcorrencias({ unidadeId: id }), listarVistorias({ unidadeId: id }, 0, 10)]), [id]);
  const [novo, setNovo] = useState<EstadoUnidade | ''>('');
  const [confirmar, setConfirmar] = useState(false);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  const u = c.dados?.[0].find((x) => x.id === id);
  if (c.dados && !u) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;
  const ocs = c.dados?.[1] ?? [];
  const vs = c.dados?.[2].lista ?? [];
  const criticas = ocs.filter((o) => emAberto(o) && o.gravidade === 'critica').length;

  async function aplicar() {
    const r = await alterarSituacao(id, novo as EstadoUnidade);
    setConfirmar(false);
    if (!r.ok) return setMsg({ t: r.erro, erro: true });
    setMsg({ t: `Situação alterada para ${ESTADOS[novo as EstadoUnidade].label}.` }); setNovo(''); c.carregar();
  }
  return (
    <GestaoShell eyebrow={u?.propriedade ?? 'Unidade'} titulo={u?.nome ?? '…'} acoes={u && <EstadoBadge estado={u.estado} size="md" />}>
      {c.erro ? <Falha tentar={c.carregar} /> : !u ? <Carregando /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <Titulo>Ocorrências <span className="font-mono text-fg-3">{ocs.filter(emAberto).length} em aberto</span></Titulo>
              <ul className={`${card} divide-y divide-line-1`}>
                {ocs.map((o) => (
                  <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className="flex min-h-12 flex-wrap items-center gap-3 px-4 py-3 hover:bg-cream"><GravidadeTag g={o.gravidade} /><span className="min-w-0 flex-1 truncate text-[0.8125rem]">{o.descricao}</span><StatusOcTag s={o.status} /></Link></li>
                ))}
                {ocs.length === 0 && <li className="p-4 text-[0.8125rem] text-fg-2">Sem ocorrências.</li>}
              </ul>
            </section>
            <section className="flex flex-col gap-2">
              <Titulo>Vistorias recentes <Link to={`/gestao/vistorias?unidade=${id}`} className="normal-case tracking-normal text-pine">Ver todas</Link></Titulo>
              <ul className={`${card} divide-y divide-line-1`}>
                {vs.map((v) => (
                  <li key={v.id}><Link to={`/gestao/vistorias/${v.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-[0.8125rem] hover:bg-cream"><span className="min-w-0 truncate">{v.tipo} · {v.fim ? formatarData(v.fim) : dia(v.agendada)}</span><StatusVTag v={v} /></Link></li>
                ))}
                {vs.length === 0 && <li className="p-4 text-[0.8125rem] text-fg-2">Nenhuma vistoria registrada.</li>}
              </ul>
            </section>
          </div>
          <aside className="flex flex-col gap-4">
            <dl className={`${card} divide-y divide-line-1 text-[0.8125rem]`}>
              {[['Tipo', u.tipo + (u.andar ? ` · ${u.andar}` : '')], ['Validação', VALIDACAO[u.validacao].label], ['Ambientes', String(u.ambientes)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-fg-3">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className={`${card} flex flex-col gap-3 p-4 print:hidden`}>
              <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Alterar situação</h2>
              {msg && <Aviso msg={msg.t} erro={msg.erro} />}
              <Seletor rotulo="Nova situação" placeholder="Selecione a nova situação" valor={novo} onChange={(v) => { setNovo(v as EstadoUnidade | ''); setConfirmar(false); setMsg(null); }}
                opcoes={(Object.keys(ESTADOS) as EstadoUnidade[]).filter((e) => e !== u.estado).map((e) => ({ valor: e, label: ESTADOS[e].label, icone: ESTADOS[e].icon }))} />
              {novo === 'liberado' && criticas > 0 && <p className="text-[0.75rem] text-error">Há {criticas} ocorrência{criticas > 1 ? 's' : ''} crítica{criticas > 1 ? 's' : ''} aberta{criticas > 1 ? 's' : ''}: resolva antes de liberar.</p>}
              {novo === 'liberado' && <p className="text-[0.75rem] text-fg-3">Liberar encerra o bloqueio de manutenção e devolve as noites à venda no site.</p>}
              {!confirmar ? (
                <button type="button" className={btnPrimary} disabled={!novo} onClick={() => setConfirmar(true)}>Aplicar</button>
              ) : (
                <div className="grid grid-cols-2 gap-2" role="alertdialog" aria-label="Confirmar situação">
                  <button type="button" className={btnSecondary} onClick={() => setConfirmar(false)}>Cancelar</button>
                  <button type="button" className={btnPrimary} onClick={aplicar}>Confirmar</button>
                </div>
              )}
              <p className="text-[0.6875rem] text-fg-3">A mudança fica registrada na auditoria com o seu usuário.</p>
            </div>
            <PainelQr u={u} />
          </aside>
        </div>
      )}
    </GestaoShell>
  );
}

/** T23 — Vistorias: filtros por situação, unidade e período; paginação no servidor; exportação CSV. */
export function T23Vistorias() {
  const q = new URLSearchParams(location.search);
  const [f, setF] = useState<FiltroV>({ status: '', unidadeId: q.get('unidade') ?? '', de: q.get('de') ?? '', ate: q.get('ate') ?? '' });
  const [pag, setPag] = useState(0);
  const POR = 20;
  const us = useCarga(() => unidadesGestao());
  const c = useCarga(() => listarVistorias(f, pag, POR), [f, pag]);
  const [exportando, setExportando] = useState(false);
  const mudar = (p: Partial<FiltroV>) => { setF({ ...f, ...p }); setPag(0); };
  async function exportar() {
    setExportando(true);
    try {
      const { lista } = await listarVistorias(f, 0, 1000);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csvVistorias(lista)], { type: 'text/csv;charset=utf-8' }));
      a.download = `vistorias-${hoje()}.csv`; a.click(); URL.revokeObjectURL(a.href);
    } finally { setExportando(false); }
  }
  const total = c.dados?.total ?? 0;
  const data = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-fg-1';
  return (
    <GestaoShell eyebrow="Gestão" titulo="Vistorias" acoes={<button type="button" onClick={exportar} disabled={exportando || !total} className={`${btnSecondary} w-auto`}><Icon icon="solar:download-linear" width={18} aria-hidden="true" />{exportando ? 'Gerando…' : 'Exportar CSV'}</button>}>
      <Chips rotulo="Situação" valor={f.status ?? ''} onChange={(v) => mudar({ status: v as FiltroV['status'] })} opcoes={[{ valor: '', label: 'Todas' }, { valor: 'agendada', label: 'Agendadas' }, { valor: 'em_andamento', label: 'Em andamento' }, { valor: 'concluida', label: 'Concluídas' }, { valor: 'sinalizada', label: 'Sinalizadas' }, { valor: 'cancelada', label: 'Canceladas' }]} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Seletor rotulo="Unidade" icone="solar:home-2-linear" valor={f.unidadeId ?? ''} onChange={(v) => mudar({ unidadeId: v })} opcoes={[{ valor: '', label: 'Todas as unidades' }, ...(us.dados ?? []).map((u) => ({ valor: u.id, label: u.nome }))]} />
        <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">Agendada de<input type="date" className={data} value={f.de} max={f.ate || undefined} onChange={(e) => mudar({ de: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">até<input type="date" className={data} value={f.ate} min={f.de || undefined} onChange={(e) => mudar({ ate: e.target.value })} /></label>
      </div>
      {c.erro ? <Falha tentar={c.carregar} /> : !c.dados ? <Carregando /> : c.dados.lista.length === 0 ? <p className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhuma vistoria neste filtro.</p> : (
        <TabelaResp rows={c.dados.lista} cols={[
          { h: 'Unidade', principal: true, r: (v) => <Link to={`/gestao/vistorias/${v.id}`} className="font-medium text-pine hover:underline">{v.unidade} · {v.tipo}</Link> },
          { h: 'Data', r: (v) => <span className="text-fg-2">{v.fim ? formatarData(v.fim) : `agendada ${dia(v.agendada)}`}</span> },
          { h: 'Responsável', r: (v) => <span className="text-fg-2">{v.responsavel ?? '—'}</span> },
          { h: 'Situação', r: (v) => <StatusVTag v={v} /> },
        ]} />
      )}
      <div className="flex items-center justify-between text-[0.75rem] text-fg-3">
        <span>{total} registro{total === 1 ? '' : 's'}</span>
        <div className="flex gap-2"><button type="button" disabled={pag === 0} onClick={() => setPag(pag - 1)} className="min-h-11 px-3 disabled:opacity-40">Anterior</button><button type="button" disabled={(pag + 1) * POR >= total} onClick={() => setPag(pag + 1)} className="min-h-11 px-3 disabled:opacity-40">Próxima</button></div>
      </div>
    </GestaoShell>
  );
}

function Metadados({ v }: { v: DetalheV }) {
  const linhas: [string, string][] = [
    ['Unidade', v.unidade], ['Tipo', v.tipo], ['Responsável', v.responsavel ?? '—'], ['Agendada', dia(v.agendada)],
    ['Início', v.inicio ? formatarData(v.inicio) : '—'], ['Conclusão', v.fim ? formatarData(v.fim) : '—'],
    ['Presença', v.validacao ? `${v.validacao.replace('_E_', ' + ')}${v.distancia !== undefined ? ` · ${v.distancia} m` : ''}${v.precisao ? ` (±${v.precisao} m)` : ''}` : '—'],
    ['Situação', STATUS_V[v.status].label], ['Sinalizações', v.sinalizacoes.join(' · ') || '—'],
    ['Unidade ficou', v.situacao ? ESTADOS[v.situacao].label : '—'], ['Recebida em', v.recebimento ? formatarData(v.recebimento) : '—'], ['Código', v.id],
  ];
  return (
    <dl className={`${card} grid grid-cols-1 divide-y divide-line-1 text-[0.8125rem] sm:grid-cols-2 sm:divide-y-0`}>
      {linhas.map(([k, val]) => <div key={k} className="flex justify-between gap-3 px-4 py-3 sm:border-b sm:border-line-1"><dt className="shrink-0 text-fg-3">{k}</dt><dd className="min-w-0 truncate text-right font-medium">{val}</dd></div>)}
    </dl>
  );
}

function Respostas({ v, fotosGrandes }: { v: DetalheV; fotosGrandes?: boolean }) {
  const ambs = [...new Set(v.respostas.map((r) => r.ambiente))];
  if (!ambs.length) return <p className="text-[0.8125rem] text-fg-2">{v.status === 'concluida' ? 'Sem respostas registradas.' : 'As respostas aparecem quando a vistoria for concluída.'}</p>;
  return (
    <div className="flex flex-col gap-4">
      {ambs.map((a) => (
        <section key={a} className="flex flex-col gap-2 [break-inside:avoid]">
          <h3 className="text-xs uppercase tracking-[0.08em] text-fg-2">{a}</h3>
          <ul className={`${card} divide-y divide-line-1`}>
            {v.respostas.filter((r) => r.ambiente === a).map((r) => (
              <li key={r.item} className="flex flex-col gap-2 px-4 py-3 text-[0.8125rem]">
                <div className="flex items-start justify-between gap-3"><span className="text-fg-1">{r.item}{r.qtde !== undefined ? ` · ${r.qtde} un.` : ''}</span><span className={`shrink-0 font-medium ${RESP[r.resposta].cls}`}>{RESP[r.resposta].label}</span></div>
                {r.observacao && <p className="text-[0.75rem] text-fg-2">{r.observacao}</p>}
                {r.fotos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {r.fotos.map((u, i) => <a key={u} href={u} target="_blank" rel="noreferrer noopener"><img src={u} alt={`Foto ${i + 1} de ${r.item}`} className={`${fotosGrandes ? 'h-40 w-56' : 'h-20 w-28'} rounded-md border border-line-1 object-cover`} loading="lazy" /></a>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function useVistoria(id: string) {
  const c = useCarga(() => detalheVistoria(id), [id]);
  return c;
}

/** T24 — Detalhe da vistoria: registro final, somente leitura. */
export function T24DetalheVistoria() {
  const { id = '' } = useParams();
  const c = useVistoria(id);
  if (c.dados === undefined) return <Navigate to="/gestao/vistorias" replace />;
  const v = c.dados;
  return (
    <GestaoShell eyebrow={v ? `${v.unidade} · ${v.tipo}` : 'Vistoria'} titulo="Detalhe da vistoria"
      acoes={v?.status === 'concluida' && <Link to={`/gestao/vistorias/${id}/relatorio`} className={`${btnPrimary} w-auto`}><Icon icon="solar:document-text-linear" width={18} aria-hidden="true" />Relatório</Link>}>
      {c.erro ? <Falha tentar={c.carregar} /> : !v ? <Carregando /> : (
        <>
          {v.status === 'concluida' && <p className="flex items-center gap-2 text-[0.8125rem] text-fg-2"><Icon icon="solar:lock-linear" width={16} className="text-pine" aria-hidden="true" />Registro final: somente leitura.</p>}
          <Metadados v={v} />
          {v.ocorrencias.length > 0 && (
            <section className="flex flex-col gap-2">
              <Titulo>Ocorrências abertas por esta vistoria</Titulo>
              <ul className={`${card} divide-y divide-line-1`}>
                {v.ocorrencias.map((o) => <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className="flex min-h-12 flex-wrap items-center gap-3 px-4 py-3 hover:bg-cream"><GravidadeTag g={o.gravidade} /><span className="min-w-0 flex-1 truncate text-[0.8125rem]">{o.item}: {o.descricao}</span><StatusOcTag s={o.status} /></Link></li>)}
              </ul>
            </section>
          )}
          <section className="flex flex-col gap-2"><Titulo>Checklist</Titulo><Respostas v={v} /></section>
          {v.assinatura && <section className="flex flex-col gap-2"><Titulo>Assinatura</Titulo><img src={v.assinatura} alt="Assinatura do vistoriador" className={`${card} h-24 w-auto self-start bg-white p-2`} /></section>}
        </>
      )}
    </GestaoShell>
  );
}

/** T27 — Relatório para imprimir ou salvar em PDF (pelo navegador), com o registro do banco. */
export function T27Relatorio() {
  const { id = '' } = useParams();
  const c = useVistoria(id);
  if (c.dados === undefined) return <Navigate to="/gestao/vistorias" replace />;
  const v = c.dados;
  return (
    <GestaoShell eyebrow="Relatório" titulo={v ? `${v.unidade} · ${v.tipo}` : '…'}
      acoes={v && <button type="button" className={`${btnPrimary} w-auto`} onClick={() => window.print()}><Icon icon="solar:printer-linear" width={18} aria-hidden="true" />Imprimir ou salvar PDF</button>}>
      {c.erro ? <Falha tentar={c.carregar} /> : !v ? <Carregando /> : v.status !== 'concluida' ? <Aviso msg="O relatório fica disponível quando a vistoria for concluída." erro /> : (
        <article className="mx-auto flex w-full max-w-[48rem] flex-col gap-5 rounded-sm border border-line-1 bg-white p-[clamp(1.25rem,4vw,3rem)] shadow-lg print:max-w-none print:border-0 print:p-0 print:shadow-none">
          <header className="flex items-start justify-between gap-4 border-b border-line-1 pb-4">
            <div><p className="text-[0.625rem] uppercase tracking-[0.32em] text-fg-3">Relatório de vistoria · Solar do Espinhaço</p><h2 className="font-serif text-2xl font-medium text-fg-1">{v.unidade}</h2><p className="text-[0.8125rem] text-fg-2">{v.tipo} · {v.fim ? formatarData(v.fim) : ''} · {v.responsavel ?? ''}</p></div>
            <Icon icon="solar:leaf-linear" width={32} className="shrink-0 text-pine-deep" aria-hidden="true" />
          </header>
          <Metadados v={v} />
          <section className="flex flex-col gap-2">
            <h3 className="text-xs uppercase tracking-[0.08em] text-fg-2">Ocorrências ({v.ocorrencias.length})</h3>
            {v.ocorrencias.length ? <ul className="divide-y divide-line-1 text-[0.8125rem]">{v.ocorrencias.map((o) => <li key={o.id} className="flex items-center justify-between gap-3 py-2"><span>{o.ambiente} · {o.item}: {o.descricao}</span><GravidadeTag g={o.gravidade} /></li>)}</ul> : <p className="text-[0.8125rem] text-fg-2">Nenhuma.</p>}
          </section>
          <section className="flex flex-col gap-2"><h3 className="text-xs uppercase tracking-[0.08em] text-fg-2">Checklist</h3><Respostas v={v} fotosGrandes /></section>
          <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-line-1 pt-4 text-[0.75rem] text-fg-3">
            <span>Código {v.id}</span>
            {v.assinatura ? <span className="flex flex-col items-end gap-1"><img src={v.assinatura} alt="Assinatura do vistoriador" className="h-16 w-auto" />Assinatura do vistoriador</span> : <span>Sem assinatura</span>}
          </footer>
        </article>
      )}
    </GestaoShell>
  );
}

/** T25 — Ocorrências: em aberto primeiro, críticas em destaque. */
export function T25Ocorrencias() {
  const c = useCarga(() => listarOcorrencias());
  const [st, setSt] = useState<'abertas' | StatusOc | ''>('abertas');
  const lista = useMemo(() => (c.dados ?? []).filter((o) => !st || (st === 'abertas' ? emAberto(o) : o.status === st)), [c.dados, st]);
  return (
    <GestaoShell eyebrow="Gestão" titulo="Ocorrências">
      <Chips rotulo="Situação" valor={st} onChange={setSt} opcoes={[{ valor: 'abertas', label: 'Em aberto' }, { valor: '', label: 'Todas' }, ...(Object.keys(STATUS_OC) as StatusOc[]).map((x) => ({ valor: x as typeof st, label: STATUS_OC[x].label }))]} />
      {c.erro ? <Falha tentar={c.carregar} /> : !c.dados ? <Carregando /> : (
        <ul className="flex flex-col gap-2">
          {lista.map((o) => (
            <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className={`${card} flex flex-col gap-2 p-4 hover:shadow-md sm:flex-row sm:items-center ${o.gravidade === 'critica' && emAberto(o) ? 'border-error' : ''}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1"><GravidadeTag g={o.gravidade} /><span className="text-[0.875rem] text-fg-1">{o.descricao}</span><span className="text-[0.75rem] text-fg-3">{o.unidade} · {o.ambiente} · {o.item}</span></div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-fg-2"><span>Aberta em {dia(o.abertura)}</span>{o.bloqueioAte && emAberto(o) && <span className="text-error">Fora da venda até {dia(o.bloqueioAte)}</span>}<StatusOcTag s={o.status} /></div>
            </Link></li>
          ))}
          {lista.length === 0 && <li className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhuma ocorrência neste filtro.</li>}
        </ul>
      )}
    </GestaoShell>
  );
}

/** T26 — Tratamento: andamento, resolver ou cancelar, tirar da venda e liberar a unidade. Histórico gravado pelo banco. */
export function T26Tratamento() {
  const { id = '' } = useParams();
  const c = useCarga(() => Promise.all([listarOcorrencias(), unidadesGestao()]));
  const o = c.dados?.[0].find((x) => x.id === id);
  const u = c.dados?.[1].find((x) => x.id === o?.unidadeId);
  const [texto, setTexto] = useState('');
  const [liberar, setLiberar] = useState(true);
  const [ate, setAte] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; erro?: boolean } | null>(null);
  if (c.dados && !o) return <Navigate to="/gestao/ocorrencias" replace />;

  const foraDaVenda = u?.estado === 'manutencao' || u?.estado === 'bloqueado';
  const outrasCriticas = (c.dados?.[0] ?? []).filter((x) => x.id !== id && x.unidadeId === o?.unidadeId && emAberto(x) && x.gravidade === 'critica').length;
  async function fazer(f: () => Promise<{ ok: boolean; erro?: string }>, ok: string) {
    setOcupado(true); setMsg(null);
    const r = await f();
    setOcupado(false);
    if (!r.ok) return setMsg({ t: r.erro ?? 'Falhou.', erro: true });
    setMsg({ t: ok }); setTexto(''); setAte(''); c.carregar();
  }
  const aberta = !!o && emAberto(o);
  const libera = foraDaVenda && liberar && outrasCriticas === 0;   // com outra crítica aberta o banco recusaria e desfaria a resolução
  return (
    <GestaoShell eyebrow={o ? `${o.unidade} · ${o.ambiente} · ${o.item}` : 'Ocorrência'} titulo={o?.descricao ?? '…'} acoes={o && <StatusOcTag s={o.status} />}>
      {c.erro ? <Falha tentar={c.carregar} /> : !o || !u ? <Carregando /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex flex-col gap-3">
            {msg && <Aviso msg={msg.t} erro={msg.erro} />}
            <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Histórico</h2>
            <ol className={`${card} flex flex-col gap-4 p-4`}>
              {o.historico.map((h, i) => (
                <li key={i} className="flex gap-3 text-[0.8125rem]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pine" /><div className="min-w-0"><p className="text-fg-1 [overflow-wrap:anywhere]">{h.texto}</p>{h.quando && <p className="text-[0.75rem] text-fg-3">{h.quando}</p>}</div></li>
              ))}
            </ol>
            {aberta && (
              <div className="flex flex-col gap-2">
                <textarea rows={3} maxLength={1000} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="O que foi feito ou combinado (fica no histórico com seu nome e horário)" className="rounded-md border border-line-2 bg-white p-3" aria-label="Registro do tratamento" />
                <button type="button" className={`${btnSecondary} sm:w-auto sm:self-end`} disabled={ocupado || texto.trim().length < 3} onClick={() => fazer(() => tratarOcorrencia(id, 'em_tratamento', texto), 'Andamento registrado.')}>Registrar andamento</button>
              </div>
            )}
            {o.vistoriaId && <Link to={`/gestao/vistorias/${o.vistoriaId}`} className="text-[0.8125rem] text-pine underline underline-offset-4">Ver a vistoria que abriu a ocorrência</Link>}
          </section>
          <aside className={`${card} flex flex-col gap-3 p-4`}>
            <GravidadeTag g={o.gravidade} />
            <div className="flex items-center justify-between gap-3 text-[0.8125rem]"><span className="text-fg-3">Unidade</span><Link to={`/gestao/unidades/${u.id}`} className="inline-flex items-center gap-2 text-pine"><EstadoBadge estado={u.estado} /></Link></div>
            {o.bloqueioAte && <p className="text-[0.75rem] text-fg-2">Fora da venda no site até {dia(o.bloqueioAte)}{aberta ? ' (renovado se precisar)' : ''}.</p>}
            {aberta && (
              <>
                {foraDaVenda && (
                  <label className="flex items-start gap-2 text-[0.8125rem] text-fg-1">
                    <input type="checkbox" className="mt-1" checked={liberar} onChange={(e) => setLiberar(e.target.checked)} />
                    <span>Ao resolver, liberar a unidade (volta à venda){outrasCriticas > 0 && <span className="block text-[0.75rem] text-error">Há outra ocorrência crítica aberta: a unidade só libera depois dela.</span>}</span>
                  </label>
                )}
                <button type="button" className={btnPrimary} disabled={ocupado} onClick={() => fazer(() => tratarOcorrencia(id, 'resolvida', texto, libera), libera ? 'Ocorrência resolvida e unidade liberada.' : 'Ocorrência resolvida.')}>
                  <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Resolver
                </button>
                <button type="button" className={btnSecondary} disabled={ocupado || texto.trim().length < 5} onClick={() => fazer(() => tratarOcorrencia(id, 'cancelada', `Cancelada: ${texto}`, libera), 'Ocorrência cancelada.')} title="Escreva o motivo no campo de registro">
                  Cancelar (motivo no registro)
                </button>
                {!o.bloqueioAte && o.gravidade !== 'critica' && (
                  <div className="flex flex-col gap-2 border-t border-line-1 pt-3">
                    <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">Tirar da venda até (inclusive)
                      <input type="date" min={hoje()} value={ate} onChange={(e) => setAte(e.target.value)} className="min-h-11 rounded-md border border-line-2 bg-white px-3 text-fg-1" />
                    </label>
                    <button type="button" className={btnSecondary} disabled={ocupado || !ate || ate < hoje()} onClick={() => fazer(() => bloquearPorOcorrencia(id, ate), `Unidade fora da venda até ${dia(ate)}.`)}>Tirar da venda</button>
                  </div>
                )}
              </>
            )}
            {!aberta && foraDaVenda && (
              <button type="button" className={btnPrimary} disabled={ocupado || outrasCriticas > 0} onClick={() => fazer(() => tratarOcorrencia(id, o.status as 'resolvida' | 'cancelada', '', true), 'Unidade liberada.')}>Liberar a unidade</button>
            )}
          </aside>
        </div>
      )}
    </GestaoShell>
  );
}
