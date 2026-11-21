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


