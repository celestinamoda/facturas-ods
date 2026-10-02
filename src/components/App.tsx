// src/components/App.tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { abrir, guardar, type Cliente, type Datos, type Producto, type Registro, type Venta } from '../lib/registro.ts';
import { descargar, desdeFile, elegirArchivo, escribir, guardarComo, puedeGuardarEncima, reabrir, type Archivo, type FileHandle } from '../lib/archivo.ts';
import { olvidar, recordar, recuperar, type Recuerdo } from '../lib/recuerdo.ts';
import { norm } from '../lib/format.ts';
import { Factura, type FacturaData } from './Factura.tsx';
import { NuevaVenta, type NuevaVentaResult } from './NuevaVenta.tsx';
import { Ventas } from './Ventas.tsx';
import { TablaEditable } from './TablaEditable.tsx';
import { TiendaForm } from './TiendaForm.tsx';
import { Descuentos } from './Descuentos.tsx';
import { btn, error as errorCls, iconBase, muted } from './ui.ts';

type Tab = 'venta' | 'ventas' | 'clientes' | 'productos' | 'descuentos' | 'tienda';
// pestaña, texto, texto corto e icono (trazo SVG de 24×24); los dos últimos son para la barra inferior del móvil
const TABS: [Tab, string, string, string][] = [
  ['venta', 'Nueva venta', 'Nueva', 'M12 8v8M8 12h8M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z'],
  ['ventas', 'Ventas', 'Ventas', 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01'],
  ['clientes', 'Clientes', 'Clientes', 'M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a4 4 0 0 0-3-3.87M15 4.13a3 3 0 0 1 0 5.74'],
  ['productos', 'Productos', 'Productos', 'M3 12V4h8l10 10-8 8L3 12zM7.5 8.5h.01'],
  ['descuentos', 'Descuentos', 'Dtos.', 'M19 5 5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z'],
  ['tienda', 'Tienda', 'Tienda', 'M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M10 20v-6h4v6'],
];
// acciones de archivo del menú «⋯» de la barra superior
const ACCIONES = ['Abrir otro archivo', 'Descargar una copia', 'Cerrar el archivo'];

interface Sesion {
  registro: Registro;
  nombre: string;
  handle: FileHandle | null;
}

interface Modal extends FacturaData {
  registrar?: NuevaVentaResult;
}

export default function App() {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [tab, setTab] = useState<Tab>('venta');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [modal, setModal] = useState<Modal | null>(null);
  const [drag, setDrag] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const toastTimer = useRef<number>();
  // al entrar se mira si hay un archivo de otra visita; `pendiente` es uno que necesita permiso para releerse
  const [inicio, setInicio] = useState(true);
  const [pendiente, setPendiente] = useState<Recuerdo | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  useEffect(() => {
    (async () => {
      const r = await recuperar();
      if (r?.handle) {
        await retomar(r, false);
      } else if (r?.bytes) {
        await cargar({ nombre: r.nombre, bytes: r.bytes, handle: null }, false);
        avisar(`Recuperada la copia de ${r.nombre} del ${new Date(r.fecha).toLocaleDateString('es-ES')}`);
      }
    })().finally(() => setInicio(false));
  }, []);

  function avisar(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3500);
  }

  async function cargar(a: Archivo | null, recordarlo = true) {
    if (!a) return;
    if (dirty && !confirm('Hay cambios sin guardar. ¿Abrir otro archivo igualmente?')) return;
    setBusy(true);
    setError('');
    try {
      const { registro, datos } = await abrir(a.bytes);
      setSesion({ registro, nombre: a.nombre, handle: a.handle });
      setDatos(datos);
      setDirty(false);
      setTab('venta');
      setPendiente(null);
      if (recordarlo) recordar({ nombre: a.nombre, handle: a.handle, bytes: a.handle ? null : a.bytes });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function retomar(r: Recuerdo, pedir: boolean) {
    if (!r.handle) return;
    try {
      const a = await reabrir(r.handle, pedir);
      if (a) return await cargar(a);
      setPendiente(r);
      if (pedir) setError(`Sin permiso para leer ${r.nombre}.`);
    } catch {
      setPendiente(null);
      olvidar();
      setError(`No se pudo reabrir ${r.nombre}: puede que se haya movido o borrado.`);
    }
  }

  function cerrar() {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Cerrar el archivo igualmente?')) return;
    olvidar();
    setSesion(null);
    setDatos(null);
    setDirty(false);
    setModal(null);
    setError('');
  }

  async function plantilla() {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    const r = await fetch(`${base}plantilla.ods`);
    await cargar({ nombre: 'registro de ventas celestina.ods', bytes: await r.arrayBuffer(), handle: null });
  }

  function cambiar(fn: (d: Datos) => Datos) {
    setDatos(d => (d ? fn(d) : d));
    setDirty(true);
  }

  async function guardarArchivo(copia = false) {
    if (!sesion || !datos) return;
    setBusy(true);
    try {
      const bytes = await guardar(sesion.registro, datos);
      if (!copia && sesion.handle) {
        await escribir(sesion.handle, bytes);
        avisar(`Guardado en ${sesion.nombre}`);
      } else if (!copia && puedeGuardarEncima()) {
        const handle = await guardarComo(sesion.nombre, bytes);
        if (!handle) return;
        setSesion({ ...sesion, handle, nombre: handle.name });
        recordar({ nombre: handle.name, handle, bytes: null });
        avisar(`Guardado en ${handle.name}`);
      } else {
        descargar(sesion.nombre, bytes);
        if (!copia) recordar({ nombre: sesion.nombre, handle: null, bytes: bytes.slice().buffer });
        avisar('Descargado. Sustituye tu archivo por este.');
      }
      if (!copia) setDirty(false);
    } catch (e) {
      setError(`No se pudo guardar: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const buscarCliente = (nombre: string): Cliente | undefined =>
    datos?.clientes.find(c => norm(c.nombre) === norm(nombre));

  function abrirFactura(r: NuevaVentaResult, registrar: boolean) {
    if (!datos) return;
    setModal({ tienda: datos.tienda, venta: r.venta, lineas: r.lineas, notas: r.notas,
      cliente: buscarCliente(r.venta.cliente), borrador: !registrar, registrar: registrar ? undefined : r });
  }

  function registrar(r: NuevaVentaResult) {
    if (!datos) return;
    if (datos.ventas.some(v => v.num === r.venta.num)) {
      setError(`La factura ${r.venta.num} ya está registrada.`);
      return;
    }
    cambiar(d => ({
      ...d,
      ventas: [...d.ventas, r.venta],
      lineas: [...d.lineas, ...r.lineas],
      // cada descuento aplicado gasta un uso: se apunta en él la factura
      descuentos: d.descuentos.map((x, i) => (r.usados.includes(i) ? { ...x, facturas: [...x.facturas, r.venta.num] } : x)),
      tienda: { ...d.tienda, sig: Math.trunc(d.tienda.sig) + 1 },
    }));
    setFormKey(k => k + 1);
    setModal({ tienda: datos.tienda, venta: r.venta, lineas: r.lineas, notas: r.notas, cliente: buscarCliente(r.venta.cliente) });
    avisar(`Factura ${r.venta.num} registrada. Recuerda guardar el archivo.`);
  }

  function verVenta(v: Venta) {
    if (!datos) return;
    setModal({ tienda: datos.tienda, venta: v, lineas: datos.lineas.filter(l => l.num === v.num), notas: '', cliente: buscarCliente(v.cliente) });
  }

  function eliminarVenta(v: Venta) {
    if (!confirm(`¿Eliminar la factura ${v.num} de ${v.cliente}? Se borra de Ventas y de Detalle ventas.`)) return;
    cambiar(d => ({
      ...d,
      ventas: d.ventas.filter(x => x.num !== v.num),
      lineas: d.lineas.filter(l => l.num !== v.num),
      // la factura borrada devuelve el uso a los descuentos que gastó
      descuentos: d.descuentos.map(x => (x.facturas.includes(v.num) ? { ...x, facturas: x.facturas.filter(f => f !== v.num) } : x)),
    }));
  }

  function imprimir() {
    if (!modal) return;
    const prev = document.title;
    document.title = `Factura_${modal.venta.num}`;
    window.addEventListener('afterprint', () => { document.title = prev; }, { once: true });
    window.print();
  }

  // ------------------------------------------------------------ sin archivo
  if (inicio && !sesion) return <main class="min-h-screen print:hidden" />;
  if (!sesion || !datos) {
    return (
      <main
        class={`grid min-h-screen place-items-center px-4 py-6 transition-colors duration-200 print:hidden ${drag ? 'bg-primary' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={async e => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer?.files[0];
          if (f) await cargar(await desdeFile(f));
        }}
      >
        <div class="w-[min(560px,100%)] rounded-[18px] bg-paper px-10 py-11 shadow-[0_1px_0_var(--color-line),0_30px_60px_-30px_rgba(0,0,0,.25)] movil:px-5.5 movil:py-7.5">
          <p class="font-celestina text-[64px] leading-none whitespace-nowrap">Celestina</p>
          <h1 class="mt-1.5 mb-3 text-[34px] leading-[1.1] font-bold tracking-[-.02em]">Registro de ventas</h1>
          <p class="mb-6.5 text-[15px] text-ink-2">Abre tu archivo <code class="font-mono text-[.92em]">.ods</code> y haz las facturas desde aquí. Los datos se leen y se guardan en ese mismo archivo: no salen de tu ordenador.</p>
          <div class="mb-3 flex flex-wrap gap-2.5">
            {pendiente && (
              <button class={`${btn('primary', 'big')} movil:w-full`} disabled={busy} onClick={() => retomar(pendiente, true)}>Continuar con {pendiente.nombre}</button>
            )}
            <button class={`${btn(pendiente ? 'ghost' : 'primary', 'big')} movil:w-full`} disabled={busy} onClick={async () => cargar(await elegirArchivo())}>
              {pendiente ? 'Abrir otro .ods' : 'Abrir registro .ods'}
            </button>
            <button class={`${btn('ghost', 'big')} movil:w-full`} disabled={busy} onClick={plantilla}>Empezar con uno vacío</button>
          </div>
          <p class={`${muted} text-xs`}>o arrastra el archivo aquí</p>
          {error && <p class={`${errorCls} mt-2.5`} role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  // ------------------------------------------------------------ app
  // mismo orden que ACCIONES
  const acciones = [async () => cargar(await elegirArchivo()), () => guardarArchivo(true), cerrar];
  return (
    <div>
      <header class="sticky top-0 z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-primary px-5 py-2.5 text-ink tablet:grid-cols-[1fr_auto] movil:gap-2 movil:px-3 print:hidden">
        <span class="min-w-0 truncate font-celestina text-[32px] leading-none">{datos.tienda.nombre || 'Celestina'}</span>
        {/* tablet: fila propia bajo la barra; móvil: barra fija abajo con iconos */}
        <nav class="flex gap-0.5 rounded-full bg-ink/8 p-0.75 tablet:order-3 tablet:col-span-full tablet:max-w-full tablet:justify-self-start tablet:overflow-x-auto movil:fixed movil:inset-x-0 movil:bottom-0 movil:grid movil:max-w-none movil:justify-self-stretch movil:overflow-visible movil:grid-cols-6 movil:gap-0 movil:rounded-none movil:border-t movil:border-line movil:bg-paper movil:p-0 movil:pb-[env(safe-area-inset-bottom)]" role="tablist">
          {TABS.map(([id, label, corto, icono]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              class={`cursor-pointer appearance-none rounded-full border-0 px-3.5 py-1.75 text-[13px] font-semibold whitespace-nowrap movil:flex movil:flex-col movil:items-center movil:gap-0.5 movil:rounded-none movil:px-0 movil:pt-2 movil:pb-1.5 movil:text-[10px] ${tab === id ? 'bg-white text-ink movil:bg-primary/45' : 'bg-transparent text-ink-2 hover:text-ink'}`}>
              <svg class="hidden size-5.5 movil:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={icono} /></svg>
              <span class="movil:hidden">{label}</span><span class="hidden movil:inline">{corto}</span>
            </button>
          ))}
        </nav>
        <div class="flex justify-end gap-2">
          <button class={btn('white')} disabled={busy || !dirty} onClick={() => guardarArchivo(false)}>
            {busy ? 'Guardando…' : dirty ? 'Guardar' : 'Guardado'}
          </button>
          {/* las acciones de archivo van en un menú, que también dice qué archivo está abierto */}
          <div class="relative">
            <button class={`${btn('bar')} px-3`} aria-label="Más acciones" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>⋯</button>
            {menu && (
              <>
                <div class="fixed inset-0" onClick={() => setMenu(false)} />
                <div class="absolute top-full right-0 mt-2 flex w-60 flex-col rounded-xl bg-paper p-1.5 shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)]" role="menu">
                  <p class="truncate border-b border-line px-3 pt-1.5 pb-2.5 text-xs text-muted" title={sesion.nombre}>{sesion.nombre}</p>
                  {ACCIONES.map((texto, n) => (
                    <button key={texto} role="menuitem" class="cursor-pointer rounded-lg px-3 py-3 text-left text-[15px] hover:bg-field disabled:opacity-35"
                      disabled={busy} onClick={() => { setMenu(false); acciones[n](); }}>{texto}</button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div class="flex items-center justify-between bg-danger px-5 py-2.5 text-white print:hidden" role="alert">
          {error}<button class={`${iconBase} text-white`} onClick={() => setError('')}>×</button>
        </div>
      )}

      <main class="mx-auto max-w-295 px-5 pt-6 pb-20 movil:px-3 movil:pt-3.5 movil:pb-24 print:hidden">
        {tab === 'venta' && <NuevaVenta key={formKey} datos={datos} onPreview={r => abrirFactura(r, false)} onRegistrar={registrar} />}
        {tab === 'ventas' && <Ventas datos={datos} onVer={verVenta} onEliminar={eliminarVenta} />}
        {tab === 'clientes' && (
          <TablaEditable<Cliente & Record<string, unknown>>
            titulo="Clientes" ayuda="El nombre es el que se elige al hacer una venta" capacidad={300} ancha
            columnas={[
              { key: 'nombre', label: 'Nombre / razón social', ancho: '22%' }, { key: 'nif', label: 'NIF / CIF', ancho: '9rem' },
              { key: 'direccion', label: 'Dirección' }, { key: 'cp', label: 'CP', ancho: '5.5rem' }, { key: 'ciudad', label: 'Ciudad' },
              { key: 'provincia', label: 'Provincia' }, { key: 'email', label: 'Email' }, { key: 'telefono', label: 'Teléfono', ancho: '9rem' },
            ]}
            filas={datos.clientes as (Cliente & Record<string, unknown>)[]}
            nueva={() => ({ nombre: '', nif: '', direccion: '', cp: '', ciudad: '', provincia: '', email: '', telefono: '' })}
            onChange={clientes => cambiar(d => ({ ...d, clientes }))}
          />
        )}
        {tab === 'productos' && (
          <TablaEditable<Producto & Record<string, unknown>>
            titulo="Productos" ayuda="Precio sin IVA" capacidad={300}
            columnas={[
              { key: 'nombre', label: 'Producto / servicio', ancho: '40%' },
              { key: 'precio', label: 'Precio (sin IVA)', tipo: 'dinero', ancho: '10rem' }, { key: 'notas', label: 'Notas' },
            ]}
            filas={datos.productos as (Producto & Record<string, unknown>)[]}
            nueva={() => ({ nombre: '', precio: null, notas: '' })}
            onChange={productos => cambiar(d => ({ ...d, productos }))}
          />
        )}
        {tab === 'descuentos' && <Descuentos datos={datos} onChange={descuentos => cambiar(d => ({ ...d, descuentos }))} />}
        {tab === 'tienda' && <TiendaForm tienda={datos.tienda} onChange={tienda => cambiar(d => ({ ...d, tienda }))} />}
      </main>

      {modal && (
        <div class="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-5 movil:p-0 print:static print:block print:bg-transparent print:p-0"
          role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          {/* en móvil ocupa toda la pantalla */}
          <div class="flex max-h-[calc(100dvh-40px)] w-[min(860px,100%)] flex-col overflow-hidden rounded-[14px] bg-bg movil:h-dvh movil:max-h-none movil:rounded-none print:block print:h-auto print:max-h-none print:w-auto print:overflow-visible print:rounded-none print:bg-white">
            <div class="flex flex-wrap items-center justify-between gap-3 bg-primary py-2.5 pr-3.5 pl-5 text-ink movil:px-3 print:hidden">
              <span class="font-bold">Factura {modal.venta.num}</span>
              <div class="flex flex-wrap gap-2">
                {modal.registrar && (
                  <button class={btn('white')} onClick={() => { registrar(modal.registrar!); setTab('ventas'); }}>Registrar venta</button>
                )}
                <button class={btn('white')} onClick={imprimir}>Imprimir / PDF</button>
                <button class={btn('bar')} onClick={() => setModal(null)}>Cerrar</button>
              </div>
            </div>
            <div class="overflow-auto p-5.5 movil:p-2.5 print:overflow-visible print:p-0"><Factura {...modal} /></div>
          </div>
        </div>
      )}

      {toast && (
        <div class="fixed bottom-5.5 left-1/2 z-60 w-max max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-primary px-4.5 py-2.75 text-ink shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] movil:bottom-20 movil:rounded-2xl movil:text-center print:hidden" role="status">{toast}</div>
      )}
    </div>
  );
}
