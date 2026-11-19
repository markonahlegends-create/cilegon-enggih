/**
 * Sesi admin berbasis cookie HttpOnly.
 *
 * Sebelumnya token disimpan di localStorage, artinya JavaScript apa pun yang
 * berjalan di halaman (termasuk lewat celah XSS atau dependency yang disusupi)
 * bisa membaca token dan memakainya dari komputer lain. Sekarang token hidup
 * di cookie `HttpOnly` yang tidak bisa dibaca JavaScript; browser hanya
 * mengirimkannya otomatis, dan hanya ke origin yang sama.
 *
 * Format token: `<b64url(payload)>.<hmac-sha256>` dengan payload
 * { sid, u, iat, exp }.
 *
 * `sid` (session id) membuat token bisa **dicabut** sebelum kedaluwarsa —
 * dipakai saat logout, saat password diganti, dan tombol "keluarkan semua
 * perangkat" di tab Keamanan.
 */

import crypto from 'node:crypto';

export const COOKIE_NAME = 'ce_admin_session';
export const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 jam
export const SESSION_TTL_DAYS = 0.5;
/** Toleransi clock skew saat membandingkan waktu kedaluwarsa. */
const CLOCK_SKEW_MS = 60 * 1000;

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (input) => {
  const padded = String(input).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
};

/**
 * Rahasia penandatangan sesi.
 *
 * PENTING: sebelumnya ada fallback hardcoded (`cilegon-enggih::<password>::fadil-labs`).
 * Itu berarti kalau ADMIN_PASSWORD tidak diset, siapa pun yang pernah membaca
 * source code bisa membuat cookie admin palsu tanpa tahu password sama sekali.
 * Sekarang:
 *
 *  1. ADMIN_TOKEN_SECRET dipakai kalau ada (paling benar).
 *  2. Kalau tidak, turunkan dari ADMIN_PASSWORD (masih butuh tahu password).
 *  3. Kalau keduanya kosong, pakai rahasia ACAK per proses — sesi lama jadi
 *     tidak valid setelah restart, tapi tidak ada yang bisa ditebak.
 */
let ephemeralSecretCache = null;

export const sessionSecret = (adminPassword) => {
  if (process.env.ADMIN_TOKEN_SECRET) return process.env.ADMIN_TOKEN_SECRET;

  if (adminPassword) {
    return crypto.createHmac('sha256', String(adminPassword)).update('cilegon-enggih/session/v2').digest('hex');
  }

  if (!ephemeralSecretCache) {
    ephemeralSecretCache = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralSecretCache;
};

const sign = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

/** Buat token sesi baru. */
export const createSessionToken = ({ secret, username = 'admin', ttlMs = SESSION_TTL_MS }) => {
  const now = Date.now();
  const payload = b64url(
    JSON.stringify({
      sid: crypto.randomBytes(12).toString('hex'),
      u: username,
      iat: now,
      exp: now + ttlMs
    })
  );
  return { token: `${payload}.${sign(payload, secret)}`, expiresAt: now + ttlMs };
};

/** Verifikasi tanda tangan + masa berlaku. Mengembalikan klaim atau null. */
export const verifySessionToken = (token, { secret }) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payload || !sig) return null;
  try {
    const expected = sign(payload, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(unb64url(payload));
    if (!claims?.exp || claims.exp + CLOCK_SKEW_MS < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
};

/* ------------------------------------------------------------------ */
/* Cookie helpers (framework agnostic — hanya string header)           */
/* ------------------------------------------------------------------ */

const headerValue = (headers = {}, name) => {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers || {})) {
    if (String(key).toLowerCase() === lower) return Array.isArray(value) ? value.join('; ') : value;
  }
  return '';
};

/** Baca cookie dari header request. */
export const parseCookies = (headers = {}) => {
  const raw = String(headerValue(headers, 'cookie') || '');
  const out = {};
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    const val = part.slice(eq + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
};

/** Deteksi koneksi HTTPS (Vercel selalu meneruskan x-forwarded-proto). */
export const isSecureRequest = (headers = {}) => {
  const proto = String(headerValue(headers, 'x-forwarded-proto') || '').split(',')[0].trim();
  if (proto) return proto === 'https';
  return process.env.NODE_ENV === 'production';
};

/**
 * Attribute cookie sesi. `SameSite=Strict` membuat CSRF praktis mustahil,
 * `HttpOnly` menutup pencurian lewat JavaScript, `Path=/api` mempersempit
 * pengiriman hanya ke endpoint API (aset statis tidak membawa sesi).
 */
export const sessionCookie = (token, { headers = {}, maxAgeSeconds = SESSION_TTL_MS / 1000 } = {}) => {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/api',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  if (isSecureRequest(headers)) parts.push('Secure');
  return parts.join('; ');
};

/** Cookie kedaluwarsa untuk logout. */
export const clearSessionCookie = (headers = {}) => {
  const parts = [`${COOKIE_NAME}=`, 'Path=/api', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (isSecureRequest(headers)) parts.push('Secure');
  return parts.join('; ');
};

/* ------------------------------------------------------------------ */
/* Pencatatan sesi (untuk pencabutan dini saat logout)                 */
/* ------------------------------------------------------------------ */

const sessionKey = (sid) => `session:${sid}`;

/**
 * Catat sesi aktif. Disimpan lewat store koleksi `sessions` supaya bisa
 * dicabut dari instance lain (serverless) — bukan hanya dari proses ini.
 */
export const registerSession = async (store, { sid, username, ip, userAgent }) => {
  if (!store?.put || !sid) return;
  await store
    .put('sessions', {
      id: sessionKey(sid),
      sid,
      username: username || 'admin',
      ip: ip || 'unknown',
      userAgent: String(userAgent || '').slice(0, 180),
      createdAt: new Date().toISOString(),
      revokedAt: null
    })
    .catch((err) => console.error('[session] gagal mencatat sesi:', err.message));
};

/** Sesi dicabut? (true = tolak akses) */
export const isSessionRevoked = async (store, sid) => {
  if (!store?.get || !sid) return false;
  try {
    const doc = await store.get('sessions', sessionKey(sid));
    return Boolean(doc?.revokedAt);
  } catch {
    return false;
  }
};

/** Cabut satu sesi (logout). */
export const revokeSession = async (store, sid) => {
  if (!store?.put || !sid) return;
  const key = sessionKey(sid);
  const existing = (await store.get('sessions', key).catch(() => null)) || {};
  await store
    .put('sessions', {
      ...existing,
      id: key,
      sid,
      revokedAt: new Date().toISOString()
    })
    .catch((err) => console.error('[session] gagal mencabut sesi:', err.message));
};

/** Cabut seluruh sesi admin selain yang sedang dipakai (opsional). */
export const revokeAllSessions = async (store, { ip } = {}) => {
  const docs = await store.list('sessions').catch(() => []);
  const now = new Date().toISOString();
  let count = 0;
  for (const doc of docs) {
    if (doc.revokedAt) continue;
    await store.put('sessions', { ...doc, revokedAt: now });
    count += 1;
  }
  return { revoked: count, at: now, by: ip || 'admin' };
};
