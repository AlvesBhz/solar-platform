import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Seletor } from '../components/Filtros';
import AvisoFixo from '../components/AvisoFixo';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { cpfValido, formatarCpf } from '../lib/cpf';
import { problemaSenha, type Perfil } from '../lib/acesso';
import { PERFIS, criarUsuario, listarPropriedades, listarUsuarios, redefinirSenha, rotuloPerfil, salvarUsuario, type Propriedade, type Usuario, listarUnidadesPresenca, type UnidadePresenca } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const LOGIN_VALIDO = /^[a-z][a-z0-9._-]{2,39}$/;
const campo = 'ui-campo';
const rotulo = 'ui-rotulo';
const mascaraCpf = (c: string | null) => (c ? `•••.${c.slice(3, 6)}.${c.slice(6, 9)}-••` : '—');
/** Senha provisória forte: 12 caracteres sem os que se confundem (0/O, 1/l/I), sempre com maiúscula, minúscula e número. */
function gerarSenha(): string {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const s = Array.from(crypto.getRandomValues(new Uint32Array(12)), (n) => a[n % a.length]).join('');
  return /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) ? s : gerarSenha();
}
const semAcento = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
/** Usuário digitado: minúsculo, sem acento, espaço vira ponto e só os caracteres aceitos (nunca mostra erro de formato). */
const limparLogin = (t: string) => semAcento(t).toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z]+/, '').slice(0, 40);
/** Sugestão a partir do nome: primeiro e último nome (lais.magalhaes), sem repetir um usuário que já existe. */
function sugerirLogin(nome: string, existentes: string[]): string {
  const partes = semAcento(nome).toLowerCase().split(/\s+/).map((p) => p.replace(/[^a-z]/g, '')).filter((p) => p && !['de', 'da', 'do', 'das', 'dos', 'e'].includes(p));
  if (!partes.length) return '';
  let base = (partes.length > 1 ? `${partes[0]}.${partes[partes.length - 1]}` : partes[0]).slice(0, 36);
  if (base.length < 3) base = (base + 'usr').slice(0, 3);
  let login = base, n = 2;
  while (existentes.includes(login)) login = `${base}${n++}`;
  return login;
}

// escolher[idPropriedade] = true: só os chalés marcados em `unidades`; senão, todos os chalés da pousada
type Form = { modo: 'novo' | 'editar'; base?: Usuario; nome: string; login: string; loginManual?: boolean; cpf: string; perfil: Perfil; senha: string; props: number[]; unidades: number[]; escolher: Record<number, boolean>; ativo: boolean };
const vazio = (): Form => ({ modo: 'novo', nome: '', login: '', cpf: '', perfil: 'ASSESSOR', senha: gerarSenha(), props: [], unidades: [], escolher: {}, ativo: true });

/** T32 — Usuários e permissões: cadastro (Edge Function criar-usuario), perfil, pousadas, status e redefinição de senha. Só ADMIN. */
export function T32Usuarios() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const [us, setUs] = useState<Usuario[]>([]);
  const [props, setProps] = useState<Propriedade[]>([]);
  const [chales, setChales] = useState<UnidadePresenca[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [senhaDe, setSenhaDe] = useState<{ u: Usuario; senha: string } | null>(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = () => Promise.all([listarUsuarios(), listarPropriedades(), listarUnidadesPresenca().catch(() => [])]).then(([u, p, c]) => { setUs(u); setProps(p); setChales(c); })
    .catch(() => setErro('Não foi possível carregar a equipe.'));
  useEffect(() => { if (perfil) carregar(); }, [perfil]);
  if (!perfil) return null;

  const chalesDe = (idProp: number) => chales.filter((c) => c.idPropriedade === idProp);
  // "Solar do Espinhaço (Casa do Mirante)" quando há chalés escolhidos; só o nome da pousada quando atende todos
  const nomeProps = (u: Usuario) => (u.perfil === 'ADMIN' ? 'Todas' : props.filter((p) => u.props.includes(p.id_propriedade)).map((p) => {
    const marc = chalesDe(p.id_propriedade).filter((c) => u.unidades.includes(c.id)).map((c) => c.nome);
    return marc.length ? `${p.nm_propriedade} (${marc.join(', ')})` : p.nm_propriedade;
  }).join(', ') || '—');
  const editar = (u: Usuario) => { setErro(''); setAviso(''); setSenhaDe(null); setForm({ modo: 'editar', base: u, nome: u.nome, login: u.login, cpf: u.cpf ?? '', perfil: u.perfil, senha: '', props: u.props, unidades: u.unidades,
    escolher: Object.fromEntries(u.props.map((p) => [p, chalesDe(p).some((c) => u.unidades.includes(c.id))])), ativo: u.ativo }); };

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(''); setAviso('');
    // integridade antes de ir ao servidor (o banco confere de novo)
    if (form.nome.trim().length < 3) return setErro('Informe o nome completo.');
    if (form.perfil !== 'ADMIN' && form.props.length === 0) return setErro('Escolha ao menos uma pousada para este perfil.');
    // chalés: só os das pousadas marcadas com "Escolher chalés"
    const unidades = form.perfil === 'ADMIN' ? [] : form.props.filter((p) => form.escolher[p]).flatMap((p) => chalesDe(p).filter((c) => form.unidades.includes(c.id)).map((c) => c.id));
    const semChale = form.perfil === 'ADMIN' ? undefined : props.find((p) => form.props.includes(p.id_propriedade) && form.escolher[p.id_propriedade] && !chalesDe(p.id_propriedade).some((c) => unidades.includes(c.id)));
    if (semChale) return setErro(`${semChale.nm_propriedade}: marque ao menos um chalé ou escolha "Todos os chalés".`);
    if (form.modo === 'novo') {
      if (!LOGIN_VALIDO.test(form.login)) return setErro('Usuário: use ao menos 3 letras (ex.: maria.silva).');
      if (us.some((u) => u.login === form.login)) return setErro(`O usuário ${form.login} já existe. Escolha outro (ex.: ${sugerirLogin(form.nome, us.map((u) => u.login))}).`);
      if (form.cpf && !cpfValido(form.cpf)) return setErro('CPF inválido.');
      const ps = problemaSenha(form.senha, form.login);
      if (ps) return setErro(`Senha provisória: ${ps}`);
    }
    setSalvando(true);
    const r = form.modo === 'novo'
      ? await criarUsuario({ nome: form.nome.trim(), login: form.login, cpf: form.cpf.replace(/\D/g, ''), perfil: form.perfil, senha: form.senha, props: form.props, unidades })
      : await salvarUsuario(form.base!, { nome: form.nome, perfil: form.perfil, ativo: form.ativo, props: form.props, unidades });
    setSalvando(false);
    if (!r.ok) return setErro(r.erro);
    setAviso(form.modo === 'novo' ? `Usuário ${form.login} criado. Senha provisória: ${form.senha} — passe ao funcionário; no primeiro acesso ele cria a própria senha.${form.cpf ? ' Ele também entra pelo CPF.' : ''}` : 'Alterações salvas.');
    setForm(null);
    carregar();
  }

  async function salvarSenha(e: FormEvent) {
    e.preventDefault();
    if (!senhaDe) return;
    const ps = problemaSenha(senhaDe.senha, senhaDe.u.login);
    if (ps) return setErro(`Nova senha: ${ps}`);
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
      {aviso && <AvisoFixo texto={aviso} manter={/senha/i.test(aviso)} onFechar={() => setAviso('')} />}

      {form && (
        <form onSubmit={salvar} className={`${card} flex flex-col gap-4 p-4`} aria-label={form.modo === 'novo' ? 'Novo usuário' : 'Editar usuário'}>
          <p className="text-[0.9375rem] font-medium text-fg-1">{form.modo === 'novo' ? 'Novo usuário' : `Editar ${form.base!.login}`}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={rotulo}>Nome completo<input id="u-nome" className={campo} maxLength={80} value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value, login: form.modo === 'novo' && !form.loginManual ? sugerirLogin(e.target.value, us.map((u) => u.login)) : form.login })} /></label>
            {form.modo === 'novo' && <>
              <label className={rotulo}>Usuário para entrar
                <input id="u-login" className={campo} maxLength={40} autoCapitalize="none" spellCheck={false} placeholder="preenchido pelo nome" value={form.login}
                  onChange={(e) => setForm({ ...form, login: limparLogin(e.target.value), loginManual: e.target.value !== '' })} />
                <span className="normal-case tracking-normal text-fg-3">Criado a partir do nome; pode mudar. Também dá para entrar pelo CPF.</span>
              </label>
              <label className={rotulo}>CPF (opcional, também serve para entrar)<input id="u-cpf" className={campo} inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatarCpf(e.target.value) })} /></label>
              <label className={rotulo}>Senha provisória
                <div className="flex gap-2"><input id="u-senha" className={`${campo} font-mono`} maxLength={72} autoComplete="off" spellCheck={false} value={form.senha} onChange={(e) => setForm({ ...form, senha: e.target.value })} />
                  <button type="button" className={`${btnSecondary} !w-12 shrink-0 !px-0`} onClick={() => setForm({ ...form, senha: gerarSenha() })} aria-label="Gerar outra senha" title="Gerar outra senha"><Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /></button></div>
                {(() => { const ps = problemaSenha(form.senha, form.login); return (
                  <span className={`normal-case tracking-normal ${ps ? 'text-error' : 'text-fg-3'}`}>{ps ?? 'Gerada automaticamente. O funcionário é obrigado a criar a própria senha no primeiro acesso.'}</span>
                ); })()}
              </label>
            </>}
            <Seletor rotulo="Perfil" valor={form.perfil} onChange={(v) => setForm({ ...form, perfil: v })} opcoes={PERFIS} />
          </div>
          {form.perfil === 'ADMIN' ? <p className="text-[0.8125rem] text-fg-3">Administrador vê todas as pousadas.</p> : (
            <fieldset className="flex flex-col gap-2"><legend className="ui-rotulo mb-1">Pousadas</legend>
              {props.map((p) => {
                const marcada = form.props.includes(p.id_propriedade), cs = chalesDe(p.id_propriedade), escolher = !!form.escolher[p.id_propriedade];
                return (
                  <div key={p.id_propriedade} className="flex flex-col" data-pousada={p.nm_propriedade}>
                    <label className="ui-marcar text-fg-1">
                      <input type="checkbox" className="ui-caixa" checked={marcada}
                        onChange={(e) => setForm({ ...form, props: e.target.checked ? [...form.props, p.id_propriedade] : form.props.filter((x) => x !== p.id_propriedade) })} />{p.nm_propriedade}
                    </label>
                    {/* chalés da pousada: todos (padrão) ou só os escolhidos */}
                    {marcada && cs.length > 0 && (
                      <div className="ml-7 flex flex-col gap-0.5 border-l border-line-1 pl-3" role="group" aria-label={`Chalés de ${p.nm_propriedade}`}>
                        <label className="ui-marcar text-fg-1"><input type="radio" name={`ch-${p.id_propriedade}`} className="ui-caixa" checked={!escolher}
                          onChange={() => setForm({ ...form, escolher: { ...form.escolher, [p.id_propriedade]: false } })} />Todos os chalés</label>
                        <label className="ui-marcar text-fg-1"><input type="radio" name={`ch-${p.id_propriedade}`} className="ui-caixa" checked={escolher}
                          onChange={() => setForm({ ...form, escolher: { ...form.escolher, [p.id_propriedade]: true } })} />Escolher chalés</label>
                        {escolher && (
                          <div className="ml-7 flex flex-col">
                            {cs.map((c) => (
                              <label key={c.id} className="ui-marcar text-fg-1">
                                <input type="checkbox" className="ui-caixa" checked={form.unidades.includes(c.id)}
                                  onChange={(e) => setForm({ ...form, unidades: e.target.checked ? [...form.unidades, c.id] : form.unidades.filter((x) => x !== c.id) })} />{c.nome}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="ui-ajuda">Quem tem chalés escolhidos vê e faz vistoria só nesses chalés.</p>
            </fieldset>)}
          {form.modo === 'editar' && (
            <label className="ui-marcar text-fg-1"><input type="checkbox" className="ui-caixa" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />Ativo (desmarcar bloqueia o acesso na hora)</label>
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
            <button type="button" className={`${btnSecondary} !w-12 shrink-0 !px-0`} onClick={() => setSenhaDe({ ...senhaDe, senha: gerarSenha() })} aria-label="Gerar outra senha" title="Gerar outra senha"><Icon icon="solar:refresh-linear" width={18} aria-hidden="true" /></button></div>
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
