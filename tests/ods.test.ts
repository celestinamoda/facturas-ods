// tests/ods.test.ts — node --experimental-strip-types tests/ods.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
Object.assign(globalThis, { DOMParser, XMLSerializer });
const { abrir, guardar, numeroFactura, totales, sumarDias } = await import('../src/lib/registro.ts');

const out = process.argv[2] ?? 'tests/salida.ods';
const t0 = performance.now();
const { registro, datos } = await abrir(readFileSync('public/plantilla.ods'));
assert.equal(datos.tienda.nombre, 'Celestina');
assert.equal(datos.tienda.iva, 0.21);
assert.equal(datos.tienda.sig, 1);
assert.equal(datos.clientes.length, 2);
assert.equal(datos.productos[1].precio, 120);
assert.equal(datos.ventas.length, 0);

datos.tienda.nombre = 'Celestina web';
datos.clientes.push({ nombre: 'Nuevo Cliente SL', nif: 'B87654321', direccion: 'C/ Sol 3', cp: '41001', ciudad: 'Sevilla', provincia: 'Sevilla', email: 'a@b.es', telefono: '955000000' });
datos.productos.push({ nombre: 'Producto web', precio: 9.95, notas: '' });

for (let n = 0; n < 3; n++) {
  const num = numeroFactura(datos.tienda);
  const ls = [
    { producto: 'Producto de ejemplo A', cantidad: 2, precio: 45 },
    { producto: 'Producto web', cantidad: 3, precio: 9.95 },
  ].map(l => ({ ...l, importe: Math.round(l.cantidad * l.precio * 100) / 100 }));
  const t = totales(ls, datos.tienda.iva, datos.tienda.irpf);
  datos.ventas.push({ num, fecha: '2026-10-02', vencimiento: sumarDias('2026-10-02', datos.tienda.dias), cliente: 'Nuevo Cliente SL',
    nif: 'B87654321', pago: 'Bizum', base: t.base, ivaPct: datos.tienda.iva, iva: t.iva, irpfPct: 0, irpf: t.irpf, total: t.total, pdf: '' });
  for (const l of ls) datos.lineas.push({ num, fecha: '2026-10-02', cliente: 'Nuevo Cliente SL', ...l });
  datos.tienda.sig++;
}
writeFileSync(out, await guardar(registro, datos));

// reabrir y comprobar
const again = await abrir(readFileSync(out));
assert.equal(again.datos.tienda.nombre, 'Celestina web');
assert.equal(again.datos.tienda.sig, 4);
assert.equal(again.datos.clientes.length, 3);
assert.equal(again.datos.ventas.length, 3);
assert.equal(again.datos.ventas[2].num, '2026-003');
assert.equal(again.datos.ventas[0].vencimiento, '2026-11-01');
assert.equal(again.datos.ventas[0].total, 145.02);
assert.equal(again.datos.lineas.length, 6);

// borrar una venta y un cliente: no deben quedar restos
again.datos.ventas.splice(1, 1);
again.datos.lineas = again.datos.lineas.filter(l => l.num !== '2026-002');
again.datos.clientes.splice(0, 1);
writeFileSync(out, await guardar(again.registro, again.datos));
const third = await abrir(readFileSync(out));
assert.deepEqual(third.datos.ventas.map(v => v.num), ['2026-001', '2026-003']);
assert.equal(third.datos.lineas.length, 4);
assert.equal(third.datos.clientes.length, 2);
console.log(`ok · ${Math.round(performance.now() - t0)} ms`);
