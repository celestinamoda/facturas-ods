// src/components/PaginaDrive.tsx
// Página «Google Drive» (menú «⋯»): la carpeta «Celestina» con los registros y las copias de seguridad,
// para abrir cualquiera aquí o en Google Drive, y el estado del guardado y las copias automáticas.
import { useEffect, useState } from 'preact/hooks';
import { accesoDrive, carpetaApp, conectadoDrive, listarDrive, type CarpetaDrive, type DriveArchivo } from '../lib/drive.ts';
import { fecha } from '../lib/format.ts';
import { btn, error as errorCls, etiqueta, h2, lista, listaFila, muted, panel, panelHead } from './ui.ts';

interface Props {
  /** el registro abierto, si está en Drive */
  actual: DriveArchivo | null;
  /** fecha de la última copia de seguridad (ISO local) o vacío */
  ultimaCopia: string;
  /** el guardado automático está parado (sesión caducada o cambios de otro dispositivo): ver el aviso de arriba */
  pausado: boolean;
  onAbrir(f: DriveArchivo): void;
  /** crea un registro nuevo (de la plantilla) en Drive y lo abre */
  onCrear(): void;
  /** sube el registro abierto, si no está ya en Drive */
  onSubir?: () => void;
  /** hace una copia de seguridad ahora; la lista se refresca al acabar */
  onCopia(): Promise<void>;
}

type Contenido = { carpeta: CarpetaDrive | null; registros: DriveArchivo[]; copias: DriveArchivo[] };

const cuando = (iso: string): string =>
  new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const aviso = 'rounded-lg bg-field px-3.5 py-3 text-[13px]';

export function PaginaDrive({ actual, ultimaCopia, pausado, onAbrir, onCrear, onSubir, onCopia }: Props) {
  const [contenido, setContenido] = useState<Contenido | null>(null);
  const [cargando, setCargando] = useState(false);
  const [fallo, setFallo] = useState('');
  // sin token de esta pestaña hay que entrar en Google con un clic
  const [entrar, setEntrar] = useState(!conectadoDrive());

  async function cargar(acceso: Promise<unknown> = accesoDrive()) {
    setCargando(true);
    setFallo('');
    try {
      await acceso;
      setEntrar(false);
      const lista = await listarDrive();
      // sin carpeta (la primera vez, o porque se borró): se crea
      setContenido(lista.carpeta ? lista : { ...lista, carpeta: await carpetaApp() });
    } catch (e) {
      setFallo((e as Error).message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => { if (conectadoDrive()) cargar(); }, []);

  const fila = (f: DriveArchivo) => {
    const abierto = actual?.id === f.id;
    return (
      <li key={f.id} class={listaFila}>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold" title={f.nombre}>
            {f.nombre}
            {abierto && <span class="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold">Abierto</span>}
          </p>
          <p class={`${muted} text-xs`}>{f.hoja ? 'Hoja de cálculo de Google' : 'Archivo .ods'} · modificado el {cuando(f.modificado)}</p>
        </div>
        <div class="flex shrink-0 gap-1.5 movil:flex-col">
          {!abierto && <button class={btn('primary', 'small')} onClick={() => onAbrir(f)}>Abrir aquí</button>}
          <a class={`${btn('ghost', 'small')} text-center no-underline`} href={f.enlace} target="_blank" rel="noopener">Abrir en Drive</a>
        </div>
      </li>
    );
  };

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>Google Drive</h2>
          <p class={muted}>La carpeta «Celestina» de tu Drive: tus registros y, dentro, «Copias de seguridad».</p>
        </div>
        <div class="flex flex-wrap gap-2">
          {contenido?.carpeta && (
            <a class={`${btn('ghost')} no-underline`} href={contenido.carpeta.enlace} target="_blank" rel="noopener">Abrir la carpeta en Drive</a>
          )}
          {actual && !entrar && (
            <button class={btn('ghost')} disabled={cargando} onClick={() => { const a = accesoDrive(); cargar(a.then(onCopia)); }}>Hacer una copia ahora</button>
          )}
          {!entrar && <button class={btn('ghost')} disabled={cargando} onClick={() => cargar()}>Actualizar</button>}
        </div>
      </div>

      <div class={`${aviso} mb-5`}>
        {actual ? (
          <>
            <b>{pausado ? 'Guardado automático en pausa' : 'Guardado automático activado'}.</b>{pausado && ' Mira el aviso de arriba; pulsa «Guardar» para seguir.'} Los cambios de «{actual.nombre}» se guardan solos en Drive a los pocos segundos.
            Cada día, al guardar los primeros cambios, se hace una copia de seguridad en «Copias de seguridad».
            {' '}{ultimaCopia ? `Última copia: ${fecha(ultimaCopia.slice(0, 10))}.` : 'Todavía no hay ninguna copia.'}
          </>
        ) : (
          <>El registro abierto no está en Drive. Con «⋯ › Subir este registro a Drive» se sube a esta carpeta y desde entonces se guarda solo.</>
        )}
      </div>

      {entrar ? (
        <div class="py-6 text-center">
          <p class={`${muted} mb-3`}>Entra en Google para ver la carpeta.</p>
          <button class={btn('primary')} disabled={cargando} onClick={() => cargar()}>Entrar en Google</button>
        </div>
      ) : cargando && !contenido ? (
        <p class={`${muted} py-6 text-center`}>Cargando…</p>
      ) : contenido && (
        <>
          <h3 class={`${etiqueta} mb-1.5`}>Registros</h3>
          {contenido.registros.length ? <ul class={`${lista} mb-6`}>{contenido.registros.map(fila)}</ul> : (
            <div class="mb-6">
              <p class={`${muted} mb-3`}>No hay ningún registro en la carpeta.</p>
              <div class="flex flex-wrap gap-2">
                {onSubir && <button class={btn('primary', 'small')} onClick={onSubir}>Subir el registro abierto</button>}
                <button class={btn(onSubir ? 'ghost' : 'primary', 'small')} onClick={onCrear}>Crear un registro nuevo en Drive</button>
              </div>
            </div>
          )}
          <h3 class={`${etiqueta} mb-1.5`}>Copias de seguridad</h3>
          {contenido.copias.length ? (
            <>
              <p class={`${muted} mb-2 text-xs`}>Para recuperar una: «Abrir aquí» la abre como cualquier registro (lo que guardes irá a esa copia).</p>
              <ul class={lista}>{contenido.copias.map(fila)}</ul>
            </>
          ) : <p class={muted}>Ninguna todavía.</p>}
        </>
      )}
      {fallo && <p class={`${errorCls} mt-4`} role="alert">{fallo}</p>}
    </section>
  );
}
