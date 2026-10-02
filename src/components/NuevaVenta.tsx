// src/components/NuevaVenta.tsx
import { useMemo, useState } from 'preact/hooks';
import type { Datos, Linea, Venta } from '../lib/registro.ts';
import { hoy, mejorDescuento, numeroFactura, round2, sumarDias, totales } from '../lib/registro.ts';
import { eur, norm, parseNum } from '../lib/format.ts';
import { btn, campo, error as errorCls, etiqueta, filaMovil, gridForm, h2, icon, input, muted, panel, panelHead, span2, span4, table, tableWrap, tdInput, th, thR } from './ui.ts';

const PAGOS = ['Transferencia', 'Efectivo', 'Tarjeta', 'Bizum', 'Domiciliación'];

const fila = 'flex items-center justify-between border-b border-line py-1.75 tabular-nums';
const filaLabel = 'text-xs font-bold tracking-[.06em] text-muted uppercase';
const pctInput = 'w-[3.6rem] rounded-md border border-line-2 bg-field px-1.5 py-0.5 text-right outline-none focus:border-ink focus:bg-white movil:text-base';
// el texto de ayuda solo hace falta en móvil, donde no hay cabecera de tabla
const numero = 'text-right tabular-nums placeholder:text-transparent movil:placeholder:text-muted';
const ancho = 'min-w-65 movil:w-full movil:min-w-0';
// etiqueta del descuento de una línea; al pulsarla se quita o se vuelve a poner
const chip = 'mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold';

interface LineaForm {
  producto: string;
  cantidad: string;
  precio: string;
  precioManual: boolean;
  /** el descuento que le tocaría se ha quitado a mano en esta línea */
  sinDto: boolean;
}
const vacia = (): LineaForm => ({ producto: '', cantidad: '', precio: '', precioManual: false, sinDto: false });

export interface NuevaVentaResult {
  venta: Venta;
  lineas: Linea[];
  notas: string;
  /** descuentos aplicados (posición en `Datos.descuentos`): cada uno gasta un uso al registrar */
  usados: number[];
}

interface Props {
  datos: Datos;
  onPreview(r: NuevaVentaResult): void;
  onRegistrar(r: NuevaVentaResult): void;
}

export function NuevaVenta({ datos, onPreview, onRegistrar }: Props) {
  const t = datos.tienda;
  const [cliente, setCliente] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [pago, setPago] = useState(t.pago || 'Transferencia');
  const [notas, setNotas] = useState('');
  const [ivaPct, setIvaPct] = useState(String(Math.round(t.iva * 10000) / 100));
  const [irpfPct, setIrpfPct] = useState(String(Math.round(t.irpf * 10000) / 100));
  const [lineas, setLineas] = useState<LineaForm[]>([vacia(), vacia(), vacia()]);
  const [error, setError] = useState('');

  const precios = useMemo(() => new Map(datos.productos.map(p => [norm(p.nombre), p.precio])), [datos.productos]);
  const clientes = useMemo(() => new Map(datos.clientes.map(c => [norm(c.nombre), c])), [datos.clientes]);
  const num = numeroFactura(t);
  const duplicado = datos.ventas.some(v => v.num === num);

  const calculadas = lineas.map(l => {
    const cantidad = parseNum(l.cantidad);
    const precio = parseNum(l.precio);
    // el descuento que le toca a la línea, aunque se haya quitado a mano (para poder volver a ponerlo)
    const dto = l.producto.trim() && cantidad !== null && precio !== null
      ? mejorDescuento(datos.descuentos, { producto: l.producto, cantidad, precio, cliente, fecha })
      : null;
    const aplicado = dto && !l.sinDto ? dto : null;
    const final = aplicado ? aplicado.precio : precio;
    const importe = cantidad !== null && final !== null ? round2(cantidad * final) : null;
    return { ...l, cantidad, precio, importe, dto, aplicado, final };
  });
  const validas = calculadas.filter(l => l.producto.trim() && l.importe !== null);
  const iva = (parseNum(ivaPct) ?? 0) / 100;
  const irpf = (parseNum(irpfPct) ?? 0) / 100;
  const tot = totales(validas.map(l => ({ importe: l.importe! })), iva, irpf);
  const ahorro = round2(validas.reduce((a, l) => a + (l.aplicado ? l.cantidad! * l.precio! - l.importe! : 0), 0));

  function setLinea(i: number, patch: Partial<LineaForm>) {
    setLineas(ls => {
      const next = ls.map((l, j) => (j === i ? { ...l, ...patch } : l));
      const l = next[i];
      if (patch.producto !== undefined && !l.precioManual) {
        const p = precios.get(norm(l.producto));
        next[i] = { ...l, precio: p === undefined || p === null ? '' : String(p).replace('.', ',') };
      }
      // al poner un producto, cantidad 1 si aún no hay ninguna
      if (patch.producto?.trim() && !next[i].cantidad) next[i] = { ...next[i], cantidad: '1' };
      if (i === next.length - 1 && next[i].producto.trim()) next.push(vacia());
      return next;
    });
  }

  function construir(): NuevaVentaResult | null {
    const c = clientes.get(norm(cliente));
    if (!c) return fail('Elige un cliente de la lista. Si es nuevo, añádelo antes en Clientes.');
    if (!fecha) return fail('Falta la fecha.');
    const incompleta = calculadas.find(l => l.producto.trim() && (l.importe === null || (l.cantidad ?? 0) <= 0));
    if (incompleta) return fail(`La línea «${incompleta.producto}» necesita cantidad y precio.`);
    if (!validas.length) return fail('Añade al menos un producto.');
    if (duplicado) return fail(`La factura ${num} ya existe. Revisa «Siguiente número» en Tienda.`);
    setError('');
    const venta: Venta = {
      num, fecha, vencimiento: sumarDias(fecha, t.dias), cliente: c.nombre, nif: c.nif, pago,
      base: tot.base, ivaPct: iva, iva: tot.iva, irpfPct: irpf, irpf: tot.irpf, total: tot.total, pdf: '',
    };
    const ls: Linea[] = validas.map(l => ({
      num, fecha, cliente: c.nombre, producto: l.producto.trim(), cantidad: l.cantidad!, precio: l.final!, importe: l.importe!,
      ...(l.aplicado ? { descuento: l.aplicado.etiqueta, precioBase: l.precio! } : {}),
    }));
    const usados = [...new Set(validas.flatMap(l => (l.aplicado ? [l.aplicado.indice] : [])))];
    return { venta, lineas: ls, notas, usados };
  }
  function fail(msg: string): null {
    setError(msg);
    return null;
  }
  function limpiar() {
    setCliente(''); setFecha(hoy()); setPago(t.pago || 'Transferencia'); setNotas('');
    setIvaPct(String(Math.round(t.iva * 10000) / 100)); setIrpfPct(String(Math.round(t.irpf * 10000) / 100));
    setLineas([vacia(), vacia(), vacia()]); setError('');
  }

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>Nueva venta</h2>
          <p class={muted}>Factura <b>{num}</b>{duplicado && <span class="font-semibold text-danger"> · ya existe</span>}</p>
        </div>
        <button class={btn('ghost')} onClick={limpiar}>Limpiar</button>
      </div>

      <div class={gridForm}>
        <label class={`${campo} ${span2}`}>
          <span class={etiqueta}>Cliente</span>
          <input class={input} list="dl-clientes" value={cliente} placeholder="Escribe para buscar…"
            onInput={e => setCliente(e.currentTarget.value)} />
          <datalist id="dl-clientes">{datos.clientes.map(c => <option key={c.nombre} value={c.nombre} />)}</datalist>
        </label>
        <label class={campo}>
          <span class={etiqueta}>Fecha</span>
          <input class={input} type="date" value={fecha} onInput={e => setFecha(e.currentTarget.value)} />
        </label>
        <label class={campo}>
          <span class={etiqueta}>Forma de pago</span>
          <input class={input} list="dl-pagos" value={pago} onInput={e => setPago(e.currentTarget.value)} />
          <datalist id="dl-pagos">{PAGOS.map(p => <option key={p} value={p} />)}</datalist>
        </label>
        <label class={`${campo} ${span4}`}>
          <span class={etiqueta}>Notas (solo salen en la factura impresa)</span>
          <input class={input} value={notas} onInput={e => setNotas(e.currentTarget.value)} />
        </label>
      </div>

      <datalist id="dl-productos">{datos.productos.map(p => <option key={p.nombre} value={p.nombre} />)}</datalist>
      <div class={tableWrap}>
        <table class={`${table} min-w-140`}>
          <thead>
            <tr>
              <th class={th}>Producto / servicio</th><th class={`${thR} w-28`}>Cant.</th><th class={`${thR} w-38`}>Precio</th>
              <th class={`${thR} w-38`}>Importe</th><th class={`${th} w-9`} />
            </tr>
          </thead>
          <tbody>
            {calculadas.map((l, i) => (
              // móvil: producto arriba a todo el ancho; debajo cantidad, precio, importe y quitar
              <tr key={i} class={`${filaMovil} movil:grid-cols-[1fr_1fr_auto_auto] movil:items-center`}>
                <td class={`${tdInput} movil:col-span-4`}>
                  <input class={input} list="dl-productos" value={l.producto} placeholder="Producto…"
                    onInput={e => setLinea(i, { producto: e.currentTarget.value })} />
                  {l.dto && (
                    <button class={`${chip} ${l.aplicado ? 'bg-primary text-ink' : 'border border-dashed border-line-2 text-muted line-through'}`}
                      title={l.aplicado ? 'Quitar el descuento de esta línea' : 'Volver a aplicar el descuento'}
                      onClick={() => setLinea(i, { sinDto: !l.sinDto })}>
                      {l.dto.etiqueta}{l.aplicado && <span class="font-normal">· antes {eur(l.cantidad! * l.precio!)}</span>}
                    </button>
                  )}
                </td>
                <td class={tdInput}><input class={`${input} ${numero}`} inputMode="decimal" placeholder="Cant." value={lineas[i].cantidad}
                  onInput={e => setLinea(i, { cantidad: e.currentTarget.value })} /></td>
                <td class={tdInput}><input class={`${input} ${numero}`} inputMode="decimal" placeholder="Precio" value={lineas[i].precio}
                  onInput={e => setLinea(i, { precio: e.currentTarget.value, precioManual: e.currentTarget.value !== '' })} /></td>
                <td class="border-b border-line py-1.25 pr-3 pl-1 text-right align-middle font-semibold whitespace-nowrap tabular-nums movil:min-w-18 movil:border-0 movil:p-0">{l.importe === null ? '' : eur(l.importe)}</td>
                <td class={tdInput}>{lineas.length > 1 && (
                  <button class={icon} title="Quitar línea" onClick={() => setLineas(ls => ls.filter((_, j) => j !== i))}>×</button>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div class="mt-5.5 flex flex-wrap-reverse items-end justify-between gap-6 movil:flex-wrap">
        <div class="ml-auto w-[min(380px,100%)]">
          {ahorro > 0 && <div class={fila}><span class={filaLabel}>Descuentos</span><b>−{eur(ahorro)}</b></div>}
          <div class={fila}><span class={filaLabel}>Base imponible</span><b>{eur(tot.base)}</b></div>
          <div class={fila}>
            <span class={filaLabel}>IVA <input class={pctInput} inputMode="decimal" value={ivaPct} onInput={e => setIvaPct(e.currentTarget.value)} /> %</span>
            <b>{eur(tot.iva)}</b>
          </div>
          <div class={fila}>
            <span class={filaLabel}>IRPF <input class={pctInput} inputMode="decimal" value={irpfPct} onInput={e => setIrpfPct(e.currentTarget.value)} /> %</span>
            <b>{eur(tot.irpf)}</b>
          </div>
          <div class="mt-2 flex items-center justify-between rounded-lg bg-primary px-3.5 py-3 text-ink tabular-nums">
            <span class="text-xs font-bold tracking-[.06em] uppercase">TOTAL</span><b class="text-xl">{eur(tot.total)}</b>
          </div>
        </div>
        <div class="flex flex-col items-start gap-2.5 movil:w-full">
          {error && <p class={errorCls} role="alert">{error}</p>}
          <button class={`${btn('ghost')} ${ancho}`} onClick={() => { const r = construir(); if (r) onPreview(r); }}>Vista previa</button>
          <button class={`${btn()} ${ancho}`} onClick={() => { const r = construir(); if (r) { onRegistrar(r); limpiar(); } }}>
            Registrar venta y ver factura
          </button>
        </div>
      </div>
    </section>
  );
}
