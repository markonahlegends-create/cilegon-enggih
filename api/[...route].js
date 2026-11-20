/**
 * Vercel Serverless Function (catch-all).
 * Vercel: `api/[...route].js` menangkap seluruh /api/* dan meneruskannya ke core.
 * Deploy: set env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ADMIN_PASSWORD.
 */
import { dispatch } from '../server/core.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  const result = await dispatch({
    method: req.method,
    path: req.url || '/',
    query: req.query || {},
    body: req.body,
    headers: req.headers
  });

  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
  // Header tambahan (mis. Set-Cookie untuk sesi HttpOnly).
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  }
  // 204: tanpa body. Respons CSV dikirim sebagai teks apa adanya.
  if (result.status === 204 || result.body === undefined) {
    res.status(result.status).end();
    return;
  }
  const ctype = String(res.getHeader('Content-Type') || '');
  if (ctype.startsWith('text/csv')) {
    res.status(result.status).send(result.body.csv ?? result.body);
    return;
  }
  /*
   * Respons NON-JSON (mis. kartu share `text/html`) harus dikirim apa adanya.
   * Tanpa cabang ini, HTML di-`json()` sehingga keluar sebagai string
   * ber-escape dan crawler tidak menemukan satu pun tag <meta>.
   */
  if (typeof result.body === 'string' && ctype && !ctype.includes('json')) {
    res.status(result.status).send(result.body);
    return;
  }
  /*
   * Respons BINER (thumbnail `/api/og-image/<slug>.jpg`). Tanpa cabang ini
   * Buffer di-`json()` menjadi `{"type":"Buffer","data":[...]}` sehingga
   * crawler menerima teks, bukan JPEG, dan thumbnail tidak muncul.
   */
  if (Buffer.isBuffer(result.body)) {
    res.status(result.status).send(result.body);
    return;
  }
  res.status(result.status).json(result.body);
}
