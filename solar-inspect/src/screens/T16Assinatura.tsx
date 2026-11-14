import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import BottomBar from '../components/BottomBar';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { lerRascunho, salvarRascunho } from '../mocks/vistoria';

/** T16 — Assinatura: área de desenho, limpar e confirmar (obrigatória em todos os tipos no mockup). */
export default function T16Assinatura() {
  const { unidadeId = '' } = useParams();
  const navigate = useNavigate();
  const base = `/app/vistorias/nova/${unidadeId}`;
  const rasc = lerRascunho(unidadeId);
  const canvas = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ajustar = () => {
      const r = c.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      c.width = r.width * dpr; c.height = r.height * dpr;
      const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--c-pine-deep').trim();
      setVazio(true);
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, []);

  if (!rasc?.inicio) return <Navigate to={`${base}/presenca`} replace />;

  const ponto = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  const ctx = () => canvas.current!.getContext('2d')!;
  function inicio(e: React.PointerEvent) { canvas.current!.setPointerCapture(e.pointerId); desenhando.current = true; const [x, y] = ponto(e); ctx().beginPath(); ctx().moveTo(x, y); }
  function mover(e: React.PointerEvent) { if (!desenhando.current) return; const [x, y] = ponto(e); ctx().lineTo(x, y); ctx().stroke(); setVazio(false); }
  function limpar() { const c = canvas.current!; ctx().clearRect(0, 0, c.width, c.height); setVazio(true); }
  function confirmar() { salvarRascunho({ ...rasc!, assinatura: canvas.current!.toDataURL('image/png') }); navigate(`${base}/confirmacao`); }

  return (
    <div className="screen flex flex-col bg-cream">
      <AppHeader back={`${base}/resumo`} eyebrow="Envio" title="Assinatura" />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
        <div className="flex flex-col gap-2">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Responsável</span>
          <h1 className="screen-title">Assine para confirmar a vistoria</h1>
          <p className="text-[0.8125rem] leading-relaxed text-fg-2">Use o dedo na área abaixo. A assinatura acompanha o relatório.</p>
        </div>
        <div className="relative">
          <canvas
            ref={canvas}
            onPointerDown={inicio} onPointerMove={mover} onPointerUp={() => (desenhando.current = false)} onPointerCancel={() => (desenhando.current = false)}
            className="block h-[min(16rem,40svh)] w-full touch-none rounded-xl border border-line-2 bg-white shadow-sm"
            aria-label="Área de assinatura"
          />
          <span className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-line-2" aria-hidden="true" />
          {vazio && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.8125rem] text-fg-4">Assine aqui</span>}
        </div>
      </main>
      <BottomBar>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className={btnSecondary} onClick={limpar} disabled={vazio}>
            <Icon icon="solar:trash-bin-minimalistic-linear" width={18} aria-hidden="true" /> Limpar
          </button>
          <button type="button" className={btnPrimary} disabled={vazio} onClick={confirmar}>
            Confirmar <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" />
          </button>
        </div>
      </BottomBar>
    </div>
  );
}
