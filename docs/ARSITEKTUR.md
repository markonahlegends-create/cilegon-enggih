# Arsitektur dan API

Aplikasi menggunakan React + TypeScript + Vite untuk UI, Express untuk backend lokal/self-host, serta handler `api/index.js` untuk Vercel Functions. API inti berada di `server/core.js` dan tidak terikat framework HTTP tertentu.

## Penyimpanan

`server/db.js` menyediakan Store yang memilih Supabase PostgREST ketika `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` tersedia, fallback JSON untuk self-host, dan memori jika filesystem tidak dapat ditulis. Data berisi satu dokumen situs (settings, articles, categories, comments, agenda, messages, subscribers, statistik).

## Endpoint umum

- `GET /api/health`, `/api/bootstrap`
- `GET /api/articles`, `/api/articles/:slug`, `/api/popular`, `/api/agenda`, `/api/tags`
- `POST /api/comments`, `/api/contact`, `/api/subscribe`
- `GET /api/sitemap.xml`, `/api/rss.xml`

Endpoint admin memakai token bearer yang diperoleh dari `POST /api/admin/login`. Token ditandatangani HMAC dan memiliki masa berlaku terbatas. Password dikonfigurasi melalui `ADMIN_PASSWORD`.

## Deploy dan SEO

Build menghasilkan aset `dist/`, kategori SVG, sitemap, dan RSS. Untuk share card artikel yang ter-render di crawler tanpa JavaScript, gunakan server-side rendering atau layanan prerender di masa depan; metadata halaman dinamis saat ini diterapkan pada client-side.
