// src/components/EnviarFacturas.tsx
// Envía por correo las facturas elegidas en Ventas. Un enlace mailto: no puede llevar adjuntos, así que:
// - «Compartir» (móvil, Chrome/Edge en Windows) abre el menú del sistema con los PDF ya adjuntos;
// - «Abrir el correo» descarga los PDF y abre el programa de correo con destinatario, asunto y mensaje.
import { useEffect, useState } from 'preact/hooks';
import type { Datos, Venta } from '../lib/registro.ts';
import { buscarCliente, facturaDeVenta } from './Factura.tsx';
import { btn, campo, error as errorCls, etiqueta, input, muted } from './ui.ts';

interface Props {
  datos: Datos;
  ventas: Venta[];
  onCerrar(): void;
}

const lista = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

function descargarPdf(f: File) {
  const url = URL.createObjectURL(f);
  const a = document.createElement('a');
  a.href = url;
  a.download = f.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function EnviarFacturas({ datos, ventas, onCerrar }: Props) {
  const nums = ventas.map(v => v.num);
  const emails = [...new Set(ventas.map(v => buscarCliente(datos, v.cliente)?.email.trim()).filter((e): e is string => !!e))];
  const sinEmail = [...new Set(ventas.filter(v => !buscarCliente(datos, v.cliente)?.email.trim()).map(v => v.cliente))];
  const tienda = datos.tienda.nombre || 'Celestina';

  // el email de la pestaña Tienda manda; si no hay, el de cada cliente
  const fijo = datos.tienda.envioEmail.trim();
  const [para, setPara] = useState(fijo || emails.join(', '));
  const [asunto, setAsunto] = useState(`${nums.length > 1 ? 'Facturas' : 'Factura'} ${lista(nums)} · ${tienda}`);
  const [mensaje, setMensaje] = useState(
    `Hola:\n\nTe envío ${nums.length > 1 ? `las facturas ${lista(nums)}` : `la factura ${nums[0]}`} en PDF.\n\nUn saludo,\n${tienda}`,
  );
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [error, setError] = useState('');
  const listos = pdfs.length === ventas.length;
  const compartible = listos && typeof navigator.canShare === 'function' && navigator.canShare({ files: pdfs });

  // los PDF se preparan al abrir: así «Compartir» se llama justo en el clic, que es lo que exige el navegador
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { facturaPdf } = await import('../lib/pdf.ts');
        const hechos: File[] = [];
        for (const v of ventas) {
          hechos.push(await facturaPdf(facturaDeVenta(datos, v)));
          if (vivo) setPdfs([...hechos]);
        }
      } catch (e) {
        if (vivo) setError(`No se pudieron crear los PDF: ${(e as Error).message}`);
      }
    })();
    return () => { vivo = false; };
  }, []);

  async function compartir() {
    try {
      // compartir no deja poner destinatario (y Outlook en Windows ignora el asunto): se copia para pegarlo
      if (para.trim()) await navigator.clipboard?.writeText(para.trim()).catch(() => {});
      await navigator.share({ files: pdfs, title: asunto, text: mensaje });
      onCerrar();
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError(`No se pudo compartir: ${(e as Error).message}`);
    }
  }

  function abrirCorreo() {
    pdfs.forEach(descargarPdf);
    const q = `subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(mensaje)}`;
    // la @ sin codificar: algunos programas de correo enseñan «%40» tal cual
    const a = para.split(/[,;\s]+/).filter(Boolean).map(e => encodeURIComponent(e).replaceAll('%40', '@'));
    location.href = `mailto:${a.join(',')}?${q}`;
  }

  return (
    <div class="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5 movil:p-0" role="dialog" aria-modal="true" aria-label="Enviar por correo"
      onKeyDown={e => { if (e.key === 'Escape') onCerrar(); }}>
      {/* en móvil ocupa toda la pantalla */}
      <div class="flex max-h-[calc(100dvh-40px)] w-[min(560px,100%)] flex-col overflow-hidden rounded-[14px] bg-paper movil:h-dvh movil:max-h-none movil:rounded-none">
        <div class="flex items-center justify-between gap-3 bg-primary py-2.5 pr-3.5 pl-5 text-ink movil:px-3">
          <span class="min-w-0 truncate font-bold">Enviar {nums.length > 1 ? `${nums.length} facturas` : `factura ${nums[0]}`}</span>
          <button type="button" class={btn('bar')} onClick={onCerrar}>Cerrar</button>
        </div>
        <div class="flex flex-col gap-3.5 overflow-auto p-5.5 movil:p-4">
          <p class={`${muted} text-[13px]`}>
            {error ? <span class={errorCls}>{error}</span>
              : listos ? `${pdfs.length} PDF listos: ${pdfs.map(f => f.name).join(', ')}`
              : `Preparando los PDF… ${pdfs.length} de ${ventas.length}`}
          </p>
          <label class={campo}>
            <span class={etiqueta}>Para</span>
            <input class={input} type="email" multiple value={para} placeholder="correo@cliente.com" onInput={e => setPara(e.currentTarget.value)} />
            {fijo && <span class={`${muted} text-xs`}>El de la pestaña Tienda.</span>}
            {!fijo && sinEmail.length > 0 && <span class={`${muted} text-xs`}>Sin email en su ficha: {sinEmail.join(', ')}</span>}
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
            {compartible && <button class={btn('primary')} onClick={compartir}>Compartir con los PDF adjuntos</button>}
            <button class={btn(compartible ? 'ghost' : 'primary')} disabled={!listos} onClick={abrirCorreo}>Descargar PDF y abrir el correo</button>
          </div>
          <p class={`${muted} text-xs`}>
            {compartible && <>«Compartir» abre el menú del sistema con los PDF ya adjuntos y el mensaje: elige Correo, Gmail u Outlook. No puede
              poner el destinatario, y algunas apps (Outlook en Windows) tampoco el asunto: el destinatario se copia al portapapeles para que lo
              pegues en «Para». </>}
            «Abrir el correo» descarga los PDF y abre tu programa de correo con el destinatario, el asunto y el mensaje; un enlace de correo no
            puede adjuntar archivos, así que arrastra al mensaje los PDF descargados.
          </p>
        </div>
      </div>
    </div>
  );
}
