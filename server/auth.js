/**
 * Auth admin Info Kelurahan.
 *
 * Password diambil dari env ADMIN_PASSWORD (default dev: infokelurahan2026).
 * Token = base64url(payload).HMAC-SHA256(payload) — stateless, tidak butuh session store,
 * sehingga tetap valid di serverless.
 */
import crypto from 'node:crypto';

export const DEFAULT_DEV_PASSWORD = 'infokelurahan2026';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || DEFAULT_DEV_PASSWORD;
export const IS_DEV_PASSWORD = !process.env.ADMIN_PASSWORD;
export const TOKEN_TTL_HOURS = Number(process.env.ADMIN_TOKEN_TTL_HOURS || 12);

const attempts = new Map();

function b64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(input) {
  return Buffer.from(String(input).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function sign(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(password) {
  return safeEqual(password || '', ADMIN_PASSWORD);
}

export function createToken(secret, extra = {}) {
  const payload = { sub: 'admin', role: 'editor', exp: Date.now() + TOKEN_TTL_HOURS * 3600_000, ...extra };
  const raw = b64url(JSON.stringify(payload));
  return `${raw}.${sign(secret, raw)}`;
}

export function verifyToken(secret, token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [raw, signature] = token.split('.');
  if (!raw || !signature) return null;
  if (!safeEqual(signature, sign(secret, raw))) return null;
  try {
    const payload = JSON.parse(fromB64url(raw));
    if (!payload?.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Rate limit login sederhana (per IP), cukup untuk satu kelurahan. */
export function registerLoginAttempt(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const entry = attempts.get(key) || { count: 0, reset: now + 10 * 60_000 };
  if (now > entry.reset) {
    entry.count = 0;
    entry.reset = now + 10 * 60_000;
  }
  entry.count += 1;
  attempts.set(key, entry);
  if (entry.count > 12) {
    return { blocked: true, retryAfter: Math.ceil((entry.reset - now) / 1000) };
  }
  return { blocked: false };
}

export function clearLoginAttempts(ip) {
  attempts.delete(ip || 'unknown');
}
