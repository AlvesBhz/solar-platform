// MOCKUP do checklist (ambientes → itens). Na versão real vem de ambientes/itens/tipo_vistoria_itens.
import type { Unidade } from './unidades';

export type Item = { id: string; nome: string; critico?: boolean; foto?: boolean };
export type Ambiente = { id: string; nome: string; icon: string; itens: Item[] };

const QUARTO: Ambiente = {
  id: 'quarto', nome: 'Quarto', icon: 'solar:bed-linear', itens: [
    { id: 'cama', nome: 'Cama arrumada e roupa de cama', critico: true, foto: true },
    { id: 'ar', nome: 'Ar-condicionado (quente e frio)', critico: true },
    { id: 'blackout', nome: 'Cortinas e blackout' },
    { id: 'cofre', nome: 'Cofre funcionando' },
    { id: 'cabides', nome: 'Roupões e cabides', foto: true },
  ],
};
const BANHEIRO: Ambiente = {
  id: 'banheiro', nome: 'Banheiro', icon: 'solar:bath-linear', itens: [
    { id: 'ducha', nome: 'Ducha com pressão e água quente', critico: true },
    { id: 'box', nome: 'Limpeza do box e louças', critico: true, foto: true },
    { id: 'toalhas', nome: 'Toalhas de banho e rosto', foto: true },
    { id: 'amenities', nome: 'Amenities repostos' },
  ],
};
const SALA: Ambiente = {
  id: 'sala', nome: 'Sala', icon: 'solar:sofa-linear', itens: [
    { id: 'sofa', nome: 'Sofá e almofadas' },
    { id: 'tv', nome: 'TV, controle e streaming' },
    { id: 'frigobar', nome: 'Frigobar abastecido', foto: true },
  ],
};
const COZINHA: Ambiente = {
  id: 'cozinha', nome: 'Copa', icon: 'solar:cup-hot-linear', itens: [
    { id: 'cafeteira', nome: 'Cafeteira e cápsulas' },
    { id: 'tacas', nome: 'Taças e utensílios', foto: true },
  ],
};
const VARANDA: Ambiente = {
  id: 'varanda', nome: 'Varanda', icon: 'solar:home-2-linear', itens: [
    { id: 'mobiliario', nome: 'Mobiliário externo' },
    { id: 'limpeza-varanda', nome: 'Limpeza do piso e guarda-corpo' },
  ],
};

/** Ordem física do percurso. */
export function checklistDa(u: Unidade): Ambiente[] {
  if (u.tipo === 'Chalé') return u.ambientes >= 5 ? [VARANDA, SALA, COZINHA, QUARTO, BANHEIRO] : [VARANDA, SALA, QUARTO, BANHEIRO];
  if (u.tipo === 'Suíte') return [SALA, QUARTO, BANHEIRO];
  return [QUARTO, BANHEIRO];
}

/** Respostas sem divergência. As demais exigem foto e observação (T11). */
export const RESPOSTAS_OK = ['OK', 'Igual', 'N/A'];
