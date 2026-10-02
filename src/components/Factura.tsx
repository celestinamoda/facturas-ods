// src/components/Factura.tsx
import type { Cliente, Linea, Tienda, Venta } from '../lib/registro.ts';
import { rebajaDeEtiqueta } from '../lib/registro.ts';
import { eur, fecha, numero, pct } from '../lib/format.ts';

export interface FacturaData {
  tienda: Tienda;
  venta: Venta;
  lineas: Linea[];
  cliente: Cliente | undefined;
  notas: string;
  borrador?: boolean;
}

const join = (sep: string, ...parts: string[]): string => parts.filter(Boolean).join(sep);

// La factura va siempre en blanco y negro: solo negro, blanco y los grises del tema, nunca `primary`.
const gris = 'text-muted';
const label = `${gris} mb-1 text-[7.5px] font-bold tracking-[.1em]`;
const dt = `${gris} self-center text-right text-[7.5px] font-bold tracking-[.08em]`;
const dd = 'text-right font-bold text-black';
const th = 'bg-black px-2.5 py-2 text-right text-[8px] font-bold tracking-[.06em] text-white first:text-left';
const td = 'h-6.25 border-b border-line-2 px-2.5 py-1.5 text-right tabular-nums first:text-left';
const total = 'flex justify-between px-2.5 py-1 text-[11px]';
const totalLabel = `${gris} self-center text-[8px] font-bold tracking-[.06em]`;

export function Factura({ tienda: t, venta: v, lineas, cliente: c, notas, borrador }: FacturaData) {
  const huecos = Math.max(0, 12 - lineas.length);
  return (
    <article id="factura-print" class="relative mx-auto w-full max-w-198.5 bg-white px-13 pt-12 pb-7.5 font-factura text-[10.5px] leading-[1.45] text-black shadow-[0_1px_0_var(--color-line)] movil:px-4.5 movil:py-6 [-webkit-print-color-adjust:exact] [print-color-adjust:exact] print:w-[186mm] print:max-w-none print:p-0 print:shadow-none">
      {borrador && <div class="absolute top-3.5 right-13 border border-black px-2 py-0.75 text-[9px] font-bold tracking-[.14em] print:static print:mb-3 print:ml-auto print:w-fit">BORRADOR · sin registrar</div>}
      <header class="flex items-end justify-between gap-6 border-b-[2.5px] border-black pb-4 movil:flex-col movil:items-start">
        <div>
          <h1 class="text-[34px] leading-none font-bold tracking-[.03em]">FACTURA</h1>
          <p class={`${gris} mt-1.5 text-[8px] tracking-[.08em]`}>DOCUMENTO DE FACTURACIÓN</p>
        </div>
        <div class={`${gris} flex flex-col items-end text-right text-[9.5px] leading-[1.55] movil:items-start movil:text-left`}>
          <strong class="mb-0.5 text-[17px] tracking-[.02em] text-black">{t.nombre}</strong>
          <span>{t.razon}</span>
          {t.nif && <span>NIF {t.nif}</span>}
          <span>{t.calle}</span>
          <span>{join(' · ', join(' ', t.cp, t.ciudad), t.prov)}</span>
          <span>{join(' · ', t.tel, t.email)}</span>
        </div>
      </header>

      <section class="flex justify-between gap-6 pt-5 pb-5.5 text-[#333] movil:flex-col movil:items-start">
        <div>
          <p class={label}>FACTURAR A</p>
          <p class="mb-0.5 text-[13px] font-bold text-black">{v.cliente}</p>
          {(c?.nif || v.nif) && <p>NIF / CIF {c?.nif || v.nif}</p>}
          {c && <p>{join(' · ', c.direccion, join(' ', c.cp, c.ciudad))}{c.provincia ? ` (${c.provincia})` : ''}</p>}
        </div>
        <dl class="grid grid-cols-[auto_auto] content-start gap-x-5.5 gap-y-0.75">
          <dt class={dt}>Nº FACTURA</dt><dd class={dd}>{v.num}</dd>
          <dt class={dt}>FECHA</dt><dd class={dd}>{fecha(v.fecha)}</dd>
          <dt class={dt}>FORMA DE PAGO</dt><dd class={dd}>{v.pago}</dd>
        </dl>
      </section>

      <table class="w-full border-collapse">
        <thead>
          <tr><th class={th}>CONCEPTO</th><th class={th}>CANT.</th><th class={th}>PRECIO</th><th class={th}>IMPORTE</th></tr>
        </thead>
        <tbody>
          {lineas.map((l, i) => (
            <tr key={i}>
              <td class={td}>
                {l.producto}
                {l.descuento && <span class={`${gris} block text-[8px]`}>Descuento {rebajaDeEtiqueta(l.descuento)}{l.precioBase != null && ` · antes ${eur(l.precioBase)}`}</span>}
              </td>
              <td class={td}>{numero(l.cantidad)}</td>
              <td class={td}>{eur(l.precio)}</td>
              <td class={td}><b>{eur(l.importe)}</b></td>
            </tr>
          ))}
          {Array.from({ length: huecos }, (_, i) => (
            <tr key={`h${i}`}><td class={td} /><td class={td} /><td class={td} /><td class={td} /></tr>
          ))}
        </tbody>
      </table>

      <section class="mt-4 ml-auto w-75 tabular-nums movil:w-full">
        <div class={total}><span class={totalLabel}>BASE IMPONIBLE</span><span>{eur(v.base)}</span></div>
        <div class={total}><span class={totalLabel}>IVA {pct(v.ivaPct)}</span><span>{eur(v.iva)}</span></div>
        <div class={total}><span class={totalLabel}>IRPF −{pct(v.irpfPct)}</span><span>{eur(v.irpf)}</span></div>
        <div class="mt-1.5 flex justify-between bg-black px-2.5 py-2.75 text-[15px] font-bold text-white">
          <span class="self-center text-[10px] tracking-[.06em]">TOTAL</span><span>{eur(v.total)}</span>
        </div>
      </section>

      {notas && (
        <section class="mt-7.5 border-t border-line-2 pt-3.5 text-[#333]">
          <p class={label}>NOTAS</p>
          <p>{notas}</p>
        </section>
      )}
      <p class="mt-6.5 text-[12px] font-bold">{t.gracias}</p>
      <footer class={`${gris} mt-10 border-t border-line-2 pt-2 text-center text-[8px]`}>{join(' · ', t.nombre, t.nif && `NIF ${t.nif}`, t.email, t.tel, t.web)}</footer>
    </article>
  );
}
