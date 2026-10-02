// src/components/Selector.tsx
// Desplegable propio (no el <select> del sistema): un botón con el valor y una lista que se abre debajo.
import { useEffect, useRef, useState } from 'preact/hooks';
import { norm } from '../lib/format.ts';
import { input } from './ui.ts';

type Opcion = { valor: string; texto: string };

interface Props {
  valor: string;
  /** textos, o pares valor/texto si lo que se guarda no es lo que se muestra */
  opciones: (string | Opcion)[];
  /** texto de la opción vacía; si no se da, no hay opción vacía */
  vacio?: string;
  onChange(valor: string): void;
  /** clases del botón; por defecto, las de un campo de formulario */
  clase?: string;
}

/** Dónde se pinta la lista: va con `position: fixed` para que no la recorte ningún contenedor con scroll. */
type Lugar = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

// a partir de este número de opciones la lista lleva buscador
const CON_BUSCADOR = 8;

/**
 * Si el valor actual no está entre las opciones (un producto que ya se borró, una forma de pago
 * escrita a mano en la hoja) se añade como opción, para no cambiarlo sin querer.
 */
export function Selector({ valor, opciones, vacio, onChange, clase = input }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [lugar, setLugar] = useState<Lugar | null>(null);
  const [activa, setActiva] = useState(0);
  const [q, setQ] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);

  const dadas = opciones.map((o): Opcion => (typeof o === 'string' ? { valor: o, texto: o } : o));
  const todas: Opcion[] = [
    ...(vacio !== undefined ? [{ valor: '', texto: vacio }] : []),
    ...(valor && !dadas.some(o => o.valor === valor) ? [{ valor, texto: valor }] : []),
    ...dadas,
  ];
  const conBuscador = todas.length > CON_BUSCADOR;
  const visibles = q ? todas.filter(o => norm(o.texto).includes(norm(q))) : todas;
  const actual = todas.find(o => o.valor === valor);

  function colocar() {
    const r = boton.current?.getBoundingClientRect();
    if (!r) return;
    const abajo = window.innerHeight - r.bottom - 12;
    const arriba = r.top - 12;
    const haciaArriba = abajo < 220 && arriba > abajo;
    const width = Math.max(r.width, 180);
    setLugar({
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), width,
      ...(haciaArriba ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
      maxHeight: Math.min(320, haciaArriba ? arriba : abajo),
    });
  }

  function abrir() {
    colocar();
    setQ('');
    setActiva(Math.max(0, todas.findIndex(o => o.valor === valor)));
    setAbierto(true);
    // el teclado se atiende desde aquí dentro: hay navegadores que no enfocan un botón al pulsarlo
    boton.current?.focus();
  }

  function cerrar() {
    setAbierto(false);
    boton.current?.focus();
  }

  function elegir(o: Opcion) {
    if (o.valor !== valor) onChange(o.valor);
    cerrar();
  }

  useEffect(() => {
    if (!abierto) return;
    buscador.current?.focus();
    const dentro = (el: HTMLElement | null, e: Event) => e.target instanceof Node && !!el?.contains(e.target);
    const fuera = (e: Event) => { if (!dentro(raiz.current, e)) setAbierto(false); };
    // si la página se mueve (scroll, teclado del móvil), la lista sigue a su botón
    const mover = (e: Event) => { if (!dentro(panel.current, e)) colocar(); };
    document.addEventListener('pointerdown', fuera);
    window.addEventListener('scroll', mover, true);
    window.addEventListener('resize', mover);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      window.removeEventListener('scroll', mover, true);
      window.removeEventListener('resize', mover);
    };
  }, [abierto]);

  useEffect(() => { panel.current?.querySelector('[data-activa]')?.scrollIntoView({ block: 'nearest' }); }, [activa, abierto]);

  function tecla(e: KeyboardEvent) {
    if (!abierto) {
      if (e.target === boton.current && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); abrir(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar(); } // que no cierre también el modal
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActiva(a => Math.min(visibles.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiva(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (visibles[activa]) elegir(visibles[activa]); }
    else if (e.key === 'Tab') setAbierto(false);
  }

  return (
    // `contents`: en la maquetación solo cuenta el botón
    <div ref={raiz} class="contents" onKeyDown={tecla}>
      <button ref={boton} type="button" class={`${clase} flex cursor-pointer items-center justify-between gap-2 text-left`}
        aria-haspopup="listbox" aria-expanded={abierto} onClick={() => (abierto ? cerrar() : abrir())}>
        <span class={`min-w-0 truncate ${actual?.valor ? '' : 'text-muted'}`}>{actual?.texto ?? vacio ?? ''}</span>
        <svg class={`size-4 shrink-0 text-muted transition-transform ${abierto ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>

      {abierto && lugar && (
        // dentro de un <label>, un clic en la lista activaría otra vez el botón: preventDefault lo evita
        <div ref={panel} style={lugar} onClick={e => e.preventDefault()}
          class="fixed z-70 flex flex-col rounded-xl border border-line bg-paper p-1.5 text-sm font-normal tracking-normal text-ink normal-case shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] movil:text-base">
          {conBuscador && (
            <input ref={buscador} class="mb-1.5 w-full rounded-lg border border-transparent bg-field px-2.75 py-2 outline-none focus:border-ink focus:bg-white"
              placeholder="Buscar…" aria-label="Buscar" value={q} onInput={e => { setQ(e.currentTarget.value); setActiva(0); }} />
          )}
          <div role="listbox" class="overflow-y-auto">
            {visibles.map((o, n) => (
              <button key={n} type="button" role="option" aria-selected={o.valor === valor} data-activa={n === activa ? '' : undefined}
                class={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left ${n === activa ? 'bg-field' : ''} ${o.valor === valor ? 'font-semibold' : ''} ${o.valor ? '' : 'text-muted'}`}
                onMouseMove={() => setActiva(n)} onClick={() => elegir(o)}>
                <span class="min-w-0 truncate">{o.texto}</span>
                {o.valor === valor && <span aria-hidden="true">✓</span>}
              </button>
            ))}
            {visibles.length === 0 && <p class="px-3 py-2 text-muted">Sin resultados</p>}
          </div>
        </div>
      )}
    </div>
  );
}
