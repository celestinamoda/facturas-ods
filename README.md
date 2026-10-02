# Celestina · Registro de ventas (web)

Web estática (Astro + Preact + Tailwind) para hacer facturas usando como base de datos el `.ods` del registro de ventas.
Todo ocurre en el navegador: el archivo no se sube a ningún sitio.

- **Abrir**: carga tu `registro de ventas celestina.ods` (o empieza con la plantilla vacía).
- **Nueva venta → Registrar**: añade la venta a *Ventas* y *Detalle ventas*, sube el número de factura y abre la factura para **Imprimir / PDF**.
- **Clientes, Productos, Tienda**: se editan en la web y se escriben en sus hojas.
- **Descuentos**: por producto, con fechas, límite de usos, cantidad mínima y cliente. Se aplican solos en la venta y salen en la factura.
- **Guardar**: en Chrome/Edge sobrescribe el mismo archivo; en otros navegadores descarga el `.ods` actualizado.
- **Al volver a la web** se reabre solo el último archivo. En Chrome/Edge se relee del disco (puede pedir
  permiso con un clic); en otros navegadores se recupera la copia de la última vez. **Cerrar el archivo** (menú «⋯») lo olvida.

Es una PWA: se puede instalar desde el navegador (icono de instalar en la barra de direcciones de
Chrome/Edge) y, tras la primera visita, funciona sin conexión.

El `.ods` sigue funcionando en LibreOffice con sus macros: solo se modifican los valores de las celdas
(estilos, fórmulas, botones y macros se conservan). Al abrirlo, la macro `Recalcular` actualiza las fórmulas.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # ida y vuelta del .ods (lectura/escritura)
npm run check    # TypeScript
npm run build
npm run preview  # sirve dist/; aquí sí hay service worker (en `dev` no)
```

## Publicar en GitHub Pages

```bash
git init && git add . && git commit -m "Registro de ventas web"
git branch -M main
git remote add origin https://github.com/celestinamoda/facturas-ods.git
git push -u origin main
```

En GitHub: **Settings → Pages → Source: GitHub Actions**. El workflow `.github/workflows/deploy.yml`
compila y publica en `https://celestinamoda.github.io/facturas-ods/` en cada push a `main`.

## Estructura

| Ruta | Qué hace |
|---|---|
| `src/lib/ods.ts` | Lee/escribe celdas en `content.xml` del `.ods` sin tocar nada más |
| `src/lib/registro.ts` | Mapea hojas ↔ datos (Tienda, Clientes, Productos, Ventas, Detalle ventas, Descuentos), cálculos y reglas de descuento |
| `src/lib/archivo.ts` | Abrir/guardar (File System Access API con descarga como alternativa) |
| `src/lib/recuerdo.ts` | Recuerda el último archivo abierto (IndexedDB) |
| `src/components/` | Interfaz: nueva venta, ventas, tablas editables, tienda y factura imprimible |
| `src/components/ui.ts` | Clases de Tailwind compartidas (botones, campos, tablas, paneles) |
| `src/styles/global.css` | Tema de Tailwind: color principal, grises y fuentes |
| `public/plantilla.ods` | Registro vacío con macros |
| `public/manifest.webmanifest`, `public/icons/` | Manifiesto e iconos de la PWA |
| `pwa/` | Service worker (`sw.js`) y la integración que lo genera en `dist/` al compilar |
