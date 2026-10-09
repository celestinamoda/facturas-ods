// src/components/TiendaForm.tsx
import type { Tienda } from '../lib/registro.ts';
import { numeroFactura } from '../lib/registro.ts';
import { parseNum } from '../lib/format.ts';
import { campo, etiqueta, gridForm, h2, input, muted, panel, panelHead, span2, span4 } from './ui.ts';

type Campo = { key: keyof Tienda; label: string; tipo?: 'num' | 'pct'; ayuda?: string; ancho?: 'full' };
const GRUPOS: { titulo: string; campos: Campo[] }[] = [
  { titulo: 'Identidad', campos: [
    { key: 'nombre', label: 'Nombre comercial' }, { key: 'razon', label: 'Razón social / titular' }, { key: 'nif', label: 'NIF / CIF' },
  ] },
  { titulo: 'Dirección', campos: [
    { key: 'calle', label: 'Calle y número', ancho: 'full' }, { key: 'cp', label: 'Código postal' },
    { key: 'ciudad', label: 'Ciudad' }, { key: 'prov', label: 'Provincia' },
  ] },
  { titulo: 'Contacto', campos: [{ key: 'tel', label: 'Teléfono' }, { key: 'email', label: 'Email' }, { key: 'web', label: 'Web' }] },
  { titulo: 'Cobro', campos: [
    { key: 'iban', label: 'IBAN', ancho: 'full' }, { key: 'titular', label: 'Titular de la cuenta' },
    { key: 'pago', label: 'Forma de pago habitual' }, { key: 'dias', label: 'Días hasta vencimiento', tipo: 'num' },
    { key: 'iva', label: 'IVA por defecto (%)', tipo: 'pct' },
  ] },
  { titulo: 'Numeración', campos: [
    { key: 'serie', label: 'Serie (prefijo)', ayuda: 'Cámbialo cada año: 2027-, 2028-…' },
    { key: 'sig', label: 'Siguiente número', tipo: 'num', ayuda: 'Sube solo al registrar' },
  ] },
  { titulo: 'Envío de facturas', campos: [
    { key: 'envioEmail', label: 'Email al que se envían', ancho: 'full',
      ayuda: 'Se pone en «Para» al enviar facturas desde Ventas. Vacío: el email de cada cliente. Varios, separados por comas.' },
  ] },
  { titulo: 'Pie de factura', campos: [{ key: 'gracias', label: 'Mensaje final', ancho: 'full' }] },
];

export function TiendaForm({ tienda, onChange }: { tienda: Tienda; onChange(t: Tienda): void }) {
  const set = (key: keyof Tienda, v: string | number) => onChange({ ...tienda, [key]: v });
  return (
    <section class={panel}>
      <div class={panelHead}>
        <div>
          <h2 class={h2}>Datos de la tienda</h2>
          <p class={muted}>Salen en todas las facturas. Próxima factura: <b>{numeroFactura(tienda)}</b></p>
        </div>
      </div>
      {GRUPOS.map(g => (
        <fieldset key={g.titulo} class="mb-2">
          <legend class="pb-2.5 text-[11px] font-extrabold tracking-[.14em] uppercase">{g.titulo}</legend>
          <div class={gridForm}>
            {g.campos.map(c => {
              const v = tienda[c.key];
              const shown = c.tipo === 'pct' ? String(Math.round((v as number) * 10000) / 100).replace('.', ',') : String(v ?? '');
              return (
                <label key={c.key} class={`${campo} ${c.ancho === 'full' ? span4 : span2}`}>
                  <span class={etiqueta}>{c.label}</span>
                  {c.tipo ? (
                    <input class={input} inputMode="decimal" value={shown} onChange={e => {
                      const n = parseNum(e.currentTarget.value) ?? 0;
                      set(c.key, c.tipo === 'pct' ? n / 100 : Math.trunc(n));
                    }} />
                  ) : (
                    <input class={input} value={shown} onInput={e => set(c.key, e.currentTarget.value)} />
                  )}
                  {c.ayuda && <small class="text-[11.5px] text-muted">{c.ayuda}</small>}
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
