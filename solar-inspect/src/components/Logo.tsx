import { Icon } from '@iconify/react';

/**
 * Logos copiados de brand/logo/index.html (sistema v0.1), sem redesenho.
 * Medidas originais convertidas em proporção (em / calc) para escalar sem px fixo.
 */

/** Selo "F · bone" (SE no disco) — brasão formal. Só em tamanho grande (≥ 110px). */
export function Seal() {
  return (
    <div
      role="img"
      aria-label="Solar do Espinhaço"
      className="relative flex aspect-square flex-col items-center justify-center rounded-full text-pine-deep"
      style={{ width: 'clamp(8.5rem, 6rem + 12vw, 11.5rem)', background: 'var(--c-bone)', gap: '4.5%' }}
    >
      {/* anel interno: inset 8%, opacidade .28 (igual ao original) */}
      <span className="pointer-events-none absolute inset-[8%] rounded-full border border-current opacity-[0.28]" aria-hidden="true" />
      <Icon icon="solar:leaf-linear" style={{ width: '33%', height: 'auto' }} aria-hidden="true" />
      <span className="font-serif leading-none" style={{ fontWeight: 400, fontSize: 'clamp(1.55rem, 1.1rem + 2.2vw, 2.1rem)', letterSpacing: '0.18em', paddingLeft: '0.18em' }}>
        SE
      </span>
    </div>
  );
}

/** Lockup horizontal "1B · light · solar do / ESPINHAÇO" (invertido). Navbar, cartão, cabeçalho. */
export function LockupHorizontal() {
  return (
    <div
      role="img"
      aria-label="Solar do Espinhaço"
      className="flex items-center whitespace-nowrap text-pine-deep"
      style={{ fontSize: 'clamp(1.6rem, 1.3rem + 1.4vw, 2rem)', gap: '0.59em' }}
    >
      <span className="relative flex shrink-0 items-center justify-center" style={{ width: '1.36em', height: '1.36em' }} aria-hidden="true">
        <span className="absolute inset-0 rounded-full border border-current opacity-[0.42]" />
        <Icon icon="solar:leaf-linear" style={{ width: '0.86em', height: '0.86em' }} />
      </span>
      <span className="flex flex-col">
        <span className="font-sans uppercase leading-none text-fg-3" style={{ fontWeight: 300, fontSize: 'max(0.75rem, 0.386em)', letterSpacing: '0.34em' }}>
          Solar do
        </span>
        <span className="font-serif font-medium uppercase leading-none" style={{ letterSpacing: '0.06em', marginTop: '0.14em' }}>
          Espinhaço
        </span>
      </span>
    </div>
  );
}
