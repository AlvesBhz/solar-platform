import { Icon } from '@iconify/react';
import { useState } from 'react';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { useOnline } from '../components/NetworkBadge';
import { btnPrimary } from '../components/ScreenShell';
import { formatarData } from '../components/Status';
import { listarEnvios, sincronizar, type Envio } from '../mocks/envios';

/** T18 — Sincronização: fila offline com tentativas e erro. Reenvio idempotente (mesmo UUID). */
export default function T18Sincronizacao() {
  const online = useOnline();
  const [lista, setLista] = useState<Envio[]>(listarEnvios);
  const [rodando, setRodando] = useState(false);
  const pendentes = lista.filter((e) => e.status === 'pendente');
  const recentes = lista.filter((e) => e.status !== 'pendente').slice(0, 5);

  async function tentar() { setRodando(true); setLista(await sincronizar()); setRodando(false); }

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back="/app/unidades" eyebrow="Vistorias" title="Sincronização" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className={`flex items-center gap-3 rounded-xl border p-4 ${pendentes.length ? 'border-transparent bg-warning-bg text-warning' : 'border-line-1 bg-white text-available'}`} role="status">
          <Icon icon={pendentes.length ? 'solar:cloud-cross-linear' : 'solar:check-circle-linear'} width={24} aria-hidden="true" />
          <div className="flex flex-col">
            <span className="text-[0.9375rem] font-medium">{pendentes.length ? `${pendentes.length} vistoria${pendentes.length > 1 ? 's' : ''} aguardando envio` : 'Tudo sincronizado'}</span>
            <span className="text-[0.75rem] opacity-80">{online ? 'Conectado' : 'Sem conexão: envio automático quando voltar'}</span>
          </div>
        </div>

        {pendentes.length > 0 && <Grupo titulo="Na fila" itens={pendentes} />}
        <Grupo titulo="Enviadas recentemente" itens={recentes} />
      </main>
      {pendentes.length > 0 && (
        <BottomBar>
          <button type="button" className={btnPrimary} disabled={rodando} onClick={tentar}>
            <Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /> {rodando ? 'Sincronizando…' : 'Tentar agora'}
          </button>
        </BottomBar>
      )}
    </div>
  );
}

function Grupo({ titulo, itens }: { titulo: string; itens: Envio[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center justify-between font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">{titulo}<span className="font-mono text-fg-3">{itens.length}</span></h2>
      <ul className="divide-y divide-line-1 overflow-hidden rounded-xl border border-line-1 bg-white">
        {itens.map((e) => <LinhaEnvio key={e.id} e={e} />)}
      </ul>
    </section>
  );
}

const STATUS = {
  pendente: { label: 'Pendente', icon: 'solar:clock-circle-linear', cls: 'text-warning' },
  enviada: { label: 'Enviada', icon: 'solar:check-circle-linear', cls: 'text-available' },
  sinalizada: { label: 'Sinalizada', icon: 'solar:shield-warning-linear', cls: 'text-warning' },
};

export function LinhaEnvio({ e }: { e: Envio }) {
  const s = STATUS[e.status];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon icon="solar:clipboard-check-linear" width={20} className="mt-0.5 shrink-0 text-pine" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[0.875rem] font-medium text-fg-1">{e.unidade} · {e.tipo}</span>
        <span className="text-[0.75rem] text-fg-3">{formatarData(e.fim)}{e.ocorrencias ? ` · ${e.ocorrencias} ocorrência${e.ocorrencias > 1 ? 's' : ''}` : ''}</span>
        {e.status === 'pendente' && <span className="text-[0.75rem] text-fg-3">{e.tentativas} tentativa{e.tentativas === 1 ? '' : 's'}{e.ultimoErro ? ` · ${e.ultimoErro}` : ''}</span>}
        {e.sinalizacoes.length > 0 && <span className="text-[0.75rem] text-warning">{e.sinalizacoes.join(' · ')}</span>}
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 text-[0.75rem] font-medium ${s.cls}`}><Icon icon={s.icon} width={16} aria-hidden="true" />{s.label}</span>
    </li>
  );
}
