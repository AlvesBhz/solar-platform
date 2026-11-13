import { Icon } from '@iconify/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ScreenShell, { StateIcon, btnPrimary, btnSecondary } from '../components/ScreenShell';

type Reason = 'sem-permissao' | 'inativo' | 'sessao-expirada' | 'offline' | 'sem-localizacao';

const REASONS: Record<Reason, { icon: string; tone: 'warning' | 'error'; title: string; text: string; action: 'login' | 'retry' | 'location' }> = {
  'sem-permissao': {
    icon: 'solar:shield-cross-linear', tone: 'error', title: 'Sem permissão de acesso',
    text: 'Seu usuário não tem acesso a esta área ou propriedade. Solicite a liberação ao administrador.', action: 'login',
  },
  inativo: {
    icon: 'solar:user-block-linear', tone: 'error', title: 'Usuário inativo',
    text: 'Seu acesso foi desativado pelo administrador. Fale com ele para reativar a conta.', action: 'login',
  },
  'sessao-expirada': {
    icon: 'solar:clock-circle-linear', tone: 'warning', title: 'Sessão expirada',
    text: 'Por segurança, sua sessão foi encerrada. Entre novamente para continuar.', action: 'login',
  },
  offline: {
    icon: 'solar:close-circle-linear', tone: 'warning', title: 'Sem conexão',
    text: 'Este conteúdo precisa de internet. Vistorias já salvas no aparelho continuam guardadas.', action: 'retry',
  },
  'sem-localizacao': {
    icon: 'solar:map-point-linear', tone: 'warning', title: 'Localização necessária',
    text: 'Sem a localização não é possível validar sua presença na unidade. Peça ajuda ao gestor ou libere o acesso no navegador.', action: 'location',
  },
};

/** T04 — Acesso indisponível: explica o motivo e oferece recuperação. Não exibe dados. */
export default function T04AcessoIndisponivel() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const key = params.get('motivo') as Reason;
  const r = REASONS[key] ?? REASONS['sem-permissao'];

  const primary = {
    login: { label: 'Voltar ao login', icon: 'solar:login-2-linear', go: () => navigate('/login', { replace: true }) },
    retry: { label: 'Tentar novamente', icon: 'solar:refresh-linear', go: () => navigate(0) },
    location: { label: 'Revisar permissão', icon: 'solar:map-point-linear', go: () => navigate('/permissao-localizacao') },
  }[r.action];

  return (
    <ScreenShell>
      <StateIcon tone={r.tone} icon={<Icon icon={r.icon} width={32} aria-hidden="true" />} />
      <div className="flex flex-col gap-3" role="alert">
        <span className={`text-[0.6875rem] uppercase tracking-[0.32em] ${r.tone === 'error' ? 'text-error' : 'text-warning'}`}>
          Acesso indisponível
        </span>
        <h1 className="screen-title">{r.title}</h1>
        <p className="text-sm leading-relaxed text-fg-2">{r.text}</p>
      </div>
      <div className="flex flex-col gap-3">
        <button type="button" className={btnPrimary} onClick={primary.go}>
          <Icon icon={primary.icon} width={18} aria-hidden="true" /> {primary.label}
        </button>
        <button type="button" className={btnSecondary} onClick={() => navigate(-1)}>
          <Icon icon="solar:arrow-left-linear" width={18} aria-hidden="true" /> Voltar
        </button>
      </div>
      <p className="flex items-start gap-2 border-t border-line-1 pt-5 text-xs leading-relaxed text-fg-3">
        <Icon icon="solar:info-circle-linear" width={16} className="mt-px shrink-0" aria-hidden="true" />
        Precisa de ajuda? Procure o gestor da propriedade ou o administrador do sistema.
      </p>
    </ScreenShell>
  );
}
