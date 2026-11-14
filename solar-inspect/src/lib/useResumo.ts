import { useEffect, useState } from 'react';
import { checklistDa, type Ambiente, type Item } from '../mocks/checklist';
import { DURACAO_MINIMA_MIN } from '../mocks/envios';
import { contarFotosPorItem } from '../mocks/fotos';
import { listarTiposAtivos, obterUnidade, type Gravidade, type TipoVistoria, type Unidade } from '../mocks/unidades';
import { lerRascunho, type Rascunho } from '../mocks/vistoria';
import { divergente, itemCompleto } from './evidencia';

export type OcorrenciaPrevista = { item: Item; ambiente: Ambiente; gravidade: Gravidade; descricao: string };

/** Consolida o rascunho: pendências, divergências, ocorrências previstas, duração e sinalizações. */
export function useResumo(unidadeId: string) {
  const [u, setU] = useState<Unidade | null | undefined>(null);
  const [tipo, setTipo] = useState<TipoVistoria | null>(null);
  const [rasc] = useState<Rascunho | null>(() => lerRascunho(unidadeId));
  const [nFotos, setNFotos] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    obterUnidade(unidadeId).then(setU);
    listarTiposAtivos().then((ts) => setTipo(ts.find((t) => t.id === rasc?.tipoId) ?? null));
    if (rasc) contarFotosPorItem(rasc.id).then(setNFotos);
  }, [unidadeId, rasc]);

  const pronto = !!u && !!tipo && !!rasc && !!nFotos;
  const ambientes = u ? checklistDa(u) : [];
  const itens = ambientes.flatMap((ambiente) => ambiente.itens.map((item) => ({ item, ambiente })));
  const resp = (id: string) => rasc?.respostas[id];
  const pendentes = itens.filter(({ item }) => !itemCompleto(item, resp(item.id), rasc?.obs?.[item.id], nFotos?.[item.id] ?? 0));
  const ocorrencias: OcorrenciaPrevista[] = itens
    .filter(({ item }) => divergente(resp(item.id)))
    .map(({ item, ambiente }) => {
      const o = rasc?.ocorrencias?.[item.id];
      return { item, ambiente, gravidade: o?.gravidade ?? (item.critico ? 'critica' : 'media'), descricao: o?.descricao ?? rasc?.obs?.[item.id] ?? '' };
    });
  const totalFotos = Object.values(nFotos ?? {}).reduce((a, b) => a + b, 0);
  const minutos = rasc?.inicio ? Math.max(0, Math.round((Date.now() - new Date(rasc.inicio).getTime()) / 60000)) : 0;
  const sinalizacoes = [
    ...(minutos < DURACAO_MINIMA_MIN ? [`Duração abaixo de ${DURACAO_MINIMA_MIN} min`] : []),
  ];

  return { u, tipo, rasc, pronto, itens, pendentes, ocorrencias, totalFotos, minutos, sinalizacoes };
}
