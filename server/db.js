/**
 * Penyimpanan data Info Kelurahan.
 *
 * Tiga mode, dipilih otomatis:
 *  1. Supabase (PostgREST) — bila SUPABASE_URL + key tersedia. Cocok untuk produksi
 *     (Vercel serverless tidak punya disk permanen).
 *  2. File JSON lokal (server/data/db.json) — default untuk dev / self-host / VPS.
 *  3. Memori — fallback bila filesystem read-only (mis. Vercel tanpa Supabase).
 *
 * Semua mode memakai satu dokumen JSON utuh sehingga mudah dibackup/dipindah.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { seedDatabase } from './seed.js';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'server', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';
const SUPABASE_TABLE = process.env.SUPABASE_TABLE || 'site_state';
const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_KEY);

const MEMORY_ONLY = process.env.VERCEL === '1' || process.env.READ_ONLY_FS === '1';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
  };
}

class Store {
  constructor() {
    this.doc = null;
    this.mode = SUPABASE_ENABLED ? 'supabase' : MEMORY_ONLY ? 'memory' : 'file';
    this.fileDisabled = MEMORY_ONLY;
    this.timer = null;
    this.pending = false;
    this.ready = null;
  }

  async init() {
    if (!this.ready) this.ready = this._init();
    return this.ready;
  }

  async _init() {
    const seed = seedDatabase();

    if (SUPABASE_ENABLED) {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.main&select=doc`,
          { headers: headers() }
        );
        if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.doc) {
          this.doc = normalize(rows[0].doc, seed);
          this.mode = 'supabase';
          return this.doc;
        }
        this.doc = seed;
        await this._pushSupabase();
        console.log('[Info Kelurahan] Supabase kosong — data awal (seed) diunggah.');
        return this.doc;
      } catch (error) {
        console.error('[Info Kelurahan] Supabase gagal dimuat, fallback ke memori:', error.message);
        this.mode = 'memory';
        this.doc = seed;
        return this.doc;
      }
    }

    if (!this.fileDisabled) {
      try {
        if (fs.existsSync(DB_FILE)) {
          const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
          this.doc = normalize(raw, seed);
          this.mode = 'file';
          return this.doc;
        }
        this.doc = seed;
        this._writeFile();
        this.mode = 'file';
        console.log(`[Info Kelurahan] Database baru dibuat: ${DB_FILE}`);
        return this.doc;
      } catch (error) {
        console.error('[Info Kelurahan] Gagal membaca db.json, memakai memori:', error.message);
        this.fileDisabled = true;
        this.mode = 'memory';
      }
    }

    this.doc = seed;
    return this.doc;
  }

  get() {
    if (!this.doc) this.doc = seedDatabase();
    return this.doc;
  }

  /** Simpan perubahan; penulisan ke disk di-debounce agar tidak thrash. */
  persist() {
    this.pending = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((error) => console.error('[Info Kelurahan] Gagal menyimpan:', error.message));
    }, 250);
  }

  async flush() {
    if (!this.pending) return;
    this.pending = false;
    const snapshot = this.get();
    if (SUPABASE_ENABLED && this.mode === 'supabase') {
      await this._pushSupabase(snapshot);
      return;
    }
    this._writeFile(snapshot);
  }

  _writeFile(snapshot = this.get()) {
    if (this.fileDisabled) return;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
      fs.renameSync(tmp, DB_FILE);
    } catch (error) {
      console.error('[Info Kelurahan] Penulisan file gagal (filesystem read-only?):', error.message);
      this.fileDisabled = true;
      this.mode = 'memory';
    }
  }

  async _pushSupabase(snapshot = this.get()) {
    const body = JSON.stringify([{ id: 'main', doc: snapshot, updated_at: new Date().toISOString() }]);
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method: 'POST',
      headers: { ...headers(), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body,
    });
    if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  }

  /** Rahasia HMAC sesi admin; disimpan di dokumen agar sesi bertahan setelah restart. */
  secret() {
    if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
    const doc = this.get();
    if (!doc.meta.secret) {
      doc.meta.secret = crypto.randomBytes(32).toString('hex');
      this.persist();
    }
    return doc.meta.secret;
  }
}

/** Pastikan dokumen lama/korup tetap punya semua field wajib. */
function normalize(doc, seed) {
  const raw = doc && typeof doc === 'object' ? doc : {};
  const out = {
    ...seed,
    ...raw,
    meta: { ...seed.meta, ...(raw.meta || {}) },
    settings: { ...seed.settings, ...(raw.settings || {}) },
    stats: { ...seed.stats, ...(raw.stats || {}) },
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : seed.categories,
    authors: Array.isArray(raw.authors) && raw.authors.length ? raw.authors : seed.authors,
    articles: Array.isArray(raw.articles) ? raw.articles : seed.articles,
    agenda: Array.isArray(raw.agenda) ? raw.agenda : seed.agenda,
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    subscribers: Array.isArray(raw.subscribers) ? raw.subscribers : [],
    media: Array.isArray(raw.media) ? raw.media : [],
  };
  return out;
}

export const store = new Store();
export const storageInfo = {
  get mode() {
    return store.mode;
  },
  supabase: SUPABASE_ENABLED,
  table: SUPABASE_TABLE,
  file: DB_FILE,
};

export function slugify(input, fallback = 'artikel') {
  const slug = String(input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 90)
    .replace(/^-|-$/g, '');
  return slug || `${fallback}-${Date.now().toString(36)}`;
}

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
}
