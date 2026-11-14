import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import GestaoShell, { card, td, th } from '../components/GestaoShell';
import { VALIDACAO, formatarData } from '../components/Status';
import { listarAuditoria, registrarAuditoria, unidadesGestao } from '../mocks/gestao';
import type { Unidade } from '../mocks/unidades';

/** T28 — Propriedades: busca, status e unidades. Desativar sem apagar. */
export function T28Propriedades() {
  const [us, setUs] = useState<Unidade[]>([]);
  const [inativas, setInativas] = useState<string[]>([]);
  useEffect(() => { unidadesGestao().then(setUs); }, []);
  const props = [...new Set(us.map((u) => u.propriedade))].map((nome) => ({ nome, unidades: us.filter((u) => u.propriedade === nome) }));
  return (
    <GestaoShell eyebrow="Administração" titulo="Propriedades">
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {props.map((p) => {
          const ativa = !inativas.includes(p.nome);
          return (
            <li key={p.nome} className={`${card} flex flex-col gap-3 p-4 ${ativa ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[0.9375rem] font-medium text-fg-1">{p.nome}</p><p className="text-[0.75rem] text-fg-3">{p.unidades.length} unidades</p></div>
                <span className={`inline-flex items-center gap-1 text-[0.75rem] font-medium ${ativa ? 'text-available' : 'text-fg-3'}`}><Icon icon={ativa ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} width={16} aria-hidden="true" />{ativa ? 'Ativa' : 'Inativa'}</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">{p.unidades.map((u) => <li key={u.id} className="inline-flex items-center gap-1 rounded-full border border-line-1 px-2.5 py-1 text-[0.6875rem] text-fg-2"><Icon icon={VALIDACAO[u.validacao].icon} width={12} aria-hidden="true" />{u.nome}</li>)}</ul>
              <button type="button" className="min-h-11 self-start text-[0.75rem] text-pine underline underline-offset-4" onClick={() => { setInativas((l) => ativa ? [...l, p.nome] : l.filter((x) => x !== p.nome)); registrarAuditoria(ativa ? 'Propriedade desativada' : 'Propriedade reativada', p.nome); }}>
                {ativa ? 'Desativar (mantém o histórico)' : 'Reativar'}
              </button>
            </li>
          );
        })}
      </ul>
    </GestaoShell>
  );
}

const USUARIOS = [
  { nome: 'Ana Souza', email: 'ana@solar.dev', perfil: 'Assessor', props: 'Pousada Solar do Espinhaço', ativo: true },
  { nome: 'Bruno Lima', email: 'bruno@solar.dev', perfil: 'Assessor', props: 'Pousada Solar do Espinhaço', ativo: true },
  { nome: 'Carla Dias', email: 'carla@solar.dev', perfil: 'Assessor', props: 'Hotel Lapinha', ativo: true },
  { nome: 'Gestor Demo', email: 'gestor@solar.dev', perfil: 'Gestor', props: 'Todas', ativo: true },
  { nome: 'Usuário Inativo', email: 'inativo@solar.dev', perfil: 'Assessor', props: 'Hotel Lapinha', ativo: false },
];

/** T32 — Usuários e permissões: perfil, propriedades e status (menor privilégio). */
export function T32Usuarios() {
  const [l, setL] = useState(USUARIOS);
  return (
    <GestaoShell eyebrow="Administração" titulo="Usuários e permissões">
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[38rem]">
          <thead className="border-b border-line-1"><tr><th className={th}>Usuário</th><th className={th}>Perfil</th><th className={th}>Propriedades</th><th className={th}>Status</th></tr></thead>
          <tbody className="divide-y divide-line-1">
            {l.map((u, i) => (
              <tr key={u.email}>
                <td className={td}><div className="font-medium">{u.nome}</div><div className="text-[0.75rem] text-fg-3">{u.email}</div></td>
                <td className={td}>{u.perfil}</td><td className={`${td} text-fg-2`}>{u.props}</td>
                <td className={td}>
                  <button type="button" aria-pressed={u.ativo} onClick={() => { setL((x) => x.map((y, j) => j === i ? { ...y, ativo: !y.ativo } : y)); registrarAuditoria(u.ativo ? 'Usuário desativado' : 'Usuário reativado', u.email); }}
                    className={`inline-flex min-h-11 items-center gap-1.5 text-[0.75rem] font-medium ${u.ativo ? 'text-available' : 'text-fg-3'}`}>
                    <Icon icon={u.ativo ? 'solar:check-circle-linear' : 'solar:user-block-linear'} width={16} aria-hidden="true" />{u.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[0.75rem] text-fg-3">Toque no status para ativar ou desativar. O acesso de cada usuário fica limitado às propriedades vinculadas (RLS).</p>
    </GestaoShell>
  );
}

/** T34 — Auditoria: eventos por usuário, ação e período. Somente leitura. */
export function T34Auditoria() {
  const ev = listarAuditoria();
  const [q, setQ] = useState('');
  const lista = ev.filter((e) => `${e.usuario} ${e.acao} ${e.detalhe}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <GestaoShell eyebrow="Administração" titulo="Auditoria">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por usuário, ação ou unidade" className="min-h-11 rounded-md border border-line-2 bg-white px-3 placeholder:text-fg-4" aria-label="Filtrar" />
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[36rem]">
          <thead className="border-b border-line-1"><tr><th className={th}>Quando</th><th className={th}>Usuário</th><th className={th}>Ação</th><th className={th}>Detalhe</th></tr></thead>
          <tbody className="divide-y divide-line-1">
            {lista.map((e, i) => <tr key={i}><td className={`${td} whitespace-nowrap font-mono text-[0.75rem] text-fg-2`}>{formatarData(e.em)}</td><td className={td}>{e.usuario}</td><td className={`${td} font-medium`}>{e.acao}</td><td className={`${td} text-fg-2`}>{e.detalhe}</td></tr>)}
          </tbody>
        </table>
      </div>
    </GestaoShell>
  );
}
