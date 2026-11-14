import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RESPOSTAS_OK } from '../mocks/checklist';
import type { Foto } from '../mocks/fotos';
import type { Gravidade } from '../mocks/unidades';

/** Foto de referência (RF-07) ou aviso quando o ambiente não tem uma cadastrada. */
export function FotoReferencia({ src, legenda, icon }: { src?: string; legenda: string; icon: string }) {
  return (
    <figure className="relative overflow-hidden rounded-xl border border-line-1 bg-white">
      {src ? (
        <img src={src} alt={`Referência: ${legenda}`} width={1200} height={675} className="aspect-video w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-cream text-fg-3">
          <Icon icon={icon} width={32} aria-hidden="true" />
          <span className="text-[0.75rem]">Sem foto de referência cadastrada</span>
        </div>
      )}
      <figcaption className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-medium text-white" style={{ background: 'var(--scrim-top)' }}>
        <Icon icon="solar:gallery-linear" width={14} aria-hidden="true" /> Referência
      </figcaption>
    </figure>
  );
}

/** Seletor de resposta (radiogroup). Respostas divergentes ficam em âmbar. */
export function SeletorResposta({ opcoes, valor, onChange, rotulo }: { opcoes: string[]; valor?: string; onChange: (v: string) => void; rotulo: string }) {
  return (
    <div className={`grid gap-2 ${opcoes.length === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-[repeat(auto-fit,minmax(min(6rem,100%),1fr))]'}`} role="radiogroup" aria-label={rotulo}>
      {opcoes.map((op) => {
        const sel = valor === op;
        const neg = !RESPOSTAS_OK.includes(op);
        return (
          <button
            key={op}
            type="button"
            role="radio"
            aria-checked={sel}
            onClick={() => onChange(op)}
            className={`min-h-12 rounded-md border px-2 text-[0.8125rem] transition-colors duration-fast ${
              sel ? (neg ? 'border-warning bg-warning-bg font-medium text-warning' : 'border-pine bg-pine font-medium text-white') : 'border-line-2 bg-white text-fg-2 hover:border-fg-3'
            }`}
          >
            {op}
          </button>
        );
      })}
    </div>
  );
}

export function CampoObservacao({ valor, onChange, obrigatoria }: { valor: string; onChange: (v: string) => void; obrigatoria: boolean }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-xs uppercase tracking-[0.08em] text-fg-2">
        Observação {obrigatoria && <span className="normal-case tracking-normal text-warning">obrigatória</span>}
      </span>
      <textarea
        rows={3}
        maxLength={500}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={obrigatoria ? 'Descreva o que está diferente, onde e a extensão do problema.' : 'Opcional'}
        className={`w-full resize-y rounded-md border bg-white p-3 text-fg-1 shadow-sm placeholder:text-fg-4 focus:border-pine focus:outline-none ${obrigatoria && !valor.trim() ? 'border-warning' : 'border-line-2'}`}
      />
      <span className="self-end font-mono text-[0.6875rem] text-fg-3">{valor.length}/500</span>
    </label>
  );
}

/** Miniaturas das evidências do item, com remoção (rascunho ainda editável). */
export function GradeEvidencias({ fotos, novaFoto, onRemover }: { fotos: Foto[]; novaFoto: string; onRemover: (id: string) => void }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const m: Record<string, string> = {};
    fotos.forEach((f) => { m[f.id] = URL.createObjectURL(f.blob); });
    setUrls(m);
    return () => Object.values(m).forEach(URL.revokeObjectURL);
  }, [fotos]);

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(6.5rem,100%),1fr))] gap-2">
      {fotos.map((f) => (
        <li key={f.id} className="relative overflow-hidden rounded-lg border border-line-1 bg-white">
          {urls[f.id] && <img src={urls[f.id]} alt="Evidência registrada" width={160} height={160} className="aspect-square w-full object-cover" />}
          {f.foraDoRaio && (
            <span className="absolute bottom-1 left-1 inline-flex items-center gap-1 rounded-full bg-warning-bg px-1.5 py-0.5 text-[0.625rem] font-medium text-warning">
              <Icon icon="solar:shield-warning-linear" width={12} aria-hidden="true" /> Fora do raio
            </span>
          )}
          <button
            type="button"
            onClick={() => onRemover(f.id)}
            className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-white"
            aria-label="Remover foto"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: 'var(--scrim-top)' }}>
              <Icon icon="solar:trash-bin-minimalistic-linear" width={16} aria-hidden="true" />
            </span>
          </button>
        </li>
      ))}
      <li>
        <Link
          to={novaFoto}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-2 bg-white text-[0.75rem] text-pine transition-colors duration-fast hover:border-pine"
        >
          <Icon icon="solar:camera-linear" width={24} aria-hidden="true" />
          Adicionar foto
        </Link>
      </li>
    </ul>
  );
}

export function ListaRequisitos({ itens }: { itens: { id: string; label: string; ok: boolean }[] }) {
  return (
    <ul className="flex flex-col gap-1.5 rounded-xl border border-line-1 bg-white p-4" aria-label="Requisitos do item">
      {itens.map((r) => (
        <li key={r.id} className={`flex items-center gap-2 text-[0.8125rem] ${r.ok ? 'text-fg-2' : 'text-warning'}`}>
          <Icon icon={r.ok ? 'solar:check-circle-linear' : 'solar:danger-circle-linear'} width={16} className={r.ok ? 'text-available' : ''} aria-hidden="true" />
          {r.label}
        </li>
      ))}
    </ul>
  );
}

const GRAVIDADES: { id: Gravidade; label: string; icon: string; desc: string; cls: string }[] = [
  { id: 'baixa', label: 'Baixa', icon: 'solar:info-circle-linear', desc: 'Não afeta a estadia', cls: 'border-pine bg-pine text-white' },
  { id: 'media', label: 'Média', icon: 'solar:danger-circle-linear', desc: 'Resolver antes da próxima estadia', cls: 'border-warning bg-warning-bg text-warning' },
  { id: 'critica', label: 'Crítica', icon: 'solar:danger-triangle-linear', desc: 'Impede a entrega da unidade', cls: 'border-error bg-white text-error ring-1 ring-error' },
];

/** As 3 caixas de gravidade: aparecem assim que a resposta é uma divergência. */
export function SeletorGravidade({ valor, onChange }: { valor: Gravidade; onChange: (g: Gravidade) => void }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-xs uppercase tracking-[0.08em] text-fg-2">Gravidade da ocorrência</legend>
      {GRAVIDADES.map((o) => {
        const sel = valor === o.id;
        return (
          <label key={o.id} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors duration-fast ${sel ? o.cls : 'border-line-1 bg-white text-fg-2 hover:border-fg-3'}`}>
            <input type="radio" name="gravidade" className="sr-only" checked={sel} onChange={() => onChange(o.id)} />
            <Icon icon={o.icon} width={20} aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-[0.875rem] font-medium">{o.label}</span>
              <span className={`text-[0.75rem] ${sel && o.id === 'baixa' ? 'text-white/80' : 'opacity-80'}`}>{o.desc}</span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
