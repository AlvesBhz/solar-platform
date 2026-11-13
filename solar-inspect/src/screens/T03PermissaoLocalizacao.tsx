import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenShell, { StateIcon, btnPrimary, btnSecondary } from '../components/ScreenShell';

type State = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

const USES = [
  { icon: 'solar:map-point-linear', text: 'Confirmar que você está na unidade ao iniciar a vistoria.' },
  { icon: 'solar:camera-linear', text: 'Registrar o local de cada foto de evidência.' },
  { icon: 'solar:shield-check-linear', text: 'Nunca em segundo plano: só durante a vistoria.' },
];

/** T03 — Permissão de localização: explica o uso e solicita o GPS. Sem coleta em segundo plano. */
export default function T03PermissaoLocalizacao() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>('idle');

  // Só consulta o status da permissão; não lê a posição.
  useEffect(() => {
    if (!('geolocation' in navigator)) return setState('unavailable');
    navigator.permissions?.query({ name: 'geolocation' }).then((p) => {
      if (p.state === 'granted') setState('granted');
      if (p.state === 'denied') setState('denied');
    }).catch(() => {});
  }, []);

  function requestPermission() {
    setState('requesting');
    // Leitura única (sem watchPosition), apenas para disparar o pedido do navegador.
    navigator.geolocation.getCurrentPosition(
      () => setState('granted'),
      (err) => setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  if (state === 'granted') {
    return (
      <ScreenShell>
        <StateIcon tone="available" icon={<Icon icon="solar:check-circle-linear" width={32} aria-hidden="true" />} />
        <div className="flex flex-col gap-3" role="status">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Localização</span>
          <h1 className="screen-title">Tudo pronto</h1>
          <p className="text-[0.8125rem] leading-relaxed text-fg-2">A localização está permitida e será usada apenas durante as vistorias.</p>
        </div>
        {/* Próxima tela: T05 Minhas unidades (ainda não implementada). */}
        <button type="button" className={btnPrimary} onClick={() => navigate('/app/unidades')}>
          Continuar <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
        </button>
      </ScreenShell>
    );
  }

  if (state === 'denied' || state === 'unavailable') {
    const denied = state === 'denied';
    return (
      <ScreenShell>
        <StateIcon tone="warning" icon={<Icon icon="solar:danger-circle-linear" width={32} aria-hidden="true" />} />
        <div className="flex flex-col gap-3" role="alert">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-warning">Atenção</span>
          <h1 className="screen-title">{denied ? 'Localização bloqueada' : 'GPS indisponível'}</h1>
          <p className="text-[0.8125rem] leading-relaxed text-fg-2">
            {denied
              ? 'Sem a localização não é possível validar sua presença na unidade. Libere o acesso nas configurações do navegador e tente novamente.'
              : 'Não foi possível obter sua posição. Verifique se o GPS do aparelho está ligado e tente em um local com melhor sinal.'}
          </p>
        </div>
        {denied && (
          <ol className="flex flex-col gap-2 rounded-lg border border-line-1 bg-white p-4 text-sm text-fg-2">
            {['Toque no ícone de cadeado ao lado do endereço.', 'Em "Localização", escolha Permitir.', 'Volte aqui e toque em Tentar novamente.'].map((t, i) => (
              <li key={t} className="flex gap-3"><span className="font-mono text-fg-3">{i + 1}.</span>{t}</li>
            ))}
          </ol>
        )}
        <div className="flex flex-col gap-3">
          <button type="button" className={btnPrimary} onClick={requestPermission}>
            <Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /> Tentar novamente
          </button>
          <button type="button" className={btnSecondary} onClick={() => navigate('/acesso-indisponivel?motivo=sem-localizacao')}>
            Não consigo permitir
          </button>
        </div>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <StateIcon icon={<Icon icon="solar:map-point-linear" width={32} aria-hidden="true" />} />
      <div className="flex flex-col gap-3">
        <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Permissão</span>
        <h1 className="screen-title">Permitir localização</h1>
        <p className="text-[0.8125rem] leading-relaxed text-fg-2">As vistorias exigem comprovação de presença. Sua localização é usada para:</p>
      </div>
      <ul className="flex flex-col gap-4">
        {USES.map((u) => (
          <li key={u.icon} className="flex items-start gap-3 text-[0.8125rem] text-fg-2">
            <Icon icon={u.icon} width={20} className="mt-px shrink-0 text-pine" aria-hidden="true" />
            {u.text}
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-3">
        <button type="button" className={btnPrimary} onClick={requestPermission} disabled={state === 'requesting'}>
          {state === 'requesting' ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />
              Aguardando permissão
            </>
          ) : (
            <>
              <Icon icon="solar:map-point-linear" width={18} aria-hidden="true" /> Permitir localização
            </>
          )}
        </button>
        <p className="text-center text-xs text-fg-3">O navegador vai pedir sua confirmação.</p>
      </div>
    </ScreenShell>
  );
}
