import { useCallback, useEffect, useState } from 'react';
import { type Ambiente, type Item } from '../mocks/checklist';
import { listarFotos, removerFoto, type Foto } from '../mocks/fotos';
import { carregarChecklist, fotosDaEntrada, itemDe, obterUnidade, tipoDoRascunho, type Gravidade, type TipoVistoria, type Unidade } from './campo';
import { lerRascunho, salvarRascunho, type Rascunho } from '../mocks/vistoria';

/** Contexto comum de T11/T13: unidade, tipo, rascunho, item, fotos e gravação incremental. */
export function useItem(unidadeId: string, itemId: string) {
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [tipo, setTipo] = useState<TipoVistoria | null>(null);
  const [rasc, setRasc] = useState<Rascunho | null>(() => lerRascunho(unidadeId));
  const [fotos, setFotos] = useState<Foto[]>([]);

  const [ambs, setAmbs] = useState<Ambiente[] | null>(null);
  const [entrada, setEntrada] = useState<string[]>([]);   // fotos do item na Entrada vinculada (T13)
  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    tipoDoRascunho(rasc).then(setTipo);
  }, [unidadeId, rasc?.tipoId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (u) carregarChecklist(u, lerRascunho(unidadeId)).then(setAmbs).catch(() => setAmbs([])); }, [u, unidadeId]);
  useEffect(() => { if (rasc?.id) fotosDaEntrada(rasc.id, itemId).then(setEntrada); }, [rasc?.id, itemId]);

  const recarregarFotos = useCallback(() => { if (rasc) listarFotos(rasc.id, itemId).then(setFotos); }, [rasc?.id, itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(recarregarFotos, [recarregarFotos]);

  const ctx: { item: Item; ambiente: Ambiente } | undefined = itemDe(ambs ?? [], itemId);

  // Grava direto no armazenamento (fonte da verdade) para não perder nada se a tela trocar em seguida.
  const gravar = (f: (r: Rascunho) => Partial<Rascunho>) => { const r = lerRascunho(unidadeId)!; setRasc(salvarRascunho({ ...r, ...f(r) })); };
  const responder = (valor: string) => gravar((r) => ({ respostas: { ...r.respostas, [itemId]: valor } }));
  const contar = (n: number | undefined) => gravar((r) => { const q = { ...(r.qtd ?? {}) }; if (n === undefined) delete q[itemId]; else q[itemId] = n; return { qtd: q }; });
  const observar = (texto: string) => gravar((r) => ({ obs: { ...(r.obs ?? {}), [itemId]: texto } }));
  // item crítico é sempre CRITICA (regra do banco); nos demais vale a escolha do vistoriador
  const gravidade: Gravidade = ctx?.item.critico ? 'critica' : rasc?.ocorrencias?.[itemId]?.gravidade ?? 'media';
  const definirGravidade = (g: Gravidade) =>
    gravar((r) => ({ ocorrencias: { ...(r.ocorrencias ?? {}), [itemId]: { gravidade: g, descricao: r.ocorrencias?.[itemId]?.descricao ?? '' } } }));
  const remover = async (id: string) => { await removerFoto(id); recarregarFotos(); };

  return {
    u, tipo, rasc, fotos, ctx, entrada, carregado: ambs !== null,
    resposta: rasc?.respostas[itemId],
    obs: rasc?.obs?.[itemId] ?? '',
    responder, observar, remover, gravidade, definirGravidade, contar, qtd: rasc?.qtd?.[itemId],
  };
}
