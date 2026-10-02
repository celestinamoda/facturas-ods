// src/components/Descuentos.tsx
import { useState } from 'preact/hooks';
import type { Datos, Descuento, EstadoDescuento } from '../lib/registro.ts';
import { estadoDescuento, etiquetaDescuento, hoy } from '../lib/registro.ts';
import { fecha, norm, parseNum } from '../lib/format.ts';
import { btn, campo, empty, etiqueta, filtro, filtros, h2, icon, input, muted, panel, panelHead } from './ui.ts';

const CAPACIDAD = 200;

// cuatro columnas, dos en tablet y móvil; los campos de texto largos ocupan dos
const rejilla = 'grid grid-cols-4 gap-x-4 gap-y-3.5 tablet:grid-cols-2 movil:gap-x-2.5';
const ancho = 'col-span-2';
const aviso = 'text-[11.5px] font-medium text-danger';

const ESTADO: Record<EstadoDescuento, { texto: string; clase: string }> = {
  activo: { texto: 'Activo', clase: 'bg-primary text-ink' },
  programado: { texto: 'Programado', clase: 'border border-line-2 text-ink-2' },
  pausado: { texto: 'Pausado', clase: 'bg-field text-muted' },
  caducado: { texto: 'Caducado', clase: 'bg-field text-muted' },
  agotado: { texto: 'Agotado', clase: 'bg-field text-muted' },
};

const nuevo = (): Descuento => ({
  nombre: '', producto: '', tipo: '%', valor: 10, desde: hoy(), hasta: '',
  maxUsos: null, minCantidad: null, cliente: '', activo: true, facturas: [],
});

const texto = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));

interface Props {
  datos: Datos;
  onChange(descuentos: Descuento[]): void;
}

export function Descuentos({ datos, onChange }: Props) {
  const [q, setQ] = useState('');
  const lista = datos.descuentos;
  const visibles = lista.map((x, i) => ({ x, i })).filter(({ x }) =>
    !q || norm(`${x.nombre} ${x.producto} ${x.cliente}`).includes(norm(q)));
  const productos = new Set(datos.productos.map(p => norm(p.nombre)));
  const clientes = new Set(datos.clientes.map(c => norm(c.nombre)));
  const hoyIso = hoy();

  const set = (i: number, patch: Partial<Descuento>) => onChange(lista.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  // número ≥ 0, o null si se deja vacío
  const numero = (s: string): number | null => { const n = parseNum(s); return n === null ? null : Math.max(0, n); };

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>Descuentos</h2>
          <p class={muted}>Se aplican solos en Nueva venta cuando la línea cumple las condiciones · {lista.length} de {CAPACIDAD}</p>
        </div>
        <div class={filtros}>
          <input class={filtro} type="search" placeholder="Buscar…" value={q} onInput={e => setQ(e.currentTarget.value)} />
          <button class={btn()} disabled={lista.length >= CAPACIDAD} onClick={() => { setQ(''); onChange([nuevo(), ...lista]); }}>Añadir</button>
        </div>
      </div>

      <datalist id="dl-dto-productos">{datos.productos.map(p => <option key={p.nombre} value={p.nombre} />)}</datalist>
      <datalist id="dl-dto-clientes">{datos.clientes.map(c => <option key={c.nombre} value={c.nombre} />)}</datalist>

      {visibles.map(({ x, i }) => {
        const estado = ESTADO[estadoDescuento(x, hoyIso)];
        const usos = x.facturas.length;
        return (
          <article key={i} class="mb-3 rounded-[10px] border border-line p-4 movil:p-3">
            <header class="mb-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span class={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${estado.clase}`}>{estado.texto}</span>
              <b class="min-w-0 truncate">{etiquetaDescuento(x)}</b>
              <span class="text-xs text-muted" title={x.facturas.join(', ')}>
                Usos: {usos}{x.maxUsos !== null && ` de ${x.maxUsos}`}
              </span>
              <label class="ml-auto flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" class="size-4 accent-ink" checked={x.activo} onChange={e => set(i, { activo: e.currentTarget.checked })} />
                Activado
              </label>
              <button class={icon} title="Eliminar descuento" onClick={() => {
                if (confirm(`¿Eliminar el descuento «${x.nombre || 'sin nombre'}»? Las facturas ya hechas no cambian.`)) onChange(lista.filter((_, j) => j !== i));
              }}>×</button>
            </header>

            <div class={rejilla}>
              <label class={`${campo} ${ancho}`}>
                <span class={etiqueta}>Nombre (sale en la factura)</span>
                <input class={input} value={x.nombre} placeholder="Rebajas de enero" onInput={e => set(i, { nombre: e.currentTarget.value })} />
              </label>
              <label class={`${campo} ${ancho}`}>
                <span class={etiqueta}>Producto</span>
                <input class={input} list="dl-dto-productos" value={x.producto} placeholder="Todos los productos"
                  onInput={e => set(i, { producto: e.currentTarget.value })} />
                {x.producto.trim() && !productos.has(norm(x.producto)) && <small class={aviso}>No está en Productos: no se aplicará a nada.</small>}
              </label>

              <label class={campo}>
                <span class={etiqueta}>Tipo</span>
                <select class={input} value={x.tipo} onChange={e => set(i, { tipo: e.currentTarget.value === '€' ? '€' : '%' })}>
                  <option value="%">Porcentaje</option>
                  <option value="€">Euros por unidad</option>
                </select>
              </label>
              <label class={campo}>
                <span class={etiqueta}>{x.tipo === '%' ? 'Descuento (%)' : 'Descuento (€)'}</span>
                <input class={`${input} text-right tabular-nums`} inputMode="decimal" value={texto(x.valor)}
                  onChange={e => set(i, { valor: Math.min(numero(e.currentTarget.value) ?? 0, x.tipo === '%' ? 100 : Infinity) })} />
                {x.valor <= 0 && <small class={aviso}>Con 0 no descuenta nada.</small>}
              </label>
              <label class={campo}>
                <span class={etiqueta}>Desde</span>
                <input class={input} type="date" value={x.desde} max={x.hasta || undefined} onInput={e => set(i, { desde: e.currentTarget.value })} />
              </label>
              <label class={campo}>
                <span class={etiqueta}>Hasta (incluido)</span>
                <input class={input} type="date" value={x.hasta} min={x.desde || undefined} onInput={e => set(i, { hasta: e.currentTarget.value })} />
                {x.desde && x.hasta && x.hasta < x.desde && <small class={aviso}>Acaba antes de empezar.</small>}
              </label>

              <label class={campo}>
                <span class={etiqueta}>Límite de usos</span>
                <input class={`${input} text-right tabular-nums`} inputMode="numeric" value={texto(x.maxUsos)} placeholder="Sin límite"
                  onChange={e => { const n = numero(e.currentTarget.value); set(i, { maxUsos: n === null ? null : Math.trunc(n) }); }} />
                <small class="text-[11.5px] text-muted">Una factura = un uso</small>
              </label>
              <label class={campo}>
                <span class={etiqueta}>Cantidad mínima</span>
                <input class={`${input} text-right tabular-nums`} inputMode="decimal" value={texto(x.minCantidad)} placeholder="Cualquiera"
                  onChange={e => set(i, { minCantidad: numero(e.currentTarget.value) })} />
              </label>
              <label class={`${campo} ${ancho}`}>
                <span class={etiqueta}>Solo para el cliente</span>
                <input class={input} list="dl-dto-clientes" value={x.cliente} placeholder="Cualquier cliente"
                  onInput={e => set(i, { cliente: e.currentTarget.value })} />
                {x.cliente.trim() && !clientes.has(norm(x.cliente)) && <small class={aviso}>No está en Clientes: no se aplicará a nadie.</small>}
              </label>
            </div>

            {usos > 0 && <p class="mt-3 text-xs text-muted">Facturas: {x.facturas.join(', ')}</p>}
            {(x.desde || x.hasta) && (
              <p class="mt-1 text-xs text-muted">
                Vale {x.desde ? `desde el ${fecha(x.desde)}` : 'desde ya'}{x.hasta ? ` hasta el ${fecha(x.hasta)}` : ', sin fecha de fin'}, según la fecha de la venta.
              </p>
            )}
          </article>
        );
      })}
      {lista.length === 0 && <p class={empty}>Todavía no hay descuentos. Pulsa «Añadir».</p>}
      {lista.length > 0 && visibles.length === 0 && <p class={empty}>Ningún descuento coincide con la búsqueda.</p>}
    </section>
  );
}
