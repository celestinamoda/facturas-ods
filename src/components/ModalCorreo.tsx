// src/components/ModalCorreo.tsx
// Envía archivos por correo. Un enlace mailto: no puede llevar adjuntos, así que hay dos caminos:
// - «Compartir» (móvil, Chrome/Edge en Windows) abre el menú del sistema con los archivos ya adjuntos;
// - «Abrir el correo» descarga los archivos y abre el programa de correo con destinatario, asunto y mensaje.
// Los archivos llegan ya preparados (o preparándose): `share` exige que la llamada venga justo del clic.
import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { btn, campo, error as errorCls, etiqueta, input, muted } from './ui.ts';

interface Props {
  titulo: string;
  /** los que ya están listos; hasta que no estén los `total`, no se puede enviar */
  archivos: File[];
  total: number;
  /** «los PDF», «el archivo»…: para los botones y los avisos */
  adjuntos: string;
  /** error al preparar los archivos */
  fallo?: string;
  para: string;
  /** nota bajo el destinatario */
  notaPara?: ComponentChildren;
  asunto: string;
  mensaje: string;
  /** al compartir o abrir el correo (no se puede saber si de verdad se llegó a enviar), con lo que había en «Para» */
  onEnviado?(para: string): void;
  onCerrar(): void;
}

function descargarArchivo(f: File) {
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function ModalCorreo({ titulo, archivos, total, adjuntos, fallo, notaPara, onEnviado, onCerrar, ...inicial }: Props) {
  const [para, setPara] = useState(inicial.para);
  const [asunto, setAsunto] = useState(inicial.asunto);
  const [mensaje, setMensaje] = useState(inicial.mensaje);
  const [error, setError] = useState('');
  const listos = archivos.length === total;
  // Chrome y Edge solo comparten ciertos tipos de archivo (PDF sí, .ods no) y `canShare` no lo comprueba:
  // el botón sale igual (lo pidió el usuario) y, si al compartir lo rechazan, se explica qué hacer
  const compartible = listos && typeof navigator.canShare === 'function' && navigator.canShare({ files: archivos });

  async function compartir() {
    try {
      // compartir no deja poner destinatario (y Outlook en Windows ignora el asunto): se copia para pegarlo.
      // Sin esperar: `share` tiene que llamarse en el mismo clic, y la espera puede gastar el permiso.
      if (para.trim()) navigator.clipboard?.writeText(para.trim()).catch(() => {});
      await navigator.share({ files: archivos, title: asunto, text: mensaje });
      onEnviado?.(para.trim());
      onCerrar();
    } catch (e) {
      const nombre = (e as Error).name;
      if (nombre === 'NotAllowedError') {
        const ods = archivos.some(f => /.ods$/i.test(f.name));
        setError(`Este navegador no deja compartir ${adjuntos}${ods ? ' (Chrome y Edge no admiten archivos .ods; Safari sí)' : ''}. `
          + `Usa «Descargar ${adjuntos} y abrir el correo».`);
      } else if (nombre !== 'AbortError') {
        setError(`No se pudo compartir: ${(e as Error).message}`);
      }
    }
  }

  function abrirCorreo() {
    archivos.forEach(descargarArchivo);
    const q = `subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    // la @ sin codificar: algunos programas de correo enseñan «%40» tal cual
    const a = para.split(/[,;\s]+/).filter(Boolean).map(e => encodeURIComponent(e).replaceAll('%40', '@'));
    location.href = `mailto:${a.join(',')}?${q}`;
    onEnviado?.(para.trim());
  }

  const aviso = fallo || error;
  return (
    <div class="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5 movil:p-0" role="dialog" aria-modal="true" aria-label={titulo}
      onKeyDown={e => { if (e.key === 'Escape') onCerrar(); }}>
      {/* en móvil ocupa toda la pantalla */}
      <div class="flex max-h-[calc(100dvh-40px)] w-[min(560px,100%)] flex-col overflow-hidden rounded-[14px] bg-paper movil:h-dvh movil:max-h-none movil:rounded-none movil:pb-[env(safe-area-inset-bottom)]">
        <div class="flex items-center justify-between gap-3 bg-primary py-2.5 pr-3.5 pl-5 text-ink movil:px-3 movil:pt-[calc(10px+env(safe-area-inset-top))]">
          <span class="min-w-0 truncate font-bold">{titulo}</span>
          <button type="button" class={btn('bar')} onClick={onCerrar}>Cerrar</button>
        </div>
        <div class="flex flex-col gap-3.5 overflow-auto p-5.5 movil:p-4">
          <p class={`${muted} text-[13px]`}>
            {aviso ? <span class={errorCls}>{aviso}</span>
              : listos ? `Listo para adjuntar: ${archivos.map(f => f.name).join(', ')}`
              : `Preparando ${adjuntos}… ${archivos.length} de ${total}`}
          </p>
          <label class={campo}>
            <span class={etiqueta}>Para</span>
            <input class={input} type="email" multiple value={para} placeholder="correo@dominio.com" onInput={e => setPara(e.currentTarget.value)} />
            {notaPara && <span class={`${muted} text-xs`}>{notaPara}</span>}
          </label>
          <label class={campo}>
            <span class={etiqueta}>Asunto</span>
            <input class={input} value={asunto} onInput={e => setAsunto(e.currentTarget.value)} />
          </label>
          <label class={campo}>
            <span class={etiqueta}>Mensaje</span>
            <textarea class={`${input} resize-y`} rows={6} value={mensaje} onInput={e => setMensaje(e.currentTarget.value)} />
          </label>
          <div class="flex flex-wrap gap-2 movil:flex-col">
            {compartible && <button class={btn('primary')} onClick={compartir}>Compartir {adjuntos}</button>}
            <button class={btn(compartible ? 'ghost' : 'primary')} disabled={!listos} onClick={abrirCorreo}>Descargar {adjuntos} y abrir el correo</button>
          </div>
          <p class={`${muted} text-xs`}>
            {compartible && <>«Compartir» abre el menú del sistema con {adjuntos} como adjunto y el mensaje: elige Correo, Gmail u
              Outlook. No puede poner el destinatario, y algunas apps (Outlook en Windows) tampoco el asunto: el destinatario se copia al
              portapapeles para que lo pegues en «Para». </>}
            «Abrir el correo» descarga {adjuntos} y abre tu programa de correo con el destinatario, el asunto y el mensaje; un enlace de correo
            no puede adjuntar archivos, así que arrastra al mensaje lo que se ha descargado.
          </p>
        </div>
      </div>
    </div>
  );
}
