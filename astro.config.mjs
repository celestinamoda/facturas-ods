// astro.config.mjs
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';
import pwa from './pwa/integration.mjs';

// En GitHub Actions se rellenan solos (ver .github/workflows/deploy.yml).
export default defineConfig({
  site: process.env.SITE_URL,
  base: process.env.BASE_PATH || '/',
  integrations: [preact(), pwa()],
  vite: { plugins: [tailwindcss()] },
});
