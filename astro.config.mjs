// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  // Update to the real domain once purchased (Phase 0.2).
  // Used for sitemap and canonical URLs.
  site: 'https://edventurespetsitting.com',

  // Static output. Phase 3 adds the Cloudflare adapter for the
  // booking form's serverless endpoint.
  output: 'static',

  vite: {
    plugins: [tailwindcss()],
  },
});
