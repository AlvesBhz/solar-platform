import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useState } from 'react';
import { Seletor } from '../components/Filtros';
import GestaoShell, { card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { definirTiposDoItem, incluirItensNosTipos, listarAmbientes, listarTipos, listarUnidadesPresenca, salvarAmbiente, salvarItem, tiposDosItens, trocarOrdem, type Ambiente, type Item, type Resultado, type Tipo, type UnidadePresenca } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-[0.875rem] text-fg-1 focus:border-pine focus:outline-none';
const rot = 'flex flex-col gap-1.5 text-[0.75rem] uppercase tracking-[0.06em] text-fg-2';
const link = 'min-h-11 px-1 text-[0.75rem] text-pine underline underline-offset-4';
const seta = 'flex h-11 w-11 items-center justify-center rounded-md text-fg-2 hover:bg-cream disabled:opacity-30';
type FormItem = { id: number | null; idAmbiente: number; nome: string; orientacao: string; critico: boolean; foto: boolean; qtde: string; ordem: number; ativo: boolean; tipos: number[] };

/** T30 — Ambientes e itens do chalé: ordem de passagem, item crítico, foto obrigatória e quantidade. Desativar preserva o histórico. Gestor e ADMIN. */
export function T30Ambientes() {
  const perfil = usePerfilPermitido(['ADMIN', 'GESTOR']);
  const [us, setUs] = useState<UnidadePresenca[]>([]);
  const [uid, setUid] = useState('');
  const [ambs, setAmbs] = useState<Ambiente[]>([]);
  const [fa, setFa] = useState<{ id: number | null; nome: string; ordem: number; ativo: boolean } | null>(null);
  const [fi, setFi] = useState<FormItem | null>(null);
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [vinc, setVinc] = useState<Record<number, number[]>>({});
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  useEffect(() => { if (perfil) listarUnidadesPresenca().then((u) => { setUs(u); if (u[0]) setUid(String(u[0].id)); }).catch(() => setErro('Não foi possível carregar os chalés.')); }, [perfil]);
  const carregar = () => uid && Promise.all([listarAmbientes(Number(uid)), listarTipos(), tiposDosItens()])
    .then(([a, t, v]) => { setAmbs(a); setTipos(t.filter((x) => x.ativo)); setVinc(v); }).catch(() => setErro('Não foi possível carregar os ambientes.'));
  useEffect(() => { carregar(); }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!perfil) return null;

  const tratar = async (p: Promise<Resultado>, ok: string) => { setErro(''); setAviso(''); const r = await p; if (!r.ok) { setErro(r.erro); return false; } setAviso(ok); await carregar(); return true; };
  const proxOrdem = (l: { ordem: number }[]) => (l.length ? Math.max(...l.map((x) => x.ordem)) + 1 : 1);
  async function enviarAmbiente(e: FormEvent) {
    e.preventDefault(); if (!fa) return;
    if (await tratar(salvarAmbiente({ ...fa, idUnidade: Number(uid) }), fa.id ? 'Ambiente salvo.' : 'Ambiente incluído.')) setFa(null);
  }
  async function enviarItem(e: FormEvent) {
    e.preventDefault(); if (!fi) return;
    const qtde = fi.qtde.trim() === '' ? null : Number(fi.qtde);
    // grava o item e já o liga aos tipos marcados: um passo só
    const r = await tratar((async (): Promise<Resultado> => {
      const g = await salvarItem({ id: fi.id, idAmbiente: fi.idAmbiente, nome: fi.nome, orientacao: fi.orientacao, critico: fi.critico, fotoObrigatoria: fi.foto, qtdeEsperada: qtde, ordem: fi.ordem, ativo: fi.ativo });
      if (!g.ok) return g;
      const id = fi.id ?? g.id;
      if (id === undefined) return g;
      const t = await definirTiposDoItem(id, fi.tipos, vinc[id] ?? []);
      return t.ok ? g : { ok: false, erro: `Item salvo, mas não foi possível ligá-lo às vistorias: ${t.erro}` };
    })(), fi.tipos.length ? `Item ${fi.id ? 'salvo' : 'incluído'} e usado em: ${tipos.filter((x) => fi.tipos.includes(x.id)).map((x) => x.nome).join(', ')}.`
      : `Item ${fi.id ? 'salvo' : 'incluído'}, mas sem nenhuma vistoria marcada: ele não aparece para o vistoriador.`);
    if (r) setFi(null);
  }
  const editarItem = (i: Item) => { setFa(null); setFi({ id: i.id, idAmbiente: i.idAmbiente, nome: i.nome, orientacao: i.orientacao ?? '', critico: i.critico, foto: i.fotoObrigatoria, qtde: i.qtdeEsperada?.toString() ?? '', ordem: i.ordem, ativo: i.ativo, tipos: vinc[i.id] ?? [] }); };

  return (
    <GestaoShell eyebrow="Administração" titulo="Ambientes e itens"
      acoes={uid ? <button type="button" className={`${btnPrimary} w-auto`} onClick={() => { setFi(null); setFa({ id: null, nome: '', ordem: proxOrdem(ambs), ativo: true }); }}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Novo ambiente</button> : undefined}>
      <div className="max-w-sm"><Seletor rotulo="Chalé" valor={uid} onChange={setUid} opcoes={us.map((u) => ({ valor: String(u.id), label: `${u.nome} · ${u.pousada}` }))} /></div>
      {erro && <p role="alert" className="rounded-md border border-error bg-white p-3 text-sm text-error">{erro}</p>}
      {aviso && <p className="rounded-md border border-line-1 bg-white p-3 text-sm text-available">{aviso}</p>}

      {(() => {
        const ativos = new Set(tipos.map((t) => t.id));
        const soltos = ambs.filter((a) => a.ativo).flatMap((a) => a.itens).filter((i) => i.ativo && !(vinc[i.id] ?? []).some((t) => ativos.has(t)));
        if (!soltos.length || !tipos.length) return null;
        return (
          <div role="status" className="flex flex-col items-start gap-2 rounded-md border border-warning bg-white p-3 text-[0.8125rem] text-fg-1">
            <p><strong className="font-medium">{soltos.length} {soltos.length === 1 ? 'item ainda não está' : 'itens ainda não estão'} em nenhuma vistoria.</strong> Enquanto isso o vistoriador não consegue iniciar a vistoria deste chalé.</p>
            <button type="button" className={`${btnPrimary} w-auto`} onClick={() => tratar(incluirItensNosTipos(soltos.map((i) => i.id), tipos.map((t) => t.id)), `${soltos.length} ${soltos.length === 1 ? 'item incluído' : 'itens incluídos'} em todas as vistorias. Ajuste em Tipos de vistoria, se quiser.`)}>Incluir em todas as vistorias</button>
          </div>
        );
      })()}

      {fa && (
        <form onSubmit={enviarAmbiente} className={`${card} flex max-w-xl flex-col gap-3 p-4`} aria-label="Ambiente">
          <label className={rot}>Nome do ambiente<input id="a-nome" className={campo} maxLength={80} value={fa.nome} onChange={(e) => setFa({ ...fa, nome: e.target.value })} placeholder="Ex.: Banheiro" /></label>
          <div className="flex flex-wrap gap-2"><button type="submit" className={`${btnPrimary} w-auto`}>Salvar</button><button type="button" className={`${btnSecondary} w-auto`} onClick={() => setFa(null)}>Cancelar</button></div>
        </form>
      )}
      {fi && (
        <form onSubmit={enviarItem} className={`${card} grid max-w-xl grid-cols-[minmax(0,1fr)] gap-3 p-4 sm:grid-cols-2`} aria-label="Item">
          <label className={`${rot} sm:col-span-2`}>Nome do item<input id="i-nome" className={campo} maxLength={80} value={fi.nome} onChange={(e) => setFi({ ...fi, nome: e.target.value })} placeholder="Ex.: Toalhas de banho" /></label>
          <label className={`${rot} sm:col-span-2`}>Como conferir (opcional)<input id="i-orientacao" className={campo} maxLength={300} value={fi.orientacao} onChange={(e) => setFi({ ...fi, orientacao: e.target.value })} /></label>
          <label className={rot}>Quantidade esperada (opcional)<input id="i-qtde" inputMode="numeric" className={campo} value={fi.qtde} onChange={(e) => setFi({ ...fi, qtde: e.target.value })} /></label>
          <div className="flex flex-col justify-end gap-1">
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={fi.critico} onChange={(e) => setFi({ ...fi, critico: e.target.checked })} />Item crítico (problema tira o chalé da venda)</label>
            <label className="flex min-h-11 items-center gap-2 text-[0.875rem]"><input type="checkbox" className="h-5 w-5 accent-pine" checked={fi.foto} onChange={(e) => setFi({ ...fi, foto: e.target.checked })} />Foto obrigatória</label>
          </div>
          <fieldset className="flex flex-col gap-1 sm:col-span-2">
            <legend className="text-[0.75rem] uppercase tracking-[0.06em] text-fg-2">Usar nas vistorias</legend>
            <div className="flex flex-wrap gap-x-5">
              {tipos.map((t) => (
                <label key={t.id} className="flex min-h-11 items-center gap-2 text-[0.875rem]">
                  <input type="checkbox" className="h-5 w-5 accent-pine" checked={fi.tipos.includes(t.id)}
                    onChange={(e) => setFi({ ...fi, tipos: e.target.checked ? [...fi.tipos, t.id] : fi.tipos.filter((x) => x !== t.id) })} />{t.nome}
                </label>
              ))}
            </div>
            <p className={`text-[0.75rem] ${fi.tipos.length ? 'text-fg-3' : 'text-warning'}`}>{fi.tipos.length ? 'O vistoriador vê o item só nos tipos marcados.' : 'Sem nenhum tipo marcado, o item não aparece em vistoria nenhuma.'}</p>
          </fieldset>
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className={`${btnPrimary} w-auto`}>Salvar item</button><button type="button" className={`${btnSecondary} w-auto`} onClick={() => setFi(null)}>Cancelar</button></div>
        </form>
      )}

      <ul className="flex flex-col gap-3">
        {ambs.map((a, ai) => (
          <li key={a.id} className={`${card} flex flex-col gap-2 p-4 ${a.ativo ? '' : 'opacity-60'}`} data-ambiente={a.nome}>
            <div className="flex flex-wrap items-center gap-1">
              <p className="mr-auto text-[0.9375rem] font-medium text-fg-1">{a.nome}{a.ativo ? '' : ' (desativado)'}</p>
              <button type="button" className={seta} aria-label={`Subir ${a.nome}`} title={`Subir ${a.nome}`} disabled={ai === 0} onClick={() => tratar(trocarOrdem('VST_AMBIENTE', a, ambs[ai - 1]), 'Ordem salva.')}><Icon icon="solar:alt-arrow-up-linear" width={18} aria-hidden="true" /></button>
              <button type="button" className={seta} aria-label={`Descer ${a.nome}`} title={`Descer ${a.nome}`} disabled={ai === ambs.length - 1} onClick={() => tratar(trocarOrdem('VST_AMBIENTE', a, ambs[ai + 1]), 'Ordem salva.')}><Icon icon="solar:alt-arrow-down-linear" width={18} aria-hidden="true" /></button>
              <button type="button" className={link} onClick={() => { setFi(null); setFa({ id: a.id, nome: a.nome, ordem: a.ordem, ativo: a.ativo }); }}>Renomear</button>
              <button type="button" className={link} onClick={() => tratar(salvarAmbiente({ ...a, ativo: !a.ativo }), a.ativo ? 'Ambiente desativado (histórico preservado).' : 'Ambiente reativado.')}>{a.ativo ? 'Desativar' : 'Reativar'}</button>
              <button type="button" className={link} onClick={() => { setFa(null); setFi({ id: null, idAmbiente: a.id, nome: '', orientacao: '', critico: false, foto: false, qtde: '', ordem: proxOrdem(a.itens), ativo: true, tipos: tipos.map((t) => t.id) }); }}>+ Item</button>
            </div>
            <ul className="flex flex-col divide-y divide-line-1">
              {a.itens.map((i, ii) => (
                <li key={i.id} className={`flex flex-wrap items-center gap-1 py-1.5 ${i.ativo ? '' : 'opacity-60'}`} data-item={i.nome}>
                  <span className="mr-auto text-[0.875rem] text-fg-1">{i.nome}
                    <span className="ml-2 text-[0.6875rem] text-fg-3">{[i.critico && 'crítico', i.fotoObrigatoria && 'foto obrigatória', i.qtdeEsperada !== null && `qtde ${i.qtdeEsperada}`, !i.ativo && 'desativado'].filter(Boolean).join(' · ')}</span></span>
                  <button type="button" className={seta} aria-label={`Subir ${i.nome}`} title={`Subir ${i.nome}`} disabled={ii === 0} onClick={() => tratar(trocarOrdem('VST_ITEM', i, a.itens[ii - 1]), 'Ordem salva.')}><Icon icon="solar:alt-arrow-up-linear" width={16} aria-hidden="true" /></button>
                  <button type="button" className={seta} aria-label={`Descer ${i.nome}`} title={`Descer ${i.nome}`} disabled={ii === a.itens.length - 1} onClick={() => tratar(trocarOrdem('VST_ITEM', i, a.itens[ii + 1]), 'Ordem salva.')}><Icon icon="solar:alt-arrow-down-linear" width={16} aria-hidden="true" /></button>
                  <button type="button" className={link} onClick={() => editarItem(i)}>Editar</button>
                  <button type="button" className={link} onClick={() => tratar(salvarItem({ ...i, ativo: !i.ativo }), i.ativo ? 'Item desativado (histórico preservado).' : 'Item reativado.')}>{i.ativo ? 'Desativar' : 'Reativar'}</button>
                </li>
              ))}
              {a.itens.length === 0 && <li className="py-2 text-[0.8125rem] text-fg-3">Nenhum item ainda.</li>}
            </ul>
          </li>
        ))}
      </ul>
      {uid && ambs.length === 0 && <p className="text-sm text-fg-3">Este chalé ainda não tem ambientes. Comece por “Novo ambiente”.</p>}
    </GestaoShell>
  );
}
