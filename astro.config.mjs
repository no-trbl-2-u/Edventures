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

  // Static output, and it stays that way. The booking endpoint (Phase 3.7)
  // is a Cloudflare Pages Function in functions/, not an Astro route: the
  // Cloudflare adapter has dropped Pages support and now targets Workers,
  // so adopting it would migrate a live apex domain off Pages for one URL.
  output: 'static',

  // One URL shape, no redirects.
  //
  // The default (directory format) writes about/index.html, which Cloudflare
  // Pages serves at /about/ and 308-redirects /about to. That left the site
  // disagreeing with itself in three places: canonical said /about, the
  // sitemap said /about/, and the canonical URL itself redirected -- which is
  // precisely the split ranking signal 2.6.1 exists to prevent.
  //
  // `format: 'file'` writes about.html, which Pages serves at /about with no
  // redirect, matching the canonical and every internal link.
  trailingSlash: 'never',
  build: { format: 'file' },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [react(), sitemap()],
});