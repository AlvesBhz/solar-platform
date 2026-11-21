import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Seletor } from '../components/Filtros';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { cpfValido, formatarCpf } from '../lib/cpf';
import type { Perfil } from '../lib/acesso';
import { PERFIS, criarUsuario, listarPropriedades, listarUsuarios, redefinirSenha, rotuloPerfil, salvarUsuario, type Propriedade, type Usuario } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const LOGIN_VALIDO = /^[a-z][a-z0-9._-]{2,39}$/;
const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-[0.875rem] text-fg-1 focus:border-pine focus:outline-none';
const rotulo = 'flex flex-col gap-1.5 text-[0.75rem] uppercase tracking-[0.06em] text-fg-2';
const mascaraCpf = (c: string | null) => (c ? `•••.${c.slice(3, 6)}.${c.slice(6, 9)}-••` : '—');
function gerarSenha() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => a[n % a.length]).join('');
}

type Form = { modo: 'novo' | 'editar'; base?: Usuario; nome: string; login: string; cpf: string; perfil: Perfil; senha: string; props: number[]; ativo: boolean };
const vazio = (): Form => ({ modo: 'novo', nome: '', login: '', cpf: '', perfil: 'ASSESSOR', senha: gerarSenha(), props: [], ativo: true });

/** T32 — Usuários e permissões: cadastro (Edge Function criar-usuario), perfil, pousadas, status e redefinição de senha. Só ADMIN. */
export function T32Usuarios() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const [us, setUs] = useState<Usuario[]>([]);
  const [props, setProps] = useState<Propriedade[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [senhaDe, setSenhaDe] = useState<{ u: Usuario; senha: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = () => Promise.all([listarUsuarios(), listarPropriedades()]).then(([u, p]) => { setUs(u); setProps(p); })
    .catch(() => setErro('Não foi possível carregar a equipe.'));
  useEffect(() => { if (perfil) carregar(); }, [perfil]);
  if (!perfil) return null;

  const nomeProps = (u: Usuario) => (u.perfil === 'ADMIN' ? 'Todas' : props.filter((p) => u.props.includes(p.id_propriedade)).map((p) => p.nm_propriedade).join(', ') || '—');
  const editar = (u: Usuario) => { setErro(''); setAviso(''); setSenhaDe(null); setForm({ modo: 'editar', base: u, nome: u.nome, login: u.login, cpf: u.cpf ?? '', perfil: u.perfil, senha: '', props: u.props, ativo: u.ativo }); };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(''); setAviso('');
    // integridade antes de ir ao servidor (o banco confere de novo)
    if (form.nome.trim().length < 3) return setErro('Informe o nome completo.');
    if (form.perfil !== 'ADMIN' && form.props.length === 0) return setErro('Escolha ao menos uma pousada para este perfil.');
    if (form.modo === 'novo') {
      if (!LOGIN_VALIDO.test(form.login)) return setErro('Usuário: 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado, começando por letra.');
      if (form.cpf && !cpfValido(form.cpf)) return setErro('CPF inválido.');
      if (form.senha.length < 8) return setErro('A senha inicial precisa ter ao menos 8 caracteres.');
    }
    setSalvando(true);
    const r = form.modo === 'novo'
      ? await criarUsuario({ nome: form.nome.trim(), login: form.login, cpf: form.cpf.replace(/\D/g, ''), perfil: form.perfil, senha: form.senha, props: form.props })
      : await salvarUsuario(form.base!, { nome: form.nome, perfil: form.perfil, ativo: form.ativo, props: form.props });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro);
    setAviso(form.modo === 'novo' ? `Usuário ${form.login} criado. Senha inicial: ${form.senha} (passe ao funcionário; ele deve trocar no primeiro acesso).` : 'Alterações salvas.');
    setForm(null);
    carregar();
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault();
    if (!senhaDe) return;
    if (senhaDe.senha.length < 8) return setErro('A senha precisa ter ao menos 8 caracteres.');
    setSalvando(true);
    const r = await redefinirSenha(senhaDe.u.login, senhaDe.senha);
    setSalvando(false);
    if (!r.ok) return setErro(r.erro);
    setAviso(`Nova senha de ${senhaDe.u.login}: ${senhaDe.senha}`);
    setSenhaDe(null);
  }

  return (
    <GestaoShell eyebrow="Administração" titulo="Usuários e permissões"
      acoes={<button type="button" className={`${btnPrimary} w-auto`} onClick={() => { setErro(''); setAviso(''); setSenhaDe(null); setForm(vazio()); }}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Novo usuário</button>}>
      {erro && <p role="alert" className="flex items-start gap-2 rounded-md border border-error bg-white p-3 text-sm text-error"><Icon icon="solar:danger-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />{erro}</p>}
      {aviso && <p role="status" className="flex items-start gap-2 rounded-md border border-line-1 bg-white p-3 text-sm text-available [overflow-wrap:anywhere]"><Icon icon="solar:check-circle-linear" width={18} className="mt-px shrink-0" aria-hidden="true" />{aviso}</p>}

      {form && (
        <form onSubmit={salvar} className={`${card} flex flex-col gap-4 p-4`} aria-label={form.modo === 'novo' ? 'Novo usuário' : 'Editar usuário'}>
          <p className="text-[0.9375rem] font-medium text-fg-1">{form.modo === 'novo' ? 'Novo usuário' : `Editar ${form.base!.login}`}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={rotulo}>Nome completo<input id="u-nome" className={campo} maxLength={80} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
            {form.modo === 'novo' && <>
              <label className={rotulo}>Usuário<input id="u-login" className={campo} maxLength={40} autoCapitalize="none" spellCheck={false} value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase().trim() })} /></label>
              <label className={rotulo}>CPF (opcional, também serve para entrar)<input id="u-cpf" className={campo} inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })} /></label>
              <label className={rotulo}>Senha inicial
                <div className="flex gap-2"><input id="u-senha" className={`${campo} font-mono`} maxLength={72} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
                  <button type="button" className={`${btnSecondary} w-auto px-3`} onClick={() => setForm({ ...form, senha: gerarSenha() })} aria-label="Gerar outra senha"><Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /></button></div>
              </label>
            </>}
            <Seletor rotulo="Perfil" valor={form.perfil} onChange={(v) => setForm({ ...form, perfil: v })} opcoes={PERFIS} />
          </div>
          {form.perfil === 'ADMIN' ? <p className="text-[0.8125rem] text-fg-3">Administrador vê todas as pousadas.</p> : (
            <fieldset className="flex flex-col gap-2"><legend className="mb-1 text-[0.75rem] uppercase tracking-[0.06em] text-fg-2">Pousadas</legend>
              {props.map((p) => (
                <label key={p.id_propriedade} className="flex min-h-11 items-center gap-2 text-[0.875rem] text-fg-1">
                  <input type="checkbox" className="h-5 w-5 accent-pine" checked={form.props.includes(p.id_propriedade)}
                    onChange={(e) => setForm({ ...form, props: e.target.checked ? [...form.props, p.id_propriedade] : form.props.filter((x) => x !== p.id_propriedade) })} />{p.nm_propriedade}
                </label>))}
            </fieldset>)}
          {form.modo === 'editar' && (
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem] text-fg-1"><input type="checkbox" className="h-5 w-5 accent-pine" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />Ativo (desmarcar bloqueia o acesso na hora)</label>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={`${btnPrimary} w-auto`} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
            <button type="button" className={`${btnSecondary} w-auto`} onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {senhaDe && (
        <form onSubmit={salvarSenha} className={`${card} flex flex-col gap-3 p-4`} aria-label="Redefinir senha">
          <p className="text-[0.9375rem] font-medium text-fg-1">Nova senha de {senhaDe.u.login}</p>
          <div className="flex gap-2"><input id="u-nova-senha" className={`${campo} font-mono`} maxLength={72} value={senhaDe.senha} onChange={(e) => setSenhaDe({ ...senhaDe, senha: e.target.value })} />
            <button type="button" className={`${btnSecondary} w-auto px-3`} onClick={() => setSenhaDe({ ...senhaDe, senha: gerarSenha() })} aria-label="Gerar outra senha"><Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /></button></div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={`${btnPrimary} w-auto`} disabled={salvando}>{salvando ? 'Salvando…' : 'Redefinir senha'}</button>
            <button type="button" className={`${btnSecondary} w-auto`} onClick={() => setSenhaDe(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <TabelaResp rows={us} cols={[
        { h: 'Usuário', principal: true, r: (u) => (<><div>{u.nome}</div><div className="text-[0.75rem] font-normal text-fg-3">{u.login} · CPF {mascaraCpf(u.cpf)}</div></>) },
        { h: 'Perfil', r: (u) => rotuloPerfil(u.perfil) },
        { h: 'Pousadas', r: (u) => <span className="text-fg-2">{nomeProps(u)}</span> },
        { h: 'Status', r: (u) => <span className={`inline-flex items-center gap-1.5 text-[0.75rem] font-medium ${u.ativo ? 'text-available' : 'text-fg-3'}`}><Icon icon={u.ativo ? 'solar:check-circle-linear' : 'solar:user-block-linear'} width={16} aria-hidden="true" />{u.ativo ? 'Ativo' : 'Inativo'}</span> },
        { h: 'Ações', r: (u) => (
          <span className="flex flex-wrap gap-3">
            <button type="button" className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4" onClick={() => editar(u)}>Editar</button>
            <button type="button" className="min-h-11 text-[0.75rem] text-pine underline underline-offset-4" onClick={() => { setErro(''); setAviso(''); setForm(null); setSenhaDe({ u, senha: gerarSenha() }); }}>Redefinir senha</button>
          </span>) },
      ]} />
      <p className="text-[0.75rem] text-fg-3">Cada usuário só vê as pousadas vinculadas (RLS). Desativar bloqueia o acesso sem apagar o histórico.</p>
    </GestaoShell>
  );
}
