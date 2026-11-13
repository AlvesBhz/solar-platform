import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary } from '../components/ScreenShell';
import { listarTiposAtivos, obterUnidade, type TipoVistoria, type Unidade } from '../mocks/unidades';

const ICONES: Record<string, string> = {
  entrada: 'solar:login-3-linear',
  saida: 'solar:logout-3-linear',
  preventiva: 'solar:settings-linear',
};

/** T07 — Tipo de vistoria: mostra só os tipos ativos e aplicáveis à unidade. Segue para a T08. */
export default function T07TipoVistoria() {
  const { unidadeId = '' } = useParams();
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [tipos, setTipos] = useState<TipoVistoria[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    listarTiposAtivos().then(setTipos);
  }, [unidadeId]);

  if (u === undefined) return <Navigate to="/acesso-indisponivel?motivo=sem-permissao" replace />;

  const indisponivel = (t: TipoVistoria) => (t.exigeEntrada && !u?.entradaVinculadaId ? 'Requer uma vistoria de entrada vinculada (estadia em curso).' : null);

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`/app/unidades/${unidadeId}`} eyebrow={u?.nome ?? 'Nova vistoria'} title="Tipo de vistoria" />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Nova vistoria</span>
          <h1 className="screen-title">Qual vistoria você vai fazer?</h1>
        </div>

        {!tipos || !u ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl border border-line-1 bg-white" />)}
          </div>
        ) : (
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">Tipos de vistoria disponíveis</legend>
            {tipos.map((t) => {
              const motivo = indisponivel(t);
              const marcado = sel === t.id;
              return (
                <label
                  key={t.id}
                  className={`relative flex gap-4 rounded-xl border bg-white p-4 transition duration-fast ${
                    motivo ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-fg-3'
                  } ${marcado ? 'border-pine shadow-md ring-1 ring-pine' : 'border-line-1 shadow-sm'} has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-pine`}
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t.id}
                    checked={marcado}
                    disabled={!!motivo}
                    onChange={() => { setSel(t.id); setAviso(false); }}
                    className="sr-only"
                  />
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${marcado ? 'bg-pine text-white' : 'bg-cream text-pine'}`}>
                    <Icon icon={ICONES[t.id] ?? 'solar:clipboard-list-linear'} width={22} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-base font-medium text-fg-1">{t.nome}</span>
                      <Icon
                        icon={marcado ? 'solar:check-circle-linear' : 'solar:alt-arrow-right-linear'}
                        width={20}
                        className={`shrink-0 ${marcado ? 'text-pine' : 'text-fg-4'}`}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="text-sm text-fg-2">{t.descricao}</span>
                    {motivo ? (
                      <span className="mt-1 flex items-start gap-1.5 text-xs text-fg-2">
                        <Icon icon="solar:info-circle-linear" width={16} className="shrink-0" aria-hidden="true" /> {motivo}
                      </span>
                    ) : (
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-3">
                        <span className="font-mono">{t.itens} itens</span>
                        <span>{t.respostas.join(' / ')}</span>
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>
        )}
      </main>

      <BottomBar>
        {aviso && (
          <p className="flex items-start gap-2 text-sm text-fg-2" role="status">
            <Icon icon="solar:info-circle-linear" width={18} className="mt-px shrink-0 text-pine" aria-hidden="true" />
            Mockup: a próxima etapa (T08 · Validação de presença) ainda não foi implementada.
          </p>
        )}
        <button type="button" className={btnPrimary} disabled={!sel} onClick={() => setAviso(true)}>
          Validar presença <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
        </button>
      </BottomBar>
    </div>
  );
}
