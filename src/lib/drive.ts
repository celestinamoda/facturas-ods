// src/lib/drive.ts
// Abrir y guardar el registro en Google Drive desde el navegador, sin servidor: Google Identity Services
// da un token de acceso (ventana de Google) y con él se llama a la API de Drive con fetch.
//
// En Drive todo va en la carpeta «Celestina»: los registros y la subcarpeta «Copias de seguridad».
//
// Permiso `drive.file`: la web solo ve los archivos que ella misma ha creado (o abierto) en el Drive del
// usuario, no el resto. Por eso un registro se sube primero desde la web («Subir este registro a Drive») y
// luego aparece en «Abrir un registro de Drive» en cualquier dispositivo con la misma cuenta.
//
// En Drive el registro es una Hoja de cálculo de Google (lo pidió el usuario), no un .ods: se sube un .ods y
// Google lo convierte; para leerla se exporta a .ods, y para guardar se vuelve a subir un .ods encima, que
// Google convierte otra vez. Así el resto de la web sigue trabajando solo con .ods. Las copias de seguridad,
// en cambio, se quedan en .ods (para poder recuperarlas en LibreOffice).
//
// El identificador de cliente de Google llega al compilar (PUBLIC_GOOGLE_CLIENT_ID); sin él no hay Drive.

const CLIENT_ID: string = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID ?? '';
export const hayDrive = CLIENT_ID !== '';

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const API = 'https://www.googleapis.com/drive/v3';
const SUBIDA = 'https://www.googleapis.com/upload/drive/v3';
const GIS = 'https://accounts.google.com/gsi/client';
const ODS = 'application/vnd.oasis.opendocument.spreadsheet';
const CARPETA = 'application/vnd.google-apps.folder';
const HOJA = 'application/vnd.google-apps.spreadsheet';
// todo va en la carpeta «Celestina»: los registros sueltos y, dentro, «Copias de seguridad»
const CARPETA_APP = 'Celestina';
const CARPETA_COPIAS = 'Copias de seguridad';
const CAMPOS = 'id,name,mimeType,modifiedTime,webViewLink,parents,trashed';
// el token se guarda en la pestaña para no volver a pedirlo al recargar (dura una hora)
const CLAVE_TOKEN = 'facturas-ods-drive-token';

export interface DriveArchivo {
  id: string;
  nombre: string;
  /** modifiedTime de Drive: si al guardar es otro, alguien lo cambió mientras tanto */
  modificado: string;
  /** Hoja de cálculo de Google (si no, un .ods tal cual: las copias de seguridad) */
  hoja: boolean;
  /** dirección del archivo en Google Drive (en una Hoja, se abre en Hojas de cálculo) */
  enlace: string;
}

interface RespuestaToken { access_token?: string; expires_in?: number; error?: string }
interface ClienteToken { callback: (r: RespuestaToken) => void; requestAccessToken(o?: { prompt?: string }): void }
type ConGoogle = Window & {
  google?: { accounts: { oauth2: {
    initTokenClient(o: { client_id: string; scope: string; callback: (r: RespuestaToken) => void; error_callback?: (e: { type: string }) => void }): ClienteToken;
    revoke(token: string, hecho?: () => void): void;
  } } };
};

let token: { valor: string; caduca: number } | null = leerToken();
let cliente: ClienteToken | null = null;
let carga: Promise<void> | null = null;
let pendiente: { ok(t: string): void; mal(e: Error): void } | null = null;

function leerToken(): { valor: string; caduca: number } | null {
  try {
    const t = JSON.parse(sessionStorage.getItem(CLAVE_TOKEN) ?? 'null');
    return t && t.caduca > Date.now() ? t : null;
  } catch { return null; }
}

/** Carga la librería de Google. Conviene llamarla al arrancar: el token hay que pedirlo dentro del clic. */
export function prepararDrive(): Promise<void> {
  if (!hayDrive) return Promise.resolve();
  carga ??= new Promise<void>((ok, mal) => {
    const s = document.createElement('script');
    s.src = GIS;
    s.async = true;
    s.onload = () => {
      cliente = (window as ConGoogle).google!.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {},
        error_callback: e => {
          pendiente?.mal(new Error(e.type === 'popup_failed_to_open'
            ? 'El navegador ha bloqueado la ventana de Google. Vuelve a pulsar el botón.'
            : 'No se ha podido entrar en Google.'));
          pendiente = null;
        },
      });
      cliente.callback = r => {
        if (r.access_token) {
          token = { valor: r.access_token, caduca: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 };
          try { sessionStorage.setItem(CLAVE_TOKEN, JSON.stringify(token)); } catch { /* sin almacenamiento */ }
          pendiente?.ok(token.valor);
        } else {
          pendiente?.mal(new Error('Google no ha dado permiso para usar Drive.'));
        }
        pendiente = null;
      };
      ok();
    };
    s.onerror = () => { carga = null; mal(new Error('No se ha podido cargar Google (¿sin conexión?).')); };
    document.head.appendChild(s);
  });
  return carga;
}

export const conectadoDrive = (): boolean => !!token && token.caduca > Date.now();

/**
 * Token para la API. Si no hay uno válido abre la ventana de Google, y eso el navegador solo lo deja
 * hacer dentro de un clic: hay que llamarla lo primero en el manejador, antes de cualquier `await`.
 */
export function accesoDrive(): Promise<string> {
  if (conectadoDrive()) return Promise.resolve(token!.valor);
  if (!cliente) return prepararDrive().then(() => accesoDrive());
  return new Promise((ok, mal) => {
    pendiente = { ok, mal };
    cliente!.requestAccessToken();
  });
}

/** Cierra la sesión de Google en esta web. */
export function desconectarDrive(): void {
  if (token) (window as ConGoogle).google?.accounts.oauth2.revoke(token.valor);
  token = null;
  try { sessionStorage.removeItem(CLAVE_TOKEN); } catch { /* sin almacenamiento */ }
}

/** El archivo ya no está en Drive: se borró del todo o está en la papelera (donde Drive aún dejaría guardar). */
export class NoEstaEnDrive extends Error {
  constructor() { super('Ya no está en Google Drive: se ha borrado o está en la papelera.'); }
}

async function pedir(url: string, init: RequestInit = {}): Promise<Response> {
  if (!conectadoDrive()) throw new Error('La sesión de Google ha caducado: vuelve a pulsar el botón.');
  const r = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token!.valor}` } });
  if (r.status === 401) {
    token = null;
    throw new Error('La sesión de Google ha caducado: vuelve a pulsar el botón.');
  }
  if (!r.ok) {
    const detalle = await r.json().then(j => j?.error?.message, () => '');
    if (r.status === 404) throw new NoEstaEnDrive();
    throw new Error(`Google Drive: ${detalle || r.status}`);
  }
  return r;
}

type Fichero = { id: string; name: string; mimeType?: string; modifiedTime: string; webViewLink?: string; parents?: string[]; trashed?: boolean };
const aArchivo = (f: Fichero): DriveArchivo => ({
  id: f.id, nombre: f.name, modificado: f.modifiedTime, hoja: f.mimeType === HOJA,
  enlace: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
});
const q = (s: string) => encodeURIComponent(s);
const comillas = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
// las copias se reconocen por la carpeta o, si alguien las movió, por el nombre que les pone la web
const NOMBRE_COPIA = /\(copia \d{4}-\d{2}-\d{2}\)\.ods$/i;

export interface CarpetaDrive {
  id: string;
  /** dirección de la carpeta en Google Drive */
  enlace: string;
}

/**
 * Lo que la web puede ver (lo que ha subido ella), lo más reciente primero: la carpeta «Celestina», los
 * registros (Hojas de Google, o .ods sueltos) y, aparte, las copias de seguridad.
 */
export async function listarDrive(): Promise<{ carpeta: CarpetaDrive | null; registros: DriveArchivo[]; copias: DriveArchivo[] }> {
  const carpeta = await buscarCarpeta(CARPETA_APP);
  const copiasId = carpeta ? (await buscarCarpeta(CARPETA_COPIAS, carpeta.id))?.id : undefined;
  const r = await pedir(`${API}/files?q=${q(`(mimeType='${HOJA}' or mimeType='${ODS}') and trashed=false`)}&orderBy=modifiedTime desc&pageSize=200&fields=${q(`files(${CAMPOS})`)}`);
  const todos: Fichero[] = (await r.json()).files ?? [];
  const esCopia = (f: Fichero) => (!!copiasId && !!f.parents?.includes(copiasId)) || (f.mimeType === ODS && NOMBRE_COPIA.test(f.name));
  return { carpeta, registros: todos.filter(f => !esCopia(f)).map(aArchivo), copias: todos.filter(esCopia).map(aArchivo) };
}

/** Datos del archivo; si está en la papelera, como si no estuviera (NoEstaEnDrive). */
export async function datosDrive(id: string): Promise<DriveArchivo> {
  const f: Fichero = await (await pedir(`${API}/files/${id}?fields=${CAMPOS}`)).json();
  if (f.trashed) throw new NoEstaEnDrive();
  return aArchivo(f);
}

/** La carpeta «Celestina»; si no está (la primera vez, o porque se borró), se crea. */
export const carpetaApp = (): Promise<CarpetaDrive> => carpeta(CARPETA_APP);

/** Baja el registro como .ods: la Hoja de Google se exporta; un .ods se baja tal cual. */
export async function bajarDrive(id: string): Promise<{ archivo: DriveArchivo; bytes: ArrayBuffer }> {
  const archivo = await datosDrive(id);
  const url = archivo.hoja ? `${API}/files/${id}/export?mimeType=${q(ODS)}` : `${API}/files/${id}?alt=media`;
  const bytes = await (await pedir(url)).arrayBuffer();
  return { archivo, bytes };
}

/** Sube un .ods nuevo a `carpeta`. Con `hoja`, Google lo convierte en una Hoja de cálculo (y el nombre va sin «.ods»). */
async function subir(nombre: string, bytes: Uint8Array, carpeta: string, hoja: boolean): Promise<DriveArchivo> {
  const limite = `celestina${Math.random().toString(36).slice(2)}`;
  const datos = { name: hoja ? nombre.replace(/\.ods$/i, '') : nombre, mimeType: hoja ? HOJA : ODS, parents: [carpeta] };
  const cuerpo = new Blob([
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(datos)}\r\n`,
    `--${limite}\r\nContent-Type: ${ODS}\r\n\r\n`, bytes as Uint8Array<ArrayBuffer>, `\r\n--${limite}--`,
  ]);
  const r = await pedir(`${SUBIDA}/files?uploadType=multipart&fields=${CAMPOS}`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo,
  });
  return aArchivo(await r.json());
}

/** Sube el registro a la carpeta «Celestina», convertido en Hoja de cálculo de Google. */
export async function subirRegistro(nombre: string, bytes: Uint8Array): Promise<DriveArchivo> {
  return subir(nombre, bytes, (await carpeta(CARPETA_APP)).id, true);
}

/** Sube una copia de seguridad (.ods tal cual) a «Celestina › Copias de seguridad». */
export async function subirCopia(nombre: string, bytes: Uint8Array): Promise<DriveArchivo> {
  const app = await carpeta(CARPETA_APP);
  return subir(nombre, bytes, (await carpeta(CARPETA_COPIAS, app.id)).id, false);
}

/** Guarda un .ods encima de un archivo de Drive; si es una Hoja de Google, Google lo convierte otra vez. */
export async function actualizarDrive(id: string, bytes: Uint8Array): Promise<DriveArchivo> {
  const r = await pedir(`${SUBIDA}/files/${id}?uploadType=media&fields=${CAMPOS}`, {
    method: 'PATCH', headers: { 'Content-Type': ODS }, body: bytes as Uint8Array<ArrayBuffer>,
  });
  return aArchivo(await r.json());
}

async function buscarCarpeta(nombre: string, padre?: string): Promise<CarpetaDrive | null> {
  const filtro = `mimeType='${CARPETA}' and name='${comillas(nombre)}' and trashed=false${padre ? ` and '${padre}' in parents` : ''}`;
  const f = (await (await pedir(`${API}/files?q=${q(filtro)}&fields=${q('files(id,webViewLink)')}`)).json()).files?.[0];
  return f ? { id: f.id, enlace: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}` } : null;
}

/** La carpeta (dentro de `padre`, o en la raíz); se crea la primera vez. */
async function carpeta(nombre: string, padre?: string): Promise<CarpetaDrive> {
  const hay = await buscarCarpeta(nombre, padre);
  if (hay) return hay;
  const nueva = await pedir(`${API}/files?fields=${q('id,webViewLink')}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: nombre, mimeType: CARPETA, ...(padre ? { parents: [padre] } : {}) }),
  });
  const f = await nueva.json();
  return { id: f.id, enlace: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}` };
}

export { CARPETA_APP, CARPETA_COPIAS };
