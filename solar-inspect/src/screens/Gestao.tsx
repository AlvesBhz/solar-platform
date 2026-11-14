import { Icon } from '@iconify/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { ESTADOS, EstadoBadge, GravidadeTag, VALIDACAO, formatarData } from '../components/Status';
import { listarEnvios, type Envio } from '../mocks/envios';
import { RESPONSAVEIS, alterarEstado, atualizarOcorrencia, listarOcorrencias, unidadesGestao, type OcorrenciaG, type StatusOc } from '../mocks/gestao';
import type { EstadoUnidade, Unidade } from '../mocks/unidades';

const ORD = { critica: 0, media: 1, baixa: 2 };
const STATUS_OC: Record<StatusOc, { label: string; icon: string; cls: string }> = {
  aberta: { label: 'Aberta', icon: 'solar:danger-circle-linear', cls: 'text-warning' },
  em_tratamento: { label: 'Em tratamento', icon: 'solar:clock-circle-linear', cls: 'text-pine' },
  resolvida: { label: 'Resolvida', icon: 'solar:check-circle-linear', cls: 'text-available' },
  cancelada: { label: 'Cancelada', icon: 'solar:close-circle-linear', cls: 'text-fg-3' },
};
const StatusOcTag = ({ s }: { s: StatusOc }) => <span className={`inline-flex items-center gap-1 text-[0.75rem] font-medium ${STATUS_OC[s].cls}`}><Icon icon={STATUS_OC[s].icon} width={16} aria-hidden="true" />{STATUS_OC[s].label}</span>;
const abertas = (o: OcorrenciaG) => o.status === 'aberta' || o.status === 'em_tratamento';
const dia = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00' : iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
const Carregando = () => <div className={`${card} h-40 animate-pulse`} aria-busy="true" />;

function useDados() {
  const [us, setUs] = useState<Unidade[] | null>(null);
  const [ocs, setOcs] = useState<OcorrenciaG[] | null>(null);
  useEffect(() => { unidadesGestao().then(setUs); listarOcorrencias().then(setOcs); }, []);
  return { us, ocs, setOcs, setUs, envios: listarEnvios() };
}

/** T20 — Dashboard: indicadores, estados das unidades e ocorrências críticas. */
export function T20Dashboard() {
  const { us, ocs, envios } = useDados();
  const [prop, setProp] = useState('');
  const props = [...new Set((us ?? []).map((u) => u.propriedade))];
  const lista = (us ?? []).filter((u) => !prop || u.propriedade === prop);
  const ocsF = (ocs ?? []).filter((o) => abertas(o) && lista.some((u) => u.id === o.unidadeId)).sort((a, b) => ORD[a.gravidade] - ORD[b.gravidade]);
  const hoje = envios.filter((e) => e.fim.slice(0, 10) === new Date().toISOString().slice(0, 10)).length;

  return (
    <GestaoShell eyebrow="Gestão" titulo="Visão operacional" acoes={
      <select aria-label="Propriedade" value={prop} onChange={(e) => setProp(e.target.value)} className="min-h-11 min-w-0 max-w-full rounded-md border border-line-2 bg-white px-3 text-fg-1">
        <option value="">Todas as propriedades</option>{props.map((p) => <option key={p}>{p}</option>)}
      </select>}>
      {!us || !ocs ? <Carregando /> : (
        <>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Unidades', lista.length, ''],
              ['Liberadas', lista.filter((u) => u.estado === 'liberado').length, 'text-available'],
              ['Ocorrências abertas', ocsF.length, ocsF.length ? 'text-warning' : ''],
              ['Vistorias hoje', hoje, ''],
            ].map(([l, v, c]) => (
              <div key={l as string} className={`${card} p-4`}><dt className="text-[0.6875rem] uppercase tracking-[0.08em] text-fg-3">{l}</dt><dd className={`font-mono text-2xl font-medium tabular-nums ${c || 'text-fg-1'}`}>{v}</dd></div>
            ))}
          </dl>
          <section className={`${card} p-4`}>
            <h2 className="mb-3 font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Estado das unidades</h2>
            <div className="flex h-3 overflow-hidden rounded-full bg-line-1" aria-hidden="true">
              {(Object.keys(ESTADOS) as EstadoUnidade[]).map((e) => { const n = lista.filter((u) => u.estado === e).length; return n ? <span key={e} className={ESTADOS[e].cls.includes('available') ? 'bg-available' : ESTADOS[e].cls.includes('error') ? 'bg-error' : ESTADOS[e].cls.includes('warning') ? 'bg-warning' : e === 'em_limpeza' ? 'bg-pine' : 'bg-line-2'} style={{ flex: n }} /> : null; })}
            </div>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(Object.keys(ESTADOS) as EstadoUnidade[]).map((e) => <li key={e} className="inline-flex items-center gap-2"><EstadoBadge estado={e} /><span className="font-mono text-[0.75rem] text-fg-2">{lista.filter((u) => u.estado === e).length}</span></li>)}
            </ul>
          </section>
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center justify-between font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Ocorrências prioritárias <Link to="/gestao/ocorrencias" className="normal-case tracking-normal text-pine">Ver todas</Link></h2>
            <ul className={`${card} divide-y divide-line-1`}>
              {ocsF.slice(0, 5).map((o) => (
                <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-cream">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5"><GravidadeTag g={o.gravidade} /><span className="truncate text-[0.8125rem] text-fg-1">{o.descricao}</span><span className="text-[0.75rem] text-fg-3">{o.unidade} · prazo {dia(o.prazo)}</span></div>
                  <StatusOcTag s={o.status} />
                </Link></li>
              ))}
              {ocsF.length === 0 && <li className="p-4 text-[0.8125rem] text-fg-2">Nenhuma ocorrência aberta.</li>}
            </ul>
          </section>
        </>
      )}
    </GestaoShell>
  );
}

/** T21 — Gestão de unidades: tabela (desktop) / cartões (celular) com filtros. */
export function T21Unidades() {
  const { us, ocs } = useDados();
  const [q, setQ] = useState('');
  const [est, setEst] = useState('');
  const lista = (us ?? []).filter((u) => (!est || u.estado === est) && `${u.nome} ${u.propriedade}`.toLowerCase().includes(q.toLowerCase()));
  const nOc = (id: string) => (ocs ?? []).filter((o) => o.unidadeId === id && abertas(o)).length;
  return (
    <GestaoShell eyebrow="Gestão" titulo="Unidades">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="search" placeholder="Buscar unidade ou propriedade" value={q} onChange={(e) => setQ(e.target.value)} className="min-h-11 flex-1 rounded-md border border-line-2 bg-white px-3 text-fg-1 placeholder:text-fg-4" aria-label="Buscar" />
        <select value={est} onChange={(e) => setEst(e.target.value)} className="min-h-11 rounded-md border border-line-2 bg-white px-3 text-fg-1" aria-label="Estado">
          <option value="">Todos os estados</option>{(Object.keys(ESTADOS) as EstadoUnidade[]).map((e) => <option key={e} value={e}>{ESTADOS[e].label}</option>)}
        </select>
      </div>
      {!us ? <Carregando /> : (
        <TabelaResp rows={lista} cols={[
          { h: 'Unidade', r: (u) => (<><Link to={`/gestao/unidades/${u.id}`} className="font-medium text-pine underline-offset-4 hover:underline">{u.nome}</Link><div className="text-[0.75rem] text-fg-3">{u.tipo}</div></>) },
          { h: 'Propriedade', r: (u) => u.propriedade },
          { h: 'Estado', r: (u) => <EstadoBadge estado={u.estado} /> },
          { h: 'Ocorrências', r: (u) => <span className="font-mono">{nOc(u.id) || '—'}</span> },
          { h: 'Última vistoria', r: (u) => <span className="text-fg-2">{u.ultima ? `${u.ultima.tipo} · ${formatarData(u.ultima.data)}` : '—'}</span> },
        ]} />
      )}
    </GestaoShell>
  );
}

/** T22 — Detalhe da unidade (gestão): cadastro, estado, vistorias e ocorrências. Mudança de estado exige justificativa. */
export function T22DetalheUnidade() {
  const { id = '' } = useParams();
  const { us, ocs, setUs, envios } = useDados();
  const [novo, setNovo] = useState<EstadoUnidade | ''>('');
  const [just, setJust] = useState('');
  const u = us?.find((x) => x.id === id);
  if (us && !u) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;

  async function aplicar() {
    alterarEstado(id, novo as EstadoUnidade, just.trim());
    setUs(await unidadesGestao()); setNovo(''); setJust('');
  }
  return (
    <GestaoShell eyebrow={u?.propriedade ?? 'Unidade'} titulo={u?.nome ?? '…'} acoes={u && <EstadoBadge estado={u.estado} size="md" />}>
      {!u || !ocs ? <Carregando /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Ocorrências</h2>
              <ul className={`${card} divide-y divide-line-1`}>
                {ocs.filter((o) => o.unidadeId === id).map((o) => (
                  <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className="flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-cream"><GravidadeTag g={o.gravidade} /><span className="flex-1 truncate text-[0.8125rem]">{o.descricao}</span><StatusOcTag s={o.status} /></Link></li>
                ))}
                {!ocs.some((o) => o.unidadeId === id) && <li className="p-4 text-[0.8125rem] text-fg-2">Sem ocorrências.</li>}
              </ul>
            </section>
            <section className="flex flex-col gap-2">
              <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Vistorias</h2>
              <ul className={`${card} divide-y divide-line-1`}>
                {envios.filter((e) => e.unidadeId === id).map((e) => (
                  <li key={e.id}><Link to={`/gestao/vistorias/${e.id}`} className="flex min-h-12 items-center justify-between gap-3 px-4 py-3 text-[0.8125rem] hover:bg-cream"><span>{e.tipo} · {formatarData(e.fim)}</span><span className="text-fg-3">{e.status}</span></Link></li>
                ))}
                {!envios.some((e) => e.unidadeId === id) && <li className="p-4 text-[0.8125rem] text-fg-2">Nenhuma vistoria registrada no histórico.</li>}
              </ul>
            </section>
          </div>
          <aside className="flex flex-col gap-4">
            <dl className={`${card} divide-y divide-line-1 text-[0.8125rem]`}>
              {[['Tipo', u.tipo + (u.andar ? ` · ${u.andar}` : '')], ['Validação', VALIDACAO[u.validacao].label], ['Ambientes', String(u.ambientes)]].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 px-4 py-3"><dt className="text-fg-3">{k}</dt><dd className="font-medium">{v}</dd></div>
              ))}
            </dl>
            <div className={`${card} flex flex-col gap-3 p-4`}>
              <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Alterar estado</h2>
              <select value={novo} onChange={(e) => setNovo(e.target.value as EstadoUnidade)} className="min-h-11 rounded-md border border-line-2 bg-white px-3" aria-label="Novo estado">
                <option value="">Selecione…</option>{(Object.keys(ESTADOS) as EstadoUnidade[]).filter((e) => e !== u.estado).map((e) => <option key={e} value={e}>{ESTADOS[e].label}</option>)}
              </select>
              <textarea rows={2} value={just} onChange={(e) => setJust(e.target.value)} placeholder="Justificativa (obrigatória)" className="rounded-md border border-line-2 bg-white p-3" aria-label="Justificativa" />
              <button type="button" className={btnPrimary} disabled={!novo || just.trim().length < 5} onClick={aplicar}>Aplicar</button>
            </div>
          </aside>
        </div>
      )}
    </GestaoShell>
  );
}

/** T23 — Lista de vistorias: filtros e exportação (CSV), paginada. */
export function T23Vistorias() {
  const envios = listarEnvios();
  const [st, setSt] = useState('');
  const [pag, setPag] = useState(0);
  const POR = 10;
  const lista = envios.filter((e) => !st || e.status === st);
  const [copiado, setCopiado] = useState(false);
  async function exportar() {
    const csv = ['unidade;tipo;fim;status;ocorrencias', ...lista.map((e) => `${e.unidade};${e.tipo};${e.fim};${e.status};${e.ocorrencias}`)].join('\n');
    try { await navigator.clipboard.writeText(csv); setCopiado(true); } catch { setCopiado(false); }
  }
  return (
    <GestaoShell eyebrow="Gestão" titulo="Vistorias" acoes={<button type="button" onClick={exportar} className={`${btnSecondary} w-auto`}><Icon icon="solar:documents-linear" width={18} aria-hidden="true" />{copiado ? 'CSV copiado' : 'Copiar CSV'}</button>}>
      <select value={st} onChange={(e) => { setSt(e.target.value); setPag(0); }} className="min-h-11 w-full rounded-md border border-line-2 bg-white px-3 sm:w-56" aria-label="Status">
        <option value="">Todos os status</option><option value="enviada">Enviada</option><option value="sinalizada">Sinalizada</option><option value="pendente">Pendente</option>
      </select>
      <TabelaResp rows={lista.slice(pag * POR, pag * POR + POR)} cols={[
        { h: 'Unidade', r: (e) => <Link to={`/gestao/vistorias/${e.id}`} className="font-medium text-pine hover:underline">{e.unidade}</Link> },
        { h: 'Tipo', r: (e) => e.tipo },
        { h: 'Concluída', r: (e) => <span className="text-fg-2">{formatarData(e.fim)}</span> },
        { h: 'Status', r: (e) => <span className={e.status === 'enviada' ? 'text-available' : 'text-warning'}>{e.status}</span> },
        { h: 'Ocorr.', r: (e) => <span className="font-mono">{e.ocorrencias}</span> },
      ]} />
      <div className="flex items-center justify-between text-[0.75rem] text-fg-3">
        <span>{lista.length} registros</span>
        <div className="flex gap-2"><button type="button" disabled={pag === 0} onClick={() => setPag(pag - 1)} className="min-h-11 px-3 disabled:opacity-40">Anterior</button><button type="button" disabled={(pag + 1) * POR >= lista.length} onClick={() => setPag(pag + 1)} className="min-h-11 px-3 disabled:opacity-40">Próxima</button></div>
      </div>
    </GestaoShell>
  );
}

/** T24 — Detalhe da vistoria: registro final, somente leitura. */
export function T24DetalheVistoria() {
  const { id = '' } = useParams();
  const e = listarEnvios().find((x) => x.id === id);
  if (!e) return <Navigate to="/gestao/vistorias" replace />;
  return (
    <GestaoShell eyebrow={`${e.unidade} · ${e.tipo}`} titulo="Detalhe da vistoria" acoes={<Link to={`/gestao/vistorias/${id}/relatorio`} className={`${btnPrimary} w-auto`}><Icon icon="solar:document-text-linear" width={18} aria-hidden="true" />Relatório</Link>}>
      <p className="flex items-center gap-2 text-[0.8125rem] text-fg-2"><Icon icon="solar:lock-linear" width={16} className="text-pine" aria-hidden="true" />Registro final: somente leitura.</p>
      <Metadados e={e} />
    </GestaoShell>
  );
}

function Metadados({ e }: { e: Envio }) {
  return (
    <dl className={`${card} grid grid-cols-1 divide-y divide-line-1 text-[0.8125rem] sm:grid-cols-2 sm:divide-y-0`}>
      {[['Unidade', e.unidade], ['Tipo', e.tipo], ['Início', formatarData(e.inicio)], ['Conclusão', formatarData(e.fim)], ['Status', e.status], ['Ocorrências', String(e.ocorrencias)], ['Sinalizações', e.sinalizacoes.join(' · ') || '—'], ['Novo estado', e.novoEstado ? ESTADOS[e.novoEstado].label : '—'], ['UUID', e.id]].map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 px-4 py-3 sm:border-b sm:border-line-1"><dt className="text-fg-3">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
      ))}
    </dl>
  );
}

/** T25 — Lista de ocorrências: gravidade, status, prazo e responsável; críticas em destaque. */
export function T25Ocorrencias() {
  const { ocs } = useDados();
  const [st, setSt] = useState<'abertas' | StatusOc | ''>('abertas');
  const lista = useMemo(() => (ocs ?? []).filter((o) => !st || (st === 'abertas' ? abertas(o) : o.status === st)).sort((a, b) => ORD[a.gravidade] - ORD[b.gravidade] || a.prazo.localeCompare(b.prazo)), [ocs, st]);
  return (
    <GestaoShell eyebrow="Gestão" titulo="Ocorrências">
      <select value={st} onChange={(e) => setSt(e.target.value as typeof st)} className="min-h-11 w-full rounded-md border border-line-2 bg-white px-3 sm:w-56" aria-label="Status">
        <option value="abertas">Abertas e em tratamento</option><option value="">Todas</option>{(Object.keys(STATUS_OC) as StatusOc[]).map((s) => <option key={s} value={s}>{STATUS_OC[s].label}</option>)}
      </select>
      {!ocs ? <Carregando /> : (
        <ul className="flex flex-col gap-2">
          {lista.map((o) => (
            <li key={o.id}><Link to={`/gestao/ocorrencias/${o.id}`} className={`${card} flex flex-col gap-2 p-4 hover:shadow-md sm:flex-row sm:items-center ${o.gravidade === 'critica' && abertas(o) ? 'border-error' : ''}`}>
              <div className="flex min-w-0 flex-1 flex-col gap-1"><GravidadeTag g={o.gravidade} /><span className="text-[0.875rem] text-fg-1">{o.descricao}</span><span className="text-[0.75rem] text-fg-3">{o.unidade} · {o.ambiente}</span></div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.75rem] text-fg-2"><span>Prazo {dia(o.prazo)}</span><span>{o.responsavel ?? 'Sem responsável'}</span><StatusOcTag s={o.status} /></div>
            </Link></li>
          ))}
          {lista.length === 0 && <li className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhuma ocorrência neste filtro.</li>}
        </ul>
      )}
    </GestaoShell>
  );
}

/** T26 — Tratamento da ocorrência: atribuir, prazo, comentários e status, com histórico completo. */
export function T26Tratamento() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { ocs, setOcs } = useDados();
  const o = ocs?.find((x) => x.id === id);
  const [com, setCom] = useState('');
  if (ocs && !o) return <Navigate to="/gestao/ocorrencias" replace />;

  async function mudar(mud: Partial<OcorrenciaG>, texto: string) {
    const n = await atualizarOcorrencia(id, mud, texto);
    setOcs((l) => l!.map((x) => (x.id === id ? n : x)));
  }
  const fechada = o && !abertas(o);
  return (
    <GestaoShell eyebrow={o ? `${o.unidade} · ${o.ambiente}` : 'Ocorrência'} titulo={o?.descricao ?? '…'} acoes={o && <StatusOcTag s={o.status} />}>
      {!o ? <Carregando /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex flex-col gap-3">
            <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Histórico</h2>
            <ol className={`${card} flex flex-col gap-4 p-4`}>
              {o.historico.map((h, i) => (
                <li key={i} className="flex gap-3 text-[0.8125rem]"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-pine" /><div><p className="text-fg-1">{h.texto}</p><p className="text-[0.75rem] text-fg-3">{formatarData(h.em)}</p></div></li>
              ))}
            </ol>
            {!fechada && (
              <div className="flex flex-col gap-2">
                <textarea rows={2} value={com} onChange={(e) => setCom(e.target.value)} placeholder="Adicionar comentário" className="rounded-md border border-line-2 bg-white p-3" aria-label="Comentário" />
                <button type="button" className={`${btnSecondary} sm:w-auto sm:self-end`} disabled={!com.trim()} onClick={() => { mudar({}, `Comentário: ${com.trim()}`); setCom(''); }}>Comentar</button>
              </div>
            )}
          </section>
          <aside className={`${card} flex flex-col gap-3 p-4`}>
            <GravidadeTag g={o.gravidade} />
            <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">Responsável
              <select disabled={fechada} value={o.responsavel ?? ''} onChange={(e) => mudar({ responsavel: e.target.value, status: o.status === 'aberta' ? 'em_tratamento' : o.status }, `Atribuída a ${e.target.value}`)} className="min-h-11 rounded-md border border-line-2 bg-white px-3 text-fg-1">
                <option value="" disabled>Selecione…</option>{RESPONSAVEIS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">Prazo
              <input type="date" disabled={fechada} value={o.prazo} onChange={(e) => e.target.value && mudar({ prazo: e.target.value }, `Prazo alterado para ${dia(e.target.value)}`)} className="min-h-11 rounded-md border border-line-2 bg-white px-3 text-fg-1" />
            </label>
            {!fechada && (
              <>
                <button type="button" className={btnPrimary} disabled={!o.responsavel} onClick={() => mudar({ status: 'resolvida' }, 'Marcada como resolvida (estado da unidade não muda sozinho)')}>
                  <Icon icon="solar:check-circle-linear" width={18} aria-hidden="true" /> Resolver
                </button>
                <button type="button" className={btnSecondary} disabled={com.trim().length < 5} onClick={() => mudar({ status: 'cancelada' }, `Cancelada: ${com.trim()}`)} title="Escreva a justificativa no campo de comentário">
                  Cancelar (justificativa no comentário)
                </button>
              </>
            )}
            <button type="button" className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4" onClick={() => navigate(`/gestao/unidades/${o.unidadeId}`)}>Ver unidade</button>
          </aside>
        </div>
      )}
    </GestaoShell>
  );
}

/** T27 — Relatório: prévia do PDF que reflete o registro enviado. */
export function T27Relatorio() {
  const { id = '' } = useParams();
  const e = listarEnvios().find((x) => x.id === id);
  const [ocs, setOcs] = useState<OcorrenciaG[]>([]);
  useEffect(() => { listarOcorrencias().then(setOcs); }, []);
  if (!e) return <Navigate to="/gestao/vistorias" replace />;
  return (
    <GestaoShell eyebrow="Relatório" titulo={`${e.unidade} · ${e.tipo}`}>
      <p className="flex items-start gap-2 text-[0.75rem] text-fg-3"><Icon icon="solar:info-circle-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />Mockup: prévia do PDF. A geração do arquivo será feita no servidor (Edge Function) na versão real.</p>
      <article className="mx-auto flex w-full max-w-[42rem] flex-col gap-5 rounded-sm border border-line-1 bg-white p-[clamp(1.25rem,4vw,3rem)] shadow-lg">
        <header className="flex items-start justify-between gap-4 border-b border-line-1 pb-4">
          <div><p className="text-[0.625rem] uppercase tracking-[0.32em] text-fg-3">Relatório de vistoria</p><h2 className="font-serif text-2xl font-medium text-fg-1">{e.unidade}</h2><p className="text-[0.8125rem] text-fg-2">{e.tipo} · {formatarData(e.fim)}</p></div>
          <Icon icon="solar:leaf-linear" width={32} className="text-pine-deep" aria-hidden="true" />
        </header>
        <Metadados e={e} />
        <section className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-[0.08em] text-fg-2">Ocorrências da unidade</h3>
          <ul className="divide-y divide-line-1 text-[0.8125rem]">{ocs.filter((o) => o.unidadeId === e.unidadeId).map((o) => <li key={o.id} className="flex items-center justify-between gap-3 py-2"><span>{o.descricao}</span><GravidadeTag g={o.gravidade} /></li>)}</ul>
        </section>
        <footer className="flex items-end justify-between gap-4 border-t border-line-1 pt-4 text-[0.75rem] text-fg-3"><span>UUID {e.id}</span><span>Assinatura do assessor registrada</span></footer>
      </article>
    </GestaoShell>
  );
}
