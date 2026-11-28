// Fotos de evidência guardadas no aparelho (IndexedDB via Dexie) até o envio (lib/fila.ts sobe ao Storage e apaga).
import type { Table } from 'dexie';
// Dexie é carregado só quando uma foto é lida ou gravada (fica fora do primeiro carregamento do app)
export type Foto = {
  id: string;
  rascunhoId: string;
  itemId: string;
  blob: Blob;
  em: string;
  lat?: number;
  lng?: number;
  precisaoM?: number;
  foraDoRaio?: boolean;
};

let banco: Promise<{ fotos: Table<Foto, string> }> | null = null;
function db() {
  banco ??= import('dexie').then(({ default: Dexie }) => {
    class Banco extends Dexie {
      fotos!: Table<Foto, string>;
      constructor() {
        super('solar-inspect');
        this.version(1).stores({ fotos: '&id, rascunhoId, [rascunhoId+itemId]' });
      }
    }
    return new Banco();
  });
  return banco;
}

export const salvarFoto = async (f: Foto) => (await db()).fotos.put(f);
export const removerFoto = async (id: string) => (await db()).fotos.delete(id);
export const listarFotos = async (rascunhoId: string, itemId: string) =>
  (await db()).fotos.where('[rascunhoId+itemId]').equals([rascunhoId, itemId]).sortBy('em');

export async function contarFotosPorItem(rascunhoId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await (await db()).fotos.where('rascunhoId').equals(rascunhoId).each((f) => { out[f.itemId] = (out[f.itemId] ?? 0) + 1; });
  return out;
}

export const listarFotosDaVistoria = async (rascunhoId: string) => (await db()).fotos.where('rascunhoId').equals(rascunhoId).sortBy('em');
export const removerFotosDaVistoria = async (rascunhoId: string) => (await db()).fotos.where('rascunhoId').equals(rascunhoId).delete();
