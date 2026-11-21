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

