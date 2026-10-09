// src/lib/pdf.ts — convierte la factura en un archivo PDF (A4, una página) dentro del navegador.
// Se pinta el componente fuera de la vista, html2canvas-pro lo pasa a imagen y la imagen se mete en un
// PDF mínimo escrito a mano (no hace falta más: una página con una imagen JPEG). La versión «pro» de
// html2canvas es porque la original no entiende los colores oklch/color-mix que usa Tailwind 4.
import { h, render } from 'preact';
import html2canvas from 'html2canvas-pro';
import { Factura, type FacturaData } from '../components/Factura.tsx';

// A4 en puntos de PDF y en píxeles CSS (96 ppp): el mismo ancho que `max-w-198.5` de la factura
const A4 = { w: 595.28, h: 841.89 };
const ANCHO_PX = 794;

export const nombrePdf = (num: string): string => `Factura_${num.replace(/[\\/:*?"<>|]/g, '-')}.pdf`;

export async function facturaPdf(data: FacturaData): Promise<File> {
  const caja = document.createElement('div');
  caja.style.cssText = `position:fixed;left:-10000px;top:0;width:${ANCHO_PX}px;background:#fff`;
  document.body.appendChild(caja);
  try {
    render(h(Factura, data), caja);
    const factura = caja.firstElementChild as HTMLElement;
    factura.style.boxShadow = 'none'; // la sombra de pantalla saldría como una raya bajo el pie
    const canvas = await html2canvas(factura, {
      scale: 2,
      backgroundColor: '#ffffff',
      // la copia se pinta en una ventana de escritorio: si no, en el móvil saldría el diseño de móvil
      windowWidth: 1280,
      windowHeight: 1600,
      logging: false,
    });
    const jpeg = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
    if (!jpeg) throw new Error('No se pudo crear la imagen de la factura');
    const bytes = pdfConImagen(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
    return new File([bytes as Uint8Array<ArrayBuffer>], nombrePdf(data.venta.num), { type: 'application/pdf' });
  } finally {
    render(null, caja);
    caja.remove();
  }
}

/** PDF de una página A4 con la imagen a todo el ancho (o a todo el alto si no cabe), arriba y centrada. */
function pdfConImagen(jpeg: Uint8Array, wPx: number, hPx: number): Uint8Array {
  const escala = Math.min(A4.w / wPx, A4.h / hPx);
  const w = wPx * escala;
  const hh = hPx * escala;
  const x = (A4.w - w) / 2;
  const y = A4.h - hh;
  const dibujo = `q ${w.toFixed(2)} 0 0 ${hh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;

  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const offsets: number[] = [];
  let largo = 0;
  const poner = (p: string | Uint8Array) => {
    const b = typeof p === 'string' ? enc.encode(p) : p;
    partes.push(b);
    largo += b.length;
  };
  const objeto = (n: number, cuerpo: string, flujo?: Uint8Array) => {
    offsets[n] = largo;
    poner(`${n} 0 obj\n${cuerpo}\n`);
    if (flujo) { poner('stream\n'); poner(flujo); poner('\nendstream\n'); }
    poner('endobj\n');
  };

  poner('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objeto(1, '<< /Type /Catalog /Pages 2 0 R >>');
  objeto(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objeto(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.w} ${A4.h}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  objeto(4, `<< /Length ${dibujo.length} >>`, enc.encode(dibujo));
  objeto(5, `<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`, jpeg);
  const xref = largo;
  poner(`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  poner(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(largo);
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
}
