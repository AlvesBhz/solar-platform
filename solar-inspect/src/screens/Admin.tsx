import { Icon } from '@iconify/react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { checklistDa, type Ambiente } from '../mocks/checklist';
import GestaoShell, { TabelaResp, card } from '../components/GestaoShell';
import { VALIDACAO, formatarData } from '../components/Status';
import { listarAuditoria, registrarAuditoria, unidadesGestao } from '../mocks/gestao';
import { listarTipos, type TipoVistoria, type Unidade } from '../mocks/unidades';

/** T28 — Propriedades: busca, status e unidades. Desativar sem apagar. */
export function T28Propriedades() {
  const [us, setUs] = useState<Unidade[]>([]);
  const [inativas, setInativas] = useState<string[]>([]);
  useEffect(() => { unidadesGestao().then(setUs); }, []);
  const props = [...[...new Set(us.map((u) => u.propriedade))].map((nome) => ({ nome, unidades: us.filter((u) => u.propriedade === nome) })), ...propsExtras().map((p) => ({ nome: p.nome, unidades: [] as Unidade[] }))];
  return (
    <GestaoShell eyebrow="Administração" titulo="Propriedades" acoes={<Link to="/admin/propriedades/nova" className={`${btnPrimary} w-auto`}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Nova</Link>}>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {props.map((p) => {
          const ativa = !inativas.includes(p.nome);
          return (
            <li key={p.nome} className={`${card} flex flex-col gap-3 p-4 ${ativa ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[0.9375rem] font-medium text-fg-1">{p.nome}</p><p className="text-[0.75rem] text-fg-3">{p.unidades.length} unidades</p></div>
                <span className={`inline-flex items-center gap-1 text-[0.75rem] font-medium ${ativa ? 'text-available' : 'text-fg-3'}`}><Icon icon={ativa ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} width={16} aria-hidden="true" />{ativa ? 'Ativa' : 'Inativa'}</span>
              </div>
              <ul className="flex flex-wrap gap-1.5">{p.unidades.map((u) => <li key={u.id} className="inline-flex items-center gap-1 rounded-full border border-line-1 px-2.5 py-1 text-[0.6875rem] text-fg-2"><Icon icon={VALIDACAO[u.validacao].icon} width={12} aria-hidden="true" />{u.nome}</li>)}</ul>
              <button type="button" className="min-h-11 self-start text-[0.75rem] text-pine underline underline-offset-4" onClick={() => { setInativas((l) => ativa ? [...l, p.nome] : l.filter((x) => x !== p.nome)); registrarAuditoria(ativa ? 'Propriedade desativada' : 'Propriedade reativada', p.nome); }}>
                {ativa ? 'Desativar (mantém o histórico)' : 'Reativar'}
              </button>
            </li>
          );
        })}
      </ul>
    </GestaoShell>
  );
}

const USUARIOS = [
  { nome: 'Ana Souza', email: 'ana@solar.dev', perfil: 'Assessor', props: 'Pousada Solar do Espinhaço', ativo: true },
  { nome: 'Bruno Lima', email: 'bruno@solar.dev', perfil: 'Assessor', props: 'Pousada Solar do Espinhaço', ativo: true },
  { nome: 'Carla Dias', email: 'carla@solar.dev', perfil: 'Assessor', props: 'Hotel Lapinha', ativo: true },
  { nome: 'Gestor Demo', email: 'gestor@solar.dev', perfil: 'Gestor', props: 'Todas', ativo: true },
  { nome: 'Usuário Inativo', email: 'inativo@solar.dev', perfil: 'Assessor', props: 'Hotel Lapinha', ativo: false },
];

/** T32 — Usuários e permissões: perfil, propriedades e status (menor privilégio). */
export function T32Usuarios() {
  const [l, setL] = useState(USUARIOS);
  const alternar = (email: string) => {
    const u = l.find((x) => x.email === email)!;
    setL(l.map((x) => (x.email === email ? { ...x, ativo: !x.ativo } : x)));
    registrarAuditoria(u.ativo ? 'Usuário desativado' : 'Usuário reativado', email);
  };
  return (
    <GestaoShell eyebrow="Administração" titulo="Usuários e permissões">
      <TabelaResp rows={l} cols={[
        { h: 'Usuário', r: (u) => (<><div>{u.nome}</div><div className="text-[0.75rem] font-normal text-fg-3">{u.email}</div></>) },
        { h: 'Perfil', r: (u) => u.perfil },
        { h: 'Propriedades', r: (u) => <span className="text-fg-2">{u.props}</span> },
        { h: 'Status', r: (u) => (
          <button type="button" aria-pressed={u.ativo} onClick={() => alternar(u.email)} className={`inline-flex min-h-11 items-center gap-1.5 text-[0.75rem] font-medium ${u.ativo ? 'text-available' : 'text-fg-3'}`}>
            <Icon icon={u.ativo ? 'solar:check-circle-linear' : 'solar:user-block-linear'} width={16} aria-hidden="true" />{u.ativo ? 'Ativo' : 'Inativo'}
          </button>) },
      ]} />
      <p className="text-[0.75rem] text-fg-3">Toque no status para ativar ou desativar. O acesso de cada usuário fica limitado às propriedades vinculadas (RLS).</p>
    </GestaoShell>
  );
}

/** T34 — Auditoria: eventos por usuário, ação e período. Somente leitura. */
export function T34Auditoria() {
  const ev = listarAuditoria();
  const [q, setQ] = useState('');
  const lista = ev.filter((e) => `${e.usuario} ${e.acao} ${e.detalhe}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <GestaoShell eyebrow="Administração" titulo="Auditoria">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar por usuário, ação ou unidade" className="min-h-11 rounded-md border border-line-2 bg-white px-3 placeholder:text-fg-4" aria-label="Filtrar" />
      <TabelaResp rows={lista} cols={[
        { h: 'Quando', r: (e) => <span className="font-mono text-[0.75rem] text-fg-2">{formatarData(e.em)}</span> },
        { h: 'Usuário', r: (e) => e.usuario },
        { h: 'Ação', principal: true, r: (e) => e.acao },
        { h: 'Detalhe', r: (e) => <span className="text-fg-2">{e.detalhe}</span> },
      ]} />
    </GestaoShell>
  );
}

/* ───────── T29 · T30 · T31 · T33 ───────── */
const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-fg-1 focus:border-pine focus:outline-none';
const rot = 'flex flex-col gap-1 text-[0.75rem] uppercase tracking-[0.08em] text-fg-2';
const K_PROPS = 'solar-inspect:propriedades-extra';
export const propsExtras = (): { nome: string; tipo: string; validacao: string; raio: number }[] => { try { return JSON.parse(localStorage.getItem(K_PROPS) ?? '[]'); } catch { return []; } };

/** T29 — Formulário de propriedade: nome, tipo, GPS, raio e validação, com checagem da configuração. */
export function T29FormPropriedade() {
  const navigate = useNavigate();
  const [f, setF] = useState({ nome: '', tipo: 'Pousada', lat: '-19.1000', lng: '-43.6000', raio: '40', validacao: 'gps_qr' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const erros = [
    f.nome.trim().length < 3 && 'Informe o nome (mínimo 3 letras).',
    (Math.abs(+f.lat) > 90 || f.lat === '' || isNaN(+f.lat)) && 'Latitude inválida (-90 a 90).',
    (Math.abs(+f.lng) > 180 || f.lng === '' || isNaN(+f.lng)) && 'Longitude inválida (-180 a 180).',
    (+f.raio < 10 || +f.raio > 500) && 'Raio deve ficar entre 10 e 500 m.',
  ].filter(Boolean) as string[];
  function salvar() {
    try { localStorage.setItem(K_PROPS, JSON.stringify([...propsExtras(), { nome: f.nome.trim(), tipo: f.tipo, validacao: f.validacao, raio: +f.raio }])); } catch { /* ok */ }
    registrarAuditoria('Propriedade criada', `${f.nome.trim()} · ${VALIDACAO[f.validacao as keyof typeof VALIDACAO].label} · raio ${f.raio} m`);
    navigate('/admin/propriedades');
  }
  return (
    <GestaoShell eyebrow="Administração" titulo="Nova propriedade">
      <form className={`${card} grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 p-5 sm:grid-cols-2`} onSubmit={(e) => { e.preventDefault(); if (!erros.length) salvar(); }} noValidate>
        <label className={`${rot} sm:col-span-2`}>Nome<input id="p-nome" className={campo} value={f.nome} onChange={set('nome')} placeholder="Ex.: Chalés da Serra" /></label>
        <label className={rot}>Tipo<select id="p-tipo" className={campo} value={f.tipo} onChange={set('tipo')}><option>Pousada</option><option>Hotel</option><option>Chalés</option></select></label>
        <label className={rot}>Validação padrão<select id="p-val" className={campo} value={f.validacao} onChange={set('validacao')}>{Object.entries(VALIDACAO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        <label className={rot}>Latitude<input id="p-lat" inputMode="decimal" className={campo} value={f.lat} onChange={set('lat')} /></label>
        <label className={rot}>Longitude<input id="p-lng" inputMode="decimal" className={campo} value={f.lng} onChange={set('lng')} /></label>
        <label className={rot}>Raio (m)<input id="p-raio" inputMode="numeric" className={campo} value={f.raio} onChange={set('raio')} /></label>
        {erros.length > 0 && <ul className="flex flex-col gap-1 text-[0.8125rem] text-warning sm:col-span-2" role="alert">{erros.map((e) => <li key={e} className="flex items-center gap-1.5"><Icon icon="solar:danger-circle-linear" width={16} aria-hidden="true" />{e}</li>)}</ul>}
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="button" className={`${btnSecondary} w-auto`} onClick={() => navigate('/admin/propriedades')}>Cancelar</button>
          <button type="submit" className={`${btnPrimary} w-auto`} disabled={erros.length > 0}>Salvar propriedade</button>
        </div>
      </form>
    </GestaoShell>
  );
}

/** T30 — Ambientes e itens: árvore, ordem, criticidade e referência. Alterações valem para novas vistorias (histórico preservado). */
export function T30Ambientes() {
  const [us, setUs] = useState<Unidade[]>([]);
  const [uid, setUid] = useState('chale-ipe');
  const [arv, setArv] = useState<Ambiente[]>([]);
  const [novo, setNovo] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(false);
  const [novoAmb, setNovoAmb] = useState('');
  const addAmb = () => {
    const n = novoAmb.trim();
    if (!n) return;
    setArv([...arv, { id: `amb-${Date.now()}`, nome: n, icon: 'solar:home-2-linear', itens: [] }]);
    setNovoAmb(''); setSalvo(false);
  };
  useEffect(() => { unidadesGestao().then(setUs); }, []);
  useEffect(() => { const u = us.find((x) => x.id === uid); if (u) setArv(checklistDa(u).map((a) => ({ ...a, itens: a.itens.map((i) => ({ ...i })) }))); setSalvo(false); }, [us, uid]);
  const mover = (i: number, d: number) => { const l = [...arv]; [l[i], l[i + d]] = [l[i + d], l[i]]; setArv(l); setSalvo(false); };
  const alt = (ai: number, ii: number, k: 'critico' | 'foto') => { setArv(arv.map((a, x) => x !== ai ? a : { ...a, itens: a.itens.map((it, y) => y !== ii ? it : { ...it, [k]: !it[k] }) })); setSalvo(false); };
  const add = (ai: number) => { const n = novo[arv[ai].id]?.trim(); if (!n) return; setArv(arv.map((a, x) => x !== ai ? a : { ...a, itens: [...a.itens, { id: `novo-${Date.now()}`, nome: n }] })); setNovo({ ...novo, [arv[ai].id]: '' }); setSalvo(false); };
  return (
    <GestaoShell eyebrow="Administração" titulo="Ambientes e itens" acoes={
      <select aria-label="Unidade" className={`${campo} w-auto`} value={uid} onChange={(e) => setUid(e.target.value)}>{us.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>}>
      <p className="text-[0.8125rem] text-fg-2">Ordem física do percurso. As mudanças valem para novas vistorias; as já enviadas preservam o checklist original.</p>
      <ol className="flex flex-col gap-3">
        {arv.map((a, ai) => (
          <li key={a.id} className={`${card} flex flex-col gap-3 p-4`}>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[0.75rem] text-fg-3">{ai + 1}</span>
              {a.ref ? <img src={a.ref} alt="" width={64} height={36} className="h-9 w-16 rounded object-cover" /> : <span className="flex h-9 w-16 items-center justify-center rounded bg-cream text-fg-3"><Icon icon={a.icon} width={18} aria-hidden="true" /></span>}
              <span className="flex-1 text-[0.9375rem] font-medium text-fg-1">{a.nome}</span>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream disabled:opacity-30" disabled={ai === 0} onClick={() => mover(ai, -1)} aria-label={`Subir ${a.nome}`}><Icon icon="solar:alt-arrow-up-linear" width={18} /></button>
              <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full text-fg-2 hover:bg-cream disabled:opacity-30" disabled={ai === arv.length - 1} onClick={() => mover(ai, 1)} aria-label={`Descer ${a.nome}`}><Icon icon="solar:alt-arrow-down-linear" width={18} /></button>
            </div>
            <ul className="divide-y divide-line-1 rounded-md border border-line-1 empty:hidden">
              {a.itens.map((it, ii) => (
                <li key={it.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-[0.8125rem]">
                  <span className="min-w-0 flex-1">{it.nome}</span>
                  {(['critico', 'foto'] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={!!it[k]} onClick={() => alt(ai, ii, k)}
                      className={`inline-flex min-h-11 items-center gap-1 rounded-full px-2.5 text-[0.6875rem] uppercase tracking-[0.08em] ${it[k] ? (k === 'critico' ? 'text-error' : 'text-pine') : 'text-fg-4'}`}>
                      <Icon icon={k === 'critico' ? 'solar:danger-triangle-linear' : 'solar:camera-linear'} width={14} aria-hidden="true" />{k === 'critico' ? 'Crítico' : 'Foto'}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input aria-label={`Novo item em ${a.nome}`} className={campo} placeholder="Novo item" value={novo[a.id] ?? ''} onChange={(e) => setNovo({ ...novo, [a.id]: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add(ai)} />
              <button type="button" className={`${btnSecondary} w-auto`} onClick={() => add(ai)}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Adicionar</button>
            </div>
          </li>
        ))}
      </ol>
      <div className={`${card} flex flex-col gap-3 border-dashed p-4`}>
        <h2 className="font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2">Novo ambiente</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input aria-label="Nome do novo ambiente" className={campo} placeholder="Ex.: Área gourmet" value={novoAmb} onChange={(e) => setNovoAmb(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addAmb()} />
          <button type="button" className={`${btnSecondary} sm:w-auto sm:shrink-0`} disabled={!novoAmb.trim()} onClick={addAmb}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Criar ambiente</button>
        </div>
        <p className="text-[0.75rem] text-fg-3">Entra no fim do percurso; use as setas para reposicionar e adicione os itens em seguida.</p>
      </div>
      <button type="button" className={`${btnPrimary} sm:w-auto sm:self-start`} disabled={salvo} onClick={() => { registrarAuditoria('Checklist alterado', `${uid}: nova versão com ${arv.reduce((n, a) => n + a.itens.length, 0)} itens`); setSalvo(true); }}>
        {salvo ? 'Nova versão salva' : 'Salvar nova versão'}
      </button>
    </GestaoShell>
  );
}

const PERIODOS = ['Por estadia', 'Semanal', 'Mensal', 'Trimestral', 'Sob demanda'];
/** T31 — Tipos de vistoria: nome, periodicidade, itens e ordem. Valida antes de ativar. */
export function T31Tipos() {
  const [ts, setTs] = useState<(TipoVistoria & { periodo: string })[]>([]);
  const [msg, setMsg] = useState('');
  useEffect(() => { listarTipos().then((l) => setTs(l.map((t) => ({ ...t, periodo: t.id === 'preventiva' ? 'Mensal' : t.id === 'enxoval' ? 'Semanal' : t.id === 'dedetizacao' ? 'Trimestral' : 'Por estadia' })))); }, []);
  function alternar(i: number) {
    const t = ts[i];
    if (!t.ativo && t.itens === 0) return setMsg(`"${t.nome}" não pode ser ativado: o checklist não tem itens.`);
    setTs(ts.map((x, j) => j === i ? { ...x, ativo: !x.ativo } : x)); setMsg('');
    registrarAuditoria(t.ativo ? 'Tipo desativado' : 'Tipo ativado', `${t.nome} (vistorias anteriores preservadas)`);
  }
  return (
    <GestaoShell eyebrow="Administração" titulo="Tipos de vistoria">
      {msg && <p className="flex items-center gap-2 rounded-md bg-warning-bg p-3 text-[0.8125rem] text-warning" role="alert"><Icon icon="solar:danger-circle-linear" width={18} aria-hidden="true" />{msg}</p>}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {ts.map((t, i) => (
          <li key={t.id} className={`${card} flex flex-col gap-3 p-4 ${t.ativo ? '' : 'opacity-70'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[0.9375rem] font-medium text-fg-1">{t.nome}</p><p className="text-[0.75rem] text-fg-3">{t.itens} itens · {t.respostas.join(' / ') || 'sem respostas'}</p></div>
              <button type="button" aria-pressed={t.ativo} onClick={() => alternar(i)} className={`inline-flex min-h-11 shrink-0 items-center gap-1 text-[0.75rem] font-medium ${t.ativo ? 'text-available' : 'text-fg-3'}`}>
                <Icon icon={t.ativo ? 'solar:check-circle-linear' : 'solar:close-circle-linear'} width={16} aria-hidden="true" />{t.ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
            <p className="text-[0.8125rem] text-fg-2">{t.descricao}</p>
            <label className={rot}>Periodicidade
              <select className={campo} value={t.periodo} onChange={(e) => setTs(ts.map((x, j) => j === i ? { ...x, periodo: e.target.value } : x))}>{PERIODOS.map((p) => <option key={p}>{p}</option>)}</select>
            </label>
          </li>
        ))}
      </ul>
    </GestaoShell>
  );
}

/** T33 — Configuração GPS/QR: modo, coordenadas, raio e segredo. Rotacionar invalida os códigos anteriores. */
export function T33Presenca() {
  const [us, setUs] = useState<Unidade[]>([]);
  const [uid, setUid] = useState('chale-ipe');
  const [modo, setModo] = useState('gps_qr');
  const [raio, setRaio] = useState('40');
  const [versao, setVersao] = useState(2);
  const [ok, setOk] = useState('');
  useEffect(() => { unidadesGestao().then(setUs); }, []);
  const u = us.find((x) => x.id === uid);
  useEffect(() => { if (u) { setModo(u.validacao); setRaio(u.tipo === 'Chalé' ? '40' : '25'); setOk(''); } }, [u]);
  const raioOk = +raio >= 10 && +raio <= 500;
  return (
    <GestaoShell eyebrow="Administração" titulo="Configuração de presença" acoes={
      <select aria-label="Unidade" className={`${campo} w-auto`} value={uid} onChange={(e) => setUid(e.target.value)}>{us.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>}>
      <div className="grid max-w-3xl gap-4 md:grid-cols-2">
        <section className={`${card} flex flex-col gap-4 p-5`}>
          <h2 className="flex items-center gap-2 font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2"><Icon icon="solar:gps-linear" width={16} aria-hidden="true" />Validação</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Modo</legend>
            {Object.entries(VALIDACAO).map(([k, v]) => (
              <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 text-[0.8125rem] ${modo === k ? 'border-pine bg-pine text-white' : 'border-line-2 text-fg-1'}`}>
                <input type="radio" name="modo" className="sr-only" checked={modo === k} onChange={() => setModo(k)} /><Icon icon={v.icon} width={18} aria-hidden="true" />{v.label}
              </label>
            ))}
          </fieldset>
          {modo !== 'qr' && <label className={rot}>Raio (m)<input inputMode="numeric" className={`${campo} ${raioOk ? '' : 'border-warning'}`} value={raio} onChange={(e) => setRaio(e.target.value)} /></label>}
          <p className="text-[0.75rem] text-fg-3">Precisão mínima aceita: 50 m. A distância é calculada no servidor.</p>
          <button type="button" className={btnPrimary} disabled={modo !== 'qr' && !raioOk} onClick={() => { registrarAuditoria('Presença configurada', `${u?.nome}: ${VALIDACAO[modo as keyof typeof VALIDACAO].label}${modo !== 'qr' ? ` · raio ${raio} m` : ''}`); setOk('Configuração salva.'); }}>Salvar</button>
          {ok && <p className="flex items-center gap-1.5 text-[0.8125rem] text-available" role="status"><Icon icon="solar:check-circle-linear" width={16} aria-hidden="true" />{ok}</p>}
        </section>
        <section className={`${card} flex flex-col gap-4 p-5 ${modo === 'gps' ? 'opacity-50' : ''}`}>
          <h2 className="flex items-center gap-2 font-sans text-xs font-normal uppercase tracking-[0.08em] text-fg-2"><Icon icon="solar:qr-code-linear" width={16} aria-hidden="true" />QR Code da unidade</h2>
          <div className="rounded-md bg-cream p-3 font-mono text-[0.75rem] text-fg-1 [overflow-wrap:anywhere]">SOLAR:{uid}:{'•'.repeat(4)}<span className="text-fg-3"> · versão {versao}</span></div>
          <p className="text-[0.75rem] text-fg-3">O segredo nunca é exibido nem enviado ao navegador do assessor.</p>
          <button type="button" className={btnSecondary} disabled={modo === 'gps'} onClick={() => { setVersao(versao + 1); registrarAuditoria('QR rotacionado', `${u?.nome}: códigos anteriores invalidados (v${versao} → v${versao + 1})`); setOk(`QR rotacionado para a versão ${versao + 1}. Imprima e substitua o código fixado.`); }}>
            <Icon icon="solar:refresh-linear" width={18} aria-hidden="true" />Rotacionar segredo
          </button>
        </section>
      </div>
    </GestaoShell>
  );
}
