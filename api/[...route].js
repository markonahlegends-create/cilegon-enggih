/**
 * Vercel Serverless Function (catch-all).
 * Vercel: `api/[...route].js` menangkap seluruh /api/* dan meneruskannya ke core.
 * Deploy: set env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + ADMIN_PASSWORD.
 */
import { dispatch } from '../server/core.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

/**
 * PULIHKAN PATH ASLI DARI `__path`.
 *
 * KENAPA PERLU
 * Vercel mencocokkan rewrite berdasarkan PATH TUJUAN, bukan path asli.
 * `api/[...route].js` (di luar Next.js) dikompilasi menjadi SATU segmen
 * dinamis — `^/api/([^/]+)$` — sehingga tujuan multi-segmen seperti
 * `/api/share/produk/<slug>` atau `/api/og-image/<slug>.jpg` TIDAK cocok
 * dengan fungsi mana pun dan Vercel membalas halaman 404-nya sendiri
 * ("The page could not be found"). Itulah sebabnya kartu share produk
 * dinamis tidak pernah sampai ke crawler.
 *
 * SOLUSI
 * Semua rewrite di `vercel.json` menulis tujuan bentuk SATU segmen
 * `/api?__path=/aslinya`, yang pasti cocok dengan fungsi ini. Path asli
 * dikirim lewat query `__path` dan dipulihkan di sini sebelum `dispatch`.
 *
 * Keamanan: nilai dibatasi karakter yang sah di path produk, `..` dan
 * garis miring ganda dibuang, dan query asli tetap dipertahankan.
 */
const pathDariQuery = (req) => {
  const mentah = req.query?.__path;
  const nilai = Array.isArray(mentah) ? mentah[0] : mentah;
  if (!nilai) return null;
  let bersih = String(nilai).trim();
  try {
    bersih = decodeURIComponent(bersih);
  } catch {
    /* biarkan apa adanya bila bukan escape yang sah */
  }
  if (!bersih.startsWith('/')) bersih = `/${bersih}`;
  /* Tolak upaya keluar dari /api dan normalisasi garis miring. */
  bersih = bersih.replace(/\/{2,}/g, '/').replace(/\.\./g, '');
  if (!bersih.startsWith('/api/')) return null;
  return bersih;
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  /*
   * `__path` menang atas `req.url`, karena `req.url` sudah berisi tujuan
   * rewrite (`/api?__path=...`), bukan URL yang diminta crawler.
   */
  const pathAsli = pathDariQuery(req);
  const queryBersih = { ...(req.query || {}) };
  delete queryBersih.__path;

  let urlAkhir = pathAsli || req.url || '/';
  if (pathAsli) {
    /* Bawa serta query asli (mis. ?kategori=paket-bundling). */
    const sisa = new URL(req.url || '/', 'http://x').searchParams;
    sisa.delete('__path');
    const qs = sisa.toString();
    if (qs) urlAkhir = `${pathAsli}${pathAsli.includes('?') ? '&' : '?'}${qs}`;
  }

  const result = await dispatch({
    method: req.method,
    path: urlAkhir,
    query: queryBersih,
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
