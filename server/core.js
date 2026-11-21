/**
 * Core API Info Kelurahan — framework agnostic.
 *
 * Dipakai ulang oleh:
 *  - server/app.js  → adapter Express (dev, self-host, preview)
 *  - api/index.js   → adapter Vercel Serverless Function
 *
 * Handler menerima satu objek request netral dan mengembalikan
 * { status, body, headers, binary } sehingga bisa dijalankan di Node biasa.
 */
import { store, slugify, uid } from './db.js';
import {
  checkPassword,
  createToken,
  verifyToken,
  registerLoginAttempt,
  clearLoginAttempts,
  IS_DEV_PASSWORD,
  TOKEN_TTL_HOURS,
} from './auth.js';

const PAGE_SIZE = 12;
const MAX_PAGE_SIZE = 60;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const fail = (status, message, details) => {
  throw new HttpError(status, message, details);
};

/* ------------------------------------------------------------------ *
 * Helper umum
 * ------------------------------------------------------------------ */

function todayJakarta() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function publicSettings(settings) {
  return {
    name: settings.name,
    tagline: settings.tagline,
    description: settings.description,
    village: settings.village,
    district: settings.district,
    city: settings.city,
    province: settings.province,
    address: settings.address,
    email: settings.email,
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    officeHours: settings.officeHours,
    socials: settings.socials || {},
    credit: settings.credit,
    editors: settings.editors || [],
    announcement: settings.announcement,
    seo: settings.seo || {},
  };
}

function readingTime(content) {
  const words = String(content || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function isPublished(article) {
  return (article.status || 'published') === 'published';
}

function byDateDesc(a, b) {
  return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
}

function categoryOf(doc, slug) {
  return doc.categories.find((c) => c.slug === slug) || null;
}

function authorOf(doc, slug) {
  return doc.authors.find((a) => a.slug === slug) || null;
}

function commentCount(doc, slug) {
  return doc.comments.filter((c) => c.articleSlug === slug && c.status === 'approved').length;
}

function decorate(doc, article, options = {}) {
  const category = categoryOf(doc, article.category);
  const author = authorOf(doc, article.author);
  const base = {
    id: article.id,
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    cover: article.cover || '/covers/umum.svg',
    coverCaption: article.coverCaption || '',
    category: article.category,
    categoryName: category?.name || 'Berita',
    categoryAccent: category?.accent || '#e11d2e',
    author: article.author,
    authorName: author?.name || 'Redaksi',
    authorRole: author?.role || 'Redaksi',
    authorAccent: author?.accent || '#e11d2e',
    tags: Array.isArray(article.tags) ? article.tags : [],
    featured: Boolean(article.featured),
    breaking: Boolean(article.breaking),
    status: article.status || 'published',
    views: Number(article.views || 0),
    readingTime: readingTime(article.content),
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt || article.publishedAt,
    url: `/artikel/${article.slug}`,
    commentCount: commentCount(doc, article.slug),
  };
  if (options.withContent) base.content = article.content;
  return base;
}

function paginate(items, query) {
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(query.limit) || PAGE_SIZE));
  const page = Math.max(1, Number(query.page) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    meta: { page, limit, total, totalPages, hasMore: page < totalPages },
  };
}

function requireString(value, label, { min = 1, max = 5000 } = {}) {
  const str = String(value ?? '').trim();
  if (str.length < min) fail(400, `${label} minimal ${min} karakter`);
  if (str.length > max) fail(400, `${label} maksimal ${max} karakter`);
  return str;
}

function normalizeTags(input) {
  if (Array.isArray(input)) return input.map((t) => String(t).trim()).filter(Boolean).slice(0, 8);
  return String(input || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function articlePayload(doc, body, existing) {
  const title = requireString(body.title, 'Judul', { min: 6, max: 180 });
  const content = requireString(body.content, 'Isi berita', { min: 40, max: 60000 });
  const category = String(body.category || '').trim();
  if (!categoryOf(doc, category)) fail(400, 'Kategori tidak valid');
  const authorSlug = String(body.author || '').trim() || doc.authors[0]?.slug;
  if (!authorOf(doc, authorSlug)) fail(400, 'Penulis tidak valid');

  const now = new Date().toISOString();
  const status = body.status === 'draft' ? 'draft' : 'published';
  const requestedSlug = slugify(body.slug || title, 'artikel');
  let slug = requestedSlug;
  if (existing && existing.slug !== requestedSlug && doc.articles.some((a) => a.slug === requestedSlug)) {
    slug = `${requestedSlug}-${Date.now().toString(36).slice(-4)}`;
  }
  if (!existing) {
    while (doc.articles.some((a) => a.slug === slug)) slug = `${slug}-${Math.random().toString(36).slice(2, 5)}`;
  }

  return {
    id: existing?.id || uid('ar'),
    slug,
    title,
    dek: String(body.dek || '').trim().slice(0, 400),
    content,
    cover: String(body.cover || '').trim() || '/covers/umum.svg',
    coverCaption: String(body.coverCaption || '').trim().slice(0, 300),
    category,
    tags: normalizeTags(body.tags),
    author: authorSlug,
    status,
    featured: Boolean(body.featured),
    breaking: Boolean(body.breaking),
    views: existing?.views || 0,
    publishedAt: body.publishedAt || existing?.publishedAt || now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ *
 * Route publik
 * ------------------------------------------------------------------ */

const routes = [];
const route = (method, pattern, handler, options = {}) =>
  routes.push({ method, pattern, handler, admin: Boolean(options.admin) });

function matchRoute(pattern, path) {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i += 1) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}

route('GET', '/api/health', async () => {
  const doc = store.get();
  return {
    body: {
      ok: true,
      name: doc.settings.name,
      mode: store.mode,
      articles: doc.articles.length,
      published: doc.articles.filter(isPublished).length,
      time: new Date().toISOString(),
    },
  };
});

route('GET', '/api/bootstrap', async ({ query }) => {
  const doc = store.get();
  const published = doc.articles.filter(isPublished).sort(byDateDesc);
  const limit = Math.min(12, Math.max(1, Number(query.limit) || 6));
  return {
    body: {
      settings: publicSettings(doc.settings),
      categories: doc.categories,
      authors: doc.authors,
      agenda: doc.agenda
        .filter((a) => a.date >= todayJakarta())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 4),
      breaking: published.filter((a) => a.breaking).slice(0, 5).map((a) => decorate(doc, a)),
      headlines: published.slice(0, limit).map((a) => decorate(doc, a)),
      tags: topTags(doc, 14),
      counts: {
        articles: published.length,
        categories: doc.categories.length,
        readers: published.reduce((sum, a) => sum + Number(a.views || 0), 0),
      },
    },
  };
});

function topTags(doc, limit = 12) {
  const map = new Map();
  doc.articles.filter(isPublished).forEach((a) => {
    (a.tags || []).forEach((tag) => {
      const key = String(tag);
      map.set(key, (map.get(key) || 0) + 1);
    });
  });
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count, slug: slugify(name) }));
}

route('GET', '/api/articles', async ({ query }) => {
  const doc = store.get();
  let items = doc.articles.filter(isPublished).sort(byDateDesc);

  const category = query.category && query.category !== 'semua' ? String(query.category) : '';
  if (category) items = items.filter((a) => a.category === category);
  if (query.author) items = items.filter((a) => a.author === String(query.author));
  if (query.tag) {
    const tag = String(query.tag).toLowerCase();
    items = items.filter((a) => (a.tags || []).some((t) => slugify(t) === slugify(tag)));
  }
  if (query.featured === '1' || query.featured === 'true') items = items.filter((a) => a.featured);
  if (query.breaking === '1' || query.breaking === 'true') items = items.filter((a) => a.breaking);
  if (query.q) {
    const q = String(query.q).toLowerCase();
    items = items.filter((a) => {
      const cat = categoryOf(doc, a.category);
      const author = authorOf(doc, a.author);
      return [a.title, a.dek, a.content, cat?.name, author?.name, ...(a.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }
  if (query.exclude) items = items.filter((a) => a.slug !== String(query.exclude));

  const sort = String(query.sort || 'latest');
  if (sort === 'popular') items.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  if (sort === 'oldest') items.sort((a, b) => new Date(a.publishedAt) - new Date(b.publishedAt));

  const { items: pageItems, meta } = paginate(items, query);
  return {
    body: {
      items: pageItems.map((a) => decorate(doc, a)),
      meta,
      category: category ? categoryOf(doc, category) : null,
    },
  };
});

route('GET', '/api/articles/:slug', async ({ params }) => {
  const doc = store.get();
  const article = doc.articles.find((a) => a.slug === params.slug && isPublished(a));
  if (!article) fail(404, 'Berita tidak ditemukan');

  article.views = Number(article.views || 0) + 1;
  const day = todayJakarta();
  if (doc.stats.daily[day]) doc.stats.daily[day].views = Number(doc.stats.daily[day].views || 0) + 1;
  else doc.stats.daily[day] = { views: 1 };
  doc.stats.totalViews = Number(doc.stats.totalViews || 0) + 1;
  store.persist();

  const published = doc.articles.filter(isPublished).sort(byDateDesc);
  const index = published.findIndex((a) => a.slug === article.slug);
  const sameCategory = published.filter((a) => a.category === article.category && a.slug !== article.slug);
  const others = published.filter((a) => a.category !== article.category && a.slug !== article.slug);
  const related = [...sameCategory, ...others].slice(0, 3);

  const tagged = published.filter(
    (a) => a.slug !== article.slug && (a.tags || []).some((t) => (article.tags || []).includes(t))
  );

  return {
    body: {
      article: {
        ...decorate(doc, article, { withContent: true }),
        comments: doc.comments
          .filter((c) => c.articleSlug === article.slug && c.status === 'approved')
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .map(({ email, ...rest }) => rest),
      },
      related: related.map((a) => decorate(doc, a)),
      popular: published
        .filter((a) => a.slug !== article.slug)
        .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
        .slice(0, 5)
        .map((a) => decorate(doc, a)),
      tags: article.tags,
      moreFromTag: tagged.slice(0, 3).map((a) => decorate(doc, a)),
      prev: index > 0 ? decorate(doc, published[index - 1]) : null,
      next: index >= 0 && index < published.length - 1 ? decorate(doc, published[index + 1]) : null,
      seo: {
        title: `${article.title} — ${doc.settings.name}`,
        description: article.dek,
        image: article.cover,
        publishedAt: article.publishedAt,
        author: authorOf(doc, article.author)?.name || 'Redaksi',
      },
    },
  };
});

route('GET', '/api/popular', async ({ query }) => {
  const doc = store.get();
  const limit = Math.min(20, Math.max(1, Number(query.limit) || 5));
  const items = doc.articles
    .filter(isPublished)
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
    .slice(0, limit)
    .map((a) => decorate(doc, a));
  return { body: { items } };
});

route('GET', '/api/agenda', async () => {
  const doc = store.get();
  return { body: { items: doc.agenda.slice().sort((a, b) => a.date.localeCompare(b.date)) } };
});

route('GET', '/api/tags', async ({ query }) => {
  const doc = store.get();
  const limit = Math.min(60, Math.max(1, Number(query.limit) || 30));
  return { body: { items: topTags(doc, limit) } };
});

route('GET', '/api/comments', async ({ query }) => {
  const doc = store.get();
  if (!query.slug) fail(400, 'Parameter slug wajib');
  const items = doc.comments
    .filter((c) => c.articleSlug === String(query.slug) && c.status === 'approved')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(({ email, ...rest }) => rest);
  return { body: { items } };
});

route('POST', '/api/comments', async ({ body, ip }) => {
  const doc = store.get();
  if (body.honeypot) fail(400, 'Komentar terdeteksi sebagai spam');
  const articleSlug = requireString(body.articleSlug, 'Artikel', { max: 200 });
  const article = doc.articles.find((a) => a.slug === articleSlug && isPublished(a));
  if (!article) fail(404, 'Berita tidak ditemukan');
  const name = requireString(body.name, 'Nama', { min: 2, max: 60 });
  const text = requireString(body.body, 'Komentar', { min: 8, max: 1200 });
  const email = String(body.email || '').trim();
  if (email && !EMAIL_RE.test(email)) fail(400, 'Format email tidak valid');

  const recent = doc.comments.filter(
    (c) => c.ip === ip && Date.now() - new Date(c.createdAt).getTime() < 60_000
  );
  if (recent.length >= 2) fail(429, 'Terlalu banyak komentar. Coba lagi sebentar.');

  const comment = {
    id: uid('cm'),
    articleSlug,
    name,
    email,
    body: text,
    status: 'pending',
    ip: ip || '',
    createdAt: new Date().toISOString(),
  };
  doc.comments.unshift(comment);
  store.persist();
  return { status: 201, body: { ok: true, message: 'Komentar terkirim dan menunggu moderasi redaksi.' } };
});

route('POST', '/api/contact', async ({ body }) => {
  const doc = store.get();
  if (body.honeypot) fail(400, 'Pesan terdeteksi sebagai spam');
  const name = requireString(body.name, 'Nama', { min: 2, max: 80 });
  const email = requireString(body.email, 'Email', { min: 5, max: 120 });
  if (!EMAIL_RE.test(email)) fail(400, 'Format email tidak valid');
  const subject = requireString(body.subject, 'Subjek', { min: 3, max: 140 });
  const text = requireString(body.body, 'Isi pesan', { min: 10, max: 3000 });

  doc.messages.unshift({
    id: uid('msg'),
    name,
    email,
    subject,
    body: text,
    read: false,
    createdAt: new Date().toISOString(),
  });
  store.persist();
  return { status: 201, body: { ok: true, message: 'Pesan terkirim. Redaksi akan membalas melalui email.' } };
});

route('POST', '/api/subscribe', async ({ body }) => {
  const doc = store.get();
  const email = requireString(body.email, 'Email', { min: 5, max: 120 }).toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Format email tidak valid');
  if (doc.subscribers.some((s) => s.email === email)) {
    return { body: { ok: true, message: 'Email sudah terdaftar. Terima kasih!' } };
  }
  doc.subscribers.unshift({ id: uid('sub'), email, createdAt: new Date().toISOString() });
  store.persist();
  return { status: 201, body: { ok: true, message: 'Berhasil berlangganan. Kabar terbaru akan dikirim ke email Anda.' } };
});

route('GET', '/api/media/:id', async ({ params }) => {
  const doc = store.get();
  const media = doc.media.find((m) => m.id === params.id);
  if (!media) fail(404, 'Media tidak ditemukan');
  const match = /^data:([^;]+);base64,(.+)$/s.exec(media.dataUrl || '');
  if (!match) fail(415, 'Media tidak valid');
  return {
    headers: {
      'Content-Type': match[1],
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
    binary: Buffer.from(match[2], 'base64'),
  };
});

/* ------------------------------------------------------------------ *
 * Auth admin
 * ------------------------------------------------------------------ */

route('POST', '/api/admin/login', async ({ body, ip }) => {
  const limit = registerLoginAttempt(ip);
  if (limit.blocked) fail(429, `Terlalu banyak percobaan. Coba lagi dalam ${limit.retryAfter} detik.`);
  const password = String(body.password || '');
  if (!checkPassword(password)) fail(401, 'Password salah');
  clearLoginAttempts(ip);
  const secret = store.secret();
  return {
    body: {
      token: createToken(secret),
      expiresIn: TOKEN_TTL_HOURS * 3600,
      user: { name: 'Administrator', role: 'editor' },
    },
  };
});

route('GET', '/api/admin/session', async ({ admin }) => {
  return { body: { user: admin, devPassword: IS_DEV_PASSWORD } };
}, { admin: true });

route('GET', '/api/admin/overview', async () => {
  const doc = store.get();
  const published = doc.articles.filter(isPublished);
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(date);
    return { date: key, views: Number(doc.stats.daily[key]?.views || 0) };
  });

  return {
    body: {
      counts: {
        published: published.length,
        drafts: doc.articles.length - published.length,
        totalViews: published.reduce((sum, a) => sum + Number(a.views || 0), 0),
        todayViews: Number(doc.stats.daily[todayJakarta()]?.views || 0),
        pendingComments: doc.comments.filter((c) => c.status === 'pending').length,
        unreadMessages: doc.messages.filter((m) => !m.read).length,
        subscribers: doc.subscribers.length,
        categories: doc.categories.length,
      },
      views: days,
      topArticles: published
        .slice()
        .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
        .slice(0, 5)
        .map((a) => decorate(doc, a)),
      categories: doc.categories.map((c) => ({
        ...c,
        total: published.filter((a) => a.category === c.slug).length,
        views: published.filter((a) => a.category === c.slug).reduce((s, a) => s + Number(a.views || 0), 0),
      })),
      recentComments: doc.comments.slice(0, 6),
      storage: { mode: store.mode },
    },
  };
}, { admin: true });

/* ---- Artikel ---- */

route('GET', '/api/admin/articles', async ({ query }) => {
  const doc = store.get();
  let items = doc.articles.slice().sort(byDateDesc);
  if (query.status && query.status !== 'semua') items = items.filter((a) => (a.status || 'published') === query.status);
  if (query.category && query.category !== 'semua') items = items.filter((a) => a.category === query.category);
  if (query.q) {
    const q = String(query.q).toLowerCase();
    items = items.filter((a) => `${a.title} ${a.dek} ${a.slug}`.toLowerCase().includes(q));
  }
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 50));
  const page = Math.max(1, Number(query.page) || 1);
  return {
    body: {
      items: items.slice((page - 1) * limit, page * limit).map((a) => decorate(doc, a, { withContent: true })),
      meta: { total: items.length, page, limit, totalPages: Math.max(1, Math.ceil(items.length / limit)) },
    },
  };
}, { admin: true });

route('GET', '/api/admin/articles/:id', async ({ params }) => {
  const doc = store.get();
  const article = doc.articles.find((a) => a.id === params.id || a.slug === params.id);
  if (!article) fail(404, 'Artikel tidak ditemukan');
  return { body: { article: { ...decorate(doc, article, { withContent: true }) } } };
}, { admin: true });

route('POST', '/api/admin/articles', async ({ body }) => {
  const doc = store.get();
  const payload = articlePayload(doc, body);
  doc.articles.unshift(payload);
  store.persist();
  return { status: 201, body: { ok: true, article: decorate(doc, payload, { withContent: true }) } };
}, { admin: true });

route('PUT', '/api/admin/articles/:id', async ({ params, body }) => {
  const doc = store.get();
  const existing = doc.articles.find((a) => a.id === params.id || a.slug === params.id);
  if (!existing) fail(404, 'Artikel tidak ditemukan');
  const payload = articlePayload(doc, body, existing);
  Object.assign(existing, payload);
  store.persist();
  return { body: { ok: true, article: decorate(doc, existing, { withContent: true }) } };
}, { admin: true });

route('DELETE', '/api/admin/articles/:id', async ({ params }) => {
  const doc = store.get();
  const index = doc.articles.findIndex((a) => a.id === params.id || a.slug === params.id);
  if (index < 0) fail(404, 'Artikel tidak ditemukan');
  const [removed] = doc.articles.splice(index, 1);
  doc.comments = doc.comments.filter((c) => c.articleSlug !== removed.slug);
  store.persist();
  return { body: { ok: true, removed: removed.slug } };
}, { admin: true });

/* ---- Kategori ---- */

route('GET', '/api/admin/categories', async () => {
  const doc = store.get();
  return {
    body: {
      items: doc.categories.map((c) => ({
        ...c,
        total: doc.articles.filter((a) => a.category === c.slug).length,
      })),
    },
  };
}, { admin: true });

route('POST', '/api/admin/categories', async ({ body }) => {
  const doc = store.get();
  const name = requireString(body.name, 'Nama kategori', { min: 3, max: 40 });
  const slug = slugify(body.slug || name, 'kategori');
  if (doc.categories.some((c) => c.slug === slug)) fail(409, 'Slug kategori sudah dipakai');
  const category = {
    id: uid('cat'),
    slug,
    name,
    accent: String(body.accent || '#e11d2e').slice(0, 20),
    description: String(body.description || '').slice(0, 240),
  };
  doc.categories.push(category);
  store.persist();
  return { status: 201, body: { ok: true, category } };
}, { admin: true });

route('PUT', '/api/admin/categories/:id', async ({ params, body }) => {
  const doc = store.get();
  const category = doc.categories.find((c) => c.id === params.id || c.slug === params.id);
  if (!category) fail(404, 'Kategori tidak ditemukan');
  const oldSlug = category.slug;
  category.name = requireString(body.name ?? category.name, 'Nama kategori', { min: 3, max: 40 });
  category.accent = String(body.accent || category.accent).slice(0, 20);
  category.description = String(body.description ?? category.description).slice(0, 240);
  const newSlug = slugify(body.slug || category.slug, 'kategori');
  if (newSlug !== category.slug) {
    if (doc.categories.some((c) => c.slug === newSlug)) fail(409, 'Slug kategori sudah dipakai');
    category.slug = newSlug;
    doc.articles.forEach((a) => {
      if (a.category === oldSlug) a.category = newSlug;
    });
  }
  store.persist();
  return { body: { ok: true, category } };
}, { admin: true });

route('DELETE', '/api/admin/categories/:id', async ({ params }) => {
  const doc = store.get();
  const category = doc.categories.find((c) => c.id === params.id || c.slug === params.id);
  if (!category) fail(404, 'Kategori tidak ditemukan');
  if (doc.articles.some((a) => a.category === category.slug)) {
    fail(409, 'Kategori masih dipakai artikel. Pindahkan artikel terlebih dahulu.');
  }
  doc.categories = doc.categories.filter((c) => c.id !== category.id);
  store.persist();
  return { body: { ok: true } };
}, { admin: true });

/* ---- Komentar ---- */

route('GET', '/api/admin/comments', async ({ query }) => {
  const doc = store.get();
  let items = doc.comments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  if (query.status && query.status !== 'semua') items = items.filter((c) => c.status === query.status);
  const articles = new Map(doc.articles.map((a) => [a.slug, a.title]));
  return { body: { items: items.map((c) => ({ ...c, articleTitle: articles.get(c.articleSlug) || c.articleSlug })) } };
}, { admin: true });

route('PATCH', '/api/admin/comments/:id', async ({ params, body }) => {
  const doc = store.get();
  const comment = doc.comments.find((c) => c.id === params.id);
  if (!comment) fail(404, 'Komentar tidak ditemukan');
  const status = String(body.status || '');
  if (!['approved', 'pending', 'rejected'].includes(status)) fail(400, 'Status tidak valid');
  comment.status = status;
  store.persist();
  return { body: { ok: true, comment } };
}, { admin: true });

route('DELETE', '/api/admin/comments/:id', async ({ params }) => {
  const doc = store.get();
  doc.comments = doc.comments.filter((c) => c.id !== params.id);
  store.persist();
  return { body: { ok: true } };
}, { admin: true });

/* ---- Pesan & pelanggan ---- */

route('GET', '/api/admin/messages', async () => {
  const doc = store.get();
  return { body: { items: doc.messages.slice() } };
}, { admin: true });

route('PATCH', '/api/admin/messages/:id', async ({ params, body }) => {
  const doc = store.get();
  const message = doc.messages.find((m) => m.id === params.id);
  if (!message) fail(404, 'Pesan tidak ditemukan');
  if (typeof body.read === 'boolean') message.read = body.read;
  store.persist();
  return { body: { ok: true, message } };
}, { admin: true });

route('DELETE', '/api/admin/messages/:id', async ({ params }) => {
  const doc = store.get();
  doc.messages = doc.messages.filter((m) => m.id !== params.id);
  store.persist();
  return { body: { ok: true } };
}, { admin: true });

route('GET', '/api/admin/subscribers', async () => {
  const doc = store.get();
  return { body: { items: doc.subscribers.slice() } };
}, { admin: true });

route('DELETE', '/api/admin/subscribers/:id', async ({ params }) => {
  const doc = store.get();
  doc.subscribers = doc.subscribers.filter((s) => s.id !== params.id);
  store.persist();
  return { body: { ok: true } };
}, { admin: true });

/* ---- Agenda ---- */

route('GET', '/api/admin/agenda', async () => {
  const doc = store.get();
  return { body: { items: doc.agenda.slice().sort((a, b) => a.date.localeCompare(b.date)) } };
}, { admin: true });

route('POST', '/api/admin/agenda', async ({ body }) => {
  const doc = store.get();
  const item = {
    id: uid('ag'),
    title: requireString(body.title, 'Judul agenda', { min: 4, max: 140 }),
    date: requireString(body.date, 'Tanggal', { min: 8, max: 10 }),
    time: String(body.time || '').slice(0, 60),
    place: String(body.place || '').slice(0, 120),
    description: String(body.description || '').slice(0, 500),
  };
  doc.agenda.push(item);
  store.persist();
  return { status: 201, body: { ok: true, item } };
}, { admin: true });

route('DELETE', '/api/admin/agenda/:id', async ({ params }) => {
  const doc = store.get();
  doc.agenda = doc.agenda.filter((a) => a.id !== params.id);
  store.persist();
  return { body: { ok: true } };
}, { admin: true });

/* ---- Pengaturan & media ---- */

route('GET', '/api/admin/settings', async () => {
  const doc = store.get();
  return { body: { settings: doc.settings } };
}, { admin: true });

route('PUT', '/api/admin/settings', async ({ body }) => {
  const doc = store.get();
  const next = { ...doc.settings, ...body, credit: { ...doc.settings.credit, ...(body.credit || {}) } };
  next.name = requireString(next.name, 'Nama situs', { min: 3, max: 60 });
  next.tagline = String(next.tagline || '').slice(0, 200);
  next.description = String(next.description || '').slice(0, 600);
  doc.settings = next;
  store.persist();
  return { body: { ok: true, settings: doc.settings } };
}, { admin: true });

route('POST', '/api/admin/media', async ({ body }) => {
  const doc = store.get();
  const dataUrl = String(body.dataUrl || '');
  const match = /^data:(image\/(?:jpeg|jpg|png|webp|gif|svg\+xml));base64,(.+)$/s.exec(dataUrl);
  if (!match) fail(415, 'Format gambar harus JPEG, PNG, WEBP, GIF, atau SVG');
  const size = Math.round((match[2].length * 3) / 4);
  if (size > 2_000_000) fail(413, 'Ukuran gambar maksimal 2 MB');
  const id = uid('img');
  doc.media.push({
    id,
    name: String(body.name || 'gambar').slice(0, 80),
    mime: match[1],
    dataUrl,
    size,
    createdAt: new Date().toISOString(),
  });
  store.persist();
  return {
    status: 201,
    body: { ok: true, media: { id, url: `/api/media/${id}`, name: body.name, size } },
  };
}, { admin: true });

route('GET', '/api/admin/media', async () => {
  const doc = store.get();
  return {
    body: {
      items: doc.media
        .slice()
        .reverse()
        .map(({ dataUrl, ...rest }) => ({ ...rest, url: `/api/media/${rest.id}` })),
    },
  };
}, { admin: true });

/* ------------------------------------------------------------------ *
 * Sitemap & RSS (teks, bukan JSON)
 * ------------------------------------------------------------------ */

route('GET', '/api/sitemap.xml', async ({ headers }) => {
  const doc = store.get();
  const base = originFrom(headers) || 'https://infokelurahan.vercel.app';
  const published = doc.articles.filter(isPublished).sort(byDateDesc);
  const urls = [
    { loc: '/', priority: '1.0', lastmod: published[0]?.publishedAt },
    { loc: '/berita', priority: '0.9', lastmod: published[0]?.publishedAt },
    ...doc.categories.map((c) => ({ loc: `/kategori/${c.slug}`, priority: '0.7' })),
    ...published.map((a) => ({
      loc: `/artikel/${a.slug}`,
      priority: '0.8',
      lastmod: a.updatedAt || a.publishedAt,
    })),
    { loc: '/tentang', priority: '0.4' },
    { loc: '/kontak', priority: '0.4' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${base}${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${new Date(u.lastmod).toISOString()}</lastmod>` : ''}
    <changefreq>daily</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
  return { headers: { 'Content-Type': 'application/xml; charset=utf-8' }, raw: xml };
});

route('GET', '/api/rss.xml', async ({ headers }) => {
  const doc = store.get();
  const base = originFrom(headers) || 'https://infokelurahan.vercel.app';
  const published = doc.articles.filter(isPublished).sort(byDateDesc).slice(0, 30);
  const esc = (str) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(doc.settings.name)}</title>
    <link>${base}</link>
    <description>${esc(doc.settings.description)}</description>
    <language>id-ID</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${base}/api/rss.xml" rel="self" type="application/rss+xml" />
${published
  .map(
    (a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${base}/artikel/${a.slug}</link>
      <guid>${base}/artikel/${a.slug}</guid>
      <pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate>
      <description>${esc(a.dek)}</description>
    </item>`
  )
  .join('\n')}
  </channel>
</rss>`;
  return { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' }, raw: xml };
});

function originFrom(headers = {}) {
  const proto = headers['x-forwarded-proto'] || 'https';
  const host = headers['x-forwarded-host'] || headers.host;
  if (!host) return '';
  return `${String(proto).split(',')[0]}://${String(host).split(',')[0]}`;
}

/* ------------------------------------------------------------------ *
 * Dispatcher
 * ------------------------------------------------------------------ */

export async function handleRequest(request) {
  await store.init();
  const method = String(request.method || 'GET').toUpperCase();
  const path = String(request.path || '/');
  const query = request.query || {};
  const headers = request.headers || {};

  for (const entry of routes) {
    if (entry.method !== method) continue;
    const params = matchRoute(entry.pattern, path);
    if (!params) continue;

    try {
      let admin = null;
      if (entry.admin) {
        const header = headers.authorization || headers.Authorization || '';
        const token = String(header).replace(/^Bearer\s+/i, '') || headers['x-admin-token'];
        admin = verifyToken(store.secret(), token);
        if (!admin) {
          return { status: 401, body: { error: 'Sesi berakhir. Silakan login kembali.' } };
        }
      }
      const result = await entry.handler({
        params,
        query,
        body: request.body || {},
        headers,
        ip: request.ip || headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
        admin,
      });
      return {
        status: result.status || 200,
        body: result.body,
        raw: result.raw,
        binary: result.binary,
        headers: result.headers || {},
      };
    } catch (error) {
      if (error instanceof HttpError) {
        return { status: error.status, body: { error: error.message, details: error.details } };
      }
      console.error('[Info Kelurahan] API error:', error);
      return { status: 500, body: { error: 'Terjadi kesalahan pada server.' } };
    }
  }

  return { status: 404, body: { error: `Endpoint ${method} ${path} tidak ditemukan` } };
}

export const apiInfo = { routes: routes.length, pageSize: PAGE_SIZE };
