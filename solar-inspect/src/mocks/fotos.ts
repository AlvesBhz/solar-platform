// Fotos de evidência guardadas no aparelho (IndexedDB via Dexie) até o envio (lib/fila.ts sobe ao Storage e apaga).
import Dexie, { type Table } from 'dexie';

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

class Banco extends Dexie {
  fotos!: Table<Foto, string>;
  constructor() {
    super('solar-inspect');
    this.version(1).stores({ fotos: '&id, rascunhoId, [rascunhoId+itemId]' });
  }
}
const db = new Banco();

export const salvarFoto = (f: Foto) => db.fotos.put(f);
export const removerFoto = (id: string) => db.fotos.delete(id);
export const listarFotos = (rascunhoId: string, itemId: string) =>
  db.fotos.where('[rascunhoId+itemId]').equals([rascunhoId, itemId]).sortBy('em');

export async function contarFotosPorItem(rascunhoId: string): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await db.fotos.where('rascunhoId').equals(rascunhoId).each((f) => { out[f.itemId] = (out[f.itemId] ?? 0) + 1; });
  return out;
}

export const listarFotosDaVistoria = (rascunhoId: string) => db.fotos.where('rascunhoId').equals(rascunhoId).sortBy('em');
export const removerFotosDaVistoria = (rascunhoId: string) => db.fotos.where('rascunhoId').equals(rascunhoId).delete();
