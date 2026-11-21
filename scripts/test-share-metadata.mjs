import { store } from '../server/db.js';
import handler from '../api/share.js';

await store.init();
const article = store.get().articles.find((item) => (item.status || 'published') === 'published');
if (!article) throw new Error('No published article available for the share metadata test.');

const headers = {};
const req = {
  url: `/api/share?slug=${encodeURIComponent(article.slug)}`,
  headers: { host: 'infokelurahan.vercel.app' },
};
const res = {
  setHeader(name, value) {
    headers[name] = value;
  },
  end(body) {
    this.body = String(body);
  },
};

await handler(req, res);
const expectedImage = /^https?:\/\//i.test(article.cover)
  ? article.cover
  : `https://infokelurahan.vercel.app${article.cover || '/images/musrenbang.jpg'}`;
for (const value of [article.title, 'og:image', expectedImage, 'twitter:card']) {
  if (!res.body.includes(value)) throw new Error(`Share preview is missing expected value: ${value}`);
}
if (res.statusCode !== 200 || !headers['Content-Type']?.includes('text/html')) {
  throw new Error('Share preview did not return a successful HTML response.');
}

const missingRes = { setHeader() {}, end(body) { this.body = String(body); } };
await handler({ ...req, url: '/api/share?slug=__missing_article__' }, missingRes);
if (missingRes.statusCode !== 404) throw new Error('Unknown article should return HTTP 404.');

console.log(`✓ Share preview metadata uses the article's title and cover (${article.slug}).`);
