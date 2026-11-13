import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Seal } from '../components/Logo';
import NetworkBadge from '../components/NetworkBadge';
import { APP_VERSION, checkSession } from '../mocks/auth';

/** T01 — Inicialização: valida sessão e sincronizações e decide o destino (login, unidades ou fila). */
export default function T01Inicializacao() {
  const navigate = useNavigate();
  const [step, setStep] = useState('Verificando sessão…');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { hasSession, pendingSync } = await checkSession();
      if (!alive) return;
      setStep('Verificando sincronizações…');
      await new Promise((r) => setTimeout(r, 500));
      if (!alive) return;
      // Destinos futuros: /app/sincronizacao (T18) e /app/unidades (T05).
      if (hasSession && pendingSync > 0) navigate('/app/sincronizacao', { replace: true });
      else if (hasSession) navigate('/app/unidades', { replace: true });
      else navigate('/login', { replace: true });
    })();
    return () => { alive = false; };
  }, [navigate]);

  return (
    <main className="screen safe-pad on-dark bg-pine-gradient flex flex-col items-center justify-between text-white">
      <div className="self-end"><NetworkBadge onDark /></div>

      <div className="flex flex-col items-center gap-8">
        <Seal />
        <p className="text-xs uppercase tracking-[0.32em] text-white/70">Vistorias</p>
        <div className="flex flex-col items-center gap-3" aria-live="polite">
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white"
            role="progressbar"
            aria-label="Carregando"
          />
          <p className="text-sm text-white/70">{step}</p>
        </div>
      </div>

      <p className="font-mono text-xs text-white/70">v{APP_VERSION}</p>
    </main>
  );
}
