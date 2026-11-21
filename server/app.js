/**
 * Adapter Express untuk API Info Kelurahan.
 * Juga menyajikan hasil build frontend (dist/) bila tersedia, sehingga
 * `npm start` cukup satu proses untuk produksi / self-host.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { handleRequest } from './core.js';
import { store, storageInfo } from './db.js';

const DIST_DIR = path.join(process.cwd(), 'dist');

function sendResult(res, result) {
  if (result.headers) {
    Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
  }
  if (result.binary) {
    res.status(result.status || 200).send(result.binary);
    return;
  }
  if (result.raw !== undefined) {
    res.status(result.status || 200).send(result.raw);
    return;
  }
  res.status(result.status || 200).json(result.body ?? {});
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '4mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Semua endpoint API (termasuk /api/sitemap.xml & /api/rss.xml).
  app.all('/api/*', async (req, res) => {
    try {
      await store.init();
      const result = await handleRequest({
        method: req.method,
        path: req.path,
        query: req.query,
        headers: req.headers,
        body: req.body,
        ip: req.ip,
      });
      sendResult(res, result);
    } catch (error) {
      console.error('[Info Kelurahan] Unhandled:', error);
      res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
    }
  });

  app.get(['/sitemap.xml', '/rss.xml'], async (req, res) => {
    await store.init();
    const result = await handleRequest({
      method: 'GET',
      path: req.path === '/rss.xml' ? '/api/rss.xml' : '/api/sitemap.xml',
      headers: req.headers,
    });
    sendResult(res, result);
  });

  if (fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    app.use(
      express.static(DIST_DIR, {
        index: false,
        maxAge: '1h',
        setHeaders(res, filePath) {
          if (/\.(js|css|woff2?|svg|webp|avif|png|jpg|jpeg)$/.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res
        .type('html')
        .send(
          '<!doctype html><html lang="id"><body style="font-family:system-ui;padding:40px;max-width:640px;margin:auto">' +
            '<h1>Info Kelurahan — API aktif</h1>' +
            `<p>Mode penyimpanan: <b>${storageInfo.mode}</b></p>` +
            '<p>Frontend belum dibangun. Jalankan <code>npm run dev</code> (Vite di :5173) ' +
            'atau <code>npm run build</code> lalu <code>npm start</code>.</p>' +
            '<p>Cek API: <a href="/api/health">/api/health</a></p></body></html>'
        );
    });
  }

  app.use((error, _req, res, _next) => {
    if (error?.type === 'entity.too.large') {
      res.status(413).json({ error: 'Ukuran data terlalu besar (maksimal 4 MB).' });
      return;
    }
    console.error('[Info Kelurahan] Express error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan pada server.' });
  });

  return app;
}
