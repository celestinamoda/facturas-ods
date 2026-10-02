// pwa/integration.mjs — genera dist/sw.js con la lista de archivos a precachear
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export default function pwa() {
  return {
    name: 'celestina-pwa',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const dist = fileURLToPath(dir);
        const hash = createHash('sha1');
        const files = readdirSync(dist, { recursive: true, withFileTypes: true })
          .filter(f => f.isFile())
          .map(f => relative(dist, join(f.parentPath, f.name)).replaceAll('\\', '/'))
          .filter(f => f !== 'sw.js')
          .sort();
        for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
        // rutas relativas a sw.js, para que valgan con cualquier `base`
        const urls = files.map(f => (f === 'index.html' ? './' : f));
        const sw = readFileSync(new URL('./sw.js', import.meta.url), 'utf8')
          .replace('__VERSION__', hash.digest('hex').slice(0, 10))
          .replace('__FILES__', JSON.stringify(urls));
        writeFileSync(join(dist, 'sw.js'), sw);
        logger.info(`sw.js: ${urls.length} archivos precacheados`);
      },
    },
  };
}
