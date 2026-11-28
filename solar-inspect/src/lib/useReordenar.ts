// Reordenar arrastando (mouse, toque e caneta) pela alça da linha, com o teclado como alternativa (setas ↑ ↓ na alça).
// Só transform durante o arraste (compositor); a lista muda de verdade ao soltar.
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';

type Arraste = { lista: string; de: number; para: number; dy: number; passo: number };

export function useReordenar(onMover: (lista: string, de: number, para: number) => void) {
  const [a, setA] = useState<Arraste | null>(null);
  const r = useRef<{ lista: string; de: number; centros: number[]; y0: number; passo: number; para: number } | null>(null);

  const linhas = (el: Element) => [...(el.closest('[data-lista]')?.querySelectorAll(':scope > [data-arrastar]') ?? [])] as HTMLElement[];
  function alca(lista: string, i: number, n: number) {
    return {
      'data-alca': '',
      onPointerDown(e: PointerEvent<HTMLElement>) {
        if (e.button > 0 || n < 2) return;
        const rs = linhas(e.currentTarget).map((x) => x.getBoundingClientRect());
        if (!rs[i]) return;
        const passo = rs[i + 1] ? rs[i + 1].top - rs[i].top : rs[i].top - rs[i - 1].top;   // altura da linha + espaço entre linhas
        r.current = { lista, de: i, centros: rs.map((x) => x.top + scrollY + x.height / 2), y0: e.clientY + scrollY, passo, para: i };
        e.currentTarget.setPointerCapture(e.pointerId);
        setA({ lista, de: i, para: i, dy: 0, passo });
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        const c = r.current; if (!c) return;
        if (e.clientY < 72) scrollBy(0, -12); else if (e.clientY > innerHeight - 96) scrollBy(0, 12);   // rola junto perto das bordas
        const dy = e.clientY + scrollY - c.y0;
        const centro = c.centros[c.de] + dy;
        c.para = c.centros.filter((m, k) => k !== c.de && m < centro).length;
        setA({ lista: c.lista, de: c.de, para: c.para, dy, passo: c.passo });
      },
      onPointerUp() { const c = r.current; r.current = null; setA(null); if (c && c.para !== c.de) onMover(c.lista, c.de, c.para); },
      onPointerCancel() { r.current = null; setA(null); },
      onKeyDown(e: KeyboardEvent<HTMLElement>) {
        if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); onMover(lista, i, i - 1); }
        if (e.key === 'ArrowDown' && i < n - 1) { e.preventDefault(); onMover(lista, i, i + 1); }
      },
    };
  }
  /** Estilo de cada linha durante o arraste: a arrastada segue o dedo; as do caminho abrem espaço. */
  function estilo(lista: string, i: number): CSSProperties | undefined {
    if (!a || a.lista !== lista) return undefined;
    if (i === a.de) return { transform: `translateY(${a.dy}px)`, position: 'relative', zIndex: 20, boxShadow: 'var(--shadow-lg)', cursor: 'grabbing' };
    const mover = a.de < a.para ? (i > a.de && i <= a.para ? -a.passo : 0) : (i >= a.para && i < a.de ? a.passo : 0);
    return { transform: mover ? `translateY(${mover}px)` : undefined, transition: 'transform var(--dur-fast) ease-out' };
  }
  return { alca, estilo, arrastando: a };
}

/** Move o elemento `de` para a posição `para`. */
export const mover = <T,>(l: T[], de: number, para: number) => { const c = [...l]; const [x] = c.splice(de, 1); c.splice(para, 0, x); return c; };
