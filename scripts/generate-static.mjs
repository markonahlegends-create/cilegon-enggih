/**
 * Generate aset statis saat build:
 *  - public/sitemap.xml
 *  - public/rss.xml
 *  - public/covers/*.svg (sampul kategori untuk berita tanpa foto)
 *
 * Dijalankan otomatis oleh `npm run build`.
 */
import fs from 'node:fs';
import path from 'node:path';
import '../server/env.js';
import { seedDatabase } from '../server/seed.js';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const coverDir = path.join(publicDir, 'covers');
const SITE = process.env.SITE_URL || 'https://infokelurahan.vercel.app';

const doc = seedDatabase();
const published = doc.articles
  .filter((a) => (a.status || 'published') === 'published')
  .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

const esc = (str) =>
  String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

fs.mkdirSync(coverDir, { recursive: true });

/* ---------------- Sampul SVG per kategori ---------------- */

function coverSvg(name, accent, kicker = 'INFO KELURAHAN') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="Sampul ${esc(name)}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="0.62" stop-color="#0b2545"/>
      <stop offset="1" stop-color="#071a33"/>
    </linearGradient>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="#ffffff" stroke-opacity="0.075" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <rect width="1200" height="675" fill="url(#grid)"/>
  <circle cx="1040" cy="80" r="230" fill="#ffffff" opacity="0.05"/>
  <circle cx="1100" cy="600" r="150" fill="#ffffff" opacity="0.04"/>
  <path d="M0 560 C 220 470, 420 640, 700 540 S 1050 470, 1200 520 L1200 675 L0 675 Z" fill="#ffffff" opacity="0.06"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="3">
    <rect x="82" y="88" width="46" height="46" rx="10"/>
    <path d="M93 111h24M105 99v24"/>
  </g>
  <text x="144" y="121" font-family="'Plus Jakarta Sans', Helvetica, Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="4" fill="#ffffff" fill-opacity="0.82">${esc(kicker)}</text>
  <text x="80" y="330" font-family="'Plus Jakarta Sans', Helvetica, Arial, sans-serif" font-size="86" font-weight="800" letter-spacing="-1.5" fill="#ffffff">${esc(name)}</text>
  <rect x="84" y="376" width="112" height="8" rx="4" fill="#ffffff" fill-opacity="0.85"/>
  <text x="82" y="452" font-family="'Plus Jakarta Sans', Helvetica, Arial, sans-serif" font-size="26" font-weight="500" fill="#ffffff" fill-opacity="0.8">Kelurahan Karang Asem · Kec. Cibeber · Kota Cilegon</text>
  <text x="82" y="600" font-family="'Plus Jakarta Sans', Helvetica, Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="1" fill="#ffffff" fill-opacity="0.55">INFO KELURAHAN · FADIL LABS</text>
</svg>`;
}

doc.categories.forEach((category) => {
  const file = path.join(coverDir, `${category.slug}.svg`);
  fs.writeFileSync(file, coverSvg(category.name, category.accent));
});
fs.writeFileSync(
  path.join(coverDir, 'umum.svg'),
  coverSvg('Info Kelurahan', '#e11d2e', 'BERITA WARGA')
);

/* ---------------- sitemap.xml ---------------- */

const staticPages = ['/berita', '/agenda', '/tentang', '/kontak', '/redaksi', '/privasi', '/tersimpan'];
const urls = [
  { loc: '/', priority: '1.0', lastmod: published[0]?.publishedAt },
  { loc: '/berita', priority: '0.9', lastmod: published[0]?.publishedAt },
  ...doc.categories.map((c) => ({
    loc: `/kategori/${c.slug}`,
    priority: '0.7',
    lastmod: published.find((a) => a.category === c.slug)?.publishedAt,
  })),
  ...published.map((a) => ({ loc: `/artikel/${a.slug}`, priority: '0.8', lastmod: a.updatedAt || a.publishedAt })),
  ...staticPages.map((loc) => ({ loc, priority: '0.4' })),
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);

/* ---------------- rss.xml ---------------- */

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(doc.settings.name)}</title>
    <link>${SITE}</link>
    <description>${esc(doc.settings.description)}</description>
    <language>id-ID</language>
    <copyright>© ${new Date().getFullYear()} ${esc(doc.settings.name)} — Fadil Labs</copyright>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE}/rss.xml" rel="self" type="application/rss+xml" />
${published
  .slice(0, 40)
  .map(
    (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${SITE}/artikel/${a.slug}</link>
      <guid isPermaLink="true">${SITE}/artikel/${a.slug}</guid>
      <category>${esc(doc.categories.find((c) => c.slug === a.category)?.name || 'Berita')}</category>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <description>${esc(a.dek)}</description>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>
`;
fs.writeFileSync(path.join(publicDir, 'rss.xml'), rss);
fs.writeFileSync(
  path.join(publicDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin\n\nSitemap: ${SITE}/sitemap.xml\n`
);

console.log(
  `[Info Kelurahan] Aset statis dibuat: sitemap.xml (${urls.length} URL), rss.xml (${published.length} item), robots.txt, ${doc.categories.length + 1} sampul SVG.`
);
