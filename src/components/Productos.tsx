// src/components/Productos.tsx
// Listado de productos: cada fila enseña el nombre, el precio y sus variedades, y se edita en un modal.
import { useState } from 'preact/hooks';
import type { Producto, Variedad } from '../lib/registro.ts';
import { eur, norm, parseNum } from '../lib/format.ts';
import { ModalFormulario } from './ModalFormulario.tsx';
import { btn, campo, empty, etiqueta, filtro, filtros, h2, icon, input, lista, listaFila, muted, panel, panelHead } from './ui.ts';

const CAPACIDAD = 300;

const numero = `${input} text-right tabular-nums`;
// nombre, precio y quitar
const filaVariedad = 'grid grid-cols-[1fr_7.5rem_auto] items-center gap-2 movil:grid-cols-[1fr_5.5rem_auto]';

/** Producto abierto en el modal: `i` es su posición, o -1 si es nuevo. Los precios se editan como texto. */
interface Edicion {
  i: number;
  nombre: string;
  precio: string;
  notas: string;
  variedades: VariedadEd[];
}
interface SubEd { nombre: string; precio: string }
interface VariedadEd extends SubEd { subvariedades: SubEd[] }

const texto = (n: number | null): string => (n === null ? '' : String(n).replace('.', ','));

const conPrecio = (x: { nombre: string; precio: number | null }): string => (x.precio === null ? x.nombre : `${x.nombre} (${eur(x.precio)})`);
// «Verde: XL / L, Rojo (12,50 €): M / S»
const variedadTexto = (v: Variedad): string =>
  conPrecio(v) + (v.subvariedades.length ? `: ${v.subvariedades.map(conPrecio).join(' / ')}` : '');

function resumen(p: Producto): string {
  const variedades = p.variedades.map(variedadTexto).join(', ');
  return [p.precio === null ? '' : eur(p.precio), variedades, p.notas].filter(Boolean).join(' · ');
}

interface Props {
  productos: Producto[];
  onChange(productos: Producto[]): void;
}

export function Productos({ productos, onChange }: Props) {
  const [q, setQ] = useState('');
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const visibles = productos.map((p, i) => ({ p, i })).filter(({ p }) =>
    !q || norm(`${p.nombre} ${p.notas} ${p.variedades.map(v => `${v.nombre} ${v.subvariedades.map(s => s.nombre).join(' ')}`).join(' ')}`).includes(norm(q)));

  function abrir(i: number) {
    const p: Producto = i < 0 ? { nombre: '', precio: null, notas: '', variedades: [] } : productos[i];
    setEdicion({ i, nombre: p.nombre, precio: texto(p.precio), notas: p.notas, 
      variedades: p.variedades.map(v => ({
        nombre: v.nombre, precio: texto(v.precio), subvariedades: v.subvariedades.map(s => ({ nombre: s.nombre, precio: texto(s.precio) })),
      })),
    });
  }

  function aceptar() {
    if (!edicion) return;
    const p: Producto = {
      nombre: edicion.nombre.trim(), precio: parseNum(edicion.precio), notas: edicion.notas.trim(),
      // las filas sin nombre se descartan
      variedades: edicion.variedades.filter(v => v.nombre.trim()).map(v => ({
        nombre: v.nombre.trim(), precio: parseNum(v.precio),
        subvariedades: v.subvariedades.filter(s => s.nombre.trim()).map(s => ({ nombre: s.nombre.trim(), precio: parseNum(s.precio) })),
      })),
    };
    onChange(edicion.i < 0 ? [...productos, p] : productos.map((x, j) => (j === edicion.i ? p : x)));
    setEdicion(null);
    setQ('');
  }

  const setVariedad = (e: Edicion, n: number, patch: Partial<VariedadEd>) =>
    setEdicion({ ...e, variedades: e.variedades.map((v, j) => (j === n ? { ...v, ...patch } : v)) });
  const setSub = (e: Edicion, n: number, m: number, patch: Partial<SubEd>) =>
    setVariedad(e, n, { subvariedades: e.variedades[n].subvariedades.map((s, j) => (j === m ? { ...s, ...patch } : s)) });

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>Productos</h2>
          <p class={muted}>Precio con IVA incluido · {productos.length} de {CAPACIDAD}</p>
        </div>
        <div class={filtros}>
          <input class={filtro} type="search" placeholder="Buscar…" value={q} onInput={e => setQ(e.currentTarget.value)} />
          <button class={btn()} disabled={productos.length >= CAPACIDAD} onClick={() => abrir(-1)}>Añadir</button>
        </div>
      </div>

      {visibles.length > 0 && (
        <ul class={lista}>
          {visibles.map(({ p, i }) => (
            <li key={i} class={listaFila}>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{p.nombre || 'Sin nombre'}</p>
                {resumen(p) && <p class="truncate text-xs text-muted">{resumen(p)}</p>}
              </div>
              <button class={btn('ghost', 'small')} onClick={() => abrir(i)}>Editar</button>
              <button class={icon} title="Eliminar" onClick={() => {
                if (confirm(`¿Eliminar «${p.nombre || 'este producto'}»?`)) onChange(productos.filter((_, j) => j !== i));
              }}>×</button>
            </li>
          ))}
        </ul>
      )}
      {productos.length === 0 && <p class={empty}>Vacío. Pulsa «Añadir».</p>}
      {productos.length > 0 && visibles.length === 0 && <p class={empty}>Nada coincide con la búsqueda.</p>}

      {edicion && (
        <ModalFormulario titulo={`${edicion.i < 0 ? 'Nuevo' : 'Editar'} producto`} valido={!!edicion.nombre.trim()}
          onAceptar={aceptar} onCancelar={() => setEdicion(null)}>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3.5 movil:grid-cols-1">
            <label class={`${campo} col-span-2 movil:col-auto`}>
              <span class={etiqueta}>Producto / servicio</span>
              <input class={input} value={edicion.nombre} onInput={e => setEdicion({ ...edicion, nombre: e.currentTarget.value })} />
            </label>
            <label class={campo}>
              <span class={etiqueta}>Precio general (IVA incluido)</span>
              <input class={numero} inputMode="decimal" value={edicion.precio} onInput={e => setEdicion({ ...edicion, precio: e.currentTarget.value })} />
            </label>
            <label class={campo}>
              <span class={etiqueta}>Notas</span>
              <input class={input} value={edicion.notas} onInput={e => setEdicion({ ...edicion, notas: e.currentTarget.value })} />
            </label>
          </div>

          <fieldset class="mt-5 border-t border-line pt-4">
            <legend class="float-left mb-1 w-full text-[11px] font-extrabold tracking-[.14em] uppercase">Variedades</legend>
            <p class="clear-both mb-3 text-xs text-muted">Por ejemplo, colores, y dentro de cada color, sus tallas. Deja un precio vacío para usar el de arriba. En la venta se elige una de cada.</p>
            {edicion.variedades.map((v, n) => (
              <div key={n} class="mb-3">
                <div class={filaVariedad}>
                  <input class={input} placeholder="Verde" aria-label="Nombre de la variedad" value={v.nombre} onInput={e => setVariedad(edicion, n, { nombre: e.currentTarget.value })} />
                  <input class={numero} inputMode="decimal" aria-label="Precio de la variedad" placeholder={edicion.precio.trim() || 'Precio'} value={v.precio}
                    onInput={e => setVariedad(edicion, n, { precio: e.currentTarget.value })} />
                  <button type="button" class={icon} title="Quitar variedad" onClick={() => setEdicion({ ...edicion, variedades: edicion.variedades.filter((_, j) => j !== n) })}>×</button>
                </div>
                {/* las variedades de dentro (p. ej. las tallas de este color), con sangría */}
                <div class="mt-2 ml-3 border-l-2 border-line pl-3">
                  {v.subvariedades.map((s, m) => (
                    <div key={m} class={`${filaVariedad} mb-2`}>
                      <input class={input} placeholder="XL" aria-label={`Variedad dentro de ${v.nombre.trim() || 'esta variedad'}`} value={s.nombre} onInput={e => setSub(edicion, n, m, { nombre: e.currentTarget.value })} />
                      <input class={numero} inputMode="decimal" aria-label="Precio" placeholder={v.precio.trim() || edicion.precio.trim() || 'Precio'} value={s.precio}
                        onInput={e => setSub(edicion, n, m, { precio: e.currentTarget.value })} />
                      <button type="button" class={icon} title="Quitar" onClick={() => setVariedad(edicion, n, { subvariedades: v.subvariedades.filter((_, j) => j !== m) })}>×</button>
                    </div>
                  ))}
                  <button type="button" class="cursor-pointer text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink"
                    onClick={() => setVariedad(edicion, n, { subvariedades: [...v.subvariedades, { nombre: '', precio: '' }] })}>
                    + Añadir dentro de {v.nombre.trim() ? `«${v.nombre.trim()}»` : 'esta variedad'}
                  </button>
                </div>
              </div>
            ))}
            <button type="button" class={btn('ghost', 'small')} onClick={() => setEdicion({ ...edicion, variedades: [...edicion.variedades, { nombre: '', precio: '', subvariedades: [] }] })}>
              Añadir variedad
            </button>
          </fieldset>
        </ModalFormulario>
      )}
    </section>
  );
}
