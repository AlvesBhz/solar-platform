import type { ReactNode } from 'react';

/** Barra de ação fixa no rodapé (polegar), respeitando a safe area. */
export default function BottomBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-line-1 bg-cream pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-4">{children}</div>
    </div>
  );
}
