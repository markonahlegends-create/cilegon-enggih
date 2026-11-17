import fs from 'node:fs';
import path from 'node:path';

/**
 * Generate sitemap.xml saat build.
 *
 * Sebelumnya `public/sitemap.xml` bertanggal statis sehingga `lastmod` basi
 * selamanya dan produk baru tidak pernah masuk sitemap. Sekarang:
 *  - daftar URL diambil dari data produk (satu sumber kebenaran),
 *  - `lastmod` memakai tanggal build,
 *  - domain mengikuti VITE_STORE_DOMAIN / STORE_DOMAIN.
 */

const DOMAIN = (process.env.VITE_STORE_DOMAIN || process.env.STORE_DOMAIN || 'cilegon-enggih.vercel.app')
  .replace(/^https?:\/\//, '')
  .replace(/\/+$/, '');

const STATIC_ROUTES = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/katalog', changefreq: 'daily', priority: '0.9' },
  { path: '/custom-korporat', changefreq: 'monthly', priority: '0.8' },
  { path: '/tentang-kami', changefreq: 'monthly', priority: '0.6' },
  { path: '/cara-order-faq', changefreq: 'monthly', priority: '0.6' },
  { path: '/lacak-pesanan', changefreq: 'weekly', priority: '0.5' },
  { path: '/legalitas', changefreq: 'yearly', priority: '0.3' }
];

/** Ambil slug produk dari src/data/products.ts tanpa menjalankan TypeScript. */
const readProductSlugs = () => {
  const file = path.join(process.cwd(), 'src', 'data', 'products.ts');
  if (!fs.existsSync(file)) return [];
  const source = fs.readFileSync(file, 'utf8');
  const slugs = new Set();
  for (const m of source.matchAll(/^\s*slug:\s*['"]([a-z0-9-]+)['"]/gm)) {
    slugs.add(m[1]);
  }
  return [...slugs].sort();
};

export const generateSitemap = (outDir = 'dist') => {
  const today = new Date().toISOString().slice(0, 10);
  const entries = [
    ...STATIC_ROUTES.map((r) => ({ ...r, lastmod: today })),
    ...readProductSlugs().map((slug) => ({
      path: `/produk/${slug}`,
      changefreq: 'weekly',
      priority: '0.7',
      lastmod: today
    }))
  ];

  const body = entries
    .map(
      (e) =>
        `  <url>\n    <loc>https://${DOMAIN}${e.path}</loc>\n    <lastmod>${e.lastmod}</lastmod>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  const dir = path.join(process.cwd(), outDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'sitemap.xml'), xml, 'utf8');

  // robots.txt ikut diperbarui agar menunjuk sitemap yang benar.
  const robots = [
    '# Cilegon Enggih Official Store',
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /api/',
    '',
    `Sitemap: https://${DOMAIN}/sitemap.xml`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'robots.txt'), robots, 'utf8');

  return { count: entries.length, domain: DOMAIN };
};

/** Plugin Vite: jalankan setelah bundel selesai ditulis. */
export const sitemapPlugin = () => ({
  name: 'cilegon-sitemap',
  apply: 'build',
  closeBundle() {
    try {
      const { count, domain } = generateSitemap('dist');
      console.log(`\n[sitemap] ${count} URL untuk ${domain}`);
    } catch (err) {
      console.warn('[sitemap] gagal membuat sitemap:', err.message);
    }
  }
});
