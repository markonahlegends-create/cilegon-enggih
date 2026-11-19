/**
 * Penyimpanan gambar (Supabase Storage → fallback folder lokal).
 *
 * Dipakai oleh:
 *  - POST /api/admin/upload          (foto produk, QRIS, aset toko)
 *  - POST /api/orders/:id/proof      (bukti transfer pembeli)
 *
 * Prinsip keamanan:
 *  1. **Tipe file ditentukan dari isi (magic bytes), bukan dari prefix `data:`**
 *     yang dikirim klien. File `.svg` berisi `<script>` bisa menyamar sebagai
 *     `data:image/svg+xml`, karena itu SVG tidak pernah diterima.
 *  2. Nama file dibuat server (slug + timestamp + acak), tidak pernah memakai
 *     nama dari klien → tidak bisa path traversal (`../`).
 *  3. Batas ukuran ditegakkan setelah decode, sehingga klien tidak bisa
 *     mengelabui dengan header yang lebih kecil.
 */

const MAX_UPLOAD_BYTES = 3 * 1024 * 1024; // foto produk / QRIS / aset toko
const MAX_PROOF_BYTES = 2 * 1024 * 1024; // bukti transfer (sudah dikompres klien)
/**
 * Video produk: 5 MB. Kuota Supabase gratis hanya 1 GB, dan video adalah
 * barang yang paling cepat menghabiskannya. 5 MB cukup untuk ~30 detik
 * H.264 720p — durasi yang wajar untuk memperlihatkan produk berputar.
 */
const MAX_VIDEO_BYTES = 5 * 1024 * 1024;

/** Hanya format raster yang aman dirender di <img>. SVG sengaja tidak ada. */
const MIME_BY_SIGNATURE = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    // RIFF....WEBP
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  },
  { ext: 'gif', mime: 'image/gif', test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 }
];

/**
 * Format video yang diterima. Sama seperti gambar, tipe ditentukan dari isi
 * file (magic bytes), bukan dari label data URL yang bisa dipalsukan.
 *
 * MP4: kotak `ftyp` di offset 4 (mis. ....ftypisom / ftypmp42 / ftypavc1)
 * WebM: header EBML 1A 45 DF A3
 * Format lain (AVI, MKV ber-DRM, dll) ditolak karena tidak diputar konsisten
 * di browser HP.
 */
const VIDEO_BY_SIGNATURE = [
  {
    ext: 'mp4',
    mime: 'video/mp4',
    test: (b) =>
      b.length > 12 &&
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 // 'ftyp'
  },
  {
    ext: 'webm',
    mime: 'video/webm',
    test: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3
  }
];

const sniffVideo = (buffer) => {
  if (!buffer || buffer.length < 16) return null;
  return VIDEO_BY_SIGNATURE.find((s) => s.test(buffer)) || null;
};

const EXT_BY_MIME = MIME_BY_SIGNATURE.reduce((acc, s) => {
  acc[s.mime] = s.ext;
  return acc;
}, {});

const svgLike = (raw) => /^\s*(<\?xml|<!doctype|<svg)/i.test(raw);

/** Deteksi tipe berdasarkan magic bytes; null bila bukan gambar yang diizinkan. */
const sniffImage = (buffer) => {
  if (!buffer || buffer.length < 12) return null;
  return MIME_BY_SIGNATURE.find((s) => s.test(buffer)) || null;
};

const slugifyName = (text) =>
  String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/**
 * Decode data URL menjadi buffer + metadata, dengan validasi berlapis.
 * @throws {Error} pesan siap tampil ke pengguna (berbahasa Indonesia).
 */
export const decodeImageDataUrl = (dataUrl, { maxBytes = MAX_UPLOAD_BYTES } = {}) => {
  const raw = String(dataUrl || '').trim();
  if (!raw) throw new Error('Gambar tidak dikirim.');

  const match = /^data:([a-zA-Z0-9.+\/-]+)?(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) {
    throw new Error('Format gambar tidak dikenali. Gunakan JPG, PNG, atau WEBP.');
  }

  const declaredMime = String(match[1] || '').toLowerCase();
  if (declaredMime === 'image/svg+xml' || declaredMime === 'image/svg') {
    throw new Error('SVG tidak diizinkan. Unggah JPG, PNG, atau WEBP.');
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length) throw new Error('Gambar kosong atau rusak.');

  if (buffer.length > maxBytes) {
    const label =
      maxBytes >= 1024 * 1024
        ? `${(maxBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(maxBytes / 1024)} KB`;
    throw new Error(`Ukuran gambar melebihi ${label}. Kompres dulu sebelum mengunggah.`);
  }

  // Cek isi file benar-benar gambar raster (bukan HTML/JS yang diberi label image/*).
  const sniffed = sniffImage(buffer);
  if (!sniffed) {
    if (svgLike(buffer.toString('utf8', 0, 200))) {
      throw new Error('SVG tidak diizinkan. Unggah JPG, PNG, atau WEBP.');
    }
    throw new Error('Isi file bukan gambar JPG/PNG/WEBP yang valid.');
  }

  return { buffer, mime: sniffed.mime, ext: sniffed.ext, bytes: buffer.length };
};

const supabaseStorageConfig = () => {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  return { url: String(url).replace(/\/+$/, ''), key: String(key) };
};

/**
 * Simpan data URL gambar.
 * @returns {Promise<{url:string, filename:string, storage:'supabase'|'local', bucket?:string, bytes:number, note?:string}>}
 */
export const saveImage = async ({ dataUrl, filename, bucket, maxBytes = MAX_UPLOAD_BYTES }) => {
  const { buffer, mime, ext, bytes } = decodeImageDataUrl(dataUrl, { maxBytes });

  const safeBase = slugifyName(filename) || 'gambar';
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const finalName = `${safeBase}-${unique}.${ext}`;

  const { url: sbUrl, key: sbKey } = supabaseStorageConfig();

  if (sbUrl && sbKey) {
    const authHeaders = { apikey: sbKey, 'Content-Type': mime, 'x-upsert': 'true' };
    // Key format baru (sb_secret_…) tidak boleh dikirim sebagai Bearer.
    if (!sbKey.startsWith('sb_')) authHeaders.Authorization = `Bearer ${sbKey}`;

    let uploadRes;
    try {
      uploadRes = await fetch(
        `${sbUrl}/storage/v1/object/${bucket}/${encodeURIComponent(finalName)}`,
        { method: 'POST', headers: authHeaders, body: buffer }
      );
    } catch (err) {
      throw new Error(`Upload ke Supabase Storage gagal: ${err.message}`);
    }

    if (uploadRes.ok) {
      return {
        url: `${sbUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(finalName)}`,
        filename: finalName,
        storage: 'supabase',
        bucket,
        bytes
      };
    }

    const detail = await uploadRes.text().catch(() => '');
    console.error('[upload] Supabase Storage gagal:', uploadRes.status, detail.slice(0, 200));
    throw new Error(
      `Upload ke Supabase Storage gagal (${uploadRes.status}). Pastikan bucket "${bucket}" sudah dibuat dan bersifat Public. Detail: ${detail.slice(0, 160)}`
    );
  }

  // Fallback: filesystem lokal (hanya untuk dev / self-host).
  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, finalName), buffer);
      return {
        url: `/uploads/${finalName}`,
        filename: finalName,
        storage: 'local',
        bytes,
        note: 'File disimpan lokal. Di Vercel/Cloudflare filesystem tidak permanen — set SUPABASE_URL + kunci agar upload permanen.'
      };
    } catch (err) {
      throw new Error(`Gagal menyimpan gambar: ${err.message}`);
    }
  }

  throw new Error('Penyimpanan gambar belum dikonfigurasi (SUPABASE_URL + kunci belum diisi).');
};

/**
 * Simpan video produk (data URL base64).
 *
 * Berbeda dari saveImage: tidak memakai kompresi karena video tidak bisa
 * dikompres di browser tanpa membebani CPU ponsel. Karena itu batas ukuran
 * ditegakkan ketat (5 MB) dan admin diberi pesan jelas bila melebihi.
 *
 * @returns {Promise<{url:string, filename:string, storage:string, bucket?:string, bytes:number, mime:string}>}
 */
export const saveVideo = async ({ dataUrl, filename, bucket }) => {
  const raw = String(dataUrl || '').trim();
  if (!raw) throw new Error('Video tidak dikirim.');

  const match = /^data:([a-zA-Z0-9.+\/-]+)?(?:;charset=[^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/.exec(raw);
  if (!match) {
    throw new Error('Format video tidak dikenali. Gunakan file MP4 atau WebM.');
  }

  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  if (!buffer.length) throw new Error('Video kosong atau rusak.');

  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error(
      `Ukuran video ${(buffer.length / (1024 * 1024)).toFixed(1)} MB melebihi batas 5 MB. ` +
        'Pendekkan durasi (anjuran 30 detik) atau kecilkan resolusi ke 720p.'
    );
  }

  // Tipe ditentukan dari isi file, bukan dari label data URL.
  const sniffed = sniffVideo(buffer);
  if (!sniffed) {
    throw new Error('Isi file bukan video MP4/WebM yang valid. Format lain tidak diputar di semua browser HP.');
  }

  const safeBase = slugifyName(filename) || 'video-produk';
  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const finalName = `${safeBase}-${unique}.${sniffed.ext}`;

  const { url: sbUrl, key: sbKey } = supabaseStorageConfig();

  if (sbUrl && sbKey) {
    const authHeaders = { apikey: sbKey, 'Content-Type': sniffed.mime, 'x-upsert': 'true' };
    if (!sbKey.startsWith('sb_')) authHeaders.Authorization = `Bearer ${sbKey}`;

    let uploadRes;
    try {
      uploadRes = await fetch(
        `${sbUrl}/storage/v1/object/${bucket}/${encodeURIComponent(finalName)}`,
        { method: 'POST', headers: authHeaders, body: buffer }
      );
    } catch (err) {
      throw new Error(`Upload video ke Supabase Storage gagal: ${err.message}`);
    }

    if (uploadRes.ok) {
      return {
        url: `${sbUrl}/storage/v1/object/public/${bucket}/${encodeURIComponent(finalName)}`,
        filename: finalName,
        storage: 'supabase',
        bucket,
        bytes: buffer.length,
        mime: sniffed.mime
      };
    }

    const detail = await uploadRes.text().catch(() => '');
    console.error('[upload] Supabase video gagal:', uploadRes.status, detail.slice(0, 200));
    throw new Error(
      `Upload video gagal (${uploadRes.status}). Pastikan bucket "${bucket}" sudah dibuat dan bersifat Public.`
    );
  }

  if (typeof process !== 'undefined' && process.versions?.node) {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const dir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, finalName), buffer);
      return {
        url: `/uploads/${finalName}`,
        filename: finalName,
        storage: 'local',
        bytes: buffer.length,
        mime: sniffed.mime
      };
    } catch (err) {
      throw new Error(`Gagal menyimpan video: ${err.message}`);
    }
  }

  throw new Error('Penyimpanan video belum dikonfigurasi (SUPABASE_URL + kunci belum diisi).');
};

export { MAX_UPLOAD_BYTES, MAX_PROOF_BYTES, MAX_VIDEO_BYTES, EXT_BY_MIME };
