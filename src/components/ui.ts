// src/components/ui.ts — clases de Tailwind compartidas entre componentes

const BTN = 'appearance-none border-[1.5px] rounded-full font-semibold tracking-[.01em] whitespace-nowrap cursor-pointer transition enabled:active:translate-y-px disabled:opacity-35 disabled:cursor-default';
const BTN_COLOR = {
  primary: 'border-primary bg-primary text-ink hover:border-primary-dark hover:bg-primary-dark',
  ghost: 'border-ink bg-transparent text-ink hover:bg-primary',
  white: 'border-white bg-white text-ink hover:border-transparent hover:bg-white/70',
  // botón secundario sobre las barras de color primario
  bar: 'border-ink/35 bg-transparent text-ink hover:border-white hover:bg-white',
};
const BTN_SIZE = {
  md: 'px-4 py-2.25',
  big: 'px-5.5 py-3.25 text-[15px]',
  small: 'px-2.75 py-1 text-xs',
};
export const btn = (color: keyof typeof BTN_COLOR = 'primary', size: keyof typeof BTN_SIZE = 'md'): string =>
  `${BTN} ${BTN_COLOR[color]} ${BTN_SIZE[size]}`;

export const iconBase = 'appearance-none border-0 bg-transparent size-7 rounded-full text-lg leading-none cursor-pointer hover:bg-primary hover:text-ink movil:size-9';
export const icon = `${iconBase} text-muted`;

// en móvil los campos van a 16 px: con menos, iOS hace zoom al enfocarlos
export const input = 'w-full border border-transparent bg-field rounded-lg px-2.75 py-2.25 outline-none transition-colors focus:border-ink focus:bg-white movil:text-base';
export const filtro = 'border border-line-2 bg-white rounded-full px-3.5 py-2 min-w-50 outline-none focus:border-ink movil:min-w-0 movil:flex-1 movil:text-base';
export const filtros = 'flex gap-2 items-center flex-wrap movil:w-full';

export const panel = 'bg-paper rounded-[10px] p-6 shadow-[0_1px_0_var(--color-line)] movil:p-4';
export const panelHead = 'flex justify-between items-start gap-4 mb-5 flex-wrap';
export const h2 = 'text-[22px] font-bold tracking-[-.01em]';
export const muted = 'text-muted mt-0.5';
export const empty = 'text-muted text-center pt-9 pb-3';
export const error = 'text-danger font-medium mb-2.5';
export const etiqueta = 'text-[11px] font-bold tracking-[.08em] uppercase text-muted';

export const gridForm = 'grid grid-cols-4 gap-x-4 gap-y-3.5 mb-5.5 tablet:grid-cols-2 movil:grid-cols-1';
export const campo = 'flex flex-col gap-1.25 min-w-0';
export const span2 = 'col-span-2 movil:col-auto';
export const span4 = 'col-span-4 tablet:col-span-2 movil:col-auto';

// Tablas: en móvil dejan de ser tabla. Se oculta la cabecera y cada fila pasa a ser una tarjeta
// (la rejilla de cada tarjeta la pone el componente en su <tr>).
export const tableWrap = 'overflow-x-auto -mx-1 px-1 movil:overflow-visible';
export const table = 'w-full border-collapse movil:block movil:min-w-0 movil:[&_tbody]:block movil:[&_thead]:hidden';
const TH = 'bg-primary text-ink text-[11px] tracking-[.08em] uppercase font-bold px-3 py-2.5 first:rounded-l-lg last:rounded-r-lg';
export const th = `${TH} text-left`;
export const thR = `${TH} text-right`;
const TD = 'border-b border-line align-middle movil:block movil:border-0 movil:p-0';
// celda de solo lectura / celda que contiene un input
export const td = `${TD} px-3 py-1.5 group-hover:bg-[#fafafa] movil:group-hover:bg-transparent`;
export const tdInput = `${TD} px-1 py-1.25 first:pl-0`;
// listado de fichas (clientes, productos, descuentos): nombre y resumen a la izquierda, botones a la derecha
export const lista = 'border-t border-line';
export const listaFila = 'flex items-center gap-3 border-b border-line py-2.5';
// tarjeta de una fila en móvil
export const filaMovil = 'movil:grid movil:gap-2 movil:border-b movil:border-line movil:py-3';
