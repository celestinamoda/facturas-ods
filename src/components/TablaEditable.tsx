// src/components/TablaEditable.tsx
import { useState } from 'preact/hooks';
import { eur, norm, parseNum } from '../lib/format.ts';
import { btn, empty, filaMovil, filtro, filtros, h2, icon, input, muted, panel, panelHead, table, tableWrap, tdInput, tdLabel, th, thR } from './ui.ts';

const celda = `${tdInput} group-hover:bg-[#fafafa] movil:group-hover:bg-transparent`;

// Tablas con muchas columnas (`ancha`): pasan a tarjetas ya en tablet, con cuatro campos por fila.
// Son las mismas reglas que `table`, `tdInput`, `tdLabel` y `filaMovil` de ui.ts, con `tablet:`.
const ANCHA = {
  wrap: 'tablet:overflow-visible',
  table: 'tablet:block tablet:[&_tbody]:block tablet:[&_thead]:hidden',
  fila: 'tablet:grid tablet:grid-cols-4 tablet:gap-2 tablet:border-b tablet:border-line tablet:py-3',
  celda: 'tablet:block tablet:border-0 tablet:p-0 tablet:group-hover:bg-transparent',
  label: 'tablet:before:mb-1 tablet:before:block tablet:before:text-[10px] tablet:before:font-bold tablet:before:tracking-[.08em] tablet:before:text-muted tablet:before:uppercase tablet:before:content-[attr(data-label)]',
  primera: 'tablet:col-span-2',
  quitar: 'tablet:col-start-4 tablet:self-end tablet:text-right',
};
const NORMAL: typeof ANCHA = { wrap: '', table: '', fila: '', celda: '', label: '', primera: '', quitar: '' };

export interface Columna<T> {
  key: keyof T & string;
  label: string;
  tipo?: 'texto' | 'dinero';
  ancho?: string;
}

interface Props<T> {
  titulo: string;
  ayuda: string;
  columnas: Columna<T>[];
  filas: T[];
  nueva(): T;
  capacidad: number;
  /** Muchas columnas: usa tarjetas también en tablet, no solo en móvil. */
  ancha?: boolean;
  onChange(filas: T[]): void;
}

export function TablaEditable<T extends Record<string, unknown>>({ titulo, ayuda, columnas, filas, nueva, capacidad, ancha, onChange }: Props<T>) {
  const [q, setQ] = useState('');
  const a = ancha ? ANCHA : NORMAL;
  // Móvil: el primer campo a todo el ancho y el resto de dos en dos. Si no sobra hueco en la última
  // fila para el botón de eliminar, se le da una tercera columna estrecha.
  const m = (columnas.length - 1) % 2
    ? { fila: 'movil:grid-cols-2', primera: 'movil:col-span-2', quitar: 'movil:col-start-2' }
    : { fila: 'movil:grid-cols-[1fr_1fr_auto]', primera: 'movil:col-span-3', quitar: 'movil:col-start-3' };
  const visibles = filas.map((f, i) => ({ f, i })).filter(({ f }) =>
    !q || norm(columnas.map(c => String(f[c.key] ?? '')).join(' ')).includes(norm(q)));

  const set = (i: number, key: keyof T, value: unknown) =>
    onChange(filas.map((f, j) => (j === i ? { ...f, [key]: value } : f)));

  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>{titulo}</h2>
          <p class={muted}>{ayuda} · {filas.length} de {capacidad}</p>
        </div>
        <div class={filtros}>
          <input class={filtro} type="search" placeholder="Buscar…" value={q} onInput={e => setQ(e.currentTarget.value)} />
          <button class={btn()} disabled={filas.length >= capacidad} onClick={() => { setQ(''); onChange([...filas, nueva()]); }}>
            Añadir
          </button>
        </div>
      </div>
      <div class={`${tableWrap} ${a.wrap}`}>
        <table class={`${table} ${a.table}`}>
          <thead>
            <tr>{columnas.map(c => <th key={c.key} class={c.tipo === 'dinero' ? thR : th} style={c.ancho ? { width: c.ancho } : undefined}>{c.label}</th>)}<th class={`${th} w-9`} /></tr>
          </thead>
          <tbody>
            {visibles.map(({ f, i }) => (
              <tr key={i} class={`group ${a.fila} ${filaMovil} ${m.fila}`}>
                {columnas.map((c, n) => (
                  <td key={c.key} data-label={c.label} class={`${celda} ${a.celda} ${a.label} ${tdLabel} ${n === 0 ? `${a.primera} ${m.primera}` : ''}`}>
                    {c.tipo === 'dinero' ? (
                      <input class={`${input} min-w-24 text-right tabular-nums`} inputMode="decimal"
                        value={f[c.key] === null || f[c.key] === undefined ? '' : String(f[c.key]).replace('.', ',')}
                        title={typeof f[c.key] === 'number' ? eur(f[c.key] as number) : ''}
                        onChange={e => set(i, c.key, parseNum(e.currentTarget.value))} />
                    ) : (
                      <input class={`${input} min-w-24`} value={String(f[c.key] ?? '')} onInput={e => set(i, c.key, e.currentTarget.value)} />
                    )}
                  </td>
                ))}
                <td class={`${celda} ${a.celda} ${a.quitar} ${m.quitar} movil:self-end movil:text-right`}>
                  <button class={icon} title="Eliminar" onClick={() => {
                    const nombre = String(f[columnas[0].key] ?? '') || 'esta fila';
                    if (confirm(`¿Eliminar «${nombre}»?`)) onChange(filas.filter((_, j) => j !== i));
                  }}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length === 0 && <p class={empty}>Vacío. Pulsa «Añadir».</p>}
    </section>
  );
}
