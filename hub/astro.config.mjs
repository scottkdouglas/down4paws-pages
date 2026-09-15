// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static, private client hub. No sitemap, no adapter. Auth is Vercel Edge Middleware (middleware.js).
export default defineConfig({
  output: 'static',
  build: { format: 'directory' },
  vite: { plugins: [tailwindcss()] },
});
