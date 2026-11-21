import { Icon } from '@iconify/react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Seletor } from '../components/Filtros';
import GestaoShell, { card } from '../components/GestaoShell';
import { btnPrimary, btnSecondary } from '../components/ScreenShell';
import { definirTiposDoItem, incluirItensNosTipos, listarAmbientes, listarTipos, listarUnidadesPresenca, salvarAmbiente, salvarItem, tiposDosItens, trocarOrdem, type Ambiente, type Item, type Resultado, type Tipo, type UnidadePresenca } from '../lib/admin';
import { usePerfilPermitido } from '../lib/useAdmin';

const campo = 'min-h-11 w-full rounded-md border border-line-2 bg-white px-3 text-[0.875rem] text-fg-1 focus:border-pine focus:outline-none';
const rot = 'flex flex-col gap-1.5 text-[0.75rem] uppercase tracking-[0.06em] text-fg-2';
/** Ícone do cômodo, pelo mapa do design system (o mesmo do app de campo). */
function iconeAmbiente(nome: string) {
  const n = nome.toLowerCase();
  if (/quarto|cama|su[ií]te/.test(n) && !/banh/.test(n)) return 'solar:bed-linear';
  if (/banh|lavabo|box/.test(n)) return 'solar:bath-linear';
  if (/sala|estar/.test(n)) return 'solar:sofa-linear';
  if (/copa|cozinha|caf[eé]/.test(n)) return 'solar:cup-hot-linear';
  return 'solar:home-2-linear';
}
/** Ação só de ícone: 44 px de toque, dica ao passar o mouse e nome para leitor de tela. */
function BotaoIcone({ icone, rotulo, onClick, disabled, pequeno }: { icone: string; rotulo: string; onClick: () => void; disabled?: boolean; pequeno?: boolean }) {
  return (
    <button type="button" aria-label={rotulo} title={rotulo} disabled={disabled} onClick={onClick}
      className={`flex ${pequeno ? 'h-8 w-11' : 'h-11 w-11'} items-center justify-center rounded-md text-fg-2 transition-colors duration-fast hover:bg-white hover:text-pine disabled:opacity-25 disabled:hover:bg-transparent`}>
      <Icon icon={icone} width={pequeno ? 16 : 18} aria-hidden="true" />
    </button>
  );
}
/** Etiqueta de característica: ícone + texto (nunca só cor). */
const Etiqueta = ({ icone, texto, tom = 'text-fg-2' }: { icone: string; texto: string; tom?: string }) => (
  <span className={`inline-flex items-center gap-1 rounded-full border border-line-2 bg-white px-2 py-0.5 text-[0.6875rem] ${tom}`}><Icon icon={icone} width={12} aria-hidden="true" />{texto}</span>
);
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
  const formRef = useRef<HTMLFormElement>(null);
  // formulário aberto: rola até ele (fica junto do que está sendo editado) e foca o primeiro campo
  useEffect(() => { const f = formRef.current; if (!f) return; f.scrollIntoView({ block: 'center', behavior: 'smooth' }); f.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); }, [fi?.id, fi?.idAmbiente, fa?.id, !!fi, !!fa]); // eslint-disable-line react-hooks/exhaustive-deps
  // aviso de sucesso some sozinho
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso(''), 4500); return () => clearTimeout(t); }, [aviso]);
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

  const abrirAmbiente = (a: Ambiente) => { setErro(''); setFi(null); setFa({ id: a.id, nome: a.nome, ordem: a.ordem, ativo: a.ativo }); };
  const abrirNovoItem = (a: Ambiente) => { setErro(''); setFa(null); setFi({ id: null, idAmbiente: a.id, nome: '', orientacao: '', critico: false, foto: false, qtde: '', ordem: proxOrdem(a.itens), ativo: true, tipos: tipos.map((t) => t.id) }); };
  const erroNoForm = erro && <p role="alert" className="rounded-md border border-error bg-white p-3 text-sm text-error sm:col-span-2">{erro}</p>;
  const formAmbiente = () => fa && (
    <form ref={formRef} onSubmit={enviarAmbiente} className={`${card} flex max-w-xl flex-col gap-3 border-pine p-4`} aria-label="Ambiente">
      <p className="text-[0.8125rem] font-medium text-pine">{fa.id ? `Renomeando: ${ambs.find((x) => x.id === fa.id)?.nome ?? ''}` : 'Novo ambiente'}</p>
      {erroNoForm}
      <label className={rot}>Nome do ambiente<input id="a-nome" className={campo} maxLength={80} value={fa.nome} onChange={(e) => setFa({ ...fa, nome: e.target.value })} placeholder="Ex.: Banheiro" /></label>
      <div className="flex flex-wrap gap-2"><button type="submit" className={`${btnPrimary} w-auto`}>Salvar</button><button type="button" className={`${btnSecondary} w-auto`} onClick={() => { setFa(null); setErro(''); }}>Cancelar</button></div>
    </form>
  );
  const formItem = (titulo: string) => fi && (
    <form ref={formRef} onSubmit={enviarItem} className="grid grid-cols-[minmax(0,1fr)] gap-3 rounded-lg border border-pine bg-white p-3 sm:grid-cols-2" aria-label="Item">
      <p className="text-[0.8125rem] font-medium text-pine sm:col-span-2">{titulo}</p>
      {erroNoForm}
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
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className={`${btnPrimary} w-auto`}>Salvar item</button><button type="button" className={`${btnSecondary} w-auto`} onClick={() => { setFi(null); setErro(''); }}>Cancelar</button></div>
    </form>
  );

  return (
    <GestaoShell eyebrow="Administração" titulo="Ambientes e itens"
      acoes={uid ? <button type="button" className={`${btnPrimary} w-auto`} onClick={() => { setErro(''); setFi(null); setFa({ id: null, nome: '', ordem: proxOrdem(ambs), ativo: true }); }}><Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Novo ambiente</button> : undefined}>
      <div className="max-w-sm"><Seletor rotulo="Chalé" valor={uid} onChange={setUid} opcoes={us.map((u) => ({ valor: String(u.id), label: `${u.nome} · ${u.pousada}` }))} /></div>
      {erro && !fi && !fa && <p role="alert" className="rounded-md border border-error bg-white p-3 text-sm text-error">{erro}</p>}
      {/* aviso de sucesso: fixo no rodapé, sempre à vista, some sozinho */}
      {aviso && (
        <p role="status" data-aviso className="pointer-events-none fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[min(92vw,28rem)] -translate-x-1/2 items-center gap-2 rounded-lg bg-pine-deep px-4 py-3 text-[0.8125rem] text-white shadow-lg">
          <Icon icon="solar:check-circle-linear" width={18} className="shrink-0" aria-hidden="true" />{aviso}
        </p>
      )}

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

      {fa && fa.id === null && formAmbiente()}

      <ul className="flex flex-col gap-4">
        {ambs.map((a, ai) => {
          const ativosA = a.itens.filter((i) => i.ativo);
          const criticos = ativosA.filter((i) => i.critico).length;
          return (
            <li key={a.id} className={`${card} overflow-hidden ${a.ativo ? '' : 'opacity-60'}`} data-ambiente={a.nome}>
              {/* cabeçalho do ambiente */}
              <div className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cream text-pine"><Icon icon={iconeAmbiente(a.nome)} width={22} aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.9375rem] font-medium text-fg-1">{a.nome}</p>
                  <p className="text-[0.75rem] text-fg-3">
                    {a.ativo ? `${ativosA.length} ${ativosA.length === 1 ? 'item' : 'itens'}${criticos ? ` · ${criticos} crítico${criticos > 1 ? 's' : ''}` : ''}` : 'Desativado: não aparece nas vistorias'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center">
                  <BotaoIcone icone="solar:pen-linear" rotulo={`Renomear ${a.nome}`} onClick={() => abrirAmbiente(a)} />
                  <BotaoIcone icone="solar:alt-arrow-up-linear" rotulo={`Subir ${a.nome}`} disabled={ai === 0} onClick={() => tratar(trocarOrdem('VST_AMBIENTE', a, ambs[ai - 1]), 'Ordem salva.')} />
                  <BotaoIcone icone="solar:alt-arrow-down-linear" rotulo={`Descer ${a.nome}`} disabled={ai === ambs.length - 1} onClick={() => tratar(trocarOrdem('VST_AMBIENTE', a, ambs[ai + 1]), 'Ordem salva.')} />
                  <BotaoIcone icone={a.ativo ? 'solar:eye-closed-linear' : 'solar:restart-linear'} rotulo={`${a.ativo ? 'Desativar' : 'Reativar'} ${a.nome}`}
                    onClick={() => tratar(salvarAmbiente({ ...a, ativo: !a.ativo }), a.ativo ? 'Ambiente desativado (histórico preservado).' : 'Ambiente reativado.')} />
                </div>
              </div>
              {fa?.id === a.id && <div className="px-4 pb-4">{formAmbiente()}</div>}

              {/* itens do ambiente: bloco recuado, fundo cream */}
              <ul className="mx-4 flex flex-col divide-y divide-line-1 rounded-lg border border-line-1 bg-cream">
                {a.itens.map((i, ii) => (
                  <li key={i.id} data-item={i.nome}>
                    <div className={`flex items-start gap-1 py-2 pl-1 pr-1 ${i.ativo ? '' : 'opacity-60'} ${fi?.id === i.id ? 'bg-white' : ''}`}>
                      <div className="flex shrink-0 flex-col">
                        <BotaoIcone pequeno icone="solar:alt-arrow-up-linear" rotulo={`Subir ${i.nome}`} disabled={ii === 0} onClick={() => tratar(trocarOrdem('VST_ITEM', i, a.itens[ii - 1]), 'Ordem salva.')} />
                        <BotaoIcone pequeno icone="solar:alt-arrow-down-linear" rotulo={`Descer ${i.nome}`} disabled={ii === a.itens.length - 1} onClick={() => tratar(trocarOrdem('VST_ITEM', i, a.itens[ii + 1]), 'Ordem salva.')} />
                      </div>
                      <button type="button" className="min-w-0 flex-1 py-1.5 text-left" onClick={() => editarItem(i)} aria-label={`Editar ${i.nome}`}>
                        <span className="block text-[0.875rem] font-medium text-fg-1 [overflow-wrap:anywhere]">{i.nome}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {!i.ativo && <Etiqueta icone="solar:eye-closed-linear" texto="Desativado" />}
                          {i.critico && <Etiqueta icone="solar:danger-triangle-linear" texto="Crítico" tom="text-error" />}
                          {i.fotoObrigatoria && <Etiqueta icone="solar:camera-linear" texto="Foto" />}
                          {i.qtdeEsperada !== null && <Etiqueta icone="solar:hashtag-linear" texto={String(i.qtdeEsperada)} />}
                          {(vinc[i.id] ?? []).length === 0 && i.ativo
                            ? <Etiqueta icone="solar:danger-circle-linear" texto="Fora das vistorias" tom="text-warning" />
                            : tipos.filter((t) => (vinc[i.id] ?? []).includes(t.id)).map((t) => <span key={t.id} className="rounded-full border border-line-2 bg-white px-2 py-0.5 text-[0.6875rem] text-fg-2">{t.nome}</span>)}
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center self-center">
                        <BotaoIcone icone="solar:pen-linear" rotulo={`Editar ${i.nome}`} onClick={() => editarItem(i)} />
                        <BotaoIcone icone={i.ativo ? 'solar:eye-closed-linear' : 'solar:restart-linear'} rotulo={`${i.ativo ? 'Desativar' : 'Reativar'} ${i.nome}`}
                          onClick={() => tratar(salvarItem({ ...i, ativo: !i.ativo }), i.ativo ? 'Item desativado (histórico preservado).' : 'Item reativado.')} />
                      </div>
                    </div>
                    {fi?.id === i.id && <div className="bg-white p-3">{formItem(`Editando: ${i.nome} · ${a.nome}`)}</div>}
                  </li>
                ))}
                {a.itens.length === 0 && <li className="px-4 py-3 text-[0.8125rem] text-fg-3">Nenhum item ainda.</li>}
                {fi && fi.id === null && fi.idAmbiente === a.id && <li className="bg-white p-3">{formItem(`Novo item em ${a.nome}`)}</li>}
              </ul>
              <div className="p-4 pt-3">
                <button type="button" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-dashed border-line-2 text-[0.8125rem] font-medium text-pine transition-colors duration-fast hover:border-pine hover:bg-cream"
                  onClick={() => abrirNovoItem(a)}>
                  <Icon icon="solar:add-circle-linear" width={18} aria-hidden="true" />Adicionar item em {a.nome}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {uid && ambs.length === 0 && <p className="text-sm text-fg-3">Este chalé ainda não tem ambientes. Comece por “Novo ambiente”.</p>}
    </GestaoShell>
  );
}
