import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Seal } from '../components/Logo';
import NetworkBadge from '../components/NetworkBadge';
import { APP_VERSION, destino, verificarAcesso } from '../lib/acesso';

/** T01 — Inicialização: confere a sessão e o cadastro no banco (ativo, com pousada) e decide o destino. */
export default function T01Inicializacao() {
  const navigate = useNavigate();
  const [step, setStep] = useState('Verificando sessão');

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await verificarAcesso();
      if (!alive) return;
      setStep('Verificando sincronizações');
      if (a.estado === 'sem-sessao') navigate('/login', { replace: true });
      else if (a.estado === 'bloqueado') navigate(`/acesso-indisponivel?motivo=${a.motivo}`, { replace: true });
      else navigate(destino(a), { replace: true });
    })().catch(() => { if (alive) navigate('/acesso-indisponivel?motivo=offline', { replace: true }); });
    return () => { alive = false; };
  }, [navigate]);

  return (
    <main className="screen safe-pad on-dark bg-pine-gradient grid grid-rows-[auto_1fr_auto] text-white">
      <div className="flex justify-end"><NetworkBadge onDark /></div>

      <div className="flex flex-col items-center justify-center gap-[clamp(1.5rem,4svh,2.5rem)]">
        <Seal size="clamp(9.5rem, 7rem + 12vw, 13rem)" />
        <div className="flex items-center gap-4 text-white/70">
          <span className="h-px w-8 bg-white/30" aria-hidden="true" />
          <span className="text-[0.6875rem] uppercase tracking-[0.32em]">Vistorias</span>
          <span className="h-px w-8 bg-white/30" aria-hidden="true" />
        </div>
      </div>

      <div className="flex flex-col items-center gap-4">
        <div
          className="relative h-0.5 w-32 overflow-hidden rounded-full bg-white/15"
          role="progressbar"
          aria-label={step}
        >
          <span className="progress-indeterminate absolute inset-y-0 left-0 w-2/5 rounded-full bg-white/80" />
        </div>
        <p className="text-[0.8125rem] text-white/70" aria-live="polite">{step}</p>
        <p className="font-mono text-[0.6875rem] text-white/70">v{APP_VERSION}</p>
      </div>
    </main>
  );
}
