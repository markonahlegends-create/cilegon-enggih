/**
 * Keamanan & audit untuk Cilegon Enggih.
 *
 * Isi:
 *  - Rate limiter (in-memory, cukup untuk 1 instance Vercel/self-host)
 *  - Verifikasi OTP admin via Telegram (2FA)
 *  - Audit log (disimpan di koleksi `audit`, tidak pernah dikirim ke publik)
 *
 * Prinsip: semua fungsi di sini TIDAK PERNAH melempar error ke pemanggil.
 */

import crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Rate limiter                                                        */
/* ------------------------------------------------------------------ */

/**
 * Pembatas percobaan sederhana per kunci (mis. per IP + aksi).
 * Menyimpan timestamp percobaan terakhir di memori proses.
 *
 * Catatan: pada serverless, memori bisa hilang saat cold start sehingga
 * hitungan bisa ter-reset. Untuk toko kecil ini tetap menutup mayoritas
 * percobaan brute force otomatis; kalau butuh yang persisten, simpan ke
 * tabel Supabase.
 */
const buckets = new Map();

export const rateLimit = (key, { max = 5, windowMs = 15 * 60 * 1000 } = {}) => {
  const now = Date.now();
  const entry = buckets.get(key) || { hits: [], blockedUntil: 0 };

  if (entry.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000)
    };
  }

  entry.hits = entry.hits.filter((t) => now - t < windowMs);
  if (entry.hits.length >= max) {
    // Blokir makin lama setiap kali melewati batas.
    const penalty = Math.min(windowMs * 4, windowMs * Math.ceil(entry.hits.length / max));
    entry.blockedUntil = now + penalty;
    buckets.set(key, entry);
    return { allowed: false, retryAfterSeconds: Math.ceil(penalty / 1000) };
  }

  entry.hits.push(now);
  buckets.set(key, entry);

  // Bersihkan bucket lama supaya memori tidak tumbuh terus.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      const last = v.hits[v.hits.length - 1] || 0;
      if (now - last > windowMs * 2 && v.blockedUntil < now) buckets.delete(k);
    }
  }

  return { allowed: true, remaining: Math.max(0, max - entry.hits.length) };
};

/** Cek apakah kunci sedang diblokir (tanpa menambah hitungan). */
export const isBlocked = (key) => {
  const entry = buckets.get(key);
  if (!entry) return false;
  if (entry.blockedUntil > Date.now()) return true;
  return false;
};

export const resetRateLimit = (key) => buckets.delete(key);

/* ------------------------------------------------------------------ */
/* IP helper                                                           */
/* ------------------------------------------------------------------ */

/** Ambil IP klien dari header proxy (Vercel/Cloudflare) atau socket. */
export const clientIp = (headers = {}) => {
  const h = headers || {};
  const forwarded = h['x-forwarded-for'] || h['x-real-ip'] || h['cf-connecting-ip'] || '';
  const first = String(forwarded).split(',')[0].trim();
  return first || 'unknown';
};

/* ------------------------------------------------------------------ */
/* OTP admin (2FA via Telegram)                                        */
/* ------------------------------------------------------------------ */

const OTP_TTL_MS = 5 * 60 * 1000;
const otpChallenges = new Map();

const hashCode = (challengeId, code) =>
  crypto.createHash('sha256').update(`${challengeId}:${code}:ce-otp`).digest('hex');

/**
 * Buat tantangan OTP baru.
 * @returns {{challengeId: string, code: string, expiresInSeconds: number}}
 */
export const createOtpChallenge = () => {
  const challengeId = crypto.randomBytes(16).toString('hex');
  const code = String(crypto.randomInt(100000, 999999));
  otpChallenges.set(challengeId, {
    hash: hashCode(challengeId, code),
    expires: Date.now() + OTP_TTL_MS,
    attempts: 0
  });
  // Batasi jumlah tantangan aktif.
  if (otpChallenges.size > 200) {
    const now = Date.now();
    for (const [id, value] of otpChallenges) {
      if (value.expires < now) otpChallenges.delete(id);
    }
  }
  return { challengeId, code, expiresInSeconds: OTP_TTL_MS / 1000 };
};

/**
 * Verifikasi kode OTP.
 * @returns {{ok: boolean, reason?: string}}
 */
export const verifyOtpChallenge = (challengeId, code) => {
  const entry = otpChallenges.get(String(challengeId || ''));
  if (!entry) return { ok: false, reason: 'Tantangan verifikasi tidak ditemukan. Silakan login ulang.' };
  if (entry.expires < Date.now()) {
    otpChallenges.delete(challengeId);
    return { ok: false, reason: 'Kode verifikasi sudah kedaluwarsa. Silakan login ulang.' };
  }
  if (entry.attempts >= 5) {
    otpChallenges.delete(challengeId);
    return { ok: false, reason: 'Terlalu banyak percobaan kode. Silakan login ulang.' };
  }
  entry.attempts += 1;

  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return { ok: false, reason: 'Kode verifikasi harus 6 angka.' };

  const expected = Buffer.from(entry.hash);
  const given = Buffer.from(hashCode(challengeId, clean));
  const match = expected.length === given.length && crypto.timingSafeEqual(expected, given);

  if (!match) return { ok: false, reason: 'Kode verifikasi salah. Periksa kembali pesan Telegram.' };

  otpChallenges.delete(String(challengeId));
  return { ok: true };
};

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

const SENSITIVE_KEYS = /password|token|secret|key|authorization|otp|code/i;

/** Buang nilai sensitif dari objek sebelum dicatat. */
export const redact = (input, depth = 0) => {
  if (input === null || input === undefined) return input;
  if (depth > 3) return '[dipotong]';
  if (Array.isArray(input)) return input.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input).map(([key, value]) => [
        key,
        SENSITIVE_KEYS.test(key) ? '[disembunyikan]' : redact(value, depth + 1)
      ])
    );
  }
  if (typeof input === 'string' && input.length > 300) return `${input.slice(0, 300)}…`;
  return input;
};

/**
 * Catat aktivitas admin/publik ke koleksi `audit`.
 * Pemanggil: `await recordAudit(store, {...})`.
 */
export const recordAudit = async (store, entry) => {
  try {
    const now = new Date();
    const doc = {
      id: `audit-${now.getTime()}-${crypto.randomBytes(3).toString('hex')}`,
      at: now.toISOString(),
      action: entry.action || 'unknown',
      actor: entry.actor || 'system',
      ip: entry.ip || 'unknown',
      target: entry.target || '',
      status: entry.status || 'ok',
      detail: entry.detail ? redact(entry.detail) : undefined
    };
    await store.put('audit', doc);
    return doc;
  } catch (err) {
    console.error('[audit] gagal mencatat:', err.message);
    return null;
  }
};

/** Buang audit yang lebih tua dari N hari (dipanggil saat membaca daftar). */
export const pruneAudit = async (store, keepDays = 90) => {
  try {
    const docs = await store.list('audit');
    const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    const old = docs.filter((d) => new Date(d.at).getTime() < cutoff);
    await Promise.all(old.map((d) => store.remove('audit', d.id)));
    return old.length;
  } catch (err) {
    console.error('[audit] gagal memangkas:', err.message);
    return 0;
  }
};
