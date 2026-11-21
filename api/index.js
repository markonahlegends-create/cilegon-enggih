/**
 * Vercel Serverless Function — semua /api/* diarahkan ke sini lewat vercel.json.
 * Untuk penyimpanan permanen di Vercel, set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 * (lihat supabase/schema.sql). Tanpa itu, data hanya bertahan selama instance hidup.
 */
import '../server/env.js';
import { handleRequest } from '../server/core.js';
import { store } from '../server/db.js';

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  const headers = req.headers || {};
  // Explicitly route API requests through /api/index?path=... when Vercel's
  // catch-all does not resolve a nested endpoint consistently. Preserve the
  // original endpoint query string and do not leak the internal `path` param.
  const forwardedPath = url.searchParams.get('path');
  const endpoint = new URL(forwardedPath || url.pathname, `https://${req.headers.host || 'localhost'}`);
  const requestPath = endpoint.pathname;
  const query = Object.fromEntries(url.searchParams.entries());
  delete query.path;
  endpoint.searchParams.forEach((value, key) => { query[key] = value; });
  try {
    await store.init();
    const result = await handleRequest({
      method: req.method,
      path: requestPath,
      query,
      headers,
      body: req.method === 'GET' || req.method === 'DELETE' ? {} : readBody(req),
      ip: String(headers['x-forwarded-for'] || '').split(',')[0].trim(),
    });

    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
    }
    res.statusCode = result.status || 200;
    if (result.binary) {
      res.send(result.binary);
      return;
    }
    if (result.raw !== undefined) {
      res.send(result.raw);
      return;
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify(result.body ?? {}));
  } catch (error) {
    console.error('[Info Kelurahan] Fatal:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(JSON.stringify({ error: 'Terjadi kesalahan pada server.' }));
  }
}
