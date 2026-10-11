// src/lib/recuerdo.ts
// Recuerda el último archivo abierto para reabrirlo al volver a la web. Va en IndexedDB y no en
// localStorage porque hay que guardar el acceso al archivo del disco (o sus bytes), no solo texto.
import type { FileHandle } from './archivo.ts';

export interface Recuerdo {
  nombre: string;
  /** Chrome/Edge: acceso al archivo del disco; al volver se relee de ahí. */
  handle: FileHandle | null;
  /** Sin acceso al disco: copia del archivo tal como se abrió o se guardó por última vez. */
  bytes: ArrayBuffer | null;
  /** En Google Drive: se vuelve a bajar de allí (hace falta entrar en Google, así que con un clic). */
  drive?: string | null;
  fecha: number;
}

// en GitHub Pages el origen se comparte con las demás webs de la cuenta: el nombre debe ser propio de esta
const DB = 'facturas-ods';
const STORE = 'recuerdo';
const KEY = 'ultimo';

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => { db.close(); resolve(req.result); };
      t.onerror = t.onabort = () => { db.close(); reject(t.error); };
    };
  });
}

// Si IndexedDB no está disponible (navegación privada, almacenamiento bloqueado) la web funciona
// igual, solo que sin recordar: por eso los fallos se tragan.
export const recordar = (r: Omit<Recuerdo, 'fecha'>): Promise<void> =>
  tx('readwrite', s => s.put({ ...r, fecha: Date.now() }, KEY)).then(() => {}, () => {});

export const olvidar = (): Promise<void> =>
  tx('readwrite', s => s.delete(KEY)).then(() => {}, () => {});

export const recuperar = (): Promise<Recuerdo | null> =>
  tx<Recuerdo | undefined>('readonly', s => s.get(KEY)).then(r => r ?? null, () => null);
