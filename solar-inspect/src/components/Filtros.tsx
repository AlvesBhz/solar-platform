import { Icon } from '@iconify/react';
import { useEffect, useRef, useState } from 'react';

export type Opcao<T extends string = string> = { valor: T; label: string; icone?: string };

/** Filtro de escolha única com poucas opções: chips que rolam na horizontal; o selecionado fica sempre à vista. */
export function Chips<T extends string>({ valor, onChange, opcoes, rotulo }: { valor: T; onChange: (v: T) => void; opcoes: Opcao<T>[]; rotulo: string }) {
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const n = caixa.current;
    const a = n?.querySelector<HTMLElement>('[aria-checked=true]');
    if (n && a) n.scrollTo({ left: Math.max(0, a.offsetLeft - (n.clientWidth - a.offsetWidth) / 2), behavior: 'smooth' });
  }, [valor]);
  return (
    <div ref={caixa} role="radiogroup" aria-label={rotulo} className="relative flex min-w-0 max-w-full gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onChange(o.valor)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[0.8125rem] transition-colors duration-fast ${ativo ? 'border-pine bg-pine text-white' : 'border-line-2 bg-white text-fg-2 hover:border-fg-3'}`}
          >
            {o.icone && <Icon icon={o.icone} width={16} aria-hidden="true" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Seletor próprio no lugar do combo nativo: no celular abre uma folha que sobe do rodapé;
 * no computador, um menu suspenso. Teclado: setas, Enter e Esc.
 */
export function Seletor<T extends string>({ valor, onChange, opcoes, rotulo, icone, placeholder = 'Selecione', desabilitado, grande, className = '' }: {
  valor: T; onChange: (v: T) => void; opcoes: Opcao<T>[]; rotulo: string; icone?: string; placeholder?: string; desabilitado?: boolean; grande?: boolean; className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const gatilho = useRef<HTMLButtonElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const atual = opcoes.find((o) => o.valor === valor);

  const fechar = () => { setAberto(false); gatilho.current?.focus(); };
  useEffect(() => {
    if (!aberto) return;
    (lista.current?.querySelector<HTMLElement>('[aria-selected=true]') ?? lista.current?.querySelector<HTMLElement>('[role=option]'))?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  function teclas(e: React.KeyboardEvent) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const itens = [...(lista.current?.querySelectorAll<HTMLElement>('[role=option]') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLElement);
    itens[Math.max(0, Math.min(itens.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  }

  return (
    <div className={`relative min-w-0 ${className}`}>
      <button
        ref={gatilho}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-label={`${rotulo}: ${atual?.label ?? placeholder}`}
        disabled={desabilitado}
        onClick={() => setAberto(!aberto)}
        className={`flex w-full items-center gap-2.5 rounded-md border bg-white px-3 text-left text-[0.875rem] font-normal normal-case tracking-normal text-fg-1 shadow-sm transition-colors duration-fast hover:border-fg-3 disabled:cursor-not-allowed disabled:opacity-60 ${grande ? 'min-h-12' : 'min-h-11'} ${aberto ? 'border-pine' : 'border-line-2'}`}
      >
        {icone && <Icon icon={icone} width={18} className="shrink-0 text-fg-3" aria-hidden="true" />}
        <span className={`min-w-0 flex-1 truncate ${atual ? '' : 'text-fg-4'}`}>{atual?.label ?? placeholder}</span>
        <Icon icon="solar:alt-arrow-down-linear" width={16} className={`shrink-0 text-fg-3 transition-transform duration-fast ${aberto ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {aberto && (
        <>
          <button type="button" aria-label="Fechar" tabIndex={-1} onClick={fechar} className="fixed inset-0 z-[60] cursor-default bg-[var(--scrim-top)] sm:bg-transparent" />
          <div className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[70svh] flex-col overflow-hidden rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl normal-case tracking-normal sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-full sm:mt-1.5 sm:max-h-72 sm:w-max sm:min-w-full sm:max-w-[22rem] sm:rounded-xl sm:border sm:border-line-1 sm:pb-0">
            <div className="flex items-center justify-between px-4 pb-1 pt-4 sm:hidden">
              <span className="text-xs font-normal uppercase tracking-[0.08em] text-fg-3">{rotulo}</span>
              <button type="button" onClick={fechar} className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-fg-2" aria-label="Fechar">
                <Icon icon="solar:close-circle-linear" width={22} aria-hidden="true" />
              </button>
            </div>
            <div ref={lista} role="listbox" aria-label={rotulo} onKeyDown={teclas} className="overflow-y-auto py-1">
              {opcoes.map((o) => {
                const sel = o.valor === valor;
                return (
                  <button
                    key={o.valor}
                    type="button"
                    role="option"
                    aria-selected={sel}
                    onClick={() => { onChange(o.valor); fechar(); }}
                    className={`flex min-h-12 w-full items-center gap-3 px-4 text-left text-[0.875rem] font-normal transition-colors duration-fast hover:bg-cream focus-visible:bg-cream ${sel ? 'font-medium text-pine' : 'text-fg-1'}`}
                  >
                    {o.icone && <Icon icon={o.icone} width={18} className="shrink-0 text-fg-3" aria-hidden="true" />}
                    <span className="min-w-0 flex-1">{o.label}</span>
                    {sel && <Icon icon="solar:check-read-linear" width={18} className="shrink-0 text-pine" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
