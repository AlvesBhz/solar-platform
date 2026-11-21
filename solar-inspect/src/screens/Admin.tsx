import { Icon } from '@iconify/react';
import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Seletor } from '../components/Filtros';
import GestaoShell, { card } from '../components/GestaoShell';
import { btnSecondary } from '../components/ScreenShell';
import { formatarData } from '../components/Status';
import { listarUsuarios, type Usuario } from '../lib/admin';
import { hoje } from '../lib/campo';
import { TABELAS_AUDITADAS, listarAuditoria, type EventoAud } from '../lib/gestao';
import { usePerfilPermitido } from '../lib/useAdmin';

const menosDias = (d: string, n: number) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() - n); return x.toISOString().slice(0, 10); };
const ACAO_COR = { criou: 'text-available', alterou: 'text-pine', removeu: 'text-error' };

/** T34 — Auditoria (só ADMIN): quem mudou o quê nas vistorias, com filtros por período, assunto e usuário. Somente leitura. */
export function T34Auditoria() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const [f, setF] = useState({ de: menosDias(hoje(), 6), ate: hoje(), tabela: '', usuario: '' });
  const [pag, setPag] = useState(0);
  const [res, setRes] = useState<{ lista: EventoAud[]; total: number } | null>(null);
  const [erro, setErro] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const POR = 50;

  useEffect(() => { if (perfil) listarUsuarios().then(setUsuarios).catch(() => setUsuarios([])); }, [perfil]);
  useEffect(() => {
    if (!perfil) return;
    setRes(null); setErro(false);
    listarAuditoria(f, pag, POR).then(setRes).catch(() => setErro(true));
  }, [perfil, f, pag]);
  const mudar = (p: Partial<typeof f>) => { setF({ ...f, ...p }); setPag(0); };
  const data = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-fg-1';
  const total = res?.total ?? 0;

  return (
    <GestaoShell eyebrow="Administração" titulo="Auditoria">
      <p className="text-[0.8125rem] text-fg-3">Cada mudança nas vistorias, unidades, checklists e usuários fica registrada pelo banco com quem fez e o que mudou. CPF e código do QR nunca aparecem.</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">De<input type="date" className={data} value={f.de} max={f.ate} onChange={(e) => e.target.value && mudar({ de: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-[0.75rem] text-fg-3">Até<input type="date" className={data} value={f.ate} min={f.de} max={hoje()} onChange={(e) => e.target.value && mudar({ ate: e.target.value })} /></label>
        <Seletor rotulo="Assunto" icone="solar:folder-linear" valor={f.tabela} onChange={(v) => mudar({ tabela: v })} opcoes={[{ valor: '', label: 'Todos os assuntos' }, ...Object.entries(TABELAS_AUDITADAS).map(([valor, label]) => ({ valor, label }))]} />
        <Seletor rotulo="Usuário" icone="solar:user-rounded-linear" valor={f.usuario} onChange={(v) => mudar({ usuario: v })} opcoes={[{ valor: '', label: 'Todos os usuários' }, ...usuarios.map((u) => ({ valor: u.id, label: u.nome }))]} />
      </div>
      {erro ? (
        <div role="alert" className={`${card} flex flex-col items-start gap-3 p-4 text-[0.8125rem] text-error`}>Não foi possível carregar a auditoria. Verifique a conexão e o período (até 1 ano).<button type="button" className={`${btnSecondary} w-auto`} onClick={() => setF({ ...f })}>Tentar de novo</button></div>
      ) : !res ? (
        <div className={`${card} h-40 animate-pulse`} aria-busy="true" />
      ) : res.lista.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-2 p-8 text-center text-[0.8125rem] text-fg-2">Nenhum registro neste período e filtro.</p>
      ) : (
        <ul className={`${card} divide-y divide-line-1`}>
          {res.lista.map((e) => (
            <li key={e.id} className="flex flex-col gap-1 px-4 py-3 text-[0.8125rem]">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="min-w-0 text-fg-1"><strong className="font-medium">{e.usuario}</strong>{e.perfil ? <span className="text-fg-3"> ({e.perfil.toLowerCase()})</span> : null} <span className={ACAO_COR[e.acao]}>{e.acao}</span> {e.tabela.toLowerCase()}{e.unidade ? ` · ${e.unidade}` : ''}</span>
                <span className="shrink-0 font-mono text-[0.75rem] text-fg-3">{formatarData(e.em)}</span>
              </div>
              {e.detalhe && <p className="text-[0.75rem] text-fg-2 [overflow-wrap:anywhere]">{e.detalhe}</p>}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {e.campos.length > 3 && (
                  <details className="text-[0.75rem] text-fg-2">
                    <summary className="min-h-11 cursor-pointer content-center text-pine">Ver todos os {e.campos.length} campos</summary>
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 pb-2">{e.campos.map(([k, v]) => <Fragment key={k}><dt className="font-mono text-fg-3">{k}</dt><dd className="[overflow-wrap:anywhere]">{v}</dd></Fragment>)}</dl>
                  </details>
                )}
                {e.link && <Link to={e.link} className="inline-flex min-h-11 items-center gap-1 text-[0.75rem] text-pine underline-offset-4 hover:underline"><Icon icon="solar:arrow-right-linear" width={14} aria-hidden="true" />Abrir</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between text-[0.75rem] text-fg-3">
        <span>{total} registro{total === 1 ? '' : 's'}</span>
        <div className="flex gap-2"><button type="button" disabled={pag === 0} onClick={() => setPag(pag - 1)} className="min-h-11 px-3 disabled:opacity-40">Anterior</button><button type="button" disabled={(pag + 1) * POR >= total} onClick={() => setPag(pag + 1)} className="min-h-11 px-3 disabled:opacity-40">Próxima</button></div>
      </div>
    </GestaoShell>
  );
}
