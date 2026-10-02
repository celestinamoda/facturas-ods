// src/lib/ods.ts
// Lectura/escritura mínima de hojas .ods conservando estilos, fórmulas, macros y botones:
// solo se toca content.xml, celda a celda.
import JSZip from 'jszip';

const NS = {
  office: 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
  table: 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
  text: 'urn:oasis:names:tc:opendocument:xmlns:text:1.0',
  calcext: 'urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0',
} as const;

const MIME = 'application/vnd.oasis.opendocument.spreadsheet';

export class OdsDate {
  readonly iso: string;
  constructor(iso: string) {
    this.iso = iso.slice(0, 10);
  }
}

export type CellValue = string | number | boolean | OdsDate | null;

const VALUE_ATTRS: ReadonlyArray<[string, string]> = [
  [NS.office, 'value-type'],
  [NS.office, 'value'],
  [NS.office, 'date-value'],
  [NS.office, 'time-value'],
  [NS.office, 'string-value'],
  [NS.office, 'boolean-value'],
  [NS.office, 'currency'],
  [NS.calcext, 'value-type'],
];

function elements(parent: Node): Element[] {
  const out: Element[] = [];
  for (let n = parent.firstChild; n; n = n.nextSibling) if (n.nodeType === 1) out.push(n as Element);
  return out;
}

function repeat(el: Element, attr: 'number-rows-repeated' | 'number-columns-repeated'): number {
  const v = el.getAttributeNS(NS.table, attr);
  return v ? Math.max(1, parseInt(v, 10)) : 1;
}

function setRepeat(el: Element, attr: 'number-rows-repeated' | 'number-columns-repeated', n: number): void {
  if (n > 1) el.setAttributeNS(NS.table, `table:${attr}`, String(n));
  else el.removeAttributeNS(NS.table, attr);
}

/** Parte un nodo repetido para que el índice `k` (relativo a `start`) quede como nodo propio. */
function isolate(el: Element, start: number, k: number, attr: 'number-rows-repeated' | 'number-columns-repeated'): Element {
  const count = repeat(el, attr);
  if (count === 1) return el;
  const before = k - start;
  const after = count - before - 1;
  const parent = el.parentNode!;
  if (before > 0) {
    const b = el.cloneNode(true) as Element;
    setRepeat(b, attr, before);
    parent.insertBefore(b, el);
  }
  if (after > 0) {
    const a = el.cloneNode(true) as Element;
    setRepeat(a, attr, after);
    parent.insertBefore(a, el.nextSibling);
  }
  setRepeat(el, attr, 1);
  return el;
}

function textOf(node: Node): string {
  let s = '';
  for (let n = node.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 3) s += n.nodeValue ?? '';
    else if (n.nodeType === 1) {
      const e = n as Element;
      if (e.namespaceURI === NS.text && e.localName === 's') s += ' '.repeat(parseInt(e.getAttributeNS(NS.text, 'c') || '1', 10));
      else if (e.namespaceURI === NS.text && e.localName === 'tab') s += '\t';
      else if (e.namespaceURI === NS.text && e.localName === 'line-break') s += '\n';
      else s += textOf(e);
    }
  }
  return s;
}

function isCell(e: Element): boolean {
  return e.namespaceURI === NS.table && (e.localName === 'table-cell' || e.localName === 'covered-table-cell');
}

interface RowEntry {
  el: Element;
  start: number;
  count: number;
}

export class OdsSheet {
  readonly name: string;
  private readonly dom: Document;
  private readonly table: Element;
  private index: RowEntry[] | null = null;

  constructor(dom: Document, table: Element) {
    this.dom = dom;
    this.table = table;
    this.name = table.getAttributeNS(NS.table, 'name') ?? '';
  }

  private rowIndex(): RowEntry[] {
    if (this.index) return this.index;
    const out: RowEntry[] = [];
    let idx = 1;
    for (const el of Array.from(this.table.getElementsByTagNameNS(NS.table, 'table-row'))) {
      const count = repeat(el, 'number-rows-repeated');
      out.push({ el, start: idx, count });
      idx += count;
    }
    return (this.index = out);
  }

  private findRow(row: number): RowEntry | null {
    const ix = this.rowIndex();
    let lo = 0;
    let hi = ix.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const e = ix[mid];
      if (row < e.start) hi = mid - 1;
      else if (row >= e.start + e.count) lo = mid + 1;
      else return e;
    }
    return null;
  }

  /** Deja las filas [first, last] como nodos individuales (creándolas si faltan) y las devuelve. */
  private explodeRows(first: number, last: number): Element[] {
    for (const e of this.rowIndex()) {
      const end = e.start + e.count - 1;
      if (e.count === 1 || end < first || e.start > last) continue;
      const parent = e.el.parentNode!;
      const from = Math.max(first, e.start);
      const to = Math.min(last, end);
      if (from > e.start) {
        const b = e.el.cloneNode(true) as Element;
        setRepeat(b, 'number-rows-repeated', from - e.start);
        parent.insertBefore(b, e.el);
      }
      for (let k = from; k < to; k++) {
        const one = e.el.cloneNode(true) as Element;
        setRepeat(one, 'number-rows-repeated', 1);
        parent.insertBefore(one, e.el);
      }
      if (end > to) {
        const a = e.el.cloneNode(true) as Element;
        setRepeat(a, 'number-rows-repeated', end - to);
        parent.insertBefore(a, e.el.nextSibling);
      }
      setRepeat(e.el, 'number-rows-repeated', 1);
    }
    this.index = null;
    let ix = this.rowIndex();
    const lastEntry = ix[ix.length - 1];
    let next = lastEntry ? lastEntry.start + lastEntry.count : 1;
    if (next <= last) {
      const parent = lastEntry?.el.parentNode ?? this.table;
      for (; next <= last; next++) parent.appendChild(this.dom.createElementNS(NS.table, 'table:table-row'));
      this.index = null;
      ix = this.rowIndex();
    }
    const out: Element[] = [];
    for (let r = first; r <= last; r++) out.push(this.findRow(r)!.el);
    return out;
  }

  private findCell(rowEl: Element, col: number): Element | null {
    let idx = 1;
    for (const c of elements(rowEl).filter(isCell)) {
      const n = repeat(c, 'number-columns-repeated');
      if (col < idx + n) return c;
      idx += n;
    }
    return null;
  }

  private cellForWrite(rowEl: Element, col: number): Element {
    let idx = 1;
    for (const c of elements(rowEl).filter(isCell)) {
      const n = repeat(c, 'number-columns-repeated');
      if (col < idx + n) {
        const cell = isolate(c, idx, col, 'number-columns-repeated');
        if (cell.localName === 'covered-table-cell') throw new Error(`${this.name}: la celda ${col} está combinada`);
        return cell;
      }
      idx += n;
    }
    let created: Element | null = null;
    for (; idx <= col; idx++) {
      created = this.dom.createElementNS(NS.table, 'table:table-cell');
      rowEl.appendChild(created);
    }
    return created!;
  }

  read(row: number, col: number): CellValue {
    const r = this.findRow(row);
    const c = r && this.findCell(r.el, col);
    return c ? readCell(c) : null;
  }

  /** Lee un bloque de filas × columnas (1-based). */
  readRows(firstRow: number, firstCol: number, nCols: number, nRows: number): CellValue[][] {
    const out: CellValue[][] = [];
    for (let r = firstRow; r < firstRow + nRows; r++) {
      const e = this.findRow(r);
      const row: CellValue[] = [];
      for (let c = firstCol; c < firstCol + nCols; c++) {
        const cell = e && this.findCell(e.el, c);
        row.push(cell ? readCell(cell) : null);
      }
      out.push(row);
    }
    return out;
  }

  /** Escribe un bloque empezando en (firstRow, firstCol). Conserva el estilo de cada celda. */
  writeRows(firstRow: number, firstCol: number, data: CellValue[][]): void {
    if (!data.length) return;
    const rows = this.explodeRows(firstRow, firstRow + data.length - 1);
    data.forEach((values, i) => {
      values.forEach((v, j) => writeCell(this.dom, this.cellForWrite(rows[i], firstCol + j), v));
    });
  }

  write(row: number, col: number, value: CellValue): void {
    this.writeRows(row, col, [[value]]);
  }

  /** Nombre del estilo de una celda, para dar el mismo aspecto a otra con `setStyle`. */
  styleOf(row: number, col: number): string | null {
    const r = this.findRow(row);
    const c = r && this.findCell(r.el, col);
    return c?.getAttributeNS(NS.table, 'style-name') || null;
  }

  setStyle(row: number, col: number, style: string | null): void {
    if (!style) return;
    this.cellForWrite(this.explodeRows(row, row)[0], col).setAttributeNS(NS.table, 'table:style-name', style);
  }

  /** Guarda el resultado de una celda con fórmula sin tocar la fórmula. */
  setFormulaResult(row: number, col: number, value: number): void {
    const cell = this.cellForWrite(this.explodeRows(row, row)[0], col);
    if (!cell.hasAttributeNS(NS.table, 'formula')) return;
    for (const [ns, local] of VALUE_ATTRS) cell.removeAttributeNS(ns, local);
    while (cell.firstChild) cell.removeChild(cell.firstChild);
    cell.setAttributeNS(NS.office, 'office:value-type', 'float');
    cell.setAttributeNS(NS.office, 'office:value', String(value));
    cell.setAttributeNS(NS.calcext, 'calcext:value-type', 'float');
    const p = this.dom.createElementNS(NS.text, 'text:p');
    p.appendChild(this.dom.createTextNode(String(value)));
    cell.appendChild(p);
  }
}

function readCell(c: Element): CellValue {
  switch (c.getAttributeNS(NS.office, 'value-type')) {
    case 'float':
    case 'percentage':
    case 'currency':
      return Number(c.getAttributeNS(NS.office, 'value'));
    case 'date':
      return new OdsDate(c.getAttributeNS(NS.office, 'date-value') ?? '');
    case 'boolean':
      return c.getAttributeNS(NS.office, 'boolean-value') === 'true';
    default: {
      const ps = Array.from(c.getElementsByTagNameNS(NS.text, 'p'));
      if (!ps.length) return null;
      const s = ps.map(textOf).join('\n');
      return s === '' ? null : s;
    }
  }
}

function writeCell(dom: Document, cell: Element, value: CellValue): void {
  for (const [ns, local] of VALUE_ATTRS) cell.removeAttributeNS(ns, local);
  cell.removeAttributeNS(NS.table, 'formula');
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  if (value === null || value === '') return;

  let type: string;
  let display: string;
  if (typeof value === 'number') {
    type = 'float';
    cell.setAttributeNS(NS.office, 'office:value', String(value));
    display = String(value);
  } else if (typeof value === 'boolean') {
    type = 'boolean';
    cell.setAttributeNS(NS.office, 'office:boolean-value', String(value));
    display = value ? 'VERDADERO' : 'FALSO';
  } else if (value instanceof OdsDate) {
    type = 'date';
    cell.setAttributeNS(NS.office, 'office:date-value', value.iso);
    const [y, m, d] = value.iso.split('-');
    display = `${d}/${m}/${y}`;
  } else {
    type = 'string';
    display = value;
  }
  cell.setAttributeNS(NS.office, 'office:value-type', type);
  cell.setAttributeNS(NS.calcext, 'calcext:value-type', type);
  for (const line of display.split('\n')) {
    const p = dom.createElementNS(NS.text, 'text:p');
    p.appendChild(dom.createTextNode(line));
    cell.appendChild(p);
  }
}

export class OdsDocument {
  private readonly zip: JSZip;
  private readonly dom: Document;

  private constructor(zip: JSZip, dom: Document) {
    this.zip = zip;
    this.dom = dom;
  }

  static async open(data: ArrayBuffer | Uint8Array): Promise<OdsDocument> {
    const zip = await JSZip.loadAsync(data);
    const mime = await zip.file('mimetype')?.async('string');
    if (mime?.trim() !== MIME) throw new Error('El archivo no es una hoja de cálculo .ods');
    const xml = await zip.file('content.xml')!.async('string');
    const dom = new DOMParser().parseFromString(xml, 'application/xml');
    if (dom.getElementsByTagName('parsererror').length) throw new Error('content.xml dañado');
    return new OdsDocument(zip, dom);
  }

  sheetNames(): string[] {
    return Array.from(this.dom.getElementsByTagNameNS(NS.table, 'table')).map(t => t.getAttributeNS(NS.table, 'name') ?? '');
  }

  sheet(name: string): OdsSheet {
    const t = Array.from(this.dom.getElementsByTagNameNS(NS.table, 'table')).find(x => x.getAttributeNS(NS.table, 'name') === name);
    if (!t) throw new Error(`Falta la hoja «${name}»`);
    return new OdsSheet(this.dom, t);
  }

  /** Añade una hoja vacía y sin estilos al final del libro, con `nCols` columnas de ancho normal. */
  addSheet(name: string, nCols: number): OdsSheet {
    const tables = Array.from(this.dom.getElementsByTagNameNS(NS.table, 'table'));
    const last = tables[tables.length - 1];
    const t = this.dom.createElementNS(NS.table, 'table:table');
    t.setAttributeNS(NS.table, 'table:name', name);
    const style = last.getAttributeNS(NS.table, 'style-name');
    if (style) t.setAttributeNS(NS.table, 'table:style-name', style);
    const cols = this.dom.createElementNS(NS.table, 'table:table-column');
    setRepeat(cols, 'number-columns-repeated', nCols);
    t.appendChild(cols);
    const row = this.dom.createElementNS(NS.table, 'table:table-row');
    row.appendChild(this.dom.createElementNS(NS.table, 'table:table-cell'));
    t.appendChild(row);
    last.parentNode!.insertBefore(t, last.nextSibling);
    return new OdsSheet(this.dom, t);
  }

  /** Quita los resultados guardados de las fórmulas para que LibreOffice las recalcule al abrir. */
  invalidateFormulas(): void {
    for (const c of Array.from(this.dom.getElementsByTagNameNS(NS.table, 'table-cell'))) {
      if (!c.hasAttributeNS(NS.table, 'formula')) continue;
      for (const [ns, local] of VALUE_ATTRS) c.removeAttributeNS(ns, local);
      while (c.firstChild) c.removeChild(c.firstChild);
    }
  }

  async toBytes(): Promise<Uint8Array> {
    let xml = new XMLSerializer().serializeToString(this.dom);
    if (!xml.startsWith('<?xml')) xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + xml;
    this.zip.file('content.xml', xml);
    this.zip.file('mimetype', MIME, { compression: 'STORE' });
    return this.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', mimeType: MIME });
  }
}
