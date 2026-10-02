// src/components/Descuentos.tsx
// Listado de descuentos: cada fila enseña el nombre, el estado y un resumen, y se edita en un modal.
import { useState } from 'preact/hooks';
import type { Datos, Descuento, EstadoDescuento } from '../lib/registro.ts';
import { estadoDescuento, etiquetaDescuento, hoy } from '../lib/registro.ts';
import { fecha, norm, parseNum } from '../lib/format.ts';
import { ModalFormulario } from './ModalFormulario.tsx';
import { btn, campo, empty, etiqueta, filtro, filtros, h2, icon, input, lista, listaFila, muted, panel, panelHead } from './ui.ts';

const CAPACIDAD = 200;

const aviso = 'text-[11.5px] font-medium text-danger';
const numero = `${input} text-right tabular-nums`;

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

/** Descuento abierto en el modal: `i` es su posición, o -1 si es nuevo. Los números se editan como texto. */
interface Edicion {
  i: number;
  x: Descuento;
  valor: string;
  maxUsos: string;
  minCantidad: string;
}

const texto = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));
// número ≥ 0, o null si se deja vacío o no es un número
const positivo = (s: string): number | null => { const n = parseNum(s); return n === null ? null : Math.max(0, n); };

function resumen(x: Descuento): string {
  const fechas = x.desde && x.hasta ? `del ${fecha(x.desde)} al ${fecha(x.hasta)}`
    : x.desde ? `desde el ${fecha(x.desde)}` : x.hasta ? `hasta el ${fecha(x.hasta)}` : '';
  return [
    x.producto || 'Todos los productos', fechas, x.cliente && `solo ${x.cliente}`,
    x.minCantidad ? `desde ${texto(x.minCantidad)} uds.` : '',
    `usos: ${x.facturas.length}${x.maxUsos !== null ? ` de ${x.maxUsos}` : ''}`,
  ].filter(Boolean).join(' · ');
}

interface Props {
  datos: Datos;
  onChange(descuentos: Descuento[]): void;
}

export function Descuentos({ datos, onChange }: Props) {
  const [q, setQ] = useState('');
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const todos = datos.descuentos;
  const visibles = todos.map((x, i) => ({ x, i })).filter(({ x }) =>
    !q || norm(`${x.nombre} ${x.producto} ${x.cliente}`).includes(norm(q)));
  const hoyIso = hoy();

  function abrir(i: number) {
    const x = i < 0 ? nuevo() : todos[i];
    setEdicion({ i, x, valor: texto(x.valor), maxUsos: texto(x.maxUsos), minCantidad: texto(x.minCantidad) });
  }

  function aceptar() {
    if (!edicion) return;
    const maxUsos = positivo(edicion.maxUsos);
    const x: Descuento = {
      ...edicion.x,
      nombre: edicion.x.nombre.trim(), producto: edicion.x.producto.trim(), cliente: edicion.x.cliente.trim(),
      valor: Math.min(positivo(edicion.valor) ?? 0, edicion.x.tipo === '%' ? 100 : Infinity),
      maxUsos: maxUsos === null ? null : Math.trunc(maxUsos),
      minCantidad: positivo(edicion.minCantidad),
    };
    onChange(edicion.i < 0 ? [...todos, x] : todos.map((y, j) => (j === edicion.i ? x : y)));
    setEdicion(null);
    setQ('');
  }

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>Descuentos</h2>
          <p class={muted}>Se aplican solos en Nueva venta cuando la línea cumple las condiciones · {todos.length} de {CAPACIDAD}</p>
        </div>
        <div class={filtros}>
          <input class={filtro} type="search" placeholder="Buscar…" value={q} onInput={e => setQ(e.currentTarget.value)} />
          <button class={btn()} disabled={todos.length >= CAPACIDAD} onClick={() => abrir(-1)}>Añadir</button>
        </div>
      </div>

      {visibles.length > 0 && (
        <ul class={lista}>
          {visibles.map(({ x, i }) => {
            const estado = ESTADO[estadoDescuento(x, hoyIso)];
            return (
              <li key={i} class={listaFila}>
                <div class="min-w-0 flex-1">
                  <p class="flex items-center gap-2">
                    <span class="truncate font-semibold">{etiquetaDescuento(x)}</span>
                    <span class={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${estado.clase}`}>{estado.texto}</span>
                  </p>
                  <p class="truncate text-xs text-muted" title={x.facturas.join(', ')}>{resumen(x)}</p>
                </div>
                <button class={btn('ghost', 'small')} onClick={() => abrir(i)}>Editar</button>
                <button class={icon} title="Eliminar descuento" onClick={() => {
                  if (confirm(`¿Eliminar el descuento «${x.nombre || 'sin nombre'}»? Las facturas ya hechas no cambian.`)) onChange(todos.filter((_, j) => j !== i));
                }}>×</button>
              </li>
            );
          })}
        </ul>
      )}
      {todos.length === 0 && <p class={empty}>Todavía no hay descuentos. Pulsa «Añadir».</p>}
      {todos.length > 0 && visibles.length === 0 && <p class={empty}>Ningún descuento coincide con la búsqueda.</p>}

      {edicion && <Formulario datos={datos} e={edicion} set={setEdicion} onAceptar={aceptar} onCancelar={() => setEdicion(null)} />}
    </section>
  );
}

function Formulario({ datos, e, set, onAceptar, onCancelar }: { datos: Datos; e: Edicion; set(e: Edicion): void; onAceptar(): void; onCancelar(): void }) {
  const { x } = e;
  const cambia = (patch: Partial<Descuento>) => set({ ...e, x: { ...x, ...patch } });
  const hayProducto = !x.producto.trim() || datos.productos.some(p => norm(p.nombre) === norm(x.producto));
  const hayCliente = !x.cliente.trim() || datos.clientes.some(c => norm(c.nombre) === norm(x.cliente));
  const usos = x.facturas.length;

  return (
    <ModalFormulario titulo={`${e.i < 0 ? 'Nuevo' : 'Editar'} descuento`} onAceptar={onAceptar} onCancelar={onCancelar}>
      <datalist id="dl-dto-productos">{datos.productos.map(p => <option key={p.nombre} value={p.nombre} />)}</datalist>
      <datalist id="dl-dto-clientes">{datos.clientes.map(c => <option key={c.nombre} value={c.nombre} />)}</datalist>

      {/* dos columnas también en móvil; los campos de texto largos ocupan las dos */}
      <div class="grid grid-cols-2 gap-x-4 gap-y-3.5 movil:gap-x-2.5">
        <label class={`${campo} col-span-2`}>
          <span class={etiqueta}>Nombre (solo para ti: no sale en la factura)</span>
          <input class={input} value={x.nombre} placeholder="Rebajas de enero" onInput={ev => cambia({ nombre: ev.currentTarget.value })} />
        </label>
        <label class={`${campo} col-span-2`}>
          <span class={etiqueta}>Producto</span>
          <input class={input} list="dl-dto-productos" value={x.producto} placeholder="Todos los productos" onInput={ev => cambia({ producto: ev.currentTarget.value })} />
          {!hayProducto && <small class={aviso}>No está en Productos: no se aplicará a nada.</small>}
        </label>

        <label class={campo}>
          <span class={etiqueta}>Tipo</span>
          <select class={input} value={x.tipo} onChange={ev => cambia({ tipo: ev.currentTarget.value === '€' ? '€' : '%' })}>
            <option value="%">Porcentaje</option>
            <option value="€">Euros por unidad</option>
          </select>
        </label>
        <label class={campo}>
          <span class={etiqueta}>{x.tipo === '%' ? 'Descuento (%)' : 'Descuento (€)'}</span>
          <input class={numero} inputMode="decimal" value={e.valor} onInput={ev => set({ ...e, valor: ev.currentTarget.value })} />
          {!(positivo(e.valor) ?? 0) && <small class={aviso}>Con 0 no descuenta nada.</small>}
        </label>

        <label class={campo}>
          <span class={etiqueta}>Desde</span>
          <input class={input} type="date" value={x.desde} onInput={ev => cambia({ desde: ev.currentTarget.value })} />
        </label>
        <label class={campo}>
          <span class={etiqueta}>Hasta (incluido)</span>
          <input class={input} type="date" value={x.hasta} onInput={ev => cambia({ hasta: ev.currentTarget.value })} />
          {x.desde && x.hasta && x.hasta < x.desde && <small class={aviso}>Acaba antes de empezar.</small>}
        </label>

        <label class={campo}>
          <span class={etiqueta}>Límite de usos</span>
          <input class={numero} inputMode="numeric" value={e.maxUsos} placeholder="Sin límite" onInput={ev => set({ ...e, maxUsos: ev.currentTarget.value })} />
          <small class="text-[11.5px] text-muted">Una factura = un uso</small>
        </label>
        <label class={campo}>
          <span class={etiqueta}>Cantidad mínima</span>
          <input class={numero} inputMode="decimal" value={e.minCantidad} placeholder="Cualquiera" onInput={ev => set({ ...e, minCantidad: ev.currentTarget.value })} />
        </label>

        <label class={`${campo} col-span-2`}>
          <span class={etiqueta}>Solo para el cliente</span>
          <input class={input} list="dl-dto-clientes" value={x.cliente} placeholder="Cualquier cliente" onInput={ev => cambia({ cliente: ev.currentTarget.value })} />
          {!hayCliente && <small class={aviso}>No está en Clientes: no se aplicará a nadie.</small>}
        </label>

        <label class="col-span-2 flex cursor-pointer items-center gap-2 font-semibold">
          <input type="checkbox" class="size-4 accent-ink" checked={x.activo} onChange={ev => cambia({ activo: ev.currentTarget.checked })} />
          Activado
          <span class="font-normal text-muted">· desmárcalo para pausarlo sin borrarlo</span>
        </label>
      </div>

      {usos > 0 && <p class="mt-4 text-xs text-muted">Usado en {usos} {usos === 1 ? 'factura' : 'facturas'}: {x.facturas.join(', ')}</p>}
    </ModalFormulario>
  );
}
