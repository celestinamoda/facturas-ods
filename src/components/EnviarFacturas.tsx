// src/components/EnviarFacturas.tsx
// Envía por correo las facturas elegidas en Ventas, en PDF (el envío en sí está en ModalCorreo).
import { useEffect, useState } from 'preact/hooks';
import type { Datos, Venta } from '../lib/registro.ts';
import { buscarCliente, facturaDeVenta } from './Factura.tsx';
import { ModalCorreo } from './ModalCorreo.tsx';

interface Props {
  datos: Datos;
  ventas: Venta[];
  /** se apunta en cada factura cuándo y a quién se envió */
  onEnviadas(nums: string[], para: string): void;
  onCerrar(): void;
}

const lista = (xs: string[]): string => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);

export function EnviarFacturas({ datos, ventas, onEnviadas, onCerrar }: Props) {
  const nums = ventas.map(v => v.num);
  const emails = [...new Set(ventas.map(v => buscarCliente(datos, v.cliente)?.email.trim()).filter((e): e is string => !!e))];
  const sinEmail = [...new Set(ventas.filter(v => !buscarCliente(datos, v.cliente)?.email.trim()).map(v => v.cliente))];
  const tienda = datos.tienda.nombre || 'Celestina';
  // el email de la pestaña Tienda manda; si no hay, el de cada cliente
  const fijo = datos.tienda.envioEmail.trim();

  const [pdfs, setPdfs] = useState<File[]>([]);
  const [fallo, setFallo] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { facturaPdf } = await import('../lib/pdf.ts');
        const hechos: File[] = [];
        for (const v of ventas) {
          hechos.push(await facturaPdf(facturaDeVenta(datos, v)));
          if (vivo) setPdfs([...hechos]);
        }
      } catch (e) {
        if (vivo) setFallo(`No se pudieron crear los PDF: ${(e as Error).message}`);
      }
    })();
    return () => { vivo = false; };
  }, []);

  return (
    <ModalCorreo
      titulo={`Enviar ${nums.length > 1 ? `${nums.length} facturas` : `factura ${nums[0]}`}`}
      archivos={pdfs} total={ventas.length} adjuntos="los PDF" fallo={fallo}
      para={fijo || emails.join(', ')}
      notaPara={fijo ? 'El de la pestaña Tienda.' : sinEmail.length > 0 && `Sin email en su ficha: ${sinEmail.join(', ')}`}
      asunto={`${nums.length > 1 ? 'Facturas' : 'Factura'} ${lista(nums)} · ${tienda}`}
      mensaje={`Hola:\n\nTe envío ${nums.length > 1 ? `las facturas ${lista(nums)}` : `la factura ${nums[0]}`} en PDF.\n\nUn saludo,\n${tienda}`}
      onEnviado={para => onEnviadas(nums, para)}
      onCerrar={onCerrar}
    />
  );
}
