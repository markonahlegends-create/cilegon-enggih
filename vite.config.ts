import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error — modul mjs tanpa tipe; lihat scripts/sitemap.d.ts
import { sitemapPlugin } from './scripts/sitemap.mjs';

export default defineConfig({
  // sitemapPlugin: sitemap.xml & robots.txt digenerate ulang setiap build,
  // sehingga produk baru otomatis masuk dan lastmod tidak basi.
  plugins: [react(), sitemapPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
