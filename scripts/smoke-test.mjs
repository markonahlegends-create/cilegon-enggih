/**
 * Smoke test API + build statis.
 * Usage: node scripts/smoke-test.mjs [baseUrl]
 */
const base = process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:3001';

let passed = 0;
let failed = 0;

async function check(label, fn) {
  try {
    const result = await fn();
    if (result === false) throw new Error('assertion failed');
    passed += 1;
    console.log(`  ✓ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`  ✗ ${label} — ${error.message}`);
  }
}

async function json(path, options) {
  const res = await fetch(`${base}${path}`, options);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

console.log(`\nSmoke test Info Kelurahan → ${base}\n`);

await check('GET /api/health', async () => {
  const { status, data } = await json('/api/health');
  return status === 200 && data.ok && data.published > 10;
});

await check('GET /api/bootstrap', async () => {
  const { status, data } = await json('/api/bootstrap');
  return status === 200 && data.categories.length === 10 && data.settings.name === 'Info Kelurahan';
});

await check('GET /api/articles (paginasi)', async () => {
  const { status, data } = await json('/api/articles?limit=5');
  return status === 200 && data.items.length === 5 && data.meta.total > 10;
});

await check('GET /api/articles?q=cari', async () => {
  const { status, data } = await json('/api/articles?q=drainase');
  return status === 200 && data.items.length > 0;
});

let slug = '';
await check('GET /api/articles/:slug + komentar', async () => {
  const list = await json('/api/articles?limit=1');
  slug = list.data.items[0].slug;
  const { status, data } = await json(`/api/articles/${slug}`);
  return status === 200 && data.article.content.length > 200 && Array.isArray(data.related);
});

await check('POST /api/comments (moderasi)', async () => {
  const { status } = await json('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articleSlug: slug, name: 'Smoke Test', body: 'Komentar uji otomatis.' }),
  });
  return status === 201;
});

await check('POST /api/subscribe', async () => {
  const { status, data } = await json('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `smoke${Date.now()}@example.com` }),
  });
  return status === 201 && data.ok;
});

await check('Admin login + proteksi', async () => {
  const unauthorized = await json('/api/admin/overview');
  if (unauthorized.status !== 401) return false;
  const login = await json('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: process.env.ADMIN_PASSWORD || 'infokelurahan2026' }),
  });
  if (login.status !== 200 || !login.data.token) return false;
  const overview = await json('/api/admin/overview', {
    headers: { Authorization: `Bearer ${login.data.token}` },
  });
  return overview.status === 200 && overview.data.counts.published > 10;
});

await check('GET /api/sitemap.xml', async () => {
  const res = await fetch(`${base}/api/sitemap.xml`);
  const text = await res.text();
  return res.status === 200 && text.includes('<urlset');
});

await check('GET /api/rss.xml', async () => {
  const res = await fetch(`${base}/api/rss.xml`);
  const text = await res.text();
  return res.status === 200 && text.includes('<rss');
});

console.log(`\n${failed === 0 ? '✅' : '❌'} Selesai: ${passed} lulus, ${failed} gagal.\n`);
process.exit(failed === 0 ? 0 : 1);
