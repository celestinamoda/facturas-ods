// src/lib/format.ts
const eurFmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const numFmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

export const eur = (n: number): string => eurFmt.format(n || 0);
export const numero = (n: number): string => numFmt.format(n || 0);
export const pct = (n: number): string => `${numFmt.format(Math.round((n || 0) * 10000) / 100)} %`;

export function fecha(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Acepta "1.234,56", "1234.56" o "12,5". Devuelve null si no es un número. */
/** 2026-10-09T20:15 → 09/10/2026 20:15 */
export const fechaHora = (iso: string): string => `${fecha(iso)}${iso.length > 10 ? ` ${iso.slice(11, 16)}` : ''}`;

/** fecha y hora local en ISO, sin zona: 2026-10-09T19:55 */
export const ahoraLocal = (): string => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function parseNum(s: string): number | null {
  const t = s.trim().replace(/\s|€|%/g, '');
  if (!t) return null;
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

export const norm = (s: string): string =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
