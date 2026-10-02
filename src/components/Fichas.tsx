// src/components/Fichas.tsx
// Listado de fichas (clientes, productos): cada fila enseña el nombre y un resumen, y se edita en un modal.
import { useState } from 'preact/hooks';
import { eur, norm, parseNum } from '../lib/format.ts';
import { ModalFormulario } from './ModalFormulario.tsx';
import { btn, campo, empty, etiqueta, filtro, filtros, h2, icon, input, lista, listaFila, muted, panel, panelHead } from './ui.ts';

export interface Columna<T> {
  key: keyof T & string;
  label: string;
  tipo?: 'texto' | 'dinero';
}

interface Props<T> {
  titulo: string;
  /** para los títulos del modal: «Nuevo cliente», «Editar cliente» */
  singular: string;
  ayuda: string;
  /** la primera columna es el nombre: se muestra en el listado y es obligatoria */
  columnas: Columna<T>[];
  filas: T[];
  nueva(): T;
  capacidad: number;
  onChange(filas: T[]): void;
}

/** Ficha abierta en el modal: `i` es su posición en `filas`, o -1 si es nueva. Los campos se editan como texto. */
interface Edicion {
  i: number;
  campos: Record<string, string>;
}

export function Fichas<T extends Record<string, unknown>>({ titulo, singular, ayuda, columnas, filas, nueva, capacidad, onChange }: Props<T>) {
  const [q, setQ] = useState('');
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [nombre, ...resto] = columnas;

  const visibles = filas.map((f, i) => ({ f, i })).filter(({ f }) =>
    !q || norm(columnas.map(c => String(f[c.key] ?? '')).join(' ')).includes(norm(q)));

  const mostrar = (f: T, c: Columna<T>): string => {
    const v = f[c.key];
    return c.tipo === 'dinero' ? (typeof v === 'number' ? eur(v) : '') : String(v ?? '').trim();
  };

  function abrir(i: number) {
    const f = i < 0 ? nueva() : filas[i];
    const texto = (c: Columna<T>): string => {
      const v = String(f[c.key] ?? '');
      return c.tipo === 'dinero' ? v.replace('.', ',') : v;
    };
    setEdicion({ i, campos: Object.fromEntries(columnas.map(c => [c.key, texto(c)])) });
  }

  function aceptar() {
    if (!edicion) return;
    const valores = Object.fromEntries(columnas.map(c =>
      [c.key, c.tipo === 'dinero' ? parseNum(edicion.campos[c.key]) : edicion.campos[c.key].trim()]));
    const ficha = { ...(edicion.i < 0 ? nueva() : filas[edicion.i]), ...valores } as T;
    onChange(edicion.i < 0 ? [...filas, ficha] : filas.map((f, j) => (j === edicion.i ? ficha : f)));
    setEdicion(null);
    setQ('');
  }

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>{titulo}</h2>
          <p class={muted}>{ayuda} · {filas.length} de {capacidad}</p>
        </div>
        <div class={filtros}>
          <input class={filtro} type="search" placeholder="Buscar…" value={q} onInput={e => setQ(e.currentTarget.value)} />
          <button class={btn()} disabled={filas.length >= capacidad} onClick={() => abrir(-1)}>Añadir</button>
        </div>
      </div>

      {visibles.length > 0 && (
        <ul class={lista}>
          {visibles.map(({ f, i }) => {
            const resumen = resto.map(c => mostrar(f, c)).filter(Boolean).join(' · ');
            return (
              <li key={i} class={listaFila}>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold">{mostrar(f, nombre) || 'Sin nombre'}</p>
                  {resumen && <p class="truncate text-xs text-muted">{resumen}</p>}
                </div>
                <button class={btn('ghost', 'small')} onClick={() => abrir(i)}>Editar</button>
                <button class={icon} title="Eliminar" onClick={() => {
                  if (confirm(`¿Eliminar «${mostrar(f, nombre) || 'esta ficha'}»?`)) onChange(filas.filter((_, j) => j !== i));
                }}>×</button>
              </li>
            );
          })}
        </ul>
      )}
      {filas.length === 0 && <p class={empty}>Vacío. Pulsa «Añadir».</p>}
      {filas.length > 0 && visibles.length === 0 && <p class={empty}>Nada coincide con la búsqueda.</p>}

      {edicion && (
        <ModalFormulario titulo={`${edicion.i < 0 ? 'Nuevo' : 'Editar'} ${singular}`} valido={!!edicion.campos[nombre.key].trim()}
          onAceptar={aceptar} onCancelar={() => setEdicion(null)}>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3.5 movil:grid-cols-1">
            {columnas.map((c, n) => (
              <label key={c.key} class={`${campo} ${n === 0 ? 'col-span-2 movil:col-auto' : ''}`}>
                <span class={etiqueta}>{c.label}</span>
                <input class={`${input} ${c.tipo === 'dinero' ? 'text-right tabular-nums' : ''}`}
                  inputMode={c.tipo === 'dinero' ? 'decimal' : undefined} value={edicion.campos[c.key]}
                  onInput={e => setEdicion({ ...edicion, campos: { ...edicion.campos, [c.key]: e.currentTarget.value } })} />
              </label>
            ))}
          </div>
        </ModalFormulario>
      )}
    </section>
  );
}
