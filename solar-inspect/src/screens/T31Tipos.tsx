import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Seletor } from '../components/Filtros';
import GestaoShell, { card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import type { Perfil } from '../lib/acesso';
import { DO_SITE, alternarItemNoTipo, itensDoTipo, listarAmbientes, listarTipos, listarUnidadesPresenca, salvarTipo, validarTipo, type Ambiente, type Comportamento, type Tipo, type UnidadePresenca } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const campo = 'ui-campo';
const rot = 'ui-rotulo';
const link = 'min-h-11 px-1 text-[0.75rem] text-pine underline underline-offset-4';
const COMP = [{ valor: 'ENTRADA', label: 'Entrada (check-in)' }, { valor: 'SAIDA', label: 'Saída (check-out)' }, { valor: 'ROTINA', label: 'Rotina' }, { valor: 'MANUTENCAO', label: 'Manutenção' }];
const PER = [{ valor: '', label: 'Sem agenda (quando precisar)' }, { valor: 'DIARIA', label: 'Diária' }, { valor: 'SEMANAL', label: 'Semanal' }, { valor: 'MENSAL', label: 'Mensal' }];
const CAMPO: { valor: Perfil; label: string }[] = [{ valor: 'ASSESSOR', label: 'Vistoria' }, { valor: 'LIMPEZA', label: 'Limpeza' }, { valor: 'MANUTENCAO', label: 'Manutenção' }];
const novo = (): Omit<Tipo, 'id'> => ({ codigo: '', nome: '', comportamento: 'ROTINA', periodicidade: 'SEMANAL', exigeEntrada: false, exigeAssinatura: false, ativo: true, perfis: ['ASSESSOR'] });

/** T31 — Tipos de vistoria: regras de cada tipo, quem da equipe faz e quais itens entram no checklist. Entrada e Saída são do site. Só ADMIN. */
export function T31Tipos() {
  const perfil = usePerfilPermitido(['ADMIN']);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [f, setF] = useState<{ id: number | null; t: Omit<Tipo, 'id'> } | null>(null);
  const [sel, setSel] = useState<Tipo | null>(null);
  const [us, setUs] = useState<UnidadePresenca[]>([]);
  const [uid, setUid] = useState('');
  const [ambs, setAmbs] = useState<Ambiente[]>([]);
  const [marcados, setMarcados] = useState<number[]>([]);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const carregar = () => listarTipos().then(setTipos).catch(() => setErro('Não foi possível carregar os tipos.'));
  useEffect(() => { if (perfil) { carregar(); listarUnidadesPresenca().then((u) => { setUs(u); if (u[0]) setUid(String(u[0].id)); }).catch(() => {}); } }, [perfil]);
  useEffect(() => { if (sel && uid) Promise.all([listarAmbientes(Number(uid)), itensDoTipo(sel.id)]).then(([a, m]) => { setAmbs(a); setMarcados(m); }).catch(() => setErro('Não foi possível carregar os itens.')); }, [sel, uid]);
  if (!perfil) return null;

  const erros = f ? validarTipo(f.t, f.id === null) : [];
  const doSite = (t: { codigo: string }) => DO_SITE.includes(t.codigo);
  const ativosNoChale = ambs.flatMap((a) => a.ativo ? a.itens.filter((i) => i.ativo) : []);
  const qtdeMarcadosNoChale = ativosNoChale.filter((i) => marcados.includes(i.id)).length;

  async function salvar(e: FormEvent) {
    e.preventDefault(); if (!f || erros.length) return;
    setErro(''); setAviso('');
    const r = await salvarTipo(f.id, f.t);
    if (!r.ok) return setErro(r.erro);
    setAviso(f.id ? 'Tipo salvo.' : 'Tipo criado. Agora escolha os itens do checklist dele.'); setF(null); carregar();
  }
  async function alternar(idItem: number, incluir: boolean) {
    if (!sel) return;
    setErro(''); setAviso('');
    const aplicar = (dentro: boolean) => setMarcados((m) => (dentro ? [...m.filter((x) => x !== idItem), idItem] : m.filter((x) => x !== idItem)));
    aplicar(incluir);                                   // marca na hora; desfaz se o servidor recusar
    const r = await alternarItemNoTipo(sel.id, idItem, incluir);
    if (!r.ok) { aplicar(!incluir); setErro(r.erro); }
  }
  async function ativar(t: Tipo, ativo: boolean) {
    setErro(''); setAviso('');
    if (ativo && (await itensDoTipo(t.id)).length === 0) return setErro(`${t.nome}: inclua ao menos um item no checklist antes de ativar.`);
    const r = await salvarTipo(t.id, { ...t, ativo });
    if (!r.ok) return setErro(r.erro);
    setAviso(ativo ? 'Tipo ativado.' : 'Tipo desativado (vistorias antigas preservadas).'); carregar();
  }

  return (
    <GestaoShell eyebrow="Administração" titulo="Tipos de vistoria"
      acoes={<button type="button" className={`${btnPrimary} !min-h-10 !w-auto !px-4`} onClick={() => { setSel(null); setF({ id: null, t: novo() }); }}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Novo tipo</button>}>
      {erro && <p role="alert" className="rounded-md border border-error bg-white p-3 text-sm text-error">{erro}</p>}
      {aviso && <p className="rounded-md border border-line-1 bg-white p-3 text-sm text-available">{aviso}</p>}

      {f && (
        <form onSubmit={salvar} className={`${card} grid max-w-2xl grid-cols-[minmax(0,1fr)] gap-4 p-5 sm:grid-cols-2`} noValidate aria-label="Tipo de vistoria">
          <label className={rot}>Código<input id="t-codigo" className={`${campo} font-mono`} maxLength={40} disabled={f.id !== null} value={f.t.codigo} onChange={(e) => setF({ ...f, t: { ...f.t, codigo: e.target.value.toUpperCase().replace(/\s/g, '_') } })} placeholder="ROTINA_MENSAL" /></label>
          <label className={rot}>Nome<input id="t-nome" className={campo} maxLength={60} value={f.t.nome} onChange={(e) => setF({ ...f, t: { ...f.t, nome: e.target.value } })} /></label>
          <div className="ui-rotulo">Comportamento<Seletor rotulo="Comportamento" valor={f.t.comportamento} desabilitado={doSite(f.t) && f.id !== null} onChange={(v) => setF({ ...f, t: { ...f.t, comportamento: v as Comportamento } })} opcoes={COMP} /></div>
          {f.t.comportamento === 'ROTINA' && <div className="ui-rotulo">Periodicidade<Seletor rotulo="Periodicidade" valor={f.t.periodicidade ?? ''} onChange={(v) => setF({ ...f, t: { ...f.t, periodicidade: (v || null) as Tipo['periodicidade'] } })} opcoes={PER} /></div>}
          <fieldset className="flex flex-col gap-1 sm:col-span-2"><legend className="ui-rotulo mb-1">Quem da equipe de campo faz (gestão faz todos)</legend>
            <div className="flex flex-wrap gap-4">{CAMPO.map((p) => (
              <label key={p.valor} className="ui-marcar"><input type="checkbox" className="ui-caixa" checked={f.t.perfis.includes(p.valor)}
                onChange={(e) => setF({ ...f, t: { ...f.t, perfis: e.target.checked ? [...f.t.perfis, p.valor] : f.t.perfis.filter((x) => x !== p.valor) } })} />{p.label}</label>))}</div>
          </fieldset>
          <label className="ui-marcar"><input type="checkbox" className="ui-caixa" checked={f.t.exigeEntrada} onChange={(e) => setF({ ...f, t: { ...f.t, exigeEntrada: e.target.checked } })} />Compara com a vistoria de Entrada</label>
          <label className="ui-marcar"><input type="checkbox" className="ui-caixa" checked={f.t.exigeAssinatura} onChange={(e) => setF({ ...f, t: { ...f.t, exigeAssinatura: e.target.checked } })} />Pede assinatura no fim</label>
          {erros.length > 0 && <ul role="alert" className="flex flex-col gap-1 text-[0.8125rem] text-warning sm:col-span-2">{erros.map((x) => <li key={x}>{x}</li>)}</ul>}
          <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="button" className={`${btnSecondary} w-auto`} onClick={() => setF(null)}>Cancelar</button><button type="submit" className={`${btnPrimary} w-auto`} disabled={erros.length > 0}>Salvar tipo</button></div>
        </form>
      )}

      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(20rem,100%),1fr))] gap-3">
        {tipos.map((t) => (
          <li key={t.id} className={`${card} flex flex-col gap-2 p-4 ${t.ativo ? '' : 'opacity-60'}`} data-tipo={t.codigo}>
            <div><p className="text-[0.9375rem] font-medium text-fg-1">{t.nome}{t.ativo ? '' : ' (desativado)'}</p>
              <p className="font-mono text-[0.6875rem] text-fg-3">{t.codigo}{doSite(t) ? ' · usado pelo site' : ''}</p></div>
            <p className="text-[0.75rem] text-fg-2">{COMP.find((c) => c.valor === t.comportamento)?.label}{t.periodicidade ? ` · ${PER.find((p) => p.valor === t.periodicidade)?.label}` : ''} · {t.perfis.map((p) => CAMPO.find((c) => c.valor === p)?.label).join(', ')}</p>
            <span className="flex flex-wrap gap-2">
              <button type="button" className={link} onClick={() => { setSel(null); setF({ id: t.id, t: { ...t } }); }}>Editar</button>
              <button type="button" className={link} onClick={() => { setF(null); setSel(t); }}>Itens do checklist</button>
              {!doSite(t) && <button type="button" className={link} onClick={() => ativar(t, !t.ativo)}>{t.ativo ? 'Desativar' : 'Ativar'}</button>}
            </span>
          </li>
        ))}
      </ul>

      {sel && (
        <section className={`${card} flex flex-col gap-3 p-4`} aria-label="Itens do tipo">
          <p className="text-[0.9375rem] font-medium text-fg-1">Itens de “{sel.nome}”</p>
          <div className="max-w-sm"><Seletor rotulo="Chalé" valor={uid} onChange={setUid} opcoes={us.map((u) => ({ valor: String(u.id), label: `${u.nome} · ${u.pousada}` }))} /></div>
          {ativosNoChale.length === 0 ? <p className="text-sm text-fg-3">Este chalé ainda não tem itens ativos. Cadastre em Ambientes e itens.</p> : (
            <>
              <p className="text-[0.75rem] text-fg-3">{qtdeMarcadosNoChale} de {ativosNoChale.length} itens deste chalé entram neste tipo.</p>
              {ambs.filter((a) => a.ativo && a.itens.some((i) => i.ativo)).map((a) => (
                <fieldset key={a.id} className="flex flex-col"><legend className="ui-rotulo">{a.nome}</legend>
                  {a.itens.filter((i) => i.ativo).map((i) => (
                    <label key={i.id} className="ui-marcar"><input type="checkbox" className="ui-caixa" checked={marcados.includes(i.id)} onChange={(e) => alternar(i.id, e.target.checked)} />{i.nome}{i.critico ? <span className="text-[0.6875rem] text-warning">crítico</span> : null}</label>))}
                </fieldset>))}
            </>)}
          <button type="button" className={`${btnSecondary} w-auto self-start`} onClick={() => setSel(null)}>Fechar</button>
        </section>
      )}
    </GestaoShell>
  );
}
