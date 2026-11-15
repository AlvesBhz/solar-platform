/** Redimensiona (lado maior ≤ 1600 px), aplica carimbo visível e comprime em JPEG 80% (RNF-06, RF-06). */
export async function comprimirComCarimbo(fonte: CanvasImageSource, w0: number, h0: number, linhas: string[]): Promise<Blob> {
  const MAX = 1600;
  const k = Math.min(1, MAX / Math.max(w0, h0));
  const w = Math.round(w0 * k);
  const h = Math.round(h0 * k);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(fonte, 0, 0, w, h);

  // Carimbo: faixa escura inferior com texto claro (legível sobre qualquer foto).
  const fs = Math.max(14, Math.round(w / 48));
  const pad = Math.round(fs * 0.8);
  const faixa = linhas.length * fs * 1.35 + pad * 2;
  const css = getComputedStyle(document.documentElement);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = css.getPropertyValue('--c-pine-deep').trim() || '#1C2922';
  ctx.fillRect(0, h - faixa, w, faixa);
  ctx.globalAlpha = 1;
  ctx.fillStyle = css.getPropertyValue('--c-cream').trim() || '#FAFAF9';
  ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  linhas.forEach((t, i) => ctx.fillText(t, pad, h - faixa + pad + i * fs * 1.35));

  return new Promise((ok, erro) => c.toBlob((b) => (b ? ok(b) : erro(new Error('Falha ao gerar imagem'))), 'image/jpeg', 0.8));
}

import { POSICAO_SIMULADA, SIMULADO } from './sim';

export function obterPosicao(timeout = 10000): Promise<GeolocationCoordinates | null> {
  return new Promise((ok) => {
    if (SIMULADO) return ok(POSICAO_SIMULADA);
    if (!('geolocation' in navigator)) return ok(null);
    navigator.geolocation.getCurrentPosition((p) => ok(p.coords), () => ok(null), { enableHighAccuracy: true, timeout, maximumAge: 0 });
  });
}

export function uuid() {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
}
