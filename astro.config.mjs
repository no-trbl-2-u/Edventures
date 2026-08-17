// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Apex domain, registered Phase 0.2. Used for the sitemap and canonical URLs.
  // Keep in sync with SITE.url in src/lib/site.ts.
  site: 'https://edventures.pet',

  // Static output. Phase 3 adds the Cloudflare adapter for the
  // booking form's serverless endpoint.
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), sitemap()],
});