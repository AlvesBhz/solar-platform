import { Icon } from '@iconify/react';

type Props = { tone?: 'light' | 'dark'; size?: 'md' | 'lg' };

/** Lockup recomendado (SDE-LOGO-01): folha + wordmark Cormorant 500. */
export default function Logo({ tone = 'dark', size = 'md' }: Props) {
  const color = tone === 'light' ? 'text-cream' : 'text-pine-deep';
  const big = size === 'lg';
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${color}`}>
      <Icon icon="solar:leaf-linear" width={big ? 48 : 32} aria-hidden="true" />
      <span
        className="font-serif font-medium leading-tight"
        style={{ fontSize: big ? 'clamp(1.75rem, 1.4rem + 1.8vw, 2.5rem)' : 'clamp(1.5rem, 1.3rem + 1vw, 1.875rem)' }}
      >
        Solar do Espinhaço
      </span>
    </div>
  );
}
