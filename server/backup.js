/**
 * Backup otomatis + pemulihan.
 *
 * Kenapa ini penting: paket gratis Supabase **tidak** menyertakan backup harian.
 * Tanpa ini, satu kesalahan (hapus produk, seed ulang, atau proyek Supabase
 * tersuspend) bisa menghilangkan seluruh riwayat pesanan.
 *
 * Rancangan:
 *  - Cadangan disimpan di **Supabase Storage** (bucket `backups`, Private),
 *    bukan di database — supaya kalau tabel rusak, cadangannya tetap ada.
 *  - Snapshot dikompres gzip; rentang 1 tahun data toko kecil masih < 1 MB.
 *  - Dijadwalkan oleh Vercel Cron (`/api/cron/backup`) yang diautentikasi
 *    dengan `CRON_SECRET`, bukan dengan sesi admin.
 *  - Retensi: `BACKUP_RETENTION` berkas terakhir (default 30).
 *  - Kredensial (botToken, chatId) **tidak** ikut dicadangkan.
 */

const COLLECTIONS = ['orders', 'products', 'b2b', 'settings', 'vendors', 'expenses'];

const REDACTED_SETTINGS_KEYS = ['botToken', 'chatId'];

const supabaseConfig = () => ({
  url: String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(
    /\/+$/,
    ''
  ),
  key:
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
});

const authHeaders = (key) => {
  const headers = { apikey: key };
  // Key format baru (sb_secret_…) tidak boleh dikirim sebagai Bearer.
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  return headers;
};

const bucket = () => process.env.SUPABASE_BACKUP_BUCKET || 'backups';

const stamp = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
};

/** Buang kredensial sebelum data meninggalkan server. */
const sanitizeSettings = (doc) => {
  const copy = { ...doc };
  if (copy.telegram && typeof copy.telegram === 'object') {
    copy.telegram = { ...copy.telegram };
    for (const key of REDACTED_SETTINGS_KEYS) delete copy.telegram[key];
    copy.telegram.credentialsIncluded = false;
  }
  return copy;
};

/** Rangkum isi backup untuk ditampilkan di dashboard. */
export const snapshotStats = (snapshot) =>
  Object.fromEntries(
    COLLECTIONS.map((c) => [c, Array.isArray(snapshot[c]) ? snapshot[c].length : 0])
  );

/** Kumpulkan seluruh data ke satu objek (tanpa kredensial). */
export const collectSnapshot = async (store) => {
  const snapshot = {
    format: 'cilegon-enggih-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    note: 'Kredensial (botToken/chatId) sengaja tidak dicadangkan. Pulihkan lewat Dashboard → Pengaturan.',
    collections: COLLECTIONS
  };
  for (const collection of COLLECTIONS) {
    const docs = await store.list(collection).catch(() => []);
    snapshot[collection] =
      collection === 'settings' ? docs.map(sanitizeSettings) : docs;
  }
  return snapshot;
};

const uploadObject = async ({ name, body, contentType }) => {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL / kunci belum diisi — backup permanen butuh Supabase Storage.'
    );
  }
  const res = await fetch(`${url}/storage/v1/object/${bucket()}/${encodeURIComponent(name)}`, {
    method: 'POST',
    headers: { ...authHeaders(key), 'Content-Type': contentType, 'x-upsert': 'true' },
    body
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `Upload backup gagal (${res.status}). Pastikan bucket "${bucket()}" sudah dibuat. ${detail.slice(0, 160)}`
    );
  }
  return name;
};

const listObjects = async () => {
  const { url, key } = supabaseConfig();
  if (!url || !key) return [];
  const res = await fetch(`${url}/storage/v1/object/list/${bucket()}`, {
    method: 'POST',
    headers: { ...authHeaders(key), 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 200, sortBy: { column: 'name', order: 'asc' } })
  });
  if (!res.ok) return [];
  const rows = await res.json().catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .map((r) => r.name)
    .filter((n) => typeof n === 'string' && /^backup-.*\.json\.gz$/.test(n));
};

const deleteObject = async (name) => {
  const { url, key } = supabaseConfig();
  if (!url || !key) return false;
  const res = await fetch(`${url}/storage/v1/object/${bucket()}/${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: authHeaders(key)
  });
  return res.ok;
};

/**
 * Jalankan backup: ambil snapshot → gzip → unggah → pangkas retensi.
 * @returns {Promise<{filename:string, bytes:number, compressedBytes:number, counts:object, pruned:string[]}>}
 */
export const runBackup = async (store) => {
  const snapshot = await collectSnapshot(store);
  const raw = Buffer.from(JSON.stringify(snapshot), 'utf8');
  const gz = await new Promise((resolve, reject) => {
    import('node:zlib')
      .then(({ gzip }) => gzip(raw, { level: 9 }, (err, out) => (err ? reject(err) : resolve(out))))
      .catch(reject);
  });

  const filename = `backup-${stamp()}.json.gz`;
  await uploadObject({ name: filename, body: gz, contentType: 'application/gzip' });

  // Retensi: sisakan N berkas terbaru.
  const keep = Math.max(1, Number(process.env.BACKUP_RETENTION) || 30);
  const names = (await listObjects()).sort();
  const pruned = [];
  const overflow = names.length - keep;
  if (overflow > 0) {
    for (const name of names.slice(0, overflow)) {
      if (await deleteObject(name)) pruned.push(name);
    }
  }

  return {
    filename,
    bytes: raw.length,
    compressedBytes: gz.length,
    counts: snapshotStats(snapshot),
    pruned
  };
};

/** Daftar backup tersimpan (tanpa mengunduh isinya). */
export const listBackups = async () => {
  const names = (await listObjects()).sort().reverse();
  return names.map((name) => ({
    filename: name,
    // backup-YYYYMMDD-HHMMSS.json.gz → ISO
    createdAt: (() => {
      const m = /^backup-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/.exec(name);
      if (!m) return null;
      return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
    })()
  }));
};

/** Unduh + buka satu backup. */
export const readBackup = async (filename) => {
  if (!/^backup-[\w.-]+\.json\.gz$/.test(String(filename || ''))) {
    throw new Error('Nama berkas backup tidak valid.');
  }
  const { url, key } = supabaseConfig();
  if (!url || !key) throw new Error('Supabase belum dikonfigurasi.');
  const res = await fetch(`${url}/storage/v1/object/${bucket()}/${encodeURIComponent(filename)}`, {
    headers: authHeaders(key)
  });
  if (!res.ok) throw new Error(`Backup tidak ditemukan (${res.status}).`);
  const gz = Buffer.from(await res.arrayBuffer());
  const { gunzip } = await import('node:zlib');
  const raw = await new Promise((resolve, reject) =>
    gunzip(gz, (err, out) => (err ? reject(err) : resolve(out)))
  );
  return JSON.parse(raw.toString('utf8'));
};

/**
 * Pulihkan dari snapshot.
 * @param {'merge'|'replace'} mode merge = tambah/timpa per id, replace = hapus dulu
 */
export const restoreBackup = async (store, snapshot, { mode = 'merge' } = {}) => {
  if (!snapshot || snapshot.format !== 'cilegon-enggih-backup') {
    throw new Error('Berkas ini bukan backup Cilegon Enggih yang valid.');
  }
  const report = {};
  for (const collection of COLLECTIONS) {
    const docs = snapshot[collection];
    if (!Array.isArray(docs) || docs.length === 0) continue;
    if (mode === 'replace') {
      await store.replaceAll(collection, docs);
      report[collection] = docs.length;
      continue;
    }
    let written = 0;
    for (const doc of docs) {
      if (!doc?.id) continue;
      await store.put(collection, doc);
      written += 1;
    }
    report[collection] = written;
  }
  return report;
};

export { COLLECTIONS };
