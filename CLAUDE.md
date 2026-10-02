# Celestina · Registro de ventas (web)

Archivo de seguimiento para Claude. Léelo al empezar y **actualízalo al terminar** cualquier cambio
que altere el estado, las convenciones o la lista de pendientes (secciones "Estado" y "Pendiente").

## Qué es

Web estática para hacer facturas de la tienda Celestina usando como base de datos el `.ods` del
registro de ventas. Todo ocurre en el navegador: el archivo se abre, se edita y se guarda en local,
no hay servidor ni backend. El `.ods` debe seguir funcionando en LibreOffice con sus macros.

Pila: Astro 7 (una sola página) + Preact + Tailwind 4 + JSZip. Node 22. Es una PWA instalable.

## Comandos

```bash
npm run dev      # http://localhost:4321
npm test         # ida y vuelta del .ods contra public/plantilla.ods
npm run check    # TypeScript (tsc --noEmit)
npm run build    # sale en dist/
npm run preview  # sirve dist/ (única forma de probar el service worker)
```

Antes de dar un cambio por bueno: `npm run check`, `npm test` y `npm run build`.
El usuario suele tener ya `npm run dev` abierto desde VS Code: si el puerto 4321 está ocupado,
usa ese servidor en vez de arrancar otro, y no lo mates.

## Mapa del código

| Ruta | Qué hace |
|---|---|
| `src/pages/index.astro` | Única página; monta `<App client:only="preact">` y pone las clases de `<body>` |
| `src/components/App.tsx` | Estado global (sesión, datos, pestaña, modal), barra superior, abrir/guardar, imprimir |
| `src/components/NuevaVenta.tsx` | Formulario de venta, líneas y totales |
| `src/components/Ventas.tsx` | Listado con filtros y KPIs |
| `src/components/TablaEditable.tsx` | Tabla genérica editable (Clientes y Productos) |
| `src/components/TiendaForm.tsx` | Datos de la tienda (hoja Tienda) |
| `src/components/Factura.tsx` | Factura que se ve en el modal y se imprime a PDF |
| `src/components/ui.ts` | Cadenas de clases de Tailwind compartidas |
| `src/styles/global.css` | Solo `@import 'tailwindcss'`, `@font-face`, `@theme` y `@page` |
| `src/lib/ods.ts` | Lee/escribe celdas de `content.xml` sin tocar estilos, fórmulas ni macros |
| `src/lib/registro.ts` | Mapea hojas ↔ datos y cálculos (totales, número de factura, vencimiento) |
| `src/lib/archivo.ts` | Abrir/guardar con File System Access API, con descarga como alternativa |
| `src/lib/recuerdo.ts` | Recuerda en IndexedDB el último archivo abierto para reabrirlo al volver |
| `src/lib/format.ts` | Formato de euros, fechas, porcentajes; `norm` y `parseNum` |
| `public/plantilla.ods` | Registro vacío con macros; es lo que carga "Empezar con uno vacío" |
| `public/manifest.webmanifest` | Manifiesto de la PWA; rutas relativas para que valga con cualquier `base` |
| `public/icons/` | Iconos de la PWA (192, 512 y apple-touch 180): "C" caligráfica sobre `primary` |
| `pwa/sw.js` | Plantilla del service worker, con los marcadores `__VERSION__` y `__FILES__` |
| `pwa/integration.mjs` | Integración de Astro: al compilar escribe `dist/sw.js` con la lista de archivos |
| `tests/ods.test.ts` | Test de ida y vuelta; depende del contenido de la plantilla |
| `_github/workflows/deploy.yml` | Despliegue a GitHub Pages (hay que renombrar la carpeta a `.github`) |

## Convenciones de estilo

- **Tailwind en el marcado.** No se escriben clases CSS propias. `global.css` solo lleva el tema.
- **Lo que se repite va a `ui.ts`** como cadena exportada (`btn()`, `input`, `panel`, `th`, `td`…).
  Lo que solo usa un componente se queda como constante al principio de ese componente.
- **No mezclar utilidades que choquen en la misma cadena** (p. ej. `text-left` y `text-right`, o dos
  fondos): gana la que Tailwind emite después, no la que va última. Por eso hay variantes separadas
  (`th`/`thR`, colores y tamaños de `btn()`).
- **Clases canónicas**: `py-2.25` en vez de `py-[9px]` (escala de 4 px). La extensión de Tailwind del
  IDE avisa si no.
- **Puntos de corte**: variantes propias `tablet:` (hasta 900 px) y `movil:` (hasta 600 px), definidas
  en `global.css` en ese orden para que `movil:` gane. Se diseña para escritorio y se ajusta hacia
  abajo. Impresión con `print:`.
- **Responsive**:
  - Barra superior: logo, pestañas, "Guardar" y un menú "⋯" (lista `ACCIONES` en `App.tsx`) con
    abrir otro archivo, descargar copia y cerrar, a cualquier ancho. El nombre del archivo abierto
    solo se ve dentro de ese menú, por decisión del usuario: no volver a ponerlo en la barra.
  - Pestañas: en tablet bajan a una fila propia; en móvil son una barra fija abajo con iconos.
  - Tablas: en móvil dejan de ser tabla (`table`, `td`, `tdInput`, `filaMovil` de `ui.ts`): se oculta
    la cabecera y cada fila es una tarjeta cuya rejilla define el componente en su `<tr>`. El título
    de columna se pinta con `tdLabel` + `data-label`. `TablaEditable` con `ancha` (Clientes) pasa a
    tarjetas ya en tablet.
  - Campos a 16 px en móvil (`movil:text-base`): con menos, iOS hace zoom al enfocarlos.
  - El modal de factura ocupa toda la pantalla en móvil.
  - No debe haber desplazamiento horizontal de página a ningún ancho (probado de 320 a 1280 px).
- **Color principal**: `primary` = `rgb(250 212 193)` (`#FAD4C1`, el mismo que el proyecto
  `celestinamoda/contador`), con `primary-dark` para el hover. El texto encima va en `ink` (negro),
  nunca en blanco: no se leería.
- **Logo**: clase `font-celestina` (Herr Von Muellerhoff, copiada del proyecto contador a
  `src/assets/fonts/`). Es caligráfica: el texto debe ir en "Celestina", no en mayúsculas.
- **La factura va siempre en blanco y negro** (pantalla y PDF): en `Factura.tsx` solo negro, blanco y
  los grises del tema (`muted`, `line-2`). Nunca `primary`, y su tipografía es `font-factura` (Arial).
- Idioma del código, comentarios e interfaz: español.

## Cosas que no son obvias

- El nombre por defecto de la tienda vive **dentro de `public/plantilla.ods`** (hoja Tienda, celda
  C6, más los valores cacheados de las fórmulas que la referencian), no en el código. `App.tsx` solo
  tiene un `'Celestina'` de reserva por si la celda está vacía. `tests/ods.test.ts` comprueba ese nombre.
- Para tocar la plantilla hay que reempaquetar el zip con `mimetype` primero y sin comprimir
  (ver `OdsDocument.toBytes` en `src/lib/ods.ts`).
- La barra superior muestra `tienda.nombre` del archivo abierto: si el `.ods` del usuario lo tiene en
  mayúsculas, el logo sale en mayúsculas caligráficas.
- Las bandas negras de la factura (cabecera de conceptos y TOTAL) son fondos: en el PDF solo salen si
  en el diálogo de impresión está marcado "Gráficos de fondo".
- **Se publicará en `https://celestinamoda.github.io/facturas-ods`** (repo `celestinamoda/facturas-ods`).
  El workflow saca `base` del nombre del repo, no hay que escribirlo en ningún sitio. Ese origen se
  comparte con las demás webs de la cuenta (p. ej. `/contador`), así que todo lo que se guarde en el
  navegador lleva nombre propio: base de datos `facturas-ods`, cachés `facturas-ods-*`.
- **Archivo recordado** (`src/lib/recuerdo.ts`): al abrir un archivo se guarda en IndexedDB y al
  volver a la web se reabre solo. No puede ir en localStorage: el navegador no da la ruta del archivo.
  - Con acceso al disco (Chrome/Edge, abierto con el selector): se guarda el *handle* y al volver se
    **relee del disco**, nunca de una copia, para no pisar cambios hechos en LibreOffice. Si el
    navegador pide permiso otra vez, la bienvenida muestra "Continuar con <archivo>" (el permiso solo
    se puede pedir dentro de un clic).
  - Sin acceso al disco (otros navegadores, archivo arrastrado, plantilla vacía): se guarda una copia
    de los bytes tal como se abrió o se descargó por última vez, y se avisa con la fecha al recuperarla.
  - Los cambios sin guardar no se recuerdan. "Cerrar el archivo" (menú "⋯") lo olvida.
- **PWA**: el service worker solo existe en la compilación (`npm run build` + `npm run preview`); en
  `dev` no se registra. Precachea todo `dist/` y sirve primero de la caché. El nombre de la caché
  lleva un hash del contenido, así que cualquier cambio genera un `sw.js` distinto; la versión nueva
  se instala en segundo plano y se ve en la siguiente carga (no se fuerza la recarga para no perder
  cambios sin guardar). Sin dependencias: ni Workbox ni `vite-pwa`.
- En `pwa/sw.js` los marcadores no pueden aparecer en comentarios: se sustituye la primera aparición.
- Al probar con `BASE_PATH` desde Git Bash, la ruta se convierte sola en una de Windows; usa PowerShell.
- Los scripts de `package.json` llaman a los binarios con `node node_modules/...`; ya venía así y no
  se sabe el motivo, así que no lo cambies sin preguntar.
- El proyecto todavía **no es un repositorio git**.

## Estado (2026-10-02)

Funciona: arranca, compila, pasa `check` y `test`. Hecho en esta fecha:

- Color principal cambiado de negro a `rgb(250 212 193)`; factura mantenida en blanco y negro.
- Logo con la fuente `font-celestina` en la bienvenida y en la barra superior.
- Migración completa de CSS propio a Tailwind 4 (`@tailwindcss/vite`), revisada con capturas de todas
  las pestañas, el modal de factura, la vista de impresión y móvil.
- Nombre por defecto de la plantilla cambiado de `CELESTINA` a `Celestina`.
- La etiqueta "BORRADOR" ya no se monta sobre el nombre de la tienda al imprimir una vista previa.
- Convertida en PWA instalable y con uso sin conexión. Probado con `base` `/facturas/` en un navegador
  headless: sin errores de instalabilidad, y sin red recarga, carga la plantilla y la fuente.
- Diseño responsive: navegación inferior y menú de archivo en móvil, tablas como tarjetas, modal a
  pantalla completa. Revisado con capturas de todas las vistas a 320, 360, 390, 768 y 1280 px, sin
  desbordes ni errores de consola. Sin probar en un teléfono real (teclado, gestos, zona segura).
- La web recuerda el último archivo abierto y lo reabre al volver; botón "Cerrar" para olvidarlo.
  Probado en navegador headless: copia en bytes, handle con permiso ya concedido (releer y guardar
  encima), cerrar, y archivo borrado del disco. **Sin probar**: el caso en que el navegador vuelve a
  pedir permiso (botón "Continuar con…"), que necesita un clic real y el selector de archivos.

## Pendiente / ideas

- `public/favicon.svg` sigue siendo negro; no se ha adaptado al color principal ni al icono de la PWA.
- La PWA no avisa de que hay versión nueva ni se registra como app para abrir archivos `.ods`
  (`file_handlers`); no se ha probado la instalación en un móvil real.
- Forzar los fondos negros de la factura al imprimir (`print-color-adjust: exact`) para no depender
  de la casilla "Gráficos de fondo". Ofrecido al usuario, sin respuesta.
- El nombre de la tienda dentro de la factura va en Arial; ofrecido ponerlo en caligráfica, sin respuesta.
- Inicializar git y publicar en GitHub Pages (pasos en `README.md`).
- Un archivo arrastrado a la web no obtiene acceso al disco (se trata como copia); se podría pedir el
  handle con `DataTransferItem.getAsFileSystemHandle()` en Chrome/Edge.
- En la lista de Ventas en móvil no se muestran Base ni IVA (sí en la factura); en tablet, tampoco IVA.
- No hay tests de interfaz; solo el de lectura/escritura del `.ods`.
