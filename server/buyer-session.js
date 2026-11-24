/**
 * SESI PEMBELI (konsumen) — terpisah total dari sesi admin.
 *
 * KENAPA TERPISAH
 * Sesi admin memberi akses ke seluruh pesanan, keuangan, dan pengaturan toko.
 * Kalau pembeli memakai mekanisme yang sama, satu bug otorisasi berarti
 * pembeli bisa melihat data pembeli lain — risiko yang tidak sebanding dengan
 * kenyamanan yang didapat.
 *
 * Karena itu:
 *   - cookie berbeda (`ce_buyer` vs `ce_admin_session`);
 *   - rahasia berbeda (diturunkan dari ADMIN_TOKEN_SECRET dengan label berbeda,
 *     sehingga token admin tidak akan pernah sah sebagai token pembeli);
 *   - klaim wajib `role: 'buyer'` dan diverifikasi ulang saat dibaca.
 *
 * MODEL AKUN
 * Checkout TETAP tanpa wajib daftar (guest checkout). Akun bersifat opsional:
 * pembeli memverifikasi nomor WhatsApp dengan kode OTP, lalu seluruh pesanan
 * yang pernah dibuat dengan nomor itu otomatis terkumpul di "Pesanan Saya" —
 * termasuk status pembayaran, pengiriman, dan pengembalian dana.
 */
import crypto from 'node:crypto';

export const BUYER_COOKIE = 'ce_buyer';
/** 30 hari — pembeli tidak perlu login ulang setiap kali memesan. */
export const BUYER_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
/** Kode OTP berlaku 10 menit. */
export const OTP_TTL_MS = 1000 * 60 * 10;
/** Maksimum percobaan salah per kode sebelum dianggap hangus. */
export const OTP_MAX_ATTEMPTS = 5;

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (input) => {
  const padded = String(input).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
};

/**
 * Rahasia penandatangan sesi pembeli.
 *
 * SELALU diturunkan dari ADMIN_TOKEN_SECRET (atau ADMIN_PASSWORD) dengan label
 * `buyer` yang berbeda, supaya token admin tidak bisa dipakai sebagai token
 * pembeli meskipun strukturnya sama. Kalau tidak ada rahasia apa pun, dipakai
 * rahasia acak per proses — sesi hilang saat restart, tetapi tidak ada yang
 * bisa ditebak (fail-closed, bukan diam-diam bisa dipalsukan).
 */
let ephemeralBuyerSecret = null;

export const buyerSecret = () => {
  if (!ephemeralBuyerSecret && !process.env.ADMIN_TOKEN_SECRET && !process.env.ADMIN_PASSWORD) {
    ephemeralBuyerSecret = crypto.randomBytes(32).toString('hex');
  }
  const basis = process.env.ADMIN_TOKEN_SECRET || String(process.env.ADMIN_PASSWORD || '');
  if (!basis) return ephemeralBuyerSecret;
  return crypto.createHmac('sha256', basis).update('cilegon-enggih/buyer-session/v1').digest('hex');
};

const sign = (payload, secret) =>
  crypto.createHmac('sha256', secret).update(payload).digest('hex');

/**
 * Normalisasi nomor WhatsApp Indonesia ke bentuk `08xxxxxxxxxx`.
 *
 * Satu nomor harus SELALU menghasilkan satu identitas, kalau tidak riwayat
 * pembeli akan terpecah: `+62812…`, `62812…`, dan `0812…` adalah orang yang
 * sama. Nomor yang tidak masuk akal ditolak (bukan diterima apa adanya).
 */
export const normalisasiNomor = (nomor) => {
  let d = String(nomor || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('62')) d = `0${d.slice(2)}`;
  if (!d.startsWith('0')) d = `0${d}`;
  /* Nomor Indonesia: 08–13 digit total. */
  if (d.length < 9 || d.length > 15) return null;
  return d;
};

/** 4 digit terakhir — bukti kedua yang sudah dipakai sistem ini sejak awal. */
export const empatTerakhir = (nomor) => {
  const n = normalisasiNomor(nomor);
  return n ? n.slice(-4) : '';
};

/**
 * Apakah dua nomor ini ORANG YANG SAMA?
 *
 * KENAPA BUKAN `empatTerakhir` SAJA
 * Halaman Lacak Pesanan memang memakai 4 digit terakhir, dan di sana itu
 * memadai karena pembeli juga harus mengetik nomor pesanan yang panjang dan
 * sulit ditebak. Di sini keadaannya jauh berbeda: sesi pembeli memberi akses
 * ke SELURUH riwayat nomor itu — termasuk nama barang, nominal, dan alamat
 * pengiriman lengkap — hanya dengan sekali verifikasi OTP.
 *
 * Kalau pencocokan tetap memakai 4 digit terakhir, siapa pun yang bisa
 * menerima satu kode OTP untuk nomornya sendiri dapat membaca pesanan orang
 * lain yang kebetulan berakhiran sama. Dengan 10.000 kemungkinan dan awalan
 * operator Indonesia yang berulang, tabrakan seperti itu bukan hal langka —
 * dan sudah dibuktikan bisa terjadi (lihat scripts/test-buyer-account.mjs).
 *
 * Jadi di sini nomor harus cocok PERSIS setelah dinormalisasi: '0812…',
 * '+62 812…', dan '62812…' dianggap sama, tetapi '…7890' dan '…7890' dari
 * nomor yang berbeda TIDAK.
 */
export const nomorSama = (a, b) => {
  const na = normalisasiNomor(a);
  const nb = normalisasiNomor(b);
  return Boolean(na) && Boolean(nb) && na === nb;
};

export const createBuyerToken = ({ nomor, nama = '', ttlMs = BUYER_SESSION_TTL_MS }) => {
  const now = Date.now();
  const payload = b64url(
    JSON.stringify({
      role: 'buyer',
      wa: normalisasiNomor(nomor),
      n: String(nama || '').slice(0, 60),
      iat: now,
      exp: now + ttlMs
    })
  );
  return { token: `${payload}.${sign(payload, buyerSecret())}`, expiresAt: now + ttlMs };
};

/** Verifikasi token pembeli. Klaim `role` WAJIB 'buyer'. */
export const verifyBuyerToken = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const idx = token.lastIndexOf('.');
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!payload || !sig) return null;
  try {
    const expected = sign(payload, buyerSecret());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const claims = JSON.parse(unb64url(payload));
    if (claims?.role !== 'buyer') return null;
    if (!claims.exp || claims.exp < Date.now()) return null;
    if (!claims.wa) return null;
    return claims;
  } catch {
    return null;
  }
};

export const buyerCookie = (token, { headers = {}, maxAgeSeconds = BUYER_SESSION_TTL_MS / 1000 } = {}) => {
  const parts = [
    `${BUYER_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`
  ];
  /* SameSite=Lax (bukan Strict) supaya pembeli yang datang dari tautan Midtrans tetap terautentikasi. */
  const host = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (host === 'https' || process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
};

export const clearBuyerCookie = (headers = {}) => {
  const parts = [`${BUYER_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  const host = String(headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (host === 'https' || process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
};

/* ------------------------------------------------------------------ */
/* Kode OTP                                                            */
/* ------------------------------------------------------------------ */

/**
 * Buat kode OTP 6 digit yang AMAN.
 *
 * `Math.random()` tidak dipakai: nilainya bisa diprediksi dari kode sebelumnya.
 * `crypto.randomInt` memakai sumber acak kriptografis.
 */
export const buatKodeOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/** Id dokumen OTP diturunkan dari nomor, supaya satu nomor = satu kode aktif. */
export const otpDocId = (nomor) => {
  const n = normalisasiNomor(nomor) || String(nomor || '');
  return `otp-${crypto.createHash('sha256').update(n).digest('hex').slice(0, 24)}`;
};

/** Kode disimpan sebagai hash — kalau database bocor, kode tidak bisa dipakai. */
export const hashOtp = (nomor, kode) =>
  crypto.createHmac('sha256', buyerSecret()).update(`${normalisasiNomor(nomor)}:${String(kode).trim()}`).digest('hex');

export const otpCocok = (nomor, kode, hashTersimpan) => {
  if (!hashTersimpan) return false;
  const a = Buffer.from(hashOtp(nomor, kode));
  const b = Buffer.from(String(hashTersimpan));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
