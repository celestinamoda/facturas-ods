// src/lib/archivo.ts
// Abrir/guardar en disco. En Chrome/Edge se usa File System Access y se guarda encima del mismo archivo;
// en el resto, se descarga una copia.

interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<PermissionState>;
}
type PickerWindow = Window & {
  showOpenFilePicker?: (o: object) => Promise<FileHandle[]>;
  showSaveFilePicker?: (o: object) => Promise<FileHandle>;
};

export interface Archivo {
  nombre: string;
  bytes: ArrayBuffer;
  handle: FileHandle | null;
}

const MIME = 'application/vnd.oasis.opendocument.spreadsheet';
const TIPOS = [{ description: 'Hoja de cálculo ODS', accept: { [MIME]: ['.ods'] } }];

export const puedeGuardarEncima = (): boolean => typeof (window as PickerWindow).showOpenFilePicker === 'function';

export async function elegirArchivo(): Promise<Archivo | null> {
  const w = window as PickerWindow;
  if (w.showOpenFilePicker) {
    try {
      const [handle] = await w.showOpenFilePicker({ types: TIPOS, multiple: false });
      const file = await handle.getFile();
      return { nombre: file.name, bytes: await file.arrayBuffer(), handle };
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return null;
      throw e;
    }
  }
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.ods,' + MIME;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await desdeFile(file) : null);
    };
    input.click();
  });
}

export async function desdeFile(file: File): Promise<Archivo> {
  return { nombre: file.name, bytes: await file.arrayBuffer(), handle: null };
}

/**
 * Vuelve a leer del disco un archivo elegido en otra visita. Devuelve null si falta el permiso.
 * `pedir` solo puede ser true dentro de un clic: el navegador no deja pedir permiso sin él.
 */
export async function reabrir(handle: FileHandle, pedir: boolean): Promise<Archivo | null> {
  const modo = { mode: 'readwrite' as const };
  let permiso = (await handle.queryPermission?.(modo)) ?? 'granted';
  if (permiso !== 'granted' && pedir) permiso = (await handle.requestPermission?.(modo)) ?? 'denied';
  if (permiso !== 'granted') return null;
  const file = await handle.getFile();
  return { nombre: file.name, bytes: await file.arrayBuffer(), handle };
}

export async function escribir(handle: FileHandle, bytes: Uint8Array): Promise<void> {
  const w = await handle.createWritable();
  await w.write(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: MIME }));
  await w.close();
}

export function descargar(nombre: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: MIME }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre.endsWith('.ods') ? nombre : `${nombre}.ods`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Pide dónde guardar (Chrome/Edge). Devuelve null si el navegador no lo permite o se cancela. */
export async function guardarComo(nombre: string, bytes: Uint8Array): Promise<FileHandle | null> {
  const w = window as PickerWindow;
  if (!w.showSaveFilePicker) return null;
  try {
    const handle = await w.showSaveFilePicker({ suggestedName: nombre, types: TIPOS });
    await escribir(handle, bytes);
    return handle;
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') return null;
    throw e;
  }
}

export type { FileHandle };
