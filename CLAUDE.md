# Celestina · Registro de ventas (web)

Archivo de seguimiento para Claude. Léelo al empezar y **actualízalo al terminar** cualquier cambio
que altere el estado, las convenciones o la lista de pendientes (secciones "Estado" y "Pendiente").

## Qué es

Web estática para hacer facturas de la tienda Celestina usando como base de datos el `.ods` del
registro de ventas. Todo ocurre en el navegador: el archivo se abre, se edita y se guarda en local
o, si se configura, en el Google Drive del usuario (llamando a Google desde el navegador).
**No hay servidor ni backend, y el usuario pidió que siga sin haberlo.** El `.ods` debe seguir funcionando en LibreOffice con sus macros.

Pila: Astro 7 (una sola página) + Preact + Tailwind 4 + JSZip + html2canvas-pro (PDF). Node 22. Es una PWA instalable.

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
| `src/components/Ventas.tsx` | Listado con filtros, KPIs y selección de facturas para enviar |
| `src/components/ModalCorreo.tsx` | Modal común de envío por correo (compartir o mailto + descarga) |
| `src/components/EnviarFacturas.tsx` | Prepara los PDF de las facturas seleccionadas y abre `ModalCorreo` |
| `src/components/Fichas.tsx` | Listado genérico con edición en modal (ahora solo lo usa Clientes) |
| `src/components/Productos.tsx` | Listado de productos; el modal incluye sus variedades |
| `src/components/ModalFormulario.tsx` | Modal de formulario común a Fichas y Descuentos |
| `src/components/Selector.tsx` | Desplegable propio (no `<select>`): clientes, productos, variedades, pago, tipo de descuento, mes |
| `src/components/Descuentos.tsx` | Página de descuentos: listado con estado y resumen, y edición en modal |
| `src/components/TiendaForm.tsx` | Datos de la tienda (hoja Tienda) |
| `src/components/Factura.tsx` | Factura que se ve en el modal y se imprime a PDF; `facturaDeVenta` arma sus datos |
| `src/components/ui.ts` | Cadenas de clases de Tailwind compartidas |
| `src/styles/global.css` | Solo `@import 'tailwindcss'`, `@font-face`, `@theme` y `@page` |
| `src/lib/ods.ts` | Lee/escribe celdas de `content.xml` sin tocar estilos, fórmulas ni macros |
| `src/lib/registro.ts` | Mapea hojas ↔ datos y cálculos (totales, número de factura, vencimiento) |
| `src/lib/archivo.ts` | Abrir/guardar con File System Access API, con descarga como alternativa |
| `src/lib/drive.ts` | Google Drive sin servidor: inicio de sesión (Google Identity Services) y API de Drive con `fetch` |
| `src/components/PaginaDrive.tsx` | Página «Google Drive» (menú «⋯ › Carpeta y copias de Drive»): carpeta, registros, copias y estado del guardado automático |
| `src/components/ElegirDrive.tsx` | Modal para abrir un registro (o una copia de seguridad) de Google Drive |
| `src/lib/recuerdo.ts` | Recuerda en IndexedDB el último archivo abierto para reabrirlo al volver |
| `src/lib/pdf.ts` | Convierte la factura en un archivo PDF A4 (imagen JPEG en un PDF escrito a mano) |
| `src/lib/format.ts` | Formato de euros, fechas, porcentajes; `norm` y `parseNum` |
| `public/plantilla.ods` | Registro vacío con macros; es lo que carga "Empezar con uno vacío" |
| `public/manifest.webmanifest` | Manifiesto de la PWA; rutas relativas para que valga con cualquier `base` |
| `public/icons/` | Iconos de la PWA (192, 512 y apple-touch 180): "C" caligráfica sobre `primary` |
| `pwa/sw.js` | Plantilla del service worker, con los marcadores `__VERSION__` y `__FILES__` |
| `pwa/integration.mjs` | Integración de Astro: al compilar escribe `dist/sw.js` con la lista de archivos |
| `tests/ods.test.ts` | Test de ida y vuelta y de las reglas de descuento; depende del contenido de la plantilla |
| `tests/registro-antiguo.ods` | Registro con el formato anterior a los descuentos (sin esa hoja); lo usa el test y debe estar en git |
| `.github/workflows/deploy.yml` | Despliegue a GitHub Pages en cada push a `main` |

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
  - Barra superior: logo, pestañas, "Guardar" y un menú "⋯" (`bloques` en `App.tsx`), a cualquier ancho. Arriba,
    el nombre del archivo, dónde está y la última copia; debajo, por bloques con título (lo pidió el usuario):
    «Archivo» (abrir otro, descargar copia .ods, copia por correo), «Google Drive» (solo si está configurado:
    abrir un registro de Drive, subir este registro, ver en Google Drive, copia en Drive, carpeta y copias) y,
    aparte, «Cerrar el archivo». En móvil se desplaza si no cabe. El nombre del archivo abierto
    solo se ve dentro de ese menú, por decisión del usuario: no volver a ponerlo en la barra.
  - Pestañas (`NAV`, `NAV_TAB`, `NAV_ICONO` en `App.tsx`): en tablet bajan a una fila propia; en móvil
    son una barra fija abajo, translúcida con desenfoque (estilo iOS), con iconos y texto corto (son seis:
    no cabe el largo); la activa lleva el icono en una pastilla `primary` y el texto en negrita.
  - **Zonas seguras del iPhone**: el viewport lleva `viewport-fit=cover` (sin él `env(safe-area-inset-*)`
    vale 0 y la barrita de inicio tapaba el menú de abajo). Por eso cada borde se encarga de la suya:
    barra superior y cabecera de los modales a pantalla completa (arriba), menú de abajo, `main`, aviso
    flotante y modales (abajo), y `<body>` (lados, para el iPhone en horizontal). Si se añade algo pegado
    a un borde en móvil, que sume su `env(safe-area-inset-*)`. Probado forzando las zonas en Chromium
    (`Emulation.setSafeAreaInsetsOverride`); **sin probar en un iPhone real**.
  - Tablas (líneas de Nueva venta y Ventas): en móvil dejan de ser tabla (`table`, `td`, `tdInput`,
    `filaMovil` de `ui.ts`): se oculta la cabecera y cada fila es una tarjeta cuya rejilla define el
    componente en su `<tr>`.
  - Los modales (factura y formularios) ocupan toda la pantalla en móvil.
  - Campos a 16 px en móvil (`movil:text-base`): con menos, iOS hace zoom al enfocarlos.
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
- **Clientes, Productos y Descuentos no se editan en línea**: el usuario pidió ver solo el nombre (con
  un resumen del resto debajo) y un botón «Editar» que abre el formulario en un modal
  (`ModalFormulario.tsx`; estilos del listado en `lista` y `listaFila` de `ui.ts`). El modal trabaja
  sobre una copia: «Aceptar» aplica, «Cancelar» o Escape descartan, y no se cierra al pulsar fuera.
  En clientes y productos el nombre es obligatorio. «Aceptar» no guarda el archivo: eso sigue siendo
  «Guardar».
- **Variedades de producto, con otras dentro** (colores y, dentro de cada color, sus tallas): cada
  producto tiene un precio general y una lista de variedades; cada variedad puede tener a su vez su
  propia lista (`Variedad.subvariedades`), distinta de la de las demás (Verde: XL y L; Rojo: M y S).
  Son dos niveles, no más. El precio es opcional en los dos: vacío = el de arriba (subvariedad →
  variedad → general).
  - En Nueva venta cada línea tiene el desplegable de producto y, **solo si ese producto tiene
    variedades**, un segundo desplegable para elegirla (así lo pidió el usuario; antes era un único
    desplegable con «Vestido · Rosa»), y un tercero solo si la variedad elegida tiene otras dentro.
    Mientras falte alguno vale el precio de arriba, pero la venta no se puede registrar: avisa «Elige
    la variedad de…». Al cambiar de producto se quitan las dos; al cambiar de variedad, la de dentro.
  - En la factura y en Detalle ventas va el nombre compuesto, «Vestido · Verde · XL»
    (`nombreConVariedad`). No hay columnas aparte para la variedad.
  - En el modal de Productos, las de dentro van con sangría bajo su variedad, con «+ Añadir dentro
    de «Verde»».
  - Los descuentos son por producto: valen para todas sus variedades.
  - En el `.ods`: hoja **Variedades** (PRODUCTO, VARIEDAD, PRECIO, SUBVARIEDAD), opcional como la de
    descuentos. Una fila sin SUBVARIEDAD es la variedad con su precio; debajo, una fila por cada
    subvariedad con el suyo. SUBVARIEDAD va la última porque se añadió después: en las hojas de
    antes (incluida la de `public/plantilla.ods`) su rótulo se escribe al guardar la primera;
    se enlaza por el nombre del producto, y las filas de un producto que no existe se ignoran al
    abrir y desaparecen al guardar. La plantilla de LibreOffice no sabe de variedades.
- **Los precios llevan el IVA incluido** (lo pidió el usuario): el precio de un producto, el de una
  variedad, el de la línea de venta, los descuentos en euros y los gastos de envío son lo que paga el
  cliente.
  - `totales`: el total es la suma de las líneas más el envío; la base es total / (1 + IVA) y la cuota
    de IVA, total − base (así base + IVA cuadra siempre con el total). El % de IVA de Nueva venta solo
    cambia el desglose, no el total.
  - En Nueva venta y en la factura el TOTAL va justo debajo de líneas y envío, y el desglose (base
    imponible e IVA) debajo del total. La cabecera de la factura dice «PRECIO (IVA INCL.)».
  - **Las ventas anteriores al cambio y las hechas desde LibreOffice llevan los precios sin IVA.** No
    hay columna que lo diga: `ivaIncluido(venta, líneas)` lo deduce (si líneas + envío suman el total,
    lo llevan incluido) y `Factura.tsx` pinta las antiguas como antes (base, IVA y luego total).
  - En el `.ods` no cambia ninguna columna: Detalle ventas guarda precio e importe con IVA, y Ventas
    la base, el IVA y el total ya calculados. **La plantilla de LibreOffice no se ha tocado**: la hoja
    Productos sigue diciendo «PRECIO (SIN IVA)» y su Nueva venta sumaría el IVA encima. Los precios
    que hubiera en un registro de antes se leen tal cual, ahora como precios con IVA.
- **Sin IRPF y con gastos de envío** (lo pidió el usuario):
  - La web ya no aplica IRPF: no hay campo en Nueva venta ni en Tienda, y las ventas nuevas guardan
    0 en las columnas «IRPF %» e «IRPF» de la hoja Ventas, que se conservan. La factura solo pinta la
    fila de IRPF si la venta lo lleva (facturas antiguas), para que su total cuadre. El valor
    «Retención IRPF por defecto» de la hoja Tienda se lee y se reescribe igual, pero no se usa.
  - Gastos de envío: un importe por venta (`Venta.envio`), con el IVA incluido como los productos y al
    mismo tipo (`totales`). En el `.ods`, columna nueva O «GASTOS DE ENVÍO» en Ventas, que solo
    escribe la web; la suma de las líneas de Detalle ventas es total − envío. No hay envío por
    defecto ni envío gratis a partir de un importe.
  - La plantilla de LibreOffice (hojas Nueva venta y Factura, macros) sigue teniendo IRPF y no sabe
    de envíos.
- **Desplegables propios, no los del sistema** (decisión del usuario): no se usa `<select>` en ningún
  sitio, siempre `Selector.tsx`. Detalles que hay que respetar si se toca:
  - La lista va con `position: fixed` calculada desde el botón, para que no la recorten los
    contenedores con scroll (la tabla de líneas, el cuerpo de los modales); se abre hacia arriba si
    no cabe abajo y se recoloca si la página se mueve.
  - Con más de 8 opciones lleva buscador. Teclado: flechas, Intro, Escape y Tab.
  - Dentro de un modal, Escape cierra solo la lista (se corta la propagación).
  - Suele ir dentro de un `<label>`: por eso las opciones son botones y la lista hace
    `preventDefault` en el clic, o el label volvería a activar el botón.
  - Las fechas siguen con el selector de fecha del navegador (`<input type="date">`).
- **Cliente, producto y forma de pago se eligen en desplegables**, no con autocompletar: lo pidió
  el usuario. Consecuencia: en una venta solo se pueden poner productos y
  clientes que ya estén dados de alta. Si un valor guardado ya no está en la lista (producto borrado,
  forma de pago escrita a mano en la hoja), el desplegable lo añade como opción para no perderlo.
  Al cambiar de producto en una línea se pone siempre su precio de catálogo.
- **El nombre de un descuento no sale en la factura** (decisión del usuario): solo «Descuento −10 % ·
  antes 45,00 €». El nombre sí se guarda en la columna DESCUENTO de Detalle ventas, dentro de la
  etiqueta «Nombre (−10 %)»; `rebajaDeEtiqueta` saca la parte que se imprime.
- **Descuentos** (reglas en `estadoDescuento` y `mejorDescuento` de `registro.ts`, cubiertas por el test):
  - Cada descuento es para un producto (o todos si se deja vacío), en % o en euros por unidad, con
    rango de fechas (extremos incluidos, según la fecha de la venta), límite de usos, cantidad
    mínima, cliente concreto y un interruptor para pausarlo.
  - Se aplican solos en Nueva venta: a cada línea, el que deja el precio más bajo; no se acumulan.
    La etiqueta de la línea permite quitarlo o volver a ponerlo.
  - Un uso = una factura. No hay contador: cada descuento guarda la lista de facturas en las que se
    aplicó (`facturas`), así que borrar una factura devuelve el uso.
  - En el `.ods`: hoja **Descuentos** (opcional; los registros antiguos no la tienen y se crea al
    guardar el primero) y dos columnas más en Detalle ventas, I «DESCUENTO» y J «PRECIO SIN DTO.»,
    que solo escribe la web. El precio de la línea (G) ya va con el descuento, para que cuadre con
    el importe y con las fórmulas de LibreOffice. Las macros de LibreOffice no saben de descuentos.
  - La hoja nueva se crea sin formato propio (anchos y fechas por defecto); solo copia los estilos de
    título y cabecera de Productos. **No se ha abierto en LibreOffice para ver cómo queda.**
- **Envío de facturas por correo** (Ventas: casillas, «Enviar por correo»). El usuario pidió mailto con
  los PDF adjuntos, pero **mailto no admite adjuntos**; acordó con él este reparto:
  - «Compartir» (`navigator.share` con archivos: móvil, Chrome/Edge en Windows) manda los PDF ya
    adjuntos; ahí no se puede fijar el destinatario, y Outlook en Windows ignora también el asunto (probado
    por el usuario). Por eso, al compartir, se copia el destinatario al portapapeles. Solo aparece si
    `navigator.canShare` lo admite. Un `*|FNAME|*` en «Para» lo pone Outlook (contacto de un boletín), no la web.
  - «Descargar PDF y abrir el correo»: descarga los PDF y abre mailto con destinatario (emails de las
    fichas de cliente o el de Tienda), asunto y mensaje; los PDF se adjuntan a mano.
  - **Factura enviada**: al pulsar compartir o abrir el correo, cada factura enviada guarda fecha y hora
    (`Venta.enviada`, ISO local) y lo que había en «Para» (`Venta.enviadaA`; con «Compartir» puede no ser
    el destinatario real, que se elige en la app de correo). Solo el último envío, sin historial. Deja el
    archivo con cambios (hay que «Guardar»). En el `.ods`: columnas P «ENVIADA» y Q «ENVIADA A» de Ventas,
    que solo escribe la web; su rótulo se pone al guardar la primera. En Ventas, columna «Enviada» con una
    pastilla verde (fecha, hora y correo dentro), colores `ok`/`ok-soft` de `@theme`: el único verde del tema.
  - **Marcar como enviada a mano** (barra de selección de Ventas): para las mandadas por otro lado. Pide
    confirmación en un `ModalFormulario` («¿Estás seguro?», botón «Sí, marcar…»; `aceptar` cambia el texto del
    botón), avisa de las que ya constaban como enviadas y deja poner el correo, relleno como al enviarlas
    (`destinatario` en `EnviarFacturas.tsx`). Apunta lo mismo que un envío. No hay forma de desmarcar.
  - Selección: casillas, la de cabecera (las visibles) y el desplegable «Seleccionar por mes o año»,
    que suma todas las de ese mes o año sin mirar los filtros. La selección se pierde al cambiar de pestaña.
  - **Email de envío** en Tienda (`Tienda.envioEmail`, «Envío de facturas»): si está, va en «Para» en vez
    de los emails de los clientes. En el `.ods` es la fila «EMAIL PARA ENVIAR FACTURAS» de la hoja Tienda,
    que la plantilla no tiene: al guardar el primero se añade dos filas por debajo de la última ocupada,
    con los estilos de «CONTACTO» y «EMAIL», sin mover ninguna celda (el test lo comprueba).
  - Los PDF se generan al abrir el modal, no en el clic: `share` exige que la llamada venga del clic.
  - El PDF es una imagen de la factura (el texto no se selecciona), ~135 KB. Se pinta fuera de la vista
    con `windowWidth: 1280` para que desde el móvil salga el diseño de A4 y no el de móvil. Se usa
    `html2canvas-pro` porque `html2canvas` no entiende los colores oklch/color-mix de Tailwind 4. No hay
    jsPDF: `pdf.ts` escribe un PDF mínimo de una página. `pdf.ts` se carga con `import()` (chunk aparte).
- **Copia de seguridad por correo** (menú «⋯» y aviso bajo la barra), con el mismo `ModalCorreo`:
  - Adjunta el `.ods` completo, con los cambios sin guardar, como «<nombre> (copia AAAA-MM-DD).ods».
    «Para» es el de Tienda › Copias de seguridad (`Tienda.copiaEmail`, fila «EMAIL PARA COPIAS DE
    SEGURIDAD»); si está vacío, el email de la tienda (salvo el de relleno «[…]»). Nunca el de facturas.
  - Chrome/Edge (Windows y Android) no dejan compartir `.ods` (no está en su lista de tipos; Safari sí) y
    **`canShare` no lo detecta**: `share` falla con «Permission denied» (`NotAllowedError`). El usuario pidió
    dejar los dos botones igualmente, como en las facturas: si se rechaza, `ModalCorreo` lo explica y remite
    a «Descargar … y abrir el correo». Se le ofreció compartir un PDF con el `.ods` dentro y no lo quiso.
    El portapapeles se escribe sin `await` antes de `share`, para no gastar el permiso del clic.
  - Fecha de la última copia en `Tienda.copia` (ISO local, `2026-10-09T19:55`), fila «ÚLTIMA COPIA DE
    SEGURIDAD» de la hoja Tienda (fila de la web, como el email de envío: `FILAS_WEB` en `registro.ts`).
    Las filas de la web que comparten bloque («COPIA DE SEGURIDAD») van juntas: la que se añade después
    entra debajo de la última del bloque si detrás queda una fila libre; si no, se abre otro bloque al final.
    Se apunta al pulsar compartir o abrir el correo (no se puede saber si se envió), deja el archivo
    con cambios y hay que «Guardar» para que se quede. El archivo enviado ya lleva su propia fecha.
  - Aviso (`DIAS_AVISO_COPIA` = 60) si nunca se ha hecho copia o hace 60 días o más. Se puede ocultar con
    «×» hasta que se vuelva a abrir un archivo.
- **Google Drive** (`src/lib/drive.ts`), sin servidor:
  - Solo existe si al compilar está `PUBLIC_GOOGLE_CLIENT_ID` (identificador de cliente OAuth «Aplicación web»
    de Google Cloud; no es secreto). En GitHub Actions sale de la variable de repositorio `GOOGLE_CLIENT_ID`;
    en local, de `.env.local` (ignorado por git). Sin él no se ve nada de Drive ni se pide nada a Google.
  - Configuración en Google Cloud (la hace el usuario): proyecto, activar «Google Drive API», pantalla de
    consentimiento externa en modo de prueba con su cuenta como usuario de prueba, y credencial «ID de
    cliente de OAuth» tipo aplicación web con orígenes JavaScript `https://celestinamoda.github.io` y
    `http://localhost:4321` (orígenes, sin ruta). Sin URI de redirección: se usa el flujo de token.
  - **En Drive el registro es una Hoja de cálculo de Google, no un .ods** (lo pidió el usuario; el .ods del
    ordenador se sigue abriendo y guardando como siempre). La web solo sabe de .ods, así que: al subir, manda
    un .ods con `mimeType` de Hoja y Google lo convierte; al abrir, lo exporta a .ods (`files/{id}/export`);
    al guardar, sube un .ods encima (`uploadType=media`) y Google vuelve a convertirlo. Consecuencias: en la
    Hoja no hay macros de LibreOffice; las ediciones hechas a mano en Hojas de cálculo sí se leen (si no se
    cambian nombres de hojas ni columnas); cada guardado reimporta el libro entero (Google guarda las versiones).
    **No se ha probado con un .ods exportado de verdad por Google**: `ods.ts` es genérico (repeticiones,
    celdas combinadas, espacios de nombres), pero si algo falla al abrir una Hoja, empezar por ahí.
  - Las copias de seguridad en Drive sí son .ods (para recuperarlas en LibreOffice).
  - Permiso `drive.file`: la web solo ve lo que ella crea. Por eso un registro se sube con «⋯ › Subir este registro a Drive» y desde entonces aparece en «Abrir un registro de Drive» (y «Abrir desde Google Drive» en la bienvenida) en cualquier dispositivo; un archivo
    subido o creado a mano en drive.google.com **no** sale (haría falta el Google Picker, no implementado).
  - La ventana de Google solo se puede abrir dentro de un clic: `accesoDrive()` va lo primero en cada
    manejador, antes de cualquier `await`, y la librería (`gsi/client`) se precarga al arrancar. El token
    (1 h) se guarda en `sessionStorage` (`facturas-ods-drive-token`): al recargar se reabre solo; en una
    pestaña nueva, la bienvenida ofrece «Continuar con … (Google Drive)».
  - **Guardado automático** con el registro en Drive (lo pidió el usuario): cada cambio se guarda solo tras
    `PAUSA_AUTOGUARDADO` (2,5 s; efecto en `App.tsx`, función `guardarEnDrive(manual)`). Antes compara
    `modifiedTime` con el de cuando se abrió: si cambió (otro dispositivo, o alguien en Hojas de cálculo), el
    automático **se para** (`auto = 'parado'`) y avisa, y «Guardar» pregunta antes de pisarlo. También se para
    si caduca la sesión de Google (el token no se puede renovar sin un clic): «Guardar» vuelve a entrar. Si
    falla la red, reintenta cada `PAUSA_REINTENTO` (30 s). No hay fusión de cambios.
  - **Copia de seguridad diaria automática**: tras un guardado en Drive, si `Tienda.copia` no es de hoy, sube una
    copia .ods y apunta la fecha (que el automático guarda enseguida). Con el registro en Drive no sale el aviso
    de los 60 días. «⋯ › Copia de seguridad en Drive» y «Hacer una copia ahora» siguen existiendo a mano.
  - En Drive todo va en la carpeta **«Celestina»** (registros) con la subcarpeta **«Copias de seguridad»**;
    se crean solas. Las copias se reconocen por la carpeta o por el nombre «… (copia AAAA-MM-DD).ods».
  - «⋯ › Ver en Google Drive» abre el archivo actual (`webViewLink`; una Hoja se abre en Hojas de cálculo).
    La página «Google Drive» (`tab = 'drive'`, sin pestaña propia) lista la carpeta con «Abrir aquí» y «Abrir
    en Drive», y enlaza la carpeta.
  - **Si se borra la carpeta o el registro** (el usuario lo probó): borrado o en la papelera cuenta igual
    (`NoEstaEnDrive`; ojo, Drive deja guardar en un archivo de la papelera, por eso `datosDrive` mira `trashed`).
    Al abrir desde Drive o entrar en la página, la carpeta «Celestina» se crea si falta, y si no hay registros
    se ofrece «Crear un registro nuevo en Drive» (la plantilla, como Hoja) o «Subir el registro abierto»; no se
    crea un registro sin preguntar. Si al guardar ya no está, el registro pasa a local (los datos siguen en la
    web y se recuerdan como copia) y se ofrece volver a subirlo. «Continuar con…» de uno borrado lo olvida.
  - El service worker no toca las peticiones a otros orígenes, así que Google no pasa por la caché.
  - Probado con Google simulado en Playwright (librería y API interceptadas, Drive en memoria con carpetas):
    subir, guardado automático, copia diaria (una sola al día), choque (se para y no pisa), página de Drive,
    abrir en Drive, abrir en «iPhone», recargar y «Continuar con…». **Sin probar con Google de
    verdad**: falta el identificador de cliente del usuario.
- **La factura no muestra vencimiento ni datos de pago** (IBAN, titular, concepto): el usuario pidió
  quitarlos. Siguen existiendo en el `.ods` y en la pestaña Tienda (días de vencimiento, IBAN,
  titular) y `Venta.vencimiento` se sigue calculando y guardando; solo no se pintan. El bloque
  NOTAS solo aparece si hay notas.
- **La factura impresa debe salir igual desde cualquier dispositivo**, en A4:
  - `tablet:` y `movil:` son solo de pantalla (`@media screen and …`). Al imprimir desde un móvil
    la página mide como su pantalla y, si no, la factura saldría con el diseño de móvil.
  - En impresión la factura tiene ancho fijo `print:w-[186mm]` (A4 menos los 12 mm de margen de
    `@page`), no el del papel ni el de la pantalla.
  - Las bandas negras (cabecera de conceptos y TOTAL) son fondos; `[print-color-adjust:exact]` las
    fuerza aunque el navegador no imprima fondos (en móvil no suele haber casilla para activarlos).
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
- El usuario ya inicializó git y renombró `_github` a `.github` (primer commit hecho el 2026-10-02).

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
- Página de **Descuentos** y su aplicación en Nueva venta y en la factura. Probado con el test
  (reglas e ida y vuelta del `.ods`, incluido un registro antiguo) y con un recorrido en navegador
  headless: crear, aplicar, quitar a mano, agotar el límite y recuperar el uso al borrar la factura.
- En Nueva venta, al poner un producto la cantidad se rellena con 1.
- Clientes, Productos y Descuentos pasan a listado con edición en modal (recorridos probados en
  navegador headless: editar, cancelar, añadir, eliminar, que el precio nuevo llega a Nueva venta, y
  que el descuento se aplica y la factura no enseña su nombre).
- Variedades de producto con precio por variedad (test de ida y vuelta y recorrido en navegador headless).
- Variedades dentro de variedades (color → tallas), con tercer desplegable en Nueva venta (test de ida
  y vuelta y recorrido en navegador headless, también a 390 px).
- IRPF quitado de la interfaz y gastos de envío añadidos (test y recorrido en navegador headless).
- Precios con IVA incluido en productos, variedades, ventas y envío (test y recorrido en navegador
  headless: Productos, Nueva venta, factura y listado de Ventas).
- Desplegables del sistema sustituidos por uno propio con buscador (probado en navegador headless con
  ratón y teclado reales, dentro de modales y en móvil).
- Autocompletar sustituido por desplegables en Nueva venta y en el modal de descuentos (probado en
  navegador headless).
- Factura impresa igual en móvil y escritorio: el usuario la imprimió desde el móvil y salía distinta.
  Comprobado imprimiendo a PDF en navegador headless con emulación de móvil y de escritorio: mismo
  PDF, una página A4, con las bandas negras aunque los fondos estén desactivados. **Sin confirmar en
  el teléfono real del usuario**: si allí sigue saliendo distinto, preguntar navegador y qué se ve.
- La web recuerda el último archivo abierto y lo reabre al volver; botón "Cerrar" para olvidarlo.
  Probado en navegador headless: copia en bytes, handle con permiso ya concedido (releer y guardar
  encima), cerrar, y archivo borrado del disco. **Sin probar**: el caso en que el navegador vuelve a
  pedir permiso (botón "Continuar con…"), que necesita un clic real y el selector de archivos.

## Pendiente / ideas

- Google Drive: configurar el identificador de cliente y probarlo de verdad; Google Picker para abrir .ods
  subidos a mano; no hay «cerrar sesión de Google» en la interfaz (`desconectarDrive` existe sin usar).

- Copia de seguridad (2026-10-09): probada en navegador headless (aviso a 71 y a 10 días, sin copia,
  descarga + mailto, share simulado en móvil, y que el `.ods` descargado se abre con su fecha y sus ventas).
  Sin probar con Outlook real ni en un teléfono. «Descargar una copia» no cuenta como copia de seguridad.

- Envío por correo (2026-10-09): probado en navegador headless (selección, PDF desde escritorio y móvil,
  mailto, y `share` simulado). Compartir real probado por el usuario en Windows con Outlook (llega el PDF y el
  mensaje; no el asunto). **Sin probar en un teléfono.**
  Si una factura no cupiese en un A4, se reduce para caber (no hay varias páginas).

- `public/favicon.svg` sigue siendo negro; no se ha adaptado al color principal ni al icono de la PWA.
- La PWA no avisa de que hay versión nueva ni se registra como app para abrir archivos `.ods`
  (`file_handlers`); no se ha probado la instalación en un móvil real.
- El nombre de la tienda dentro de la factura va en Arial; ofrecido ponerlo en caligráfica, sin respuesta.
- Un archivo arrastrado a la web no obtiene acceso al disco (se trata como copia); se podría pedir el
  handle con `DataTransferItem.getAsFileSystemHandle()` en Chrome/Edge.
- En la lista de Ventas en móvil no se muestran Base ni IVA (sí en la factura); en tablet, tampoco IVA.
- No hay tests de interfaz; solo el de lectura/escritura del `.ods` y las reglas de descuento.
- La plantilla de LibreOffice sigue trabajando con precios sin IVA (rótulo de Productos, hoja Nueva
  venta y macros); no se ha adaptado al IVA incluido.
- Variedades: sin existencias ni descuentos por variedad; dos niveles como máximo.
- Descuentos: no hay códigos/cupones, ni descuento sobre el total de la factura, ni acumulación.
