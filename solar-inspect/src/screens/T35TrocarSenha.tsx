import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ScreenShell, { StateIcon, btnPrimary, btnSecondary } from '../components/ScreenShell';
import { type AcessoOk, type ErroSenha, destino, problemaSenha, sair, SENHA_MIN, trocarSenha, verificarAcesso } from '../lib/acesso';

const ERROS: Record<ErroSenha, string> = {
  atual_incorreta: 'A senha atual não confere.',
  fraca: 'A nova senha não atende às regras: misture letras e números e não use o seu usuário.',
  igual: 'A nova senha precisa ser diferente da atual.',
  offline: 'Sem internet. A troca de senha precisa de conexão.',
  muitas_tentativas: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  sessao: 'Sua sessão expirou. Entre de novo para trocar a senha.',
  indisponivel: 'Não foi possível trocar a senha agora. Tente de novo em instantes.',
};

function CampoSenha({ id, rotulo, valor, onChange, auto, erro, desc }: {
  id: string; rotulo: string; valor: string; onChange: (v: string) => void; auto: string; erro?: boolean; desc?: string;
}) {
  const [ver, setVer] = useState(false);
  return (
    <label className="flex flex-col gap-2" htmlFor={id}>
      <span className="text-[0.8125rem] font-medium text-fg-2">{rotulo}</span>
      <div className="relative">
        <Icon icon="solar:lock-keyhole-linear" width={20} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-3" aria-hidden="true" />
        <input id={id} type={ver ? 'text' : 'password'} autoComplete={auto} autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={72}
          value={valor} onChange={(e) => onChange(e.target.value)} aria-invalid={!!erro} aria-describedby={desc}
          className={`min-h-12 w-full rounded-md border bg-white py-3 pl-11 pr-12 text-fg-1 shadow-sm focus:border-pine focus:outline-none ${erro ? 'border-error' : 'border-line-2'}`} />
        <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`} title={ver ? `Ocultar ${rotulo.toLowerCase()}` : `Mostrar ${rotulo.toLowerCase()}`} aria-pressed={ver}
          className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-fg-3 hover:text-fg-1">
          <Icon icon={ver ? 'solar:eye-closed-linear' : 'solar:eye-linear'} width={20} aria-hidden="true" />
        </button>
      </div>
    </label>
  );
}

/** T35 — Trocar senha: qualquer perfil logado. Obrigatória quando a senha é provisória (criada ou redefinida pelo ADMIN). */
export default function T35TrocarSenha() {
  const navigate = useNavigate();
  const [acesso, setAcesso] = useState<AcessoOk | null>(null);
  const [atual, setAtual] = useState('');
  const [nova, setNova] = useState('');
  const [conf, setConf] = useState('');
  const [tentou, setTentou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    verificarAcesso().then((a) => {
      if (a.estado === 'sem-sessao') return navigate('/login', { replace: true });
      if (a.estado === 'bloqueado') return navigate(`/acesso-indisponivel?motivo=${a.motivo}`, { replace: true });
      setAcesso(a);
    });
  }, [navigate]);

  const regra = problemaSenha(nova);
  const difere = conf === nova;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErro(null);
    if (!atual || regra || !difere) return;
    setSalvando(true);
    const r = await trocarSenha(atual, nova);
    setSalvando(false);
    if (!r.ok) {
      if (r.erro === 'sessao') { await sair(); return navigate('/login', { replace: true }); }
      return setErro(ERROS[r.erro]);
    }
    setAtual(''); setNova(''); setConf('');
    setFeito(true);
  }

  if (!acesso) return <ScreenShell><p role="status" className="text-center text-sm text-fg-2">Carregando…</p></ScreenShell>;

  const seguir = () => navigate(destino({ ...acesso, trocarSenha: false }), { replace: true });
  if (feito) {
    return (
      <ScreenShell>
        <StateIcon tone="available" icon={<Icon icon="solar:check-circle-linear" width={32} aria-hidden="true" />} />
        <div className="flex flex-col gap-3" role="status">
          <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Conta</span>
          <h1 className="screen-title">Senha alterada</h1>
          <p className="text-[0.8125rem] leading-relaxed text-fg-2">Use a nova senha nos próximos acessos. Os outros aparelhos conectados foram desconectados.</p>
        </div>
        <button type="button" className={btnPrimary} onClick={seguir}>Continuar <Icon icon="solar:arrow-right-linear" width={18} aria-hidden="true" /></button>
      </ScreenShell>
    );
  }

  const obrigatoria = !!acesso.trocarSenha;
  return (
    <ScreenShell>
      <div className="flex flex-col gap-3">
        <span className="text-[0.6875rem] uppercase tracking-[0.32em] text-fg-3">Conta</span>
        <h1 className="screen-title">{obrigatoria ? 'Crie sua senha' : 'Trocar senha'}</h1>
        <p className="text-[0.8125rem] leading-relaxed text-fg-2">
          {obrigatoria ? 'Sua senha é provisória. Para continuar, crie uma senha que só você conheça.' : `Olá, ${acesso.nome.split(' ')[0]}. Informe a senha atual e a nova.`}
        </p>
      </div>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
        <CampoSenha id="senha-atual" rotulo={obrigatoria ? 'Senha provisória' : 'Senha atual'} valor={atual} onChange={setAtual} auto="current-password" erro={tentou && !atual} />
        <CampoSenha id="senha-nova" rotulo="Nova senha" valor={nova} onChange={setNova} auto="new-password" erro={tentou && !!regra} desc="senha-regras" />
        <p id="senha-regras" className={`-mt-3 text-xs ${tentou && regra ? 'text-error' : 'text-fg-3'}`}>
          {tentou && regra ? regra : `Pelo menos ${SENHA_MIN} caracteres, com letras e números.`}
        </p>
        <CampoSenha id="senha-conf" rotulo="Confirme a nova senha" valor={conf} onChange={setConf} auto="new-password" erro={tentou && !difere} desc={tentou && !difere ? 'senha-conf-erro' : undefined} />
        {tentou && !difere && <p id="senha-conf-erro" className="-mt-3 text-xs text-error">As senhas não são iguais.</p>}
        {erro && (
          <p role="alert" className="flex items-start gap-2 text-sm text-error">
            <Icon icon="solar:danger-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />{erro}
          </p>
        )}
        <button type="submit" className={btnPrimary} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar nova senha'}</button>
        {obrigatoria
          ? <button type="button" className={btnSecondary} onClick={async () => { await sair(); navigate('/login', { replace: true }); }}>Sair</button>
          : <button type="button" className={btnSecondary} onClick={() => navigate(-1)}>Cancelar</button>}
      </form>
    </ScreenShell>
  );
}
