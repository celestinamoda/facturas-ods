// src/components/Ventas.tsx
import { useMemo, useState } from 'preact/hooks';
import type { Datos, Venta } from '../lib/registro.ts';
import { round2 } from '../lib/registro.ts';
import { eur, fecha, norm } from '../lib/format.ts';
import { Selector } from './Selector.tsx';
import { btn, empty, etiqueta, filaMovil, filtro, filtros, h2, icon, panel, panelHead, table, tableWrap, td, th, thR } from './ui.ts';

// en móvil cada indicador es una sola línea: etiqueta a la izquierda y valor a la derecha
const kpi = 'flex flex-col gap-0.5 rounded-[10px] border border-line px-4 py-3.5 movil:flex-row movil:items-center movil:justify-between movil:py-2.5';
const kpiValor = 'text-[22px] tracking-[-.01em] tabular-nums movil:text-lg';

interface Props {
  datos: Datos;
  onVer(v: Venta): void;
  onEliminar(v: Venta): void;
}

export function Ventas({ datos, onVer, onEliminar }: Props) {
  const [q, setQ] = useState('');
  const [mes, setMes] = useState('');
  const meses = useMemo(() => [...new Set(datos.ventas.map(v => v.fecha.slice(0, 7)))].sort().reverse(), [datos.ventas]);
  const lista = datos.ventas
    .filter(v => !mes || v.fecha.startsWith(mes))
    .filter(v => !q || norm(`${v.num} ${v.cliente} ${v.nif} ${v.pago}`).includes(norm(q)))
    .slice()
    .reverse();
  const base = round2(lista.reduce((s, v) => s + v.base, 0));
  const total = round2(lista.reduce((s, v) => s + v.total, 0));

  return (
    <section class={panel}>
      <div class={panelHead}>
        <h2 class={h2}>Ventas</h2>
        <div class={filtros}>
          <Selector clase={filtro} valor={mes} vacio="Todos los meses" onChange={setMes}
            opciones={meses.map(m => ({ valor: m, texto: `${m.slice(5)}/${m.slice(0, 4)}` }))} />
          <input class={filtro} type="search" placeholder="Buscar…" value={q} onInput={e => setQ(e.currentTarget.value)} />
        </div>
      </div>
      <div class="mb-5 grid grid-cols-3 gap-3 movil:grid-cols-1 movil:gap-2">
        <div class={kpi}><span class={etiqueta}>Facturas</span><b class={kpiValor}>{lista.length}</b></div>
        <div class={kpi}><span class={etiqueta}>Base imponible</span><b class={kpiValor}>{eur(base)}</b></div>
        <div class={kpi}><span class={etiqueta}>Total facturado</span><b class={kpiValor}>{eur(total)}</b></div>
      </div>
      {lista.length === 0 ? (
        <p class={empty}>{datos.ventas.length ? 'Ninguna venta coincide con el filtro.' : 'Todavía no hay ventas registradas.'}</p>
      ) : (
        <div class={tableWrap}>
          <table class={table}>
            <thead>
              <tr>
                <th class={th}>Nº</th><th class={th}>Fecha</th><th class={th}>Cliente</th><th class={th}>Pago</th>
                <th class={thR}>Base</th><th class={`${thR} tablet:hidden`}>IVA</th><th class={thR}>Total</th><th class={th} />
              </tr>
            </thead>
            <tbody>
              {lista.map(v => (
                // móvil: nº y total arriba, cliente debajo, y fecha y pago junto a los botones
                <tr key={v.num} class={`group ${filaMovil} movil:grid-cols-[1fr_auto] movil:gap-y-0.5`}>
                  <td class={`${td} whitespace-nowrap tabular-nums movil:order-1`}><b>{v.num}</b></td>
                  <td class={`${td} movil:order-4 movil:text-xs movil:text-muted`}>{fecha(v.fecha)}</td>
                  <td class={`${td} movil:order-3 movil:col-span-2`}>{v.cliente}</td>
                  <td class={`${td} movil:order-6 movil:text-xs movil:text-muted`}>{v.pago}</td>
                  <td class={`${td} text-right tabular-nums movil:hidden`}>{eur(v.base)}</td>
                  <td class={`${td} text-right tabular-nums tablet:hidden movil:hidden`}>{eur(v.iva)}</td>
                  <td class={`${td} text-right tabular-nums movil:order-2`}><b>{eur(v.total)}</b></td>
                  <td class={`${td} text-right whitespace-nowrap movil:order-5 movil:row-span-2 movil:self-center`}>
                    <button class={btn('ghost', 'small')} onClick={() => onVer(v)}>Factura</button>
                    <button class={icon} title="Eliminar venta" onClick={() => onEliminar(v)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
