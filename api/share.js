import '../server/env.js';
import { store } from '../server/db.js';

const SITE_NAME = 'Info Kelurahan';
const DEFAULT_IMAGE = '/images/musrenbang.jpg';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absoluteUrl(value, origin) {
  const candidate = String(value || '');
  if (/^https?:\/\//i.test(candidate)) return candidate;
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return `${origin}${candidate}`;
  return `${origin}${DEFAULT_IMAGE}`;
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', `https://${req.headers?.host || 'infokelurahan.vercel.app'}`);
  const slug = String(url.searchParams.get('slug') || '').trim();
  const origin = `https://${req.headers?.host || 'infokelurahan.vercel.app'}`;

  await store.init();
  const doc = store.get();
  const article = doc.articles.find((item) => item.slug === slug && (item.status || 'published') === 'published');
  if (!article) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<!doctype html><html lang="id"><meta charset="utf-8"><title>Berita tidak ditemukan — Info Kelurahan</title><body>Berita tidak ditemukan.</body></html>');
    return;
  }

  const title = `${article.title} — ${SITE_NAME}`;
  const description = article.dek || `Baca berita ${article.title} di ${SITE_NAME}.`;
  const image = absoluteUrl(article.cover, origin);
  const canonical = `${origin}/artikel/${encodeURIComponent(article.slug)}`;
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}">
<meta property="og:image:alt" content="${escapeHtml(article.title)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}">
</head><body><article><h1>${escapeHtml(article.title)}</h1><p>${escapeHtml(description)}</p><img src="${escapeHtml(image)}" alt="${escapeHtml(article.title)}"></article></body></html>`;

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400');
  res.end(html);
}
