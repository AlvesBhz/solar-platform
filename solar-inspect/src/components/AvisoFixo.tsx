import { Icon } from '@iconify/react';
import { useEffect } from 'react';

/** Aviso no pé da tela (acima da barra das áreas no celular): sempre à vista, onde quer que se tenha tocado.
 *  Sucesso some sozinho em 4,5 s; erro e `manter` (ex.: senha provisória para copiar) ficam até fechar. */
export default function AvisoFixo({ texto, erro, manter, onFechar }: { texto: string; erro?: boolean; manter?: boolean; onFechar: () => void }) {
  useEffect(() => { if (erro || manter) return; const t = setTimeout(onFechar, 4500); return () => clearTimeout(t); }, [texto, erro, manter]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <p role={erro ? 'alert' : 'status'} data-aviso
      className={`fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[min(92vw,30rem)] -translate-x-1/2 items-start gap-2 rounded-lg px-4 py-3 text-[0.8125rem] shadow-lg [overflow-wrap:anywhere] lg:bottom-6 ${erro ? 'border border-error bg-white text-error' : 'bg-pine-deep text-white'}`}>
      <Icon icon={erro ? 'solar:danger-circle-linear' : 'solar:check-circle-linear'} width={18} className="mt-px shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 select-text">{texto}</span>
      <button type="button" aria-label="Fechar aviso" title="Fechar aviso" className="-my-1.5 -mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-80 hover:opacity-100" onClick={onFechar}>
        <Icon icon="solar:close-circle-linear" width={18} aria-hidden="true" />
      </button>
    </p>
  );
}
