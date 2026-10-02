// src/components/Selector.tsx
import { input } from './ui.ts';

interface Props {
  valor: string;
  opciones: string[];
  /** texto de la opción vacía; si no se da, no hay opción vacía */
  vacio?: string;
  onChange(valor: string): void;
}

/**
 * Desplegable de textos. Si el valor actual no está entre las opciones (un producto que ya se borró,
 * una forma de pago escrita a mano en la hoja) se añade como opción, para no cambiarlo sin querer.
 */
export function Selector({ valor, opciones, vacio, onChange }: Props) {
  return (
    <select class={`${input} ${valor ? '' : 'text-muted'}`} value={valor} onChange={e => onChange(e.currentTarget.value)}>
      {vacio !== undefined && <option value="">{vacio}</option>}
      {valor && !opciones.includes(valor) && <option value={valor} class="text-ink">{valor}</option>}
      {opciones.map(o => <option key={o} value={o} class="text-ink">{o}</option>)}
    </select>
  );
}
