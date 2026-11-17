/**
 * Storage adapter Cilegon Enggih.
 *
 * Dua mode, otomatis dipilih berdasarkan environment variable:
 *  1) SUPABASE  → jika SUPABASE_URL & (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY) tersedia.
 *     Memakai Supabase REST API (PostgREST) ke tabel `ce_documents`, sehingga aman
 *     untuk serverless (Vercel Functions / Cloudflare Pages Functions).
 *  2) LOCAL JSON → fallback untuk dev / preview / self-host. Data disimpan di
 *     `CE_DATA_DIR` (default `server/data`), otomatis memakai folder writable
 *     seperti `/tmp/cilegon-enggih-data` bila path tidak bisa ditulis (serverless).
 *
 * Skema dokumen generik (lihat supabase-schema.sql):
 *   ce_documents(collection text, id text, data jsonb, updated_at timestamptz)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SEED_ORDERS, SEED_B2B, DEFAULT_SETTINGS, DEFAULT_VOUCHERS } from './constants.js';
import { SEED_PRODUCTS } from './seed/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = (
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  ''
).replace(/\/+$/, '');

// Dukung dua gaya kunci Supabase:
//  • legacy JWT  → service_role / anon key (eyJhbGciOi...)
//  • baru (2025) → secret key `sb_secret_...` / publishable `sb_publishable_...`
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

/** Jenis kunci — dipakai untuk peringatan konfigurasi (tanpa membocorkan nilai). */
export const SUPABASE_KEY_TYPE = !SUPABASE_KEY
  ? 'none'
  : SUPABASE_KEY.startsWith('sb_secret_')
  ? 'secret'
  : SUPABASE_KEY.startsWith('sb_publishable_')
  ? 'publishable'
  : 'jwt';
const TABLE = process.env.SUPABASE_DOCS_TABLE || 'ce_documents';

export const USING_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);

/* ------------------------------------------------------------------ */
/* Local JSON fallback                                                 */
/* ------------------------------------------------------------------ */

// Catatan: JANGAN memakai ./data di root (dulu sempat ter-commit dan
// membuat build gagal); default selalu server/data.
const OLD_DATA_DIR = path.join(__dirname, 'data');
const PREFERRED_DIR = process.env.CE_DATA_DIR || OLD_DATA_DIR;

const isWritableDir = (dir) => {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.write-probe');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
};

const DATA_DIR = isWritableDir(PREFERRED_DIR)
  ? PREFERRED_DIR
  : [path.join('/tmp', 'cilegon-enggih-data'), path.join(process.cwd(), '.ce-data')].find(
      (dir) => isWritableDir(dir)
    ) || PREFERRED_DIR;

/** Urutan tampil produk mengikuti katalog seed (retail dulu, lalu bundling). */
const ORDERED_COLLECTIONS = new Set(['products']);

const sortDocs = (collection, list) =>
  ORDERED_COLLECTIONS.has(collection)
    ? [...list].sort(
        (a, b) =>
          Number(Boolean(b.isBundle)) - Number(Boolean(a.isBundle)) ||
          new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
      )
    : list;

const memoryStore = new Map();
const fileCache = new Map();

const fileOf = (collection) => path.join(DATA_DIR, `${collection}.json`);

const normalize = (doc, fallbackId) => {
  if (!doc) return doc;
  const id = doc.id || doc.orderId || doc.quoteId || doc.code || doc.slug || fallbackId;
  return id ? { ...doc, id } : { ...doc };
};

/** Settings & dokumen singleton tetap butuh id agar bisa di-UPSERT. */
const SINGLETON_IDS = { settings: 'store-settings' };

/** Baca file koleksi apa adanya (tanpa normalisasi) — dipakai penanda seed. */
const readLocalRaw = (collection) => {
  try {
    return fs.readFileSync(fileOf(collection), 'utf-8');
  } catch {
    return null;
  }
};

const readLocal = (collection) => {
  if (memoryStore.has(collection)) return memoryStore.get(collection);
  if (fileCache.has(collection)) return fileCache.get(collection);
  try {
    const raw = fs.readFileSync(fileOf(collection), 'utf-8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? sortDocs(collection, parsed.map((doc) => normalize(doc, SINGLETON_IDS[collection])))
      : [];
    fileCache.set(collection, list);
    return list;
  } catch {
    return null;
  }
};

const writeLocal = (collection, list) => {
  const normalized = sortDocs(collection, list.map(normalize));
  memoryStore.set(collection, normalized);
  fileCache.set(collection, normalized);
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(fileOf(collection), JSON.stringify(normalized, null, 2));
    return true;
  } catch {
    // Read-only filesystem (mis. Vercel): data tetap hidup di memori proses.
    return false;
  }
};

const seedFor = (collection) => {
  if (collection === 'products') return SEED_PRODUCTS.map((p) => ({ ...p, active: true }));
  if (collection === 'orders') return SEED_ORDERS;
  if (collection === 'b2b') return SEED_B2B;
  if (collection === 'vouchers') return DEFAULT_VOUCHERS;
  if (collection === 'settings') return [DEFAULT_SETTINGS];
  return [];
};

const SEED_MARKER_FILE = 'seed-initialized.json';

const readSeedMarkers = () => {
  try {
    const raw = readLocalRaw(SEED_MARKER_FILE);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const seedAlreadyDone = async (collection) => {
  if (USING_SUPABASE && remoteAvailable()) {
    try {
      const rows = await remoteRequest(
        `?collection=eq.__seed&select=id&limit=10`
      );
      return (rows || []).some((r) => r.id === `seed-${collection}`);
    } catch {
      return Boolean(readSeedMarkers()[collection]);
    }
  }
  return Boolean(readSeedMarkers()[collection]);
};

const markSeedDone = async (collection) => {
  if (USING_SUPABASE && remoteAvailable()) {
    try {
      await store.put('__seed', {
        id: `seed-${collection}`,
        collection,
        seededAt: new Date().toISOString()
      });
      return;
    } catch (err) {
      console.error('[storage] gagal menandai seed:', err.message);
    }
  }
  const markers = readSeedMarkers();
  markers[collection] = new Date().toISOString();
  try {
    memoryStore.delete(SEED_MARKER_FILE);
    fileCache.delete(SEED_MARKER_FILE);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(fileOf(SEED_MARKER_FILE), JSON.stringify(markers, null, 2), 'utf-8');
  } catch (err) {
    console.error('[storage] gagal menyimpan penanda seed:', err.message);
  }
};

const ensureLocalSeed = (collection) => {
  const existing = readLocal(collection);
  if (existing && existing.length > 0) return existing;
  // Sudah pernah disemai lalu dikosongkan admin → biarkan kosong.
  if (readSeedMarkers()[collection]) return [];
  const seeded = seedFor(collection).map((doc) => normalize(doc, SINGLETON_IDS[collection]));
  if (seeded.length) {
    writeLocal(collection, seeded);
    const markers = readSeedMarkers();
    markers[collection] = new Date().toISOString();
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(fileOf(SEED_MARKER_FILE), JSON.stringify(markers, null, 2), 'utf-8');
    } catch (err) {
      console.error('[storage] gagal menyimpan penanda seed:', err.message);
    }
  }
  return seeded;
};

/* ------------------------------------------------------------------ */
/* Supabase REST adapter                                               */
/* ------------------------------------------------------------------ */

const sbHeaders = (extra = {}) => {
  const headers = {
    apikey: SUPABASE_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=representation'
  };
  // Kunci gaya baru (sb_secret_/sb_publishable_) cukup lewat header `apikey`.
  // Kunci JWT legacy tetap butuh Authorization: Bearer <key>.
  if (!SUPABASE_KEY.startsWith('sb_')) {
    headers.Authorization = `Bearer ${SUPABASE_KEY}`;
  }
  return { ...headers, ...extra };
};

/**
 * Circuit breaker sederhana: kalau Supabase tidak bisa dihubungi
 * (mis. salah URL / jaringan down), jangan ulangi request mahal di setiap
 * panggilan. Setelah 3 kegagalan berturut-turut, remote dilewati 60 detik.
 */
let remoteFailures = 0;
let remoteBlockedUntil = 0;

const remoteAvailable = () => Date.now() > remoteBlockedUntil;

const noteRemoteFailure = (err) => {
  remoteFailures += 1;
  if (remoteFailures >= 3) {
    remoteBlockedUntil = Date.now() + 60_000;
    remoteFailures = 0;
    console.error('[storage] Supabase tidak tersedia, fallback lokal selama 60 detik:', err.message);
  }
};

const remoteRequest = async (queryPath, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}${queryPath}`, {
    ...options,
    headers: sbHeaders(options.headers)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    noteRemoteFailure(new Error(`Supabase ${res.status}: ${text.slice(0, 240)}`));
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 240)}`);
  }
  remoteFailures = 0;
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
};

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const store = {
  mode: USING_SUPABASE ? 'supabase' : 'local-json',
  dataDir: USING_SUPABASE ? null : DATA_DIR,

  /** Cek konektivitas + keberadaan tabel (dipakai /api/health). */
  async ping() {
    if (!USING_SUPABASE) return false;
    try {
      await remoteRequest('?select=id&limit=1');
      remoteFailures = 0;
      return true;
    } catch (err) {
      console.error('[storage] ping Supabase gagal:', err.message);
      return false;
    }
  },

  async list(collection) {
    if (!USING_SUPABASE || !remoteAvailable()) return ensureLocalSeed(collection);
    try {
      const rows = await remoteRequest(
        `?collection=eq.${encodeURIComponent(collection)}&select=id,data&order=updated_at.desc`
      );
      const docs = (rows || []).map((r) => normalize({ ...r.data, id: r.id }));
      if (docs.length > 0) return docs;

      /**
       * PENTING: data contoh hanya boleh dibuat sekali.
       * Sebelumnya `list()` menyemai ulang setiap kali koleksi kosong,
       * sehingga pesanan yang sengaja dihapus admin **muncul kembali**.
       * Sekarang jejak `seed-initialized` disimpan permanen; bila sudah ada,
       * koleksi kosong berarti memang kosong.
       */
      if (await seedAlreadyDone(collection)) return [];

      const seeded = seedFor(collection).map((doc) => normalize(doc, SINGLETON_IDS[collection]));
      if (seeded.length) {
        await Promise.all(seeded.map((doc) => store.put(collection, doc)));
        await markSeedDone(collection);
      }
      return seeded;
    } catch (err) {
      console.error('[storage] Supabase list gagal, pakai fallback lokal:', err.message);
      return ensureLocalSeed(collection);
    }
  },

  async get(collection, id) {
    const key = String(id);
    if (!USING_SUPABASE || !remoteAvailable()) {
      return (ensureLocalSeed(collection) || []).find((d) => String(d.id) === key) || null;
    }
    try {
      const rows = await remoteRequest(
        `?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(key)}&select=id,data&limit=1`
      );
      if (!rows || rows.length === 0) return null;
      return normalize({ ...rows[0].data, id: rows[0].id });
    } catch (err) {
      console.error('[storage] Supabase get gagal:', err.message);
      return (ensureLocalSeed(collection) || []).find((d) => String(d.id) === key) || null;
    }
  },

  async put(collection, doc) {
    const normalized = normalize(doc, SINGLETON_IDS[collection]);
    if (!normalized.id) throw new Error('Dokumen butuh properti id.');
    if (!USING_SUPABASE || !remoteAvailable()) {
      const list = ensureLocalSeed(collection).filter((d) => String(d.id) !== String(normalized.id));
      list.unshift(normalized);
      writeLocal(collection, list);
      return normalized;
    }
    try {
      await remoteRequest('?on_conflict=collection,id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify([
          {
            collection,
            id: String(normalized.id),
            data: normalized,
            updated_at: new Date().toISOString()
          }
        ])
      });
      return normalized;
    } catch (err) {
      console.error('[storage] Supabase put gagal, menulis lokal:', err.message);
      const list = ensureLocalSeed(collection).filter((d) => String(d.id) !== String(normalized.id));
      list.unshift(normalized);
      writeLocal(collection, list);
      return normalized;
    }
  },

  async remove(collection, id) {
    // Admin menghapus isi koleksi → tandai agar data contoh tidak disemai ulang.
    if (seedFor(collection).length) await markSeedDone(collection);
    if (!USING_SUPABASE || !remoteAvailable()) {
      const list = ensureLocalSeed(collection).filter((d) => String(d.id) !== String(id));
      writeLocal(collection, list);
      return true;
    }
    try {
      await remoteRequest(
        `?collection=eq.${encodeURIComponent(collection)}&id=eq.${encodeURIComponent(id)}`,
        { method: 'DELETE' }
      );
      return true;
    } catch (err) {
      console.error('[storage] Supabase delete gagal:', err.message);
      return false;
    }
  },

  async replaceAll(collection, docs) {
    if (seedFor(collection).length) await markSeedDone(collection);
    if (!USING_SUPABASE || !remoteAvailable()) {
      writeLocal(collection, docs);
      return docs;
    }
    try {
      await remoteRequest(`?collection=eq.${encodeURIComponent(collection)}`, {
        method: 'DELETE'
      });
      await Promise.all(docs.map((doc) => store.put(collection, doc)));
      return docs;
    } catch (err) {
      console.error('[storage] Supabase replaceAll gagal:', err.message);
      writeLocal(collection, docs);
      return docs;
    }
  }
};

export const createLocalOnlyStore = () => store;
