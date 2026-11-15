import { useState } from 'react';
import AppHeader from '../components/AppHeader';
import { listarEnvios } from '../mocks/envios';
import { Aviso } from './T05MinhasUnidades';
import { LinhaEnvio } from './T18Sincronizacao';

/** T19 — Meu histórico: vistorias do próprio assessor, com filtros por unidade, tipo e status. */
export default function T19MeuHistorico() {
  const todos = listarEnvios();
  const [unidade, setUnidade] = useState('');
  const [tipo, setTipo] = useState('');
  const [status, setStatus] = useState('');
  const opc = (k: 'unidade' | 'tipo') => [...new Set(todos.map((e) => e[k]))];
  const lista = todos.filter((e) => (!unidade || e.unidade === unidade) && (!tipo || e.tipo === tipo) && (!status || e.status === status));
  const sel = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-fg-1 shadow-sm focus:border-pine focus:outline-none';

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back="/app/unidades" eyebrow="Vistorias" title="Meu histórico" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-3">
          <select aria-label="Unidade" value={unidade} onChange={(e) => setUnidade(e.target.value)} className={sel}><option value="">Todas as unidades</option>{opc('unidade').map((o) => <option key={o}>{o}</option>)}</select>
          <select aria-label="Tipo" value={tipo} onChange={(e) => setTipo(e.target.value)} className={sel}><option value="">Todos os tipos</option>{opc('tipo').map((o) => <option key={o}>{o}</option>)}</select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
            <option value="">Todos os status</option><option value="enviada">Enviada</option><option value="sinalizada">Sinalizada</option><option value="pendente">Pendente</option>
          </select>
        </div>
        {lista.length === 0 ? (
          <Aviso icon="solar:history-linear" tom="text-fg-3" titulo="Nenhuma vistoria encontrada" texto="Ajuste os filtros." />
        ) : (
          <ul className="divide-y divide-line-1 overflow-hidden rounded-xl border border-line-1 bg-white">{lista.map((e) => <LinhaEnvio key={e.id} e={e} />)}</ul>
        )}
      </main>
    </div>
  );
}
