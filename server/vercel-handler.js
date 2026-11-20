/**
 * HANDLER VERCEL — satu sumber untuk semua titik masuk.
 *
 * `api/[...route].js`, `api/index.js`, dan (bila perlu) berkas lain di `api/`
 * hanya meneruskan ke sini, supaya tidak ada salinan logika yang bisa berbeda.
 *
 * MENGAPA PEMULIHAN `__path` DIPERLUKAN
 * Vercel mencocokkan rewrite berdasarkan PATH TUJUAN, dan `api/[...route].js`
 * di luar Next.js dikompilasi menjadi SATU segmen dinamis — bukan catch-all.
 * Tujuan multi-segmen karena itu tidak cocok dengan fungsi mana pun dan
 * Vercel membalas 404-nya sendiri. Rewrite kita menulis tujuan bentuk satu
 * segmen `/api?__path=<path asli>`; path aslinya dipulihkan di sini sebelum
 * `dispatch` merutekan.
 */
import { dispatch } from './core.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

/**
 * Ambil path asli dari query `__path`.
 * Keamanan: wajib berawalan `/api/`, `..` dibuang, garis miring ganda wajar.
 */
export const pathDariQuery = (req) => {
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
  if (result.headers) {
    for (const [key, value] of Object.entries(result.headers)) res.setHeader(key, value);
  }
  if (result.status === 204 || result.body === undefined) {
    res.status(result.status).end();
    return;
  }
  const ctype = String(res.getHeader('Content-Type') || '');
  if (ctype.startsWith('text/csv')) {
    res.status(result.status).send(result.body.csv ?? result.body);
    return;
  }
  /* Respons NON-JSON (kartu share `text/html`) dikirim apa adanya. */
  if (typeof result.body === 'string' && ctype && !ctype.includes('json')) {
    res.status(result.status).send(result.body);
    return;
  }
  /*
   * Respons BINER (thumbnail). Tanpa cabang ini Buffer di-`json()` menjadi
   * `{"type":"Buffer","data":[...]}` sehingga crawler menerima teks, bukan JPEG.
   */
  if (Buffer.isBuffer(result.body)) {
    res.status(result.status).send(result.body);
    return;
  }
  res.status(result.status).json(result.body);
}
