// src/lib/registro.ts
// Mapea el registro de ventas (.ods) a objetos y de vuelta. La estructura es la del libro generado:
// cabecera de tabla en la fila 5, datos desde la fila 6, columna B en adelante.
import { OdsDate, OdsDocument, type CellValue, type OdsSheet } from './ods.ts';
import { eur, norm, numero } from './format.ts';

export interface Tienda {
  nombre: string;
  razon: string;
  nif: string;
  calle: string;
  cp: string;
  ciudad: string;
  prov: string;
  tel: string;
  email: string;
  web: string;
  iban: string;
  titular: string;
  pago: string;
  dias: number;
  iva: number;
  irpf: number;
  serie: string;
  sig: number;
  gracias: string;
}

export interface Cliente {
  nombre: string;
  nif: string;
  direccion: string;
  cp: string;
  ciudad: string;
  provincia: string;
  email: string;
  telefono: string;
}

export interface Producto {
  nombre: string;
  precio: number | null;
  notas: string;
}

export interface Venta {
  num: string;
  fecha: string; // YYYY-MM-DD
  vencimiento: string;
  cliente: string;
  nif: string;
  pago: string;
  base: number;
  ivaPct: number;
  iva: number;
  /** La web ya no aplica IRPF: en las ventas nuevas es 0. Se conserva por las facturas antiguas. */
  irpfPct: number;
  irpf: number;
  total: number;
  pdf: string;
  /** gastos de envío, sin IVA; van incluidos en `base` */
  envio?: number;
}

export interface Linea {
  num: string;
  fecha: string;
  cliente: string;
  producto: string;
  cantidad: number;
  /** precio por unidad ya con el descuento aplicado, si lo hay */
  precio: number;
  importe: number;
  /** descuento aplicado: «Rebajas (−10 %)». En la factura solo sale la rebaja, sin el nombre. */
  descuento?: string;
  /** precio por unidad antes del descuento */
  precioBase?: number | null;
}

export interface Descuento {
  nombre: string;
  /** vacío = todos los productos */
  producto: string;
  tipo: '%' | '€';
  /** porcentaje (10 = 10 %) o euros por unidad, según `tipo` */
  valor: number;
  /** YYYY-MM-DD, ambos incluidos; vacío = sin límite */
  desde: string;
  hasta: string;
  /** en cuántas facturas se puede usar; null = sin límite */
  maxUsos: number | null;
  minCantidad: number | null;
  /** vacío = cualquier cliente */
  cliente: string;
  activo: boolean;
  /** facturas en las que se ha aplicado: su número es el de usos */
  facturas: string[];
}

export interface Datos {
  tienda: Tienda;
  clientes: Cliente[];
  productos: Producto[];
  ventas: Venta[];
  lineas: Linea[];
  descuentos: Descuento[];
}

export const HOJAS = { ventas: 'Ventas', detalle: 'Detalle ventas', clientes: 'Clientes', productos: 'Productos', tienda: 'Tienda' } as const;
// La hoja de descuentos es opcional: los registros hechos antes de que existiera no la tienen,
// y se crea al guardar el primer descuento.
const HOJA_DESCUENTOS = 'Descuentos';
const DESCUENTO_COLS = ['NOMBRE', 'PRODUCTO', 'TIPO', 'VALOR', 'DESDE', 'HASTA', 'LÍMITE DE USOS', 'CANT. MÍNIMA', 'CLIENTE', 'ACTIVO', 'USADO EN'];
const TOP = 6;
const CAP = { clientes: 300, productos: 300, ventas: 1000, lineas: 3000, descuentos: 200 } as const;

const TIENDA_LABELS: Record<string, keyof Tienda> = {
  'NOMBRE COMERCIAL': 'nombre',
  'RAZÓN SOCIAL / TITULAR': 'razon',
  'NIF / CIF': 'nif',
  'CALLE Y NÚMERO': 'calle',
  'CÓDIGO POSTAL': 'cp',
  CIUDAD: 'ciudad',
  PROVINCIA: 'prov',
  'TELÉFONO': 'tel',
  EMAIL: 'email',
  WEB: 'web',
  IBAN: 'iban',
  'TITULAR DE LA CUENTA': 'titular',
  'FORMA DE PAGO HABITUAL': 'pago',
  'DÍAS HASTA VENCIMIENTO': 'dias',
  'IVA POR DEFECTO': 'iva',
  'RETENCIÓN IRPF POR DEFECTO': 'irpf',
  'SERIE (PREFIJO)': 'serie',
  'SIGUIENTE NÚMERO': 'sig',
  'MENSAJE FINAL': 'gracias',
};
const TIENDA_NUM: ReadonlyArray<keyof Tienda> = ['dias', 'iva', 'irpf', 'sig'];

const str = (v: CellValue): string => (v === null ? '' : v instanceof OdsDate ? v.iso : String(v)).trim();
const num = (v: CellValue): number => (typeof v === 'number' ? v : Number(str(v).replace(',', '.')) || 0);
const numOrNull = (v: CellValue): number | null => (v === null || str(v) === '' ? null : num(v));
const date = (v: CellValue): string => (v instanceof OdsDate ? v.iso : str(v));
const d = (iso: string): CellValue => (iso ? new OdsDate(iso) : null);

const filled = (r: CellValue[]): boolean => r.some(v => v !== null && str(v) !== '');

/** Filas con datos y hasta qué fila (relativa) llega la zona ocupada, por si hay huecos. */
function rowsOf(sh: OdsSheet, nCols: number, cap: number): { rows: CellValue[][]; span: number } {
  const all = sh.readRows(TOP, 2, nCols, cap);
  let span = 0;
  all.forEach((r, i) => { if (filled(r)) span = i + 1; });
  return { rows: all.filter(filled), span };
}

/** Escribe `data` en la zona de la tabla y vacía el resto hasta `clearUntil` filas. */
function writeTable(sh: OdsSheet, rows: CellValue[][], nCols: number, clearUntil: number, cap: number): void {
  if (rows.length > cap) throw new Error(`La hoja «${sh.name}» admite ${cap} filas como máximo`);
  const out = rows.map(r => r.slice(0, nCols));
  const empty: CellValue[] = Array(nCols).fill(null);
  while (out.length < Math.min(Math.max(clearUntil, rows.length), cap)) out.push(empty);
  sh.writeRows(TOP, 2, out);
}

export interface Registro {
  ods: OdsDocument;
  /** última fila ocupada de cada tabla, para vaciar sobrantes al guardar */
  counts: Record<keyof typeof CAP, number>;
}

export async function abrir(bytes: ArrayBuffer | Uint8Array): Promise<{ registro: Registro; datos: Datos }> {
  const ods = await OdsDocument.open(bytes);
  const names = ods.sheetNames();
  const falta = Object.values(HOJAS).filter(h => !names.includes(h));
  if (falta.length) throw new Error(`No es un registro de ventas de Celestina: faltan las hojas ${falta.join(', ')}`);

  const tienda = {} as Record<keyof Tienda, string | number>;
  for (const k of Object.values(TIENDA_LABELS)) tienda[k] = TIENDA_NUM.includes(k) ? 0 : '';
  const tSheet = ods.sheet(HOJAS.tienda);
  for (const [label, value] of tSheet.readRows(1, 2, 2, 80)) {
    const key = TIENDA_LABELS[str(label).toUpperCase()];
    if (key) tienda[key] = TIENDA_NUM.includes(key) ? num(value) : str(value);
  }

  const rc = rowsOf(ods.sheet(HOJAS.clientes), 8, CAP.clientes);
  const clientes = rc.rows.map(
    ([nombre, nif, direccion, cp, ciudad, provincia, email, telefono]): Cliente => ({
      nombre: str(nombre), nif: str(nif), direccion: str(direccion), cp: str(cp),
      ciudad: str(ciudad), provincia: str(provincia), email: str(email), telefono: str(telefono),
    }));
  const rp = rowsOf(ods.sheet(HOJAS.productos), 3, CAP.productos);
  const productos = rp.rows.map(
    ([nombre, precio, notas]): Producto => ({ nombre: str(nombre), precio: numOrNull(precio), notas: str(notas) }));
  // la última columna (gastos de envío) la añade la web; puede no estar
  const rv = rowsOf(ods.sheet(HOJAS.ventas), 14, CAP.ventas);
  const ventas = rv.rows.map(
    (r): Venta => ({
      num: str(r[0]), fecha: date(r[1]), vencimiento: date(r[2]), cliente: str(r[3]), nif: str(r[4]), pago: str(r[5]),
      base: num(r[6]), ivaPct: num(r[7]), iva: num(r[8]), irpfPct: num(r[9]), irpf: num(r[10]), total: num(r[11]), pdf: str(r[12]), envio: num(r[13]),
    }));
  // las dos últimas columnas (descuento y precio sin descuento) las añade la web; pueden no estar
  const rl = rowsOf(ods.sheet(HOJAS.detalle), 9, CAP.lineas);
  const lineas = rl.rows.map(
    (r): Linea => ({
      num: str(r[0]), fecha: date(r[1]), cliente: str(r[2]), producto: str(r[3]),
      cantidad: num(r[4]), precio: num(r[5]), importe: num(r[6]), descuento: str(r[7]), precioBase: numOrNull(r[8]),
    }));
  const rd = names.includes(HOJA_DESCUENTOS) ? rowsOf(ods.sheet(HOJA_DESCUENTOS), 11, CAP.descuentos) : { rows: [], span: 0 };
  const descuentos = rd.rows.map(
    (r): Descuento => ({
      nombre: str(r[0]), producto: str(r[1]), tipo: str(r[2]) === '€' ? '€' : '%', valor: num(r[3]),
      desde: date(r[4]), hasta: date(r[5]), maxUsos: numOrNull(r[6]), minCantidad: numOrNull(r[7]), cliente: str(r[8]),
      activo: r[9] !== false && norm(str(r[9])) !== 'no',
      facturas: str(r[10]).split(',').map(f => f.trim()).filter(Boolean),
    }));

  return {
    registro: {
      ods,
      counts: { clientes: rc.span, productos: rp.span, ventas: rv.span, lineas: rl.span, descuentos: rd.span },
    },
    datos: { tienda: tienda as unknown as Tienda, clientes, productos, ventas, lineas, descuentos },
  };
}

export async function guardar(registro: Registro, datos: Datos): Promise<Uint8Array> {
  const { ods, counts } = registro;
  ods.invalidateFormulas();

  const tSheet = ods.sheet(HOJAS.tienda);
  tSheet.readRows(1, 2, 1, 80).forEach(([label], i) => {
    const key = TIENDA_LABELS[str(label).toUpperCase()];
    if (key) {
      const v = datos.tienda[key];
      tSheet.write(i + 1, 3, typeof v === 'number' ? v : v === '' ? null : v);
    }
  });

  writeTable(ods.sheet(HOJAS.clientes), datos.clientes.map(c =>
    [c.nombre, c.nif, c.direccion, c.cp, c.ciudad, c.provincia, c.email, c.telefono]), 8, counts.clientes, CAP.clientes);
  writeTable(ods.sheet(HOJAS.productos), datos.productos.map(p =>
    [p.nombre, p.precio, p.notas]), 3, counts.productos, CAP.productos);
  const veSheet = ods.sheet(HOJAS.ventas);
  writeTable(veSheet, datos.ventas.map(v =>
    [v.num, d(v.fecha), d(v.vencimiento), v.cliente, v.nif, v.pago, v.base, v.ivaPct, v.iva, v.irpfPct, v.irpf, v.total, v.pdf, v.envio || null]),
  14, counts.ventas, CAP.ventas);
  if (datos.ventas.some(v => v.envio) && veSheet.read(5, 15) === null) {
    veSheet.write(5, 15, 'GASTOS DE ENVÍO');
    veSheet.setStyle(5, 15, veSheet.styleOf(5, 14));
  }
  const dSheet = ods.sheet(HOJAS.detalle);
  writeTable(dSheet, datos.lineas.map(l =>
    [l.num, d(l.fecha), l.cliente, l.producto, l.cantidad, l.precio, l.importe, l.descuento ?? null, l.precioBase ?? null]), 9, counts.lineas, CAP.lineas);
  if (datos.lineas.some(l => l.descuento) && dSheet.read(5, 9) === null) {
    dSheet.writeRows(5, 9, [['DESCUENTO', 'PRECIO SIN DTO.']]);
    dSheet.setStyle(5, 9, dSheet.styleOf(5, 8));
    dSheet.setStyle(5, 10, dSheet.styleOf(5, 8));
  }

  const hayHoja = ods.sheetNames().includes(HOJA_DESCUENTOS);
  if (hayHoja || datos.descuentos.length) {
    writeTable(hayHoja ? ods.sheet(HOJA_DESCUENTOS) : crearHojaDescuentos(ods), datos.descuentos.map(x =>
      [x.nombre, x.producto, x.tipo, x.valor, d(x.desde), d(x.hasta), x.maxUsos, x.minCantidad, x.cliente, x.activo ? 'Sí' : 'No', x.facturas.join(', ')]),
    11, counts.descuentos, CAP.descuentos);
  }

  // resumen de Ventas (J3, L3, M3): LibreOffice no siempre recalcula los rangos al abrir
  const vSheet = ods.sheet(HOJAS.ventas);
  vSheet.setFormulaResult(3, 10, datos.ventas.length);
  vSheet.setFormulaResult(3, 12, round2(datos.ventas.reduce((s, v) => s + v.base, 0)));
  vSheet.setFormulaResult(3, 13, round2(datos.ventas.reduce((s, v) => s + v.total, 0)));

  const bytes = await ods.toBytes();
  registro.counts = {
    clientes: datos.clientes.length, productos: datos.productos.length,
    ventas: datos.ventas.length, lineas: datos.lineas.length, descuentos: datos.descuentos.length,
  };
  return bytes;
}

/** Hoja «Descuentos» con el mismo esquema que las demás: título en B2, cabecera en la fila 5. */
export function crearHojaDescuentos(ods: OdsDocument): OdsSheet {
  const sh = ods.addSheet(HOJA_DESCUENTOS, DESCUENTO_COLS.length + 1);
  sh.write(2, 2, 'DESCUENTOS');
  sh.write(3, 2, 'Un descuento por fila. Se gestionan desde la web; «USADO EN» lleva las facturas en las que se aplicó.');
  sh.writeRows(5, 2, [DESCUENTO_COLS]);
  const ref = ods.sheet(HOJAS.productos);
  sh.setStyle(2, 2, ref.styleOf(2, 2));
  DESCUENTO_COLS.forEach((_, i) => sh.setStyle(5, 2 + i, ref.styleOf(5, 2)));
  return sh;
}

// ---------------------------------------------------------------- cálculos

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export function numeroFactura(t: Tienda): string {
  return `${t.serie}${String(Math.max(1, Math.trunc(t.sig))).padStart(3, '0')}`;
}

export function sumarDias(iso: string, dias: number): string {
  const [y, m, dd] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd + Math.trunc(dias)));
  return dt.toISOString().slice(0, 10);
}

export function hoy(): string {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())).toISOString().slice(0, 10);
}

export interface Totales {
  base: number;
  iva: number;
  total: number;
}

/** Los gastos de envío entran en la base imponible: llevan el mismo IVA que los productos. */
export function totales(lineas: ReadonlyArray<{ importe: number }>, ivaPct: number, envio = 0): Totales {
  const base = round2(lineas.reduce((s, l) => s + l.importe, 0) + envio);
  const iva = round2(base * ivaPct);
  return { base, iva, total: round2(base + iva) };
}

// ---------------------------------------------------------------- descuentos

export type EstadoDescuento = 'activo' | 'pausado' | 'agotado' | 'caducado' | 'programado';

/** Estado de un descuento en una fecha (YYYY-MM-DD). Solo «activo» se aplica. */
export function estadoDescuento(x: Descuento, fecha: string): EstadoDescuento {
  if (!x.activo) return 'pausado';
  if (x.maxUsos !== null && x.facturas.length >= x.maxUsos) return 'agotado';
  if (x.hasta && fecha > x.hasta) return 'caducado';
  if (x.desde && fecha < x.desde) return 'programado';
  return 'activo';
}

export const etiquetaDescuento = (x: Descuento): string =>
  `${x.nombre || 'Descuento'} (−${x.tipo === '%' ? `${numero(x.valor)} %` : eur(x.valor)})`;

/** Solo la rebaja de una etiqueta («−10 %»), sin el nombre del descuento: es lo que sale en la factura. */
export const rebajaDeEtiqueta = (etiqueta: string): string => etiqueta.match(/\(([^()]*)\)\s*$/)?.[1] ?? '';

export interface DescuentoAplicado {
  /** posición en `Datos.descuentos` */
  indice: number;
  etiqueta: string;
  /** precio por unidad con el descuento */
  precio: number;
}

/** El descuento aplicable que deja el precio más bajo para una línea de venta, o null. */
export function mejorDescuento(
  descuentos: ReadonlyArray<Descuento>,
  l: { producto: string; cantidad: number; precio: number; cliente: string; fecha: string },
): DescuentoAplicado | null {
  let mejor: DescuentoAplicado | null = null;
  for (const [indice, x] of descuentos.entries()) {
    if (x.valor <= 0 || estadoDescuento(x, l.fecha) !== 'activo') continue;
    if (x.producto && norm(x.producto) !== norm(l.producto)) continue;
    if (x.cliente && norm(x.cliente) !== norm(l.cliente)) continue;
    if (l.cantidad < (x.minCantidad ?? 0)) continue;
    const precio = Math.max(0, round2(x.tipo === '%' ? l.precio * (1 - x.valor / 100) : l.precio - x.valor));
    if (precio < l.precio && (!mejor || precio < mejor.precio)) mejor = { indice, etiqueta: etiquetaDescuento(x), precio };
  }
  return mejor;
}
