import { RESPOSTAS_OK, type Item } from '../mocks/checklist';

export const divergente = (r?: string) => !!r && !RESPOSTAS_OK.includes(r);

/** Regras de evidência: problema exige foto (a gravidade já vem preenchida); item com foto obrigatória exige foto. Observação é opcional. */
/** qtd: contagem registrada; item com quantidade esperada exige a contagem (salvo N/A). */
export function requisitos(item: Item, resposta: string | undefined, _obs: string | undefined, nFotos: number, qtd?: number) {
  const div = divergente(resposta);
  const precisaFoto = div || (!!item.foto && resposta !== 'N/A');
  return [
    { id: 'resposta', label: 'Resposta registrada', ok: !!resposta, aplica: true },
    { id: 'qtde', label: `Quantidade conferida (esperado ${item.qtde})`, ok: qtd !== undefined, aplica: item.qtde !== undefined && !!resposta && resposta !== 'N/A' },
    { id: 'foto', label: div ? 'Pelo menos uma foto do problema' : 'Foto obrigatória', ok: nFotos > 0, aplica: !!resposta && precisaFoto },
  ].filter((r) => r.aplica);
}

export const itemCompleto = (item: Item, resposta: string | undefined, obs: string | undefined, nFotos: number, qtd?: number) =>
  requisitos(item, resposta, obs, nFotos, qtd).every((r) => r.ok);
