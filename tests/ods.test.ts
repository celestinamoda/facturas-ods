// tests/ods.test.ts — node --experimental-strip-types tests/ods.test.ts
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
Object.assign(globalThis, { DOMParser, XMLSerializer });
const { abrir, guardar, numeroFactura, totales, ivaIncluido, sumarDias, estadoDescuento, mejorDescuento, rebajaDeEtiqueta, nombreConVariedad } = await import('../src/lib/registro.ts');
import type { Descuento } from '../src/lib/registro.ts';

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
datos.productos.push({ nombre: 'Producto web', precio: 9.95, notas: '', variedades: [] });

for (let n = 0; n < 3; n++) {
  const num = numeroFactura(datos.tienda);
  const ls = [
    { producto: 'Producto de ejemplo A', cantidad: 2, precio: 45 },
    { producto: 'Producto web', cantidad: 3, precio: 9.95 },
  ].map(l => ({ ...l, importe: Math.round(l.cantidad * l.precio * 100) / 100 }));
  const t = totales(ls, datos.tienda.iva);
  datos.ventas.push({ num, fecha: '2026-10-02', vencimiento: sumarDias('2026-10-02', datos.tienda.dias), cliente: 'Nuevo Cliente SL',
    nif: 'B87654321', pago: 'Bizum', base: t.base, ivaPct: datos.tienda.iva, iva: t.iva, irpfPct: 0, irpf: 0, total: t.total, pdf: '' });
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
// los precios llevan el IVA incluido: el total es la suma de las líneas
assert.equal(again.datos.ventas[0].total, 119.85);
assert.equal(again.datos.ventas[0].base, 99.05);
assert.equal(again.datos.ventas[0].iva, 20.8);
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

// ---------------------------------------------------------------- variedades
assert.deepEqual(datos.productos[0].variedades, []);
// dentro de una variedad puede haber otras (las tallas de un color), cada una con su precio opcional
const verde = { nombre: 'Verde', precio: null, subvariedades: [{ nombre: 'XL', precio: 14 }, { nombre: 'L', precio: null }] };
const rojo = { nombre: 'Rojo', precio: 12.5, subvariedades: [{ nombre: 'M', precio: null }, { nombre: 'S', precio: null }] };
const unico = { nombre: 'Único', precio: 40, subvariedades: [] };
third.datos.productos[2].variedades = [verde, rojo];
third.datos.productos[0].variedades = [unico];
writeFileSync(out, await guardar(third.registro, third.datos));
const conVar = await abrir(readFileSync(out));
assert.deepEqual(conVar.datos.productos.map(p => p.variedades), [[unico], [], [verde, rojo]]);
assert.equal(third.registro.ods.sheet('Variedades').read(5, 5), 'SUBVARIEDAD');
// al borrar un producto se van sus variedades, y no quedan restos en la hoja
conVar.datos.productos.splice(2, 1);
writeFileSync(out, await guardar(conVar.registro, conVar.datos));
assert.deepEqual((await abrir(readFileSync(out))).datos.productos.map(p => p.variedades.length), [1, 0]);
assert.equal(nombreConVariedad('Vestido', 'Rosa'), 'Vestido · Rosa');
assert.equal(nombreConVariedad('Vestido', ''), 'Vestido');
assert.equal(nombreConVariedad('Vestido', 'Verde', 'XL'), 'Vestido · Verde · XL');
third.datos.productos[2].variedades = [];
third.datos.productos[0].variedades = [];

// ---------------------------------------------------------------- gastos de envío
// precios y envío llevan el IVA incluido: el total es la suma, y la base y el IVA salen de él
assert.deepEqual(totales([{ importe: 90 }, { importe: 10 }], 0.21, 4.5), { base: 86.36, iva: 18.14, total: 104.5 });
assert.deepEqual(totales([{ importe: 121 }], 0.21), { base: 100, iva: 21, total: 121 });
assert.deepEqual(totales([{ importe: 100 }], 0), { base: 100, iva: 0, total: 100 });
// una venta nueva lleva el IVA incluido en sus líneas; una anterior al cambio, no
const venta = { num: 'F1', fecha: '2026-10-02', vencimiento: '', cliente: 'A', nif: '', pago: '', ivaPct: 0.21, irpfPct: 0, irpf: 0, pdf: '' };
assert.equal(ivaIncluido({ ...venta, base: 86.36, iva: 18.14, total: 104.5, envio: 4.5 }, [{ importe: 100 }]), true);
assert.equal(ivaIncluido({ ...venta, base: 104.5, iva: 21.95, total: 126.45, envio: 4.5 }, [{ importe: 100 }]), false);
assert.equal(ivaIncluido({ ...venta, base: 100, iva: 21, total: 121 }, [{ importe: 100 }]), false);
assert.equal(third.datos.ventas[0].envio, 0); // ventas sin envío
third.datos.ventas[0] = { ...third.datos.ventas[0], envio: 4.5 };
writeFileSync(out, await guardar(third.registro, third.datos));
assert.deepEqual((await abrir(readFileSync(out))).datos.ventas.map(v => v.envio), [4.5, 0]);

// ---------------------------------------------------------------- descuentos
assert.equal(datos.descuentos.length, 0);
const dto = (x: Partial<Descuento>): Descuento => ({
  nombre: 'Rebajas', producto: 'Producto web', tipo: '%', valor: 10, desde: '2026-10-01', hasta: '2026-10-31',
  maxUsos: null, minCantidad: null, cliente: '', activo: true, facturas: [], ...x,
});
const linea = { producto: 'producto WEB', cantidad: 1, precio: 9.95, cliente: 'Nuevo Cliente SL', fecha: '2026-10-02' };

assert.deepEqual(mejorDescuento([dto({})], linea), { indice: 0, etiqueta: 'Rebajas (−10 %)', precio: 8.96 });
assert.equal(mejorDescuento([dto({})], { ...linea, producto: 'Otro' }), null);
assert.equal(mejorDescuento([dto({ producto: '' })], { ...linea, producto: 'Otro' })?.precio, 8.96); // sin producto = todos
// fechas: ambos extremos incluidos
assert.equal(mejorDescuento([dto({})], { ...linea, fecha: '2026-09-30' }), null);
assert.equal(mejorDescuento([dto({})], { ...linea, fecha: '2026-10-01' })?.precio, 8.96);
assert.equal(mejorDescuento([dto({})], { ...linea, fecha: '2026-10-31' })?.precio, 8.96);
assert.equal(mejorDescuento([dto({})], { ...linea, fecha: '2026-11-01' }), null);
assert.equal(estadoDescuento(dto({}), '2026-09-30'), 'programado');
assert.equal(estadoDescuento(dto({}), '2026-11-01'), 'caducado');
// límite de usos
assert.equal(mejorDescuento([dto({ maxUsos: 2, facturas: ['2026-001'] })], linea)?.precio, 8.96);
assert.equal(mejorDescuento([dto({ maxUsos: 2, facturas: ['2026-001', '2026-003'] })], linea), null);
assert.equal(estadoDescuento(dto({ maxUsos: 2, facturas: ['2026-001', '2026-003'] }), '2026-10-02'), 'agotado');
// pausado, cantidad mínima y cliente
assert.equal(mejorDescuento([dto({ activo: false })], linea), null);
assert.equal(mejorDescuento([dto({ minCantidad: 3 })], linea), null);
assert.equal(mejorDescuento([dto({ minCantidad: 3 })], { ...linea, cantidad: 3 })?.precio, 8.96);
assert.equal(mejorDescuento([dto({ cliente: 'Otro cliente' })], linea), null);
assert.equal(mejorDescuento([dto({ cliente: 'nuevo cliente sl' })], linea)?.precio, 8.96);
// importe fijo, sin bajar de cero, y gana el que deja el precio más bajo
assert.deepEqual(mejorDescuento([dto({ tipo: '€', valor: 2, nombre: '' })], linea), { indice: 0, etiqueta: 'Descuento (−2,00 €)', precio: 7.95 }); // Intl separa el € con un espacio duro
assert.equal(mejorDescuento([dto({ tipo: '€', valor: 50 })], linea)?.precio, 0);
assert.equal(mejorDescuento([dto({}), dto({ tipo: '€', valor: 2 }), dto({ valor: 5 })], linea)?.indice, 1);

// en la factura sale la rebaja sin el nombre del descuento
assert.equal(rebajaDeEtiqueta('Rebajas (−10 %)'), '−10 %');
assert.equal(rebajaDeEtiqueta('Rebajas (enero) (−2,00\u00a0€)'), '−2,00\u00a0€');
assert.equal(rebajaDeEtiqueta('texto escrito a mano en la hoja'), '');

// ida y vuelta: la hoja Descuentos y las columnas de descuento de Detalle ventas
third.datos.descuentos.push(dto({ maxUsos: 5, minCantidad: 2, cliente: 'Nuevo Cliente SL', facturas: ['2026-001', '2026-003'] }), dto({ nombre: 'Pausado', tipo: '€', valor: 1.5, desde: '', hasta: '', activo: false }));
third.datos.lineas[1] = { ...third.datos.lineas[1], precio: 8.96, importe: 26.88, descuento: 'Rebajas (−10 %)', precioBase: 9.95 };
writeFileSync(out, await guardar(third.registro, third.datos));
const fourth = await abrir(readFileSync(out));
assert.deepEqual(fourth.datos.descuentos, third.datos.descuentos);
assert.equal(fourth.datos.lineas[1].descuento, 'Rebajas (−10 %)');
assert.equal(fourth.datos.lineas[1].precioBase, 9.95);
assert.equal(fourth.datos.lineas[0].descuento, '');
assert.equal(fourth.datos.lineas[0].precioBase, null);
// borrar un descuento no deja restos
fourth.datos.descuentos.splice(0, 1);
writeFileSync(out, await guardar(fourth.registro, fourth.datos));
assert.deepEqual((await abrir(readFileSync(out))).datos.descuentos.map(x => x.nombre), ['Pausado']);

// un registro hecho antes de que existieran los descuentos: se abre igual y la hoja se crea al guardar el primero
const viejo = await abrir(readFileSync('tests/registro-antiguo.ods'));
assert.equal(viejo.registro.ods.sheetNames().includes('Descuentos'), false);
assert.equal(viejo.datos.descuentos.length, 0);
await guardar(viejo.registro, viejo.datos);
assert.equal(viejo.registro.ods.sheetNames().includes('Descuentos'), false);
viejo.datos.descuentos.push(dto({}));
writeFileSync(out, await guardar(viejo.registro, viejo.datos));
const nuevo = await abrir(readFileSync(out));
assert.deepEqual(nuevo.datos.descuentos, [dto({})]);
assert.equal(nuevo.datos.clientes.length, 2);
assert.equal(nuevo.registro.ods.sheetNames().includes('Variedades'), false);
nuevo.datos.productos[0].variedades = [{ nombre: 'Rosa', precio: null, subvariedades: [{ nombre: 'M', precio: 9 }] }];
writeFileSync(out, await guardar(nuevo.registro, nuevo.datos));
assert.deepEqual((await abrir(readFileSync(out))).datos.productos[0].variedades, [{ nombre: 'Rosa', precio: null, subvariedades: [{ nombre: 'M', precio: 9 }] }]);

// email de envío: la plantilla no tiene su fila; vacío no la crea y, al guardar uno, se añade al final sin mover nada
const conEnvio = await abrir(readFileSync('public/plantilla.ods'));
assert.equal(conEnvio.datos.tienda.envioEmail, '');
const tiendaSheet = () => conEnvio.registro.ods.sheet('Tienda').readRows(1, 2, 2, 80).map(r => r.map(v => (v === null ? null : String(v))));
const antes = tiendaSheet();
await guardar(conEnvio.registro, conEnvio.datos);
assert.deepEqual(tiendaSheet(), antes);
conEnvio.datos.tienda.envioEmail = 'gestoria@ejemplo.es';
writeFileSync(out, await guardar(conEnvio.registro, conEnvio.datos));
const releido = await abrir(readFileSync(out));
assert.equal(releido.datos.tienda.envioEmail, 'gestoria@ejemplo.es');
assert.deepEqual(releido.datos.tienda, { ...conEnvio.datos.tienda });
const filasTienda = releido.registro.ods.sheet('Tienda').readRows(1, 2, 2, 80).map(r => r.map(v => (v === null ? null : String(v))));
assert.deepEqual(filasTienda.slice(0, 34), antes.slice(0, 34));
assert.deepEqual(filasTienda[36], ['EMAIL PARA ENVIAR FACTURAS', 'gestoria@ejemplo.es']);
// se puede volver a vaciar, y la fila queda
releido.datos.tienda.envioEmail = '';
writeFileSync(out, await guardar(releido.registro, releido.datos));
assert.equal((await abrir(readFileSync(out))).datos.tienda.envioEmail, '');

// fecha de la última copia de seguridad: otra fila de la web, en su bloque debajo de la del email
const conCopia = await abrir(readFileSync(out));
assert.equal(conCopia.datos.tienda.copia, '');
conCopia.datos.tienda.copia = '2026-10-09T19:55';
writeFileSync(out, await guardar(conCopia.registro, conCopia.datos));
const conCopia2 = await abrir(readFileSync(out));
assert.equal(conCopia2.datos.tienda.copia, '2026-10-09T19:55');
const filasCopia = conCopia2.registro.ods.sheet('Tienda').readRows(1, 2, 2, 80).map(r => r.map(v => (v === null ? null : String(v))));
assert.deepEqual(filasCopia.slice(0, 34), antes.slice(0, 34));
assert.deepEqual(filasCopia[36], ['EMAIL PARA ENVIAR FACTURAS', null]);
assert.deepEqual(filasCopia[38], ['COPIA DE SEGURIDAD', null]);
assert.deepEqual(filasCopia[39], ['ÚLTIMA COPIA DE SEGURIDAD', '2026-10-09T19:55']);
// el email de las copias entra en ese mismo bloque, debajo, sin crear otro
assert.equal(conCopia2.datos.tienda.copiaEmail, '');
conCopia2.datos.tienda.copiaEmail = 'yo@celestina.es';
writeFileSync(out, await guardar(conCopia2.registro, conCopia2.datos));
const conCopia3 = await abrir(readFileSync(out));
assert.equal(conCopia3.datos.tienda.copiaEmail, 'yo@celestina.es');
assert.equal(conCopia3.datos.tienda.copia, '2026-10-09T19:55');
const filasCopia3 = conCopia3.registro.ods.sheet('Tienda').readRows(1, 2, 2, 80).map(r => r.map(v => (v === null ? null : String(v))));
assert.deepEqual(filasCopia3.slice(0, 40), filasCopia.slice(0, 40));
assert.deepEqual(filasCopia3[40], ['EMAIL PARA COPIAS DE SEGURIDAD', 'yo@celestina.es']);
assert.equal(filasCopia3.filter(r => r[0] === 'COPIA DE SEGURIDAD').length, 1);
console.log(`ok · ${Math.round(performance.now() - t0)} ms`);
