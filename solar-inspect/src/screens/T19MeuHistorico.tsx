import { useState } from 'react';
import AppHeader from '../components/AppHeader';
import { Seletor } from '../components/Filtros';
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
          <Seletor rotulo="Unidade" icone="solar:home-2-linear" valor={unidade} onChange={setUnidade} opcoes={[{ valor: '', label: 'Todas as unidades' }, ...opc('unidade').map((o) => ({ valor: o, label: o }))]} />
          <Seletor rotulo="Tipo" icone="solar:clipboard-list-linear" valor={tipo} onChange={setTipo} opcoes={[{ valor: '', label: 'Todos os tipos' }, ...opc('tipo').map((o) => ({ valor: o, label: o }))]} />
          <Seletor rotulo="Status" icone="solar:check-circle-linear" valor={status} onChange={setStatus} opcoes={[{ valor: '', label: 'Todos os status' }, { valor: 'enviada', label: 'Enviada' }, { valor: 'sinalizada', label: 'Sinalizada' }, { valor: 'pendente', label: 'Pendente' }]} />
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
