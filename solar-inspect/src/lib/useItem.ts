import { useCallback, useEffect, useState } from 'react';
import { itemDa, type Ambiente, type Item } from '../mocks/checklist';
import { listarFotos, removerFoto, type Foto } from '../mocks/fotos';
import { listarTiposAtivos, obterUnidade, type TipoVistoria, type Unidade } from '../mocks/unidades';
import { lerRascunho, salvarRascunho, type Rascunho } from '../mocks/vistoria';

/** Contexto comum de T11/T13: unidade, tipo, rascunho, item, fotos e gravação incremental. */
export function useItem(unidadeId: string, itemId: string) {
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [tipo, setTipo] = useState<TipoVistoria | null>(null);
  const [rasc, setRasc] = useState<Rascunho | null>(() => lerRascunho(unidadeId));
  const [fotos, setFotos] = useState<Foto[]>([]);

  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    listarTiposAtivos().then((ts) => setTipo(ts.find((t) => t.id === rasc?.tipoId) ?? null));
  }, [unidadeId, rasc?.tipoId]);

  const recarregarFotos = useCallback(() => { if (rasc) listarFotos(rasc.id, itemId).then(setFotos); }, [rasc?.id, itemId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(recarregarFotos, [recarregarFotos]);

  const ctx: { item: Item; ambiente: Ambiente } | undefined = u ? itemDa(u, itemId) : undefined;

  const responder = (valor: string) => setRasc((r) => salvarRascunho({ ...r!, respostas: { ...r!.respostas, [itemId]: valor } }));
  const observar = (texto: string) => setRasc((r) => salvarRascunho({ ...r!, obs: { ...(r!.obs ?? {}), [itemId]: texto } }));
  const remover = async (id: string) => { await removerFoto(id); recarregarFotos(); };

  return {
    u, tipo, rasc, fotos, ctx,
    resposta: rasc?.respostas[itemId],
    obs: rasc?.obs?.[itemId] ?? '',
    responder, observar, remover,
  };
}
