/**
 * Adapter Express untuk core API.
 * Dipakai oleh server lokal (`npm run server`), preview sandbox, dan self-host (VPS).
 */
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dispatch } from './core.js';
import { store } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  // Header keamanan dasar untuk self-host (Vercel/Cloudflare punya sendiri via config).
  app.use((_req, res, next) => {
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'SAMEORIGIN');
    res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  // Healthcheck ringan (untuk uptime monitor) — tidak menyentuh storage.
  app.get('/api/ping', (_req, res) => res.json({ pong: true, at: new Date().toISOString() }));

  app.use(express.json({ limit: '6mb' }));
  app.use(express.urlencoded({ extended: true, limit: '6mb' }));

  // CORS: izinkan SPA di origin berbeda (mis. Cloudflare Pages memanggil API Vercel).
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With'
    );
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });

  /**
   * Body yang tidak bisa di-parse JANGAN menggagalkan request analitik.
   * Endpoint /api/events bersifat best-effort: lebih baik diabaikan
   * daripada mengembalikan error ke browser pembeli.
   */
  app.use('/api/events', (err, req, res, _next) => {
    if (err) return res.status(204).end();
    return res.status(204).end();
  });

  // Semua endpoint /api ditangani core framework-agnostic.
  app.all('/api/*', async (req, res) => {
    const result = await dispatch({
      method: req.method,
      path: req.originalUrl,
      query: req.query,
      body: req.body,
      headers: req.headers
    });
    // Header tambahan (mis. Set-Cookie untuk sesi HttpOnly).
    if (result.headers) {
      for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
    }
    // 204 tanpa body, CSV dikirim sebagai teks (ekspor insight).
    if (result.status === 204 || result.body === undefined) return res.status(result.status).end();
    const ctype = res.getHeader('Content-Type');
    if (typeof ctype === 'string' && ctype.startsWith('text/csv')) {
      return res.status(result.status).send(result.body.csv ?? result.body);
    }
    res.status(result.status).json(result.body);
  });

  // Static assets (foto produk, brand) — aman untuk semua adapter.
  const publicPath = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    app.use(
      express.static(publicPath, {
        maxAge: '7d',
        setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=604800')
      })
    );
  }

  // Build SPA (production) kalau sudah ada.
  const distPath = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath, { maxAge: '1h' }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      return res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Fallback root kalau dist belum dibuild (mode dev: cukup pakai Vite 5173).
  app.get('/', (_req, res) => {
    res
      .status(200)
      .type('html')
      .send(
        `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Cilegon Enggih API</title>
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <style>body{font-family:system-ui,sans-serif;background:#0d192d;color:#e2e8f0;display:grid;place-items:center;min-height:100vh;margin:0}
        .card{max-width:560px;padding:32px;border-radius:20px;background:#152947;border:1px solid #1B365D}
        h1{margin:0 0 8px;font-size:22px}p{color:#94a3b8;line-height:1.6;font-size:14px}
        code{background:#0d192d;padding:2px 6px;border-radius:6px;color:#E5A93C}a{color:#92c7a3}</style></head>
        <body><div class="card"><h1>Cilegon Enggih — Official API</h1>
        <p>Backend aktif pada port ini. Mode penyimpanan: <code>${store.mode}</code>.</p>
        <p>Storefront dev berjalan di <a href="http://localhost:5173">http://localhost:5173</a>.
        Endpoint cek cepat: <code>/api/health</code>, <code>/api/storefront</code>.</p>
        <p>Build produksi (<code>npm run build</code>) akan otomatis menyajikan SPA di port ini.</p></div></body></html>`
      );
  });

  return app;
};
