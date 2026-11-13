import { Icon } from '@iconify/react';
import type { EstadoUnidade, Gravidade, ModoValidacao } from '../mocks/unidades';

/** Estado da unidade: sempre cor + ícone + texto. */
export const ESTADOS: Record<EstadoUnidade, { label: string; icon: string; cls: string }> = {
  liberado:   { label: 'Liberado',   icon: 'solar:check-circle-linear',      cls: 'bg-white text-available border-line-1' },
  em_limpeza: { label: 'Em limpeza', icon: 'solar:broom-linear',             cls: 'bg-white text-pine border-line-1' },
  ocupado:    { label: 'Ocupado',    icon: 'solar:user-rounded-linear',      cls: 'bg-white text-fg-2 border-line-1' },
  bloqueado:  { label: 'Bloqueado',  icon: 'solar:forbidden-circle-linear',  cls: 'bg-white text-error border-line-1' },
  manutencao: { label: 'Manutenção', icon: 'solar:settings-linear',          cls: 'bg-warning-bg text-warning border-transparent' },
};

export function EstadoBadge({ estado, size = 'sm' }: { estado: EstadoUnidade; size?: 'sm' | 'md' }) {
  const e = ESTADOS[estado];
  const sz = size === 'md' ? 'px-3 py-1.5 text-sm gap-2' : 'px-2.5 py-1 text-xs gap-1.5';
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border font-medium ${sz} ${e.cls}`}>
      <Icon icon={e.icon} width={size === 'md' ? 18 : 16} aria-hidden="true" />
      {e.label}
    </span>
  );
}

const GRAVIDADES: Record<Gravidade, { label: string; icon: string; cls: string }> = {
  critica: { label: 'Crítica', icon: 'solar:danger-triangle-linear', cls: 'text-error' },
  media:   { label: 'Média',   icon: 'solar:danger-circle-linear',   cls: 'text-warning' },
  baixa:   { label: 'Baixa',   icon: 'solar:info-circle-linear',     cls: 'text-fg-2' },
};

export function GravidadeTag({ g }: { g: Gravidade }) {
  const x = GRAVIDADES[g];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.08em] ${x.cls}`}>
      <Icon icon={x.icon} width={16} aria-hidden="true" />
      {x.label}
    </span>
  );
}

export const VALIDACAO: Record<ModoValidacao, { label: string; icon: string }> = {
  gps:    { label: 'GPS',           icon: 'solar:gps-linear' },
  qr:     { label: 'QR Code',       icon: 'solar:qr-code-linear' },
  gps_qr: { label: 'GPS + QR Code', icon: 'solar:shield-check-linear' },
};

export function formatarData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
