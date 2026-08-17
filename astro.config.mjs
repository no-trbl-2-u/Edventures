// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Used for sitemap and canonical URLs.
  site: 'https://edventures.pet',

  // Static output. Phase 3 adds the Cloudflare adapter for the
  // booking form's serverless endpoint.
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },
});
