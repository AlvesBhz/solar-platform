import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Seletor } from '../components/Filtros';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { checklistDa, type Ambiente } from '../mocks/checklist';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { VALIDACAO, formatarData } from '../components/Status';
import { listarAuditoria, registrarAuditoria, unidadesGestao } from '../mocks/gestao';
import { listarTipos, type TipoVistoria, type Unidade } from '../mocks/unidades';

/** T34 — Auditoria: eventos por usuário, ação e período. Somente leitura. */
export function T34Auditoria() {
  const ev = listarAuditoria();
  const [q, setQ] = useState('');
  const lista = ev.filter((e) => `${e.usuario} ${e.acao} ${e.detalhe}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <GestaoShell eyebrow="Administração" titulo="Auditoria">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por usuário, ação ou unidade" className="min-h-11 rounded-md border border-line-2 bg-white px-3 placeholder:text-fg-4" aria-label="Filtrar" />
      <TabelaResp rows={lista} cols={[
        { h: 'Quando', r: (e) => <span className="font-mono text-[0.75rem] text-fg-2">{formatarData(e.em)}</span> },
        { h: 'Usuário', r: (e) => e.usuario },
        { h: 'Ação', principal: true, r: (e) => e.acao },
        { h: 'Detalhe', r: (e) => <span className="text-fg-2">{e.detalhe}</span> },
      ]} />
    </GestaoShell>
  );
}

/* ───────── T29 · T30 · T31 · T33 ───────── */
const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-fg-1 focus:border-pine focus:outline-none';
const rot = 'flex flex-col gap-1 text-[0.75rem] uppercase tracking-[0.08em] text-fg-2';
/** T30 — Ambientes e itens: árvore, ordem, criticidade e referência. Alterações valem para novas vistorias (histórico preservado). */
export function T30Ambientes() {
  const [us, setUs] = useState<Unidade[]>([]);
  const [uid, setUid] = useState('chale-ipe');
  const [arv, setArv] = useState<Ambiente[]>([]);
  const [novo, setNovo] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(false);
  const [novoAmb, setNovoAmb] = useState('');
  const addAmb = () => {
    const n = novoAmb.trim();
    if (!n) return;
    setArv([...arv, { id: `amb-${Date.now()}`, nome: n, icon: 'solar:home-2-linear', itens: [] }]);
    setNovoAmb(''); setSalvo(false);
  };
  useEffect(() => { unidadesGestao().then(setUs); }, []);
  useEffect(() => { const u = us.find((x) => x.id === uid); if (u) setArv(checklistDa(u).map((a) => ({ ...a, itens: a.itens.map((i) => ({ ...i })) }))); setSalvo(false); }, [us, uid]);
  const mover = (i: number, d: number) => { const l = [...arv]; [l[i], l[i + d]] = [l[i + d], l[i]]; setArv(l); setSalvo(false); };
  const alt = (ai: number, ii: number, k: 'critico' | 'foto') => { setArv(arv.map((a, x) => x !== ai ? a : { ...a, itens: a.itens.map((it, y) => y !== ii ? it : { ...it, [k]: !it[k] }) })); setSalvo(false); };
  const add = (ai: number) => { const n = novo[arv[ai].id]?.trim(); if (!n) return; setArv(arv.map((a, x) => x !== ai ? a : { ...a, itens: [...a.itens, { id: `novo-${Date.now()}`, nome: n }] })); setNovo({ ...novo, [arv[ai].id]: '' }); setSalvo(false); };
  return (
    <GestaoShell eyebrow="Administração" titulo="Ambientes e itens" acoes={
      <Seletor rotulo="Unidade" icone="solar:home-2-linear" valor={uid} onChange={setUid} opcoes={us.map((u) => ({ valor: u.id, label: u.nome }))} className="min-w-[11rem]" />}>
      <p className="text-[0.8125rem] text-fg-2">Ordem física do percurso. As mudanças valem para novas vistorias; as já enviadas preservam o checklist original.</p>
      <ol className="flex flex-col gap-3">
        {arv.map((a, ai) => (
          <li key={a.id} className={`${card} flex flex-col gap-3 p-4`}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.75rem] text-fg-3">{ai + 1}</span>
              {a.ref ? <img src={a.ref} alt="" width={64} height={36} className="h-9 w-16 rounded object-cover" /> : <span className="flex h-9 w-16 items-center justify-center rounded bg-cream text-fg-3"><Icon icon={a.icon} width={18} aria-hidden="true" /></span>}
              <span className="flex-1 text-[0.9375rem] font-medium text-fg-1">{a.nome}</span>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream disabled:opacity-30" disabled={ai === 0} onClick={() => mover(ai, -1)} aria-label={`Subir ${a.nome}`}><Icon icon="solar:alt-arrow-up-linear" width={18} /></button>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream disabled:opacity-30" disabled={ai === arv.length - 1} onClick={() => mover(ai, 1)} aria-label={`Descer ${a.nome}`}><Icon icon="solar:alt-arrow-down-linear" width={18} /></button>
            </div>
            <ul className="divide-y divide-line-1 rounded-md border border-line-1 empty:hidden">
              {a.itens.map((it, ii) => (
                <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[0.8125rem]">
                  <span className="min-w-0 flex-1">{it.nome}</span>
                  {(['critico', 'foto'] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={!!it[k]} onClick={() => alt(ai, ii, k)}
                      className={`inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] uppercase tracking-[0.08em] ${it[k] ? (k === 'critico' ? 'text-error' : 'text-pine') : 'text-fg-4'}`}>
                      <Icon icon={k === 'critico' ? 'solar:danger-triangle-linear' : 'solar:camera-linear'} width={14} aria-hidden="true" />{k === 'critico' ? 'Crítico' : 'Foto'}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input aria-label={`Novo item em ${a.nome}`} className={campo} placeholder="Novo item" value={novo[a.id] ?? ''} onChange={(e) => setNovo({ ...novo, [a.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add(ai)} />
              <button type="button" className={`${btnSecondary} w-auto`} onClick={() => add(ai)}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Adicionar</button>
            </div>
          </li>
        ))}
      </ol>
      <div className={`${card} flex flex-col gap-3 border-dashed p-4`}>
        <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Novo ambiente</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Nome do novo ambiente" className={campo} placeholder="Ex.: Área gourmet" value={novoAmb} onChange={(e) => setNovoAmb(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAmb()} />
          <button type="button" className={`${btnSecondary} sm:w-auto sm:shrink-0`} disabled={!novoAmb.trim()} onClick={addAmb}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Criar ambiente</button>
        </div>
        <p className="text-[0.75rem] text-fg-3">Entra no fim do percurso; use as setas para reposicionar e adicione os itens em seguida.</p>
      </div>
      <button type="button" className={`${btnPrimary} sm:w-auto sm:self-start`} disabled={salvo} onClick={() => { registrarAuditoria('Checklist alterado', `${uid}: nova versão com ${arv.reduce((n, a) => n + a.itens.length, 0)} itens`); setSalvo(true); }}>
        {salvo ? 'Nova versão salva' : 'Salvar nova versão'}
      </button>
    </GestaoShell>
  );
}

const PERIODOS = ['Por estadia', 'Semanal', 'Mensal', 'Trimestral', 'Sob demanda'];
/** T31 — Tipos de vistoria: nome, periodicidade, itens e ordem. Valida antes de ativar. */
export function T31Tipos() {
  const [ts, setTs] = useState<(TipoVistoria & { periodo: string })[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { listarTipos().then((l) => setTs(l.map((t) => ({ ...t, periodo: t.id === 'preventiva' ? 'Mensal' : t.id === 'enxoval' ? 'Semanal' : t.id === 'dedetizacao' ? 'Trimestral' : 'Por estadia' })))); }, []);
  function alternar(i: number) {
    const t = ts[i];
    if (!t.ativo && t.itens === 0) return setMsg(`"${t.nome}" não pode ser ativado: o checklist não tem itens.`);
    setTs(ts.map((x, j) => j === i ? { ...x, ativo: !x.ativo } : x)); setMsg('');
    registrarAuditoria(t.ativo ? 'Tipo desativado' : 'Tipo ativado', `${t.nome} (vistorias anteriores preservadas)`);
  }
  return (
    <GestaoShell eyebrow="Administração" titulo="Tipos de vistoria">
      {msg && <p className="flex items-center gap-2 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning" role="alert"><Icon icon="solar:danger-circle-linear" width={18} aria-hidden="true" />{msg}</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {ts.map((t, i) => (
          <li key={t.id} className={`${card} flex flex-col gap-3 p-4 ${t.ativo ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[0.9375rem] font-medium text-fg-1">{t.nome}</p><p className="text-[0.75rem] text-fg-3">{t.itens} itens · {t.respostas.join(' / ') || 'sem respostas'}</p></div>
              <button type="button" aria-pressed={t.ativo} onClick={() => alternar(i)} className={`inline-flex min-h-11 shrink-0 items-center gap-1 text-[0.75rem] font-medium ${t.ativo ? 'text-available' : 'text-fg-3'}`}>
                <Icon icon={t.ativo ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} width={16} aria-hidden="true" />{t.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
            <p className="text-[0.8125rem] text-fg-2">{t.descricao}</p>
            <label className={rot}>Periodicidade
              <Seletor rotulo="Periodicidade" valor={t.periodo} onChange={(v) => setTs(ts.map((x, j) => (j === i ? { ...x, periodo: v } : x)))} opcoes={PERIODOS.map((p) => ({ valor: p, label: p }))} />
            </label>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}

