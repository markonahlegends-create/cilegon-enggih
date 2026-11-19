/**
 * Core API Cilegon Enggih — framework agnostic.
 *
 * Semua route didefinisikan di sini sebagai tabel `routes`, lalu dipakai ulang oleh:
 *  - server/app.js            → adapter Express (dev, self-host, preview)
 *  - api/index.js             → adapter Vercel Serverless Function
 *  - functions/api/[[route]].js → adapter Cloudflare Pages Functions
 *
 * Tidak ada dependency framework di file ini supaya bisa jalan di edge runtime.
 */

import crypto from 'node:crypto';
import { store, SUPABASE_KEY_TYPE } from './db.js';
import { SEED_PRODUCTS, SEED_CATEGORIES, SEED_SIZE_CHART } from './seed/catalog.js';
import {
  buildProfitLoss,
  buildMarginReport,
  buildSalesReport,
  buildCashReport,
  buildReceivables,
  buildPayables,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  num
} from './finance.js';
import { saveImage, saveVideo, MAX_UPLOAD_BYTES, MAX_PROOF_BYTES, MAX_VIDEO_BYTES } from './storage.js';
import { checkStock, applyStockMovement, stockAlreadyApplied } from './stock.js';
import {
  normalizeEvent,
  buildInsights,
  pruneOldEvents,
  storeDay,
  geoHintFromHeaders
} from './insights.js';
import {
  COOKIE_NAME,
  SESSION_TTL_MS,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  sessionCookie,
  clearSessionCookie,
  registerSession,
  isSessionRevoked,
  sessionSecret,
  revokeSession,
  revokeAllSessions
} from './session.js';
import { sendDailyDigest } from './digest.js';
import {
  scoreVendorForDropship,
  computeMargin,
  buildDropshipReadiness,
  REQUIRED_CHECKS,
  BONUS_CHECKS,
  DEFAULT_RETURN_RESERVE_PERCENT
} from './dropship.js';
import {
  runBackup,
  listBackups,
  readBackup,
  restoreBackup,
  snapshotStats,
  backupStatus
} from './backup.js';
import {
  rateLimit,
  isBlocked,
  resetRateLimit,
  clientIp,
  createOtpChallenge,
  verifyOtpChallenge,
  recordAudit,
  pruneAudit
} from './security.js';
import {
  notifySafe,
  sendTelegramMessage,
  telegramConfig,
  templateNewOrder,
  templatePaymentProof,
  templatePaid,
  templateShipped,
  templateB2B,
  templateTest
} from './notify.js';
import {
  STORE,
  DEFAULT_SETTINGS,
  SEED_ORDERS,
  SEED_B2B,
  SEED_VOUCHERS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  DEFAULT_BANKS
} from './constants.js';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Password admin.
 *
 * Dulu ada fallback hardcoded 'enggih2026'. Itu berbahaya: kalau hosting lupa
 * menyetel ADMIN_PASSWORD, dashboard tetap bisa dibuka siapa pun yang tahu
 * nilai default dari repo. Sekarang:
 *
 *  - Di produksi (NODE_ENV=production atau VERCEL=1): WAJIB set ADMIN_PASSWORD.
 *    Kalau tidak diset, login admin ditolak seluruhnya.
 *  - Di development: pakai password acak per proses, dicetak ke konsol supaya
 *    tetap bisa dipakai, tapi tidak bisa ditebak dari source code.
 */
const IS_PRODUCTION =
  process.env.NODE_ENV === 'production' ||
  process.env.VERCEL === '1' ||
  process.env.CF_PAGES === '1';

const DEV_ADMIN_PASSWORD = crypto.randomBytes(9).toString('base64url');

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || (IS_PRODUCTION ? '' : DEV_ADMIN_PASSWORD);

/** True kalau password berasal dari mode dev (bukan dari env produksi). */
const IS_DEV_PASSWORD = !process.env.ADMIN_PASSWORD && !IS_PRODUCTION;

/** True kalau admin bisa login (password tersedia dari env atau mode dev). */
const ADMIN_LOGIN_ENABLED = Boolean(ADMIN_PASSWORD);

const ADMIN_TOKEN_SECRET = sessionSecret(ADMIN_PASSWORD);
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 jam

const ok = (body, status = 200, headers = null) => ({ status, body, headers: headers || undefined });
const bad = (message, status = 400, extra = {}) =>
  ({ status, body: { error: message, ...extra } });

const b64url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64url = (input) => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf-8');
};

export const signAdminToken = (username = 'admin') => {
  const payload = b64url(JSON.stringify({ u: username, exp: Date.now() + TOKEN_TTL_MS }));
  const sig = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
};

export const verifyAdminToken = (token) => {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  try {
    const expected = crypto.createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('hex');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(unb64url(payload));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
};

const bearer = (headers = {}) => {
  const raw = headers.authorization || headers.Authorization || '';
  return String(raw).replace(/^Bearer\s+/i, '').trim();
};

/**
 * Ambil sesi admin.
 *  1. Cookie HttpOnly `ce_admin_session` (cara utama, tidak bisa dibaca JS).
 *  2. Header Authorization (kompatibilitas: script CLI & sesi lama).
 * Cookie diprioritaskan karena SameSite=Strict membuatnya otomatis aman
 * terhadap CSRF antarsitus.
 */
const readAdminSession = (headers = {}) => {
  const secret = sessionSecret(ADMIN_PASSWORD);
  const fromCookie = verifySessionToken(parseCookies(headers)[COOKIE_NAME], { secret });
  if (fromCookie) return { ...fromCookie, via: 'cookie' };

  const raw = bearer(headers);
  if (!raw) return null;
  const legacy = verifySessionToken(raw, { secret });
  if (legacy) return { ...legacy, via: 'bearer' };
  const old = verifyAdminToken(raw);
  if (old) return { id: null, u: old.u, exp: old.exp, via: 'bearer-legacy' };
  return null;
};

const isAdmin = (headers) => Boolean(readAdminSession(headers));

/**
 * Penjaga tambahan: sesi yang sudah dicabut (logout / "keluarkan semua
 * perangkat" / password diganti) harus ditolak walau tanda tangannya masih
 * valid. Dipanggil sekali per request untuk semua route /api/admin/*.
 */
const SESSION_EXEMPT = new Set([
  'POST /api/admin/login',
  'POST /api/admin/verify-otp',
  'POST /api/admin/logout',
  // Endpoint ini sengaja mencabut sesinya sendiri — responsnya tetap 200
  // supaya dashboard bisa menampilkan konfirmasi, lalu cookie dihapus.
  'DELETE /api/admin/sessions'
]);

const guardRevokedSession = async (method, path, headers, result) => {
  if (!path.startsWith('/api/admin')) return result;
  if (SESSION_EXEMPT.has(`${method} ${path}`)) return result;
  const session = readAdminSession(headers);
  if (!session?.sid) return result;
  if (await isSessionRevoked(store, session.sid)) {
    return bad('Sesi sudah berakhir. Silakan login ulang.', 401);
  }
  return result;
};

/** Daftar sesi admin aktif (untuk tab Keamanan). */
const activeSessions = async () => {
  const docs = await store.list('sessions').catch(() => []);
  return docs
    .filter((d) => !d.revokedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 20)
    .map((d) => ({
      sid: String(d.sid || '').slice(0, 6) + '…',
      ip: d.ip,
      userAgent: d.userAgent,
      createdAt: d.createdAt
    }));
};

/** OTP aktif hanya jika bot Telegram sudah dikonfigurasi (kalau tidak, login biasa). */
const otpEnabled = (settings) => {
  const tg = settings?.telegram || {};
  return Boolean(tg.botToken && tg.chatId && tg.otpEnabled === true);
};

const nowIso = () => new Date().toISOString();

const wibStamp = (date = new Date()) => {
  const formatted = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
    .format(date)
    .replace(/\./g, ':');
  return `${formatted} WIB`;
};

const todayId = () => {
  const d = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  return d.replace(/-/g, '');
};

const randomDigits = (len) => {
  let out = '';
  for (let i = 0; i < len; i += 1) out += Math.floor(Math.random() * 10);
  return out;
};

const nextOrderId = (orders) => {
  const datePart = todayId();
  const used = new Set(orders.map((o) => String(o.orderId)));
  for (let i = 0; i < 40; i += 1) {
    const candidate = `CE-${datePart}-${Math.floor(100 + Math.random() * 899)}`;
    if (!used.has(candidate)) return candidate;
  }
  return `CE-${datePart}-${Date.now().toString().slice(-4)}`;
};

const nextInvoiceNumber = (orders) => {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const seq = String(orders.length + 1).padStart(4, '0');
  const base = `INV/CE/${d.getFullYear()}/${month}/${seq}`;
  const used = new Set(orders.map((o) => String(o.invoiceNumber)));
  return used.has(base) ? `${base}-${Date.now().toString().slice(-3)}` : base;
};

/** 3-digit unique code supaya nominal transfer unik dan 100% masuk ke rekening toko. */
const makeUniqueCode = (orders, total) => {
  const used = new Set(
    orders
      .filter((o) => o.paymentStatus === 'MENUNGGU_VERIFIKASI')
      .map((o) => Number(o.uniqueCodeValue))
  );
  for (let i = 0; i < 900; i += 1) {
    const candidate = Number(randomDigits(3).padEnd(3, '0'));
    if (candidate >= 1 && candidate <= 999 && !used.has(candidate)) return candidate;
  }
  // Deterministik fallback: hindari bentrok dengan nominal yang sudah aktif.
  const base = (Number(total) + 137) % 900;
  return base + 100;
};

/**
 * Bersihkan penanda placeholder rekening secara server-side.
 * Bendera dari browser bisa tidak ikut tersimpan (mis. akun lama menyimpan
 * isPlaceholder: true), jadi backend yang memutuskan status akhirnya:
 *  - buang label "(PLACEHOLDER)" dari nama pemilik
 *  - isPlaceholder = true hanya jika nomor rekening masih nomor contoh default
 */
// Nomor rekening CONTOH (fiktif) yang tidak akan pernah menerima transfer.
// Nomor e-wallet toko (0819…) sengaja TIDAK dimasukkan karena itu nomor asli.
const PLACEHOLDER_ACCOUNT_NUMBERS = new Set([
  '1234567890',
  '1300012345678',
  '012345678901234',
  '901234567890',
  '0000000000'
]);

const normalizeBanks = (banks) => {
  if (!Array.isArray(banks)) return [];
  return banks.map((bank) => {
    const accountHolder =
      String(bank.accountHolder || '')
        .replace(/\s*\(\s*placeholder\s*\)\s*/gi, '')
        .trim() || String(bank.bank || 'Cilegon Enggih');
    const accountNumber = String(bank.accountNumber || '').trim();
    const digits = accountNumber.replace(/\D/g, '');
    // Idempoten: hanya bergantung pada nomor rekening, bukan label teks.
    // Nomor kosong atau masih nomor contoh bawaan => belum siap menerima transfer.
    const isPlaceholder = !digits || PLACEHOLDER_ACCOUNT_NUMBERS.has(digits);
    return { ...bank, accountNumber, accountHolder, isPlaceholder };
  });
};

const readSettings = async () => {
  const docs = await store.list('settings');
  const saved = docs[0] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    qris: { ...DEFAULT_SETTINGS.qris, ...(saved.qris || {}) },
    payment: { ...DEFAULT_SETTINGS.payment, ...(saved.payment || {}) },
    invoice: { ...DEFAULT_SETTINGS.invoice, ...(saved.invoice || {}) },
    telegram: {
      ...DEFAULT_SETTINGS.telegram,
      // Fallback env (kalau diisi dari dashboard, nilai database yang dipakai).
      ...(process.env.TELEGRAM_BOT_TOKEN
        ? {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID || '',
            enabled: Boolean(process.env.TELEGRAM_CHAT_ID)
          }
        : {}),
      ...(saved.telegram || {})
    },
    preOrder: { ...DEFAULT_SETTINGS.preOrder, ...(saved.preOrder || {}) },
    banks: normalizeBanks(
      Array.isArray(saved.banks) && saved.banks.length ? saved.banks : DEFAULT_BANKS
    ),
    vouchers:
      Array.isArray(saved.vouchers) && saved.vouchers.length
        ? saved.vouchers
        : SEED_VOUCHERS
  };
};

const publicSettings = (settings) => ({
  storeName: settings.storeName,
  legalName: settings.legalName,
  tagline: settings.tagline,
  address: settings.address,
  addressShort: settings.addressShort,
  originDistrict: settings.originDistrict,
  originCity: settings.originCity,
  originPostal: settings.originPostal,
  email: settings.email,
  whatsapp: settings.whatsapp,
  whatsappDisplay: settings.whatsappDisplay,
  openHours: settings.openHours,
  mapsUrl: settings.mapsUrl,
  instagram: settings.instagram,
  developerTitle: settings.developerTitle,
  developerUrl: settings.developerUrl,
  banks: settings.banks,
  qris: settings.qris,
  payment: settings.payment,
  invoice: settings.invoice,
  announcement: settings.announcement,
  preOrder: settings.preOrder,
  /**
   * Telegram untuk browser: JANGAN kirim botToken/chatId.
   * Hanya status supaya UI bisa menampilkan "sudah terhubung".
   * Nilai lengkap hanya lewat endpoint admin.
   */
  telegram: {
    enabled: Boolean((settings.telegram || {}).enabled),
    connected: Boolean((settings.telegram || {}).botToken && (settings.telegram || {}).chatId),
    notifyNewOrder: Boolean((settings.telegram || {}).notifyNewOrder),
    notifyPaymentProof: Boolean((settings.telegram || {}).notifyPaymentProof),
    notifyPaid: Boolean((settings.telegram || {}).notifyPaid),
    notifyShipped: Boolean((settings.telegram || {}).notifyShipped),
    notifyB2B: Boolean((settings.telegram || {}).notifyB2B)
  },
  updatedAt: settings.updatedAt
});

const readProducts = async () => {
  const docs = await store.list('products');
  return docs;
};

const readOrders = async () => {
  const docs = await store.list('orders');
  return [...docs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

const readB2B = async () => {
  const docs = await store.list('b2b');
  return [...docs].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
};

const trackLinksFor = (courier, resi) => {
  if (!resi) return [];
  const name = String(courier || '').toLowerCase();
  const links = [
    {
      id: 'cekresi',
      label: 'Cek Resi (Multi Kurir)',
      url: `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`
    }
  ];
  if (name.includes('jne')) {
    links.push({
      id: 'jne',
      label: 'Website Resmi JNE',
      url: `https://www.jne.co.id/id/tracking/trace?noResi=${encodeURIComponent(resi)}`
    });
  } else if (name.includes('j&t') || name.includes('jnt') || name.includes('j＆t')) {
    links.push({
      id: 'jnt',
      label: 'Website Resmi J&T Express',
      url: `https://www.jet.co.id/track?awb=${encodeURIComponent(resi)}`
    });
  } else if (name.includes('sicepat')) {
    links.push({
      id: 'sicepat',
      label: 'Website Resmi SiCepat',
      url: `https://www.sicepat.com/checkAwb?awb=${encodeURIComponent(resi)}`
    });
  } else if (name.includes('gosend') || name.includes('grab')) {
    links.push({
      id: 'instant',
      label: 'Cek Resi Instant (CekResi)',
      url: `https://cekresi.com/?noresi=${encodeURIComponent(resi)}`
    });
  }
  return links;
};

const decorateOrder = (order) => ({
  ...order,
  resiStatus: order.resi ? 'TERSEDIA' : 'MENUNGGU_INPUT_RESI',
  trackingLinks: trackLinksFor(order.courier, order.resi),
  waLink: `https://wa.me/${String(order.customerPhone || '').replace(/\D/g, '').replace(/^0/, '62')}`
});

/* ------------------------------------------------------------------ */
/* Shipping zones (origin: Kel. Karang Asem, Kec. Cibeber, Kota Cilegon) */
/* ------------------------------------------------------------------ */

export const SHIPPING_ORIGIN = {
  district: 'Kec. Cibeber',
  city: 'Kota Cilegon',
  postal: '42425',
  label: 'Kel. Karang Asem, Kec. Cibeber, Kota Cilegon 42425'
};

/**
 * Model pengiriman.
 *
 * SEMUA produk dikirim lewat dropship dari gudang pemasok (lihat
 * server/dropship.js), BUKAN dari Karang Asem. Karena itu:
 *
 * - Layanan instan/same-day (GoSend Instant, GrabExpress SameDay) DIMATIKAN.
 *   Kurir instan harus dijemput dari lokasi barang berada; pemasok tidak akan
 *   memesan kurir instan ke alamat pembeli kita.
 * - Estimasi waktu ditambah waktu proses pemasok (1-2 hari) supaya janji ke
 *   pembeli tidak terlalu optimistis.
 * - `origin` dipertahankan sebagai alamat penagihan/identitas toko, tetapi
 *   TIDAK lagi dipakai sebagai titik jemput kurir.
 */
export const SHIPPING_MODEL = 'dropship';

export const SHIPPING_ZONES = [
  {
    id: 'cilegon-pusat',
    label: 'Kota Cilegon (Jombang, Purwakarta, Cibeber, Citangkil, Ramanuju)',
    zone: 'local-cilegon',
    allowInstant: false,
    baseReg: 8000,
    etaReg: '2 - 3 Hari'
  },
  {
    id: 'cilegon-industri',
    label: 'Kota Cilegon Barat & Pelabuhan (Ciwandan, Anyer, Pulomerak, Grogol)',
    zone: 'local-cilegon-west',
    allowInstant: false,
    baseReg: 9000,
    etaReg: '2 - 3 Hari'
  },
  {
    id: 'serang',
    label: 'Kota Serang & Kab. Serang (Kramatwatu, Bojonegara, Ciruas)',
    zone: 'banten-near',
    allowInstant: false,
    baseReg: 10000,
    etaReg: '2 - 4 Hari'
  },
  {
    id: 'tangerang',
    label: 'Tangerang Raya (BSD, Alam Sutera, Karawaci, Tangsel)',
    zone: 'jabodetabek',
    allowInstant: false,
    baseReg: 12000,
    etaReg: '2 - 4 Hari'
  },
  {
    id: 'jakarta',
    label: 'DKI Jakarta (Pusat, Selatan, Barat, Timur, Utara)',
    zone: 'jabodetabek',
    allowInstant: false,
    baseReg: 13000,
    etaReg: '2 - 4 Hari'
  },
  {
    id: 'bandung-jabar',
    label: 'Bandung, Bekasi, Bogor, Depok, Banjar & Jawa Barat',
    zone: 'jabar',
    allowInstant: false,
    baseReg: 16000,
    etaReg: '3 - 5 Hari'
  },
  {
    id: 'jateng-diy',
    label: 'Semarang, Yogyakarta, Solo & Jawa Tengah',
    zone: 'jateng',
    allowInstant: false,
    baseReg: 22000,
    etaReg: '3 - 6 Hari'
  },
  {
    id: 'jatim-bali',
    label: 'Surabaya, Malang, Denpasar (Jawa Timur & Bali)',
    zone: 'jatim',
    allowInstant: false,
    baseReg: 27000,
    etaReg: '3 - 6 Hari'
  },
  {
    id: 'sumatera',
    label: 'Bandar Lampung, Palembang, Medan & Sumatera (via Merak)',
    zone: 'sumatera',
    allowInstant: false,
    baseReg: 24000,
    etaReg: '3 - 7 Hari'
  },
  {
    id: 'kalimantan-sulawesi',
    label: 'Balikpapan, Banjarmasin, Makassar & Indonesia Timur',
    zone: 'luar-jawa',
    allowInstant: false,
    baseReg: 42000,
    etaReg: '4 - 9 Hari'
  }
];

const calcShipping = ({ destinationId = 'cilegon-pusat', weightGrams = 500 }) => {
  const zone = SHIPPING_ZONES.find((z) => z.id === destinationId) || SHIPPING_ZONES[0];
  const weightKg = Math.max(1, Math.ceil(Number(weightGrams) / 1000));
  const services = [];

  /*
   * Tidak ada layanan instan/same-day. Barang dikirim dari gudang pemasok,
   * jadi kurir instan tidak bisa dijemput di sini. Lihat SHIPPING_MODEL.
   */

  services.push(
    {
      id: 'jne-reg',
      courier: 'JNE Reguler (CTC/REG)',
      badge: 'Populer',
      type: 'Reguler',
      eta: zone.etaReg,
      cost: zone.baseReg * weightKg
    },
    {
      id: 'jnt-ez',
      courier: 'J&T Express EZ',
      badge: 'Ekonomis',
      type: 'Reguler',
      eta: zone.etaReg,
      cost: (zone.baseReg + 1000) * weightKg
    },
    {
      id: 'sicepat-best',
      courier: 'SiCepat BEST / HALU',
      badge: 'Rekomendasi',
      type: 'Express',
      eta: zone.etaReg,
      cost: Math.round(zone.baseReg * 1.35) * weightKg
    }
  );

  return {
    origin: SHIPPING_ORIGIN,
    shippingModel: SHIPPING_MODEL,
    note: 'Produk dikirim dari gudang mitra pemasok. Waktu di atas sudah termasuk proses siap kirim 1-2 hari.',
    destinationId: zone.id,
    destination: zone.label,
    weightGrams: Number(weightGrams),
    weightKg,
    services
  };
};

/* ------------------------------------------------------------------ */
/* QRIS payload generator (standar EMVCo)                              */
/* ------------------------------------------------------------------ */

const tlv = (id, value) => `${id}${String(value.length).padStart(2, '0')}${value}`;

const crc16 = (input) => {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Bangun payload QRIS dinamis (EMVCo TLV + CRC16-CCITT).
 *
 * PENTING: NMID & data merchant HARUS berasal dari pengaturan toko. Sebelumnya
 * fungsi ini memakai NMID contoh yang di-hardcode, sehingga QR yang terunduh
 * tidak dikenali aplikasi pembayaran walau tampilannya normal.
 */
export const buildQrisPayload = ({
  amount,
  merchantName = 'CILEGON ENGGIH',
  nmid = '',
  city = 'CILEGON',
  postalCode = '42425'
}) => {
  const accountInfo = nmid
    ? tlv('00', 'ID.CO.QRIS.WWW') + tlv('02', String(nmid)) + tlv('03', 'UMI')
    : // Tanpa NMID, QR ini hanya contoh dan TIDAK akan bisa dibayar.
      tlv('00', 'ID.CO.QRIS.WWW') + tlv('03', 'UMI');
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', accountInfo) +
    tlv('52', '5499') +
    tlv('53', '360') +
    tlv('54', String(Math.round(Number(amount) || 0))) +
    tlv('58', 'ID') +
    tlv('59', String(merchantName).slice(0, 25).toUpperCase()) +
    tlv('60', String(city).slice(0, 15).toUpperCase()) +
    tlv('61', String(postalCode).slice(0, 10)) +
    '6304';
  return body + crc16(body);
};

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const routes = [];
const route = (method, path, handler) => routes.push({ method, path, handler });

/* ---------------- Public ---------------- */

/** Healthcheck ringan untuk uptime monitor & preflight (tidak menyentuh storage). */
route('GET', '/api/ping', async () => ok({ pong: true, at: nowIso() }));

route('GET', '/api/health', async () => {
  const settings = await readSettings();
  const warnings = [];
  if (store.mode !== 'supabase') {
    warnings.push(
      'SUPABASE_URL / kunci Supabase belum terbaca. Di serverless (Vercel) data akan hilang saat cold start. Set kedua env var lalu Redeploy.'
    );
  }
  if (SUPABASE_KEY_TYPE === 'publishable') {
    warnings.push(
      'Kunci Supabase bertipe publishable (anon). RLS aktif sehingga backend tidak bisa membaca/menulis data. Gunakan Secret key (sb_secret_...) atau service_role key.'
    );
  }
  if (store.mode === 'supabase') {
    const reachable = await store.ping();
    if (!reachable) {
      warnings.push(
        'Supabase tidak dapat dihubungi atau tabel ce_documents belum dibuat. Jalankan supabase-schema.sql di SQL Editor Supabase.'
      );
    }
  }
  return ok({
    status: 'ok',
    store: `${settings.storeName} Official API`,
    storage: store.mode,
    dataDir: store.dataDir,
    supabase: store.mode === 'supabase',
    adminProtected: true,
    env: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseKey: SUPABASE_KEY_TYPE !== 'none',
      keyType: SUPABASE_KEY_TYPE,
      adminPasswordConfigured: Boolean(process.env.ADMIN_PASSWORD),
      adminTokenSecretConfigured: Boolean(process.env.ADMIN_TOKEN_SECRET),
      telegramConfigured: Boolean(
        (settings.telegram && settings.telegram.botToken && settings.telegram.chatId) ||
          (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
      )
    },
    warnings,
    origin: SHIPPING_ORIGIN,
    timestamp: nowIso()
  });
});

route('GET', '/api/storefront', async () => {
  const [settings, products] = await Promise.all([readSettings(), readProducts()]);
  return ok({
    settings: publicSettings(settings),
    vouchers: (settings.vouchers || []).filter((v) => v.active !== false),
    products,
    origin: SHIPPING_ORIGIN,
    storage: store.mode
  });
});

/** Diagnosa mandiri untuk pemilik toko — tidak membocorkan kredensial. */
route('GET', '/api/diagnose', async () => {
  const settings = await readSettings();
  const checks = [];

  const add = (id, label, status, detail, fix = '') =>
    checks.push({ id, label, status, detail, fix });

  // 1. Env Supabase
  const urlSet = Boolean(process.env.SUPABASE_URL);
  const keySet = SUPABASE_KEY_TYPE !== 'none';
  add(
    'env-url',
    'SUPABASE_URL tersedia',
    urlSet ? 'ok' : 'fail',
    urlSet ? 'terbaca' : 'tidak terbaca di runtime',
    'Vercel → Settings → Environment Variables → tambah SUPABASE_URL (https://xxxx.supabase.co) untuk Production, lalu Redeploy.'
  );
  add(
    'env-key',
    'Kunci Supabase tersedia',
    keySet ? 'ok' : 'fail',
    keySet ? `tipe kunci: ${SUPABASE_KEY_TYPE}` : 'tidak terbaca di runtime',
    'Tambah SUPABASE_SERVICE_ROLE_KEY (JWT eyJ... atau sb_secret_...). Jangan pakai sb_publishable_/anon.'
  );
  if (SUPABASE_KEY_TYPE === 'publishable') {
    add(
      'key-type',
      'Tipe kunci memadai',
      'fail',
      'kunci publishable/anon tidak bisa menembus RLS',
      'Ganti dengan Secret key (sb_secret_...) atau service_role JWT.'
    );
  }

  // 2. Koneksi + tabel
  if (store.mode === 'supabase') {
    const reachable = await store.ping();
    add(
      'supabase-reachable',
      'Supabase dapat dihubungi & tabel ce_documents ada',
      reachable ? 'ok' : 'fail',
      reachable ? 'query berhasil' : 'gagal menghubungi / tabel belum dibuat',
      'Jalankan isi supabase-schema.sql pada SQL Editor project Supabase.'
    );

    if (reachable) {
      try {
        const products = await readProducts();
        add(
          'products',
          'Katalog produk tersedia',
          products.length > 0 ? 'ok' : 'warn',
          `${products.length} produk`,
          products.length ? '' : 'Buka /admin → Produk → Reset Katalog.'
        );
      } catch (err) {
        add('products', 'Katalog produk tersedia', 'fail', err.message, '');
      }
    }
  } else {
    add(
      'storage-mode',
      'Mode penyimpanan',
      'warn',
      'local-json (data tidak persisten di serverless)',
      'Lengkapi SUPABASE_URL + kunci Supabase.'
    );
  }

  // 3. Konfigurasi toko
  const placeholderBanks = (settings.banks || []).filter(
    (b) => b.isPlaceholder || /placehold/i.test(String(b.accountHolder))
  );
  add(
    'banks',
    'Rekening bank asli',
    placeholderBanks.length === 0 ? 'ok' : 'fail',
    placeholderBanks.length === 0
      ? `${settings.banks.length} rekening terisi`
      : `${placeholderBanks.length} dari ${settings.banks.length} rekening masih placeholder`,
    'Login /admin → Pengaturan → ganti nomor & atas nama rekening, lalu Simpan.'
  );

  const qrisOk =
    settings.qris?.mode === 'static'
      ? Boolean(settings.qris?.staticImageUrl)
      : Boolean(settings.qris?.nmid) && settings.qris?.nmid !== 'ID1020030405060';
  add(
    'qris',
    'QRIS terkonfigurasi',
    qrisOk ? 'ok' : 'warn',
    settings.qris?.mode === 'static'
      ? `mode statis → ${settings.qris?.staticImageUrl}`
      : `mode dinamis → NMID ${settings.qris?.nmid}`,
    'Pengaturan → QRIS: unggah gambar QRIS resmi (mode statis) atau isi NMID asli (mode dinamis).'
  );

  add(
    'password',
    'ADMIN_PASSWORD dari environment',
    process.env.ADMIN_PASSWORD ? 'ok' : IS_PRODUCTION ? 'fail' : 'warn',
    process.env.ADMIN_PASSWORD
      ? 'terpasang'
      : IS_PRODUCTION
        ? 'BELUM DISET — login admin dinonaktifkan'
        : 'belum diset — memakai password acak sesi dev',
    'Set ADMIN_PASSWORD kuat di hosting, lalu Redeploy. Tanpa ini login admin ditolak.'
  );
  add(
    'token-secret',
    'ADMIN_TOKEN_SECRET dari environment',
    process.env.ADMIN_TOKEN_SECRET ? 'ok' : 'warn',
    process.env.ADMIN_TOKEN_SECRET ? 'terpasang' : 'diturunkan dari password',
    'Set ADMIN_TOKEN_SECRET acak 64 karakter hex.'
  );
  add(
    'contact',
    'Kontak & alamat resmi',
    /Karang Asem/.test(settings.address) && settings.whatsapp === '6281927157103' ? 'ok' : 'warn',
    `${settings.whatsappDisplay} • ${settings.email}`,
    'Pengaturan → Identitas: pastikan alamat Karang Asem & WhatsApp 081927157103.'
  );

  // 4. Notifikasi Telegram (opsional, sangat disarankan)
  const tg = telegramConfig(settings);
  add(
    'telegram',
    'Notifikasi Telegram',
    tg.botToken && tg.chatId ? 'ok' : 'warn',
    tg.botToken && tg.chatId
      ? `terhubung (${tg.enabled ? 'aktif' : 'nonaktif'})`
      : 'belum diatur — admin tidak dapat notifikasi otomatis',
    'Dashboard → Pengaturan → Notifikasi Telegram: isi Bot Token & Chat ID, lalu klik "Tes Koneksi".'
  );

  // 5. Penyimpanan gambar produk (Supabase Storage)
  add(
    'storage-images',
    'Penyimpanan gambar produk',
    process.env.SUPABASE_URL && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY)
      ? 'ok'
      : 'warn',
    process.env.SUPABASE_URL
      ? `bucket ${process.env.SUPABASE_STORAGE_BUCKET || 'product-images'}`
      : 'belum dikonfigurasi — upload gambar hanya tersimpan lokal',
    'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, lalu buat bucket "product-images" (Public) di Supabase Storage.'
  );

  const summary = {
    ok: checks.filter((c) => c.status === 'ok').length,
    warn: checks.filter((c) => c.status === 'warn').length,
    fail: checks.filter((c) => c.status === 'fail').length
  };
  const ready = summary.fail === 0;

  return ok({
    ready,
    summary,
    storage: store.mode,
    checks,
    generatedAt: nowIso(),
    note:
      'Halaman ini hanya menampilkan status konfigurasi, tidak pernah menampilkan nilai kunci/password.'
  });
});

route('GET', '/api/settings', async () => {
  const settings = await readSettings();
  return ok({ settings: publicSettings(settings) });
});

route('GET', '/api/products', async () => {
  const products = await readProducts();
  return ok({ products });
});

route('GET', '/api/products/:slug', async ({ params }) => {
  const products = await readProducts();
  const found =
    products.find((p) => p.slug === params.slug) ||
    products.find((p) => p.id === params.slug);
  if (!found) return bad('Produk tidak ditemukan.', 404);
  return ok({ product: found });
});

route('GET', '/api/shipping/zones', async () => ok({ zones: SHIPPING_ZONES, origin: SHIPPING_ORIGIN }));

route('POST', '/api/shipping/calculate', async ({ body }) => {
  const { destinationId, weightGrams } = body || {};
  return ok(calcShipping({ destinationId, weightGrams }));
});

route('GET', '/api/payment/banks', async () => {
  const settings = await readSettings();
  return ok({
    banks: settings.banks,
    qris: settings.qris,
    payment: settings.payment
  });
});

route('POST', '/api/payment/qris', async ({ body }) => {
  const settings = await readSettings();
  const { amount = 100000, orderRef = 'CE-ORDER' } = body || {};
  const useDynamic = settings.qris.dynamicEnabled !== false && settings.qris.mode !== 'static';
  if (!useDynamic) {
    return ok({
      mode: 'static',
      imageUrl: settings.qris.staticImageUrl,
      merchantName: settings.qris.merchantName,
      nmid: settings.qris.nmid,
      amount: Number(amount),
      note: settings.qris.note
    });
  }
  const nmid = String(settings.qris.nmid || '').trim();
  const isPlaceholderNmid = !nmid || nmid === 'ID1020030405060';
  const payload = buildQrisPayload({
    amount,
    merchantName: settings.qris.merchantName || 'CILEGON ENGGIH',
    nmid: isPlaceholderNmid ? '' : nmid,
    city: settings.qris.city || 'CILEGON',
    postalCode: settings.originPostal || '42425'
  });
  // QR image dirender di sisi klien memakai library open-source `qrcode`,
  // jadi API tetap ringan & tidak butuh canvas/native module di serverless.
  return ok({
    mode: 'dynamic',
    payload,
    amount: Number(amount),
    orderRef,
    merchantName: settings.qris.merchantName,
    nmid: settings.qris.nmid,
    note: settings.qris.note,
    // Jujur ke klien: QR tanpa NMID asli tidak akan bisa dipindai-bayar.
    usable: !isPlaceholderNmid,
    warning: isPlaceholderNmid
      ? 'NMID QRIS belum diisi di Pengaturan, sehingga QR dinamis tidak bisa dipakai membayar. Isi NMID asli atau gunakan mode Statis dengan gambar QRIS resmi.'
      : null,
    fallbackImageUrl: settings.qris.staticImageUrl || null
  });
});

/* ---------------- Orders ---------------- */

/** Batas kewajaran input publik — mencegah data sampah & pesanan fiktif. */
const MAX_ITEM_QTY = 500;
const MAX_ITEMS = 30;

/**
 * Bersihkan & validasi input pembeli.
 * @returns {{errors:string[], clean:object}}
 */
const sanitizeBuyerInput = (body) => {
  const errors = [];
  const clip = (value, max) => String(value ?? '').trim().slice(0, max);

  const customerName = clip(body?.customerName, 80);
  const rawPhone = clip(body?.customerPhone, 25);
  const addressDetail = clip(body?.addressDetail, 240);
  const destination = clip(body?.destination, 80) || 'Kota Cilegon';
  const notes = clip(body?.notes, 500);
  const customerEmail = clip(body?.customerEmail, 120);

  if (customerName.length < 3) {
    errors.push('Nama penerima minimal 3 karakter.');
  }

  // Nomor Indonesia: 08xx / 628xx / +628xx, 9–15 digit setelah normalisasi.
  const phone = rawPhone.replace(/[\s().-]/g, '');
  if (!/^(?:\+?62|0)8[1-9][0-9]{6,12}$/.test(phone)) {
    errors.push('Nomor WhatsApp tidak valid. Contoh: 081234567890.');
  }

  if (customerEmail && !/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(customerEmail)) {
    errors.push('Format email tidak valid.');
  }

  if (addressDetail.length < 8) {
    errors.push('Alamat pengiriman terlalu singkat — tulis minimal 8 karakter (jalan, nomor, kelurahan).');
  }

  return {
    errors,
    clean: {
      customerName,
      customerPhone: phone,
      customerEmail,
      destination,
      addressDetail,
      notes
    }
  };
};

/** Validasi daftar item: jumlah, qty, dan bentuk data. */
const sanitizeItems = (items) => {
  const errors = [];
  if (!Array.isArray(items) || items.length === 0) {
    errors.push('Item pesanan wajib diisi.');
    return { errors, items: [] };
  }
  if (items.length > MAX_ITEMS) {
    errors.push(`Maksimal ${MAX_ITEMS} jenis produk per pesanan.`);
    return { errors, items: [] };
  }
  const clean = items.map((raw, idx) => {
    const qty = Math.round(Number(raw?.qty) || 0);
    if (!Number.isFinite(qty) || qty < 1) {
      errors.push(`Jumlah untuk item ${idx + 1} tidak valid (minimal 1).`);
    } else if (qty > MAX_ITEM_QTY) {
      errors.push(
        `Jumlah item ${idx + 1} melebihi batas ${MAX_ITEM_QTY} pcs. Untuk pesanan besar, gunakan halaman Custom/Korporat.`
      );
    }
    return { ...(raw || {}), qty: Math.max(1, qty) };
  });
  return { errors, items: clean };
};

route('POST', '/api/orders', async ({ body, headers }) => {
  const ip = clientIp(headers);

  // Anti spam: 10 pesanan / 10 menit per IP. Tanpa ini satu skrip bisa
  // membanjiri database & notifikasi Telegram.
  const limit = rateLimit(`order:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(
      `Terlalu banyak pesanan dari perangkat ini. Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit, atau hubungi kami via WhatsApp.`,
      429
    );
  }

  const buyer = sanitizeBuyerInput(body);
  const itemCheck = sanitizeItems(body?.items);
  const inputErrors = [...buyer.errors, ...itemCheck.errors];
  if (inputErrors.length) {
    return bad(inputErrors[0], 400, { details: inputErrors });
  }

  const {
    courier = 'JNE Reguler (CTC/REG)',
    courierService = '',
    shippingCost = 0,
    paymentMethod = 'Transfer Bank BCA',
    bankId = '',
    voucherCode = '',
    voucherDiscount = 0,
    paymentProofNote = '',
    isPreOrder = false,
    preOrderNote = ''
  } = body || {};
  const { customerName, customerPhone, customerEmail, destination, addressDetail, notes } =
    buyer.clean;
  const items = itemCheck.items;

  const [settings, existing, catalog] = await Promise.all([
    readSettings(),
    readOrders(),
    readProducts()
  ]);

  /**
   * Harga TIDAK dipercaya dari browser.
   * Setiap item dicocokkan ke produk (dan varian) di database, lalu harga
   * dihitung ulang di server. Ini menutup celah "ubah harga lewat DevTools".
   */
  const priceIssues = [];

  const pricedItems = items.map((raw, idx) => {
    const qty = Math.max(1, Math.round(Number(raw.qty) || 0));
    const product =
      catalog.find((p) => p.id === raw.productId) ||
      catalog.find((p) => p.slug && raw.productSlug && p.slug === raw.productSlug) ||
      catalog.find((p) => String(p.shortName || p.name || '').toLowerCase() === String(raw.name || '').toLowerCase()) ||
      null;

    if (!product) {
      /**
       * Dulu item tak dikenal tetap diterima dengan harga kiriman pembeli —
       * artinya siapa pun bisa memesan "Produk" seharga Rp 0. Sekarang ditolak.
       */
      priceIssues.push(
        `Item ${idx + 1} (${raw.name || 'tanpa nama'}) tidak ada di katalog.`
      );
      return null;
    }

    const variants = Array.isArray(product.variants) ? product.variants : [];
    const variant =
      variants.find((v) => v.id === raw.variantId) ||
      (variants.length === 1 ? variants[0] : null);

    const unitPrice = Number(variant?.price ?? product.price) || 0;
    const wholesaleApplies =
      Number(product.minWholesaleQty) > 0 && qty >= Number(product.minWholesaleQty);
    const effectivePrice = wholesaleApplies
      ? Math.min(unitPrice, Number(product.wholesalePrice) || unitPrice)
      : unitPrice;

    const sentPrice = Number(raw.price);
    if (Number.isFinite(sentPrice) && Math.abs(sentPrice - effectivePrice) > 1) {
      priceIssues.push(
        `${product.shortName || product.name}: harga kiriman Rp ${sentPrice.toLocaleString(
          'id-ID'
        )} berbeda dari harga server Rp ${effectivePrice.toLocaleString('id-ID')} — memakai harga server.`
      );
    }

    return {
      productId: product.id,
      variantId: variant?.id || raw.variantId || null,
      variantLabel: variant?.label || raw.variantLabel || '',
      name: `${product.shortName || product.name}${
        variant?.label ? ` (${variant.label})` : ''
      }`,
      qty,
      price: effectivePrice,
      // Biaya pokok & vendor dibekukan saat order dibuat (dasar laporan laba rugi).
      // Varian tanpa HPP mewarisi HPP produk (bukan dianggap 0).
      costPrice: Number(variant?.costPrice) || Number(product.costPrice) || 0,
      extraCost: Number(variant?.extraCost) || Number(product.extraCost) || 0,
      vendorId: variant?.vendorId || product.vendorId || null,
      vendorName: variant?.vendorName || product.vendorName || '',
      verified: true
    };
  });

  // Tolak pesanan yang memuat produk tidak dikenal (katalog berubah/dihapus).
  if (pricedItems.some((it) => !it)) {
    return bad(
      `Produk pada pesanan tidak ditemukan di katalog kami. Silakan muat ulang halaman lalu pilih produk kembali. (${priceIssues.join(' ')})`,
      400,
      { problems: priceIssues }
    );
  }

  const subtotal = pricedItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  // Cek stok SEBELUM order disimpan — menolak pesanan yang melebihi stok
  // (kecuali produk pre-order, yang memang diproduksi sesuai pesanan).
  const stockCheck = checkStock(
    pricedItems.map((it, i) => ({ ...it, isPreOrder: items[i]?.isPreOrder || isPreOrder })),
    catalog
  );
  if (!stockCheck.ok) {
    const detail = stockCheck.problems
      .map((p) => `${p.name}: diminta ${p.requested}, tersedia ${p.available}`)
      .join('; ');
    return bad(`Stok tidak mencukupi — ${detail}. Silakan kurangi jumlah atau hubungi kami.`, 409, {
      problems: stockCheck.problems
    });
  }

  const safeShipping = Math.max(0, Math.min(Number(shippingCost) || 0, 500000));
  const safeDiscount = Math.max(0, Math.min(Number(voucherDiscount) || 0, subtotal));
  const totalBeforeCode = Math.max(0, subtotal + safeShipping - safeDiscount);
  const uniqueCode = settings.payment.uniqueCodeEnabled === false ? 0 : makeUniqueCode(existing, totalBeforeCode);
  const totalAmount = totalBeforeCode + uniqueCode;

  const isQris = String(paymentMethod).toLowerCase().includes('qris');
  const banks = settings.banks || DEFAULT_BANKS;
  const bankMatch =
    banks.find((b) => b.id === bankId) ||
    banks.find((b) => String(paymentMethod).toLowerCase().includes(String(b.bank).toLowerCase())) ||
    (isQris ? null : banks[0]);
  const bank = isQris ? null : bankMatch;

  const orderId = nextOrderId(existing);
  const created = new Date();

  const newOrder = {
    orderId,
    invoiceNumber: nextInvoiceNumber(existing),
    uniqueCode,
    uniqueCodeValue: uniqueCode,
    resi: null,
    courier,
    courierService: courierService || courier,
    resiInputAt: null,
    customerName,
    customerPhone,
    customerEmail: customerEmail || '-',
    destination,
    addressDetail,
    fullAddress: `${addressDetail ? `${addressDetail}, ` : ''}${destination}`,
    paymentMethod,
    bankAccount: bank,
    paymentStatus: 'MENUNGGU_VERIFIKASI',
    status: 'MENUNGGU_KONFIRMASI',
    isPreOrder: Boolean(isPreOrder),
    preOrderNote: isPreOrder
      ? preOrderNote || (settings.preOrder && settings.preOrder.defaultNote) || 'Pre Order 7–15 hari kerja'
      : '',
    subtotal,
    shippingCost: safeShipping,
    voucherCode: voucherCode || null,
    voucherDiscount: safeDiscount,
    totalBeforeCode,
    totalAmount,
    notes,
    paymentProofNote,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
    items: pricedItems,
    priceAudit: priceIssues.length ? priceIssues : undefined,
    timeline: [
      {
        time: wibStamp(created),
        status: `Pesanan dibuat • Menunggu verifikasi ${
          isQris ? 'QRIS' : paymentMethod
        } ${uniqueCode ? `(kode unik ${uniqueCode})` : ''}`.trim(),
        location: 'Sistem Cilegon Enggih'
      }
    ],
    instructions: {
      amount: totalAmount,
      uniqueCode,
      bank: isQris ? null : bank,
      qris: isQris ? settings.qris : null,
      windowHours: settings.payment.paymentWindowHours,
      note: settings.payment.instructions
    }
  };

  await store.put('orders', newOrder);

  // Reservasi stok: kurangi sekarang supaya pembeli lain tidak memesan
  // barang yang sama. Dikembalikan otomatis bila order dibatalkan.
  try {
    const movement = await applyStockMovement(store, newOrder.items, { direction: 1 });
    if (movement.changed) {
      newOrder.stockAppliedAt = new Date().toISOString();
      await store.put('orders', newOrder);
    }
  } catch (err) {
    console.error('[stock] gagal mengurangi stok:', err.message);
  }

  // Notifikasi Telegram ke admin (tidak pernah menggagalkan pembuatan order).
  if (telegramConfig(settings).notifyNewOrder !== false) {
    await notifySafe(settings, templateNewOrder(newOrder));
  }

  return ok(
    {
      order: decorateOrder(newOrder),
      whatsappConfirmUrl: `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(
        `Halo Admin Cilegon Enggih, saya sudah transfer untuk pesanan ${orderId} sebesar Rp ${totalAmount.toLocaleString(
          'id-ID'
        )}. Mohon diverifikasi ya.`
      )}`
    },
    201
  );
});

/** Klien mengirim bukti transfer (catatan / URL / base64 kecil) untuk disimpan. */
route('POST', '/api/orders/:orderId/proof', async ({ params, body }) => {
  const order = await store.get('orders', params.orderId);
  if (!order) return bad('Pesanan tidak ditemukan.', 404);
  const { paymentProofNote = '', paymentProofImage = '', paymentProofUrl = '' } = body || {};
  if (!paymentProofNote && !paymentProofImage && !paymentProofUrl) {
    return bad('Isi catatan bukti transfer atau unggah gambar bukti.');
  }

  // Kalau klien mengirim data URL, pindahkan ke Storage (bukan disimpan di database).
  let proofUrl = String(paymentProofUrl || '').slice(0, 500);
  let proofStorage = 'url';
  if (String(paymentProofImage).startsWith('data:image/')) {
    try {
      const bucket = process.env.SUPABASE_PROOF_BUCKET || 'payment-proofs';
      const saved = await saveImage({
        dataUrl: paymentProofImage,
        filename: `${params.orderId}-bukti`,
        bucket,
        maxBytes: MAX_PROOF_BYTES
      });
      proofUrl = saved.url;
      proofStorage = saved.storage;
    } catch (err) {
      // Storage belum siap → simpan base64 sebagai upaya terakhir agar bukti tidak hilang.
      console.error('[proof] gagal ke storage, simpan base64:', err.message);
      proofStorage = 'inline-fallback';
    }
  }

  const updated = {
    ...order,
    paymentProofNote,
    paymentProofUrl: proofUrl || undefined,
    paymentProofStorage: proofStorage,
    paymentProofImage:
      proofStorage === 'inline-fallback'
        ? String(paymentProofImage).slice(0, 700_000)
        : '',
    paymentProofAt: nowIso(),
    updatedAt: nowIso(),
    timeline: [
      ...(order.timeline || []),
      {
        time: wibStamp(),
        status: 'Bukti transfer diunggah pembeli — menunggu verifikasi admin',
        location: 'Portal Pelanggan Cilegon Enggih'
      }
    ]
  };
  await store.put('orders', updated);

  const proofSettings = await readSettings();
  if (telegramConfig(proofSettings).notifyPaymentProof !== false) {
    await notifySafe(proofSettings, templatePaymentProof(updated));
  }

  return ok({ order: decorateOrder(updated) });
});

/**
 * Lacak pesanan.
 * Keamanan: WAJIB kode (nomor order / resi / invoice) + 4 digit terakhir WhatsApp
 * pemesan. Tanpa itu, siapa pun bisa melihat pesanan orang lain.
 * Data yang dikembalikan juga dipangkas (tanpa email & alamat lengkap).
 */
const maskPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 6) return '****';
  return `${digits.slice(0, 4)}****${digits.slice(-2)}`;
};

const publicTrackingView = (order) => ({
  orderId: order.orderId,
  invoiceNumber: order.invoiceNumber,
  status: order.status,
  paymentStatus: order.paymentStatus,
  courier: order.courier,
  courierService: order.courierService,
  resi: order.resi || null,
  resiInputAt: order.resiInputAt || null,
  resiStatus: order.resi ? 'TERSEDIA' : 'MENUNGGU_INPUT_RESI',
  trackingLinks: trackLinksFor(order.courier, order.resi),
  customerName: order.customerName,
  customerPhoneMasked: maskPhone(order.customerPhone),
  destination: order.destination,
  // Alamat hanya ditampilkan sebagian.
  addressPreview: order.addressDetail
    ? `${String(order.addressDetail).slice(0, 28)}${String(order.addressDetail).length > 28 ? '…' : ''}`
    : '',
  items: (order.items || []).map((it) => ({
    name: it.name,
    qty: it.qty,
    price: it.price
  })),
  subtotal: order.subtotal,
  shippingCost: order.shippingCost,
  voucherDiscount: order.voucherDiscount,
  uniqueCode: order.uniqueCode,
  totalAmount: order.totalAmount,
  paymentMethod: order.paymentMethod,
  bankAccount: order.paymentStatus === 'LUNAS' ? undefined : order.bankAccount,
  isPreOrder: Boolean(order.isPreOrder),
  preOrderNote: order.preOrderNote,
  createdAt: order.createdAt,
  timeline: (order.timeline || []).map((t) => ({
    time: t.time,
    status: t.status,
    location: t.location
  }))
});

route('GET', '/api/orders/track', async ({ query, headers }) => {
  const code = String(query.q || query.query || query.orderId || '').trim();
  const phone = String(query.phone || query.wa || '').replace(/\D/g, '');

  if (!code) {
    return bad('Masukkan nomor pesanan / resi / nomor invoice Anda.', 400);
  }
  if (phone.length < 4) {
    return bad('Masukkan 4 digit terakhir nomor WhatsApp yang dipakai saat memesan.', 400);
  }

  // Batasi percobaan agar tidak bisa dipakai menebak data orang lain.
  const ip = clientIp(headers);
  const limit = rateLimit(`track:${ip}`, { max: 20, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return bad('Terlalu banyak percobaan pelacakan. Coba lagi beberapa menit lagi.', 429);
  }

  const orders = await readOrders();
  const q = code.toUpperCase().replace(/\s|-/g, '');
  const tail = phone.slice(-4);

  const found = orders.find((o) => {
    const orderId = String(o.orderId || '').toUpperCase().replace(/-/g, '');
    const resi = String(o.resi || '').toUpperCase().replace(/\s/g, '');
    const invoice = String(o.invoiceNumber || '').toUpperCase().replace(/\s/g, '');
    const matchCode = orderId === q || (resi && resi === q) || invoice === q;
    if (!matchCode) return false;
    const ownerPhone = String(o.customerPhone || '').replace(/\D/g, '');
    return ownerPhone.endsWith(tail);
  });

  if (!found) {
    await recordAudit(store, {
      action: 'public.track-gagal',
      actor: 'publik',
      ip,
      status: 'not-found',
      detail: { kode: q.slice(0, 24) }
    });
    return bad(
      'Data pesanan tidak ditemukan. Periksa nomor pesanan/resi dan 4 digit terakhir nomor WhatsApp Anda.',
      404
    );
  }

  return ok({ order: publicTrackingView(found) });
});

route('POST', '/api/b2b', async ({ body, headers }) => {
  const ip = clientIp(headers);
  const limit = rateLimit(`b2b:${ip}`, { max: 5, windowMs: 30 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(
      `Terlalu banyak pengajuan dari perangkat ini. Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit.`,
      429
    );
  }

  const payload = body || {};
  if (!payload.companyName || !payload.picName || !payload.phone) {
    return bad('Nama Instansi/Perusahaan, Nama PIC, dan Nomor WhatsApp wajib diisi.');
  }
  const quoteId = `QUO-B2B-${randomDigits(4)}`;
  const entry = {
    quoteId,
    id: quoteId,
    companyName: payload.companyName,
    picName: payload.picName,
    phone: payload.phone,
    email: payload.email || '-',
    productInterest: payload.productInterest || '-',
    quantity: Number(payload.quantity) || 0,
    budgetPerUnit: Number(payload.budgetPerUnit) || 0,
    deadline: payload.deadline || '-',
    needsCustomLogo: Boolean(payload.needsCustomLogo),
    notes: payload.notes || '',
    createdAt: nowIso(),
    status: 'Menunggu Konfirmasi Tim Korporat (SLA < 1 Jam Kerja)'
  };
  await store.put('b2b', entry);

  const b2bSettings = await readSettings();
  if (telegramConfig(b2bSettings).notifyB2B !== false) {
    await notifySafe(b2bSettings, templateB2B(entry));
  }

  return ok({ inquiry: entry }, 201);
});

/* ---------------- Admin auth ---------------- */

/**
 * Terbitkan sesi: cookie HttpOnly + catat ke daftar sesi.
 * Token di body hanya disertakan sebagai mode kompatibilitas (lihat
 * `tokenDelivery` di respons) supaya script/CLI lama tetap bisa memakai
 * header Authorization.
 */
const issueSession = async ({ headers, username = 'admin' }) => {
  const secret = sessionSecret(ADMIN_PASSWORD);
  const { token, expiresAt } = createSessionToken({ secret, username });
  const claims = verifySessionToken(token, { secret }) || {};
  await registerSession(store, {
    sid: claims.sid,
    username,
    ip: clientIp(headers),
    userAgent: headers?.['user-agent'] || headers?.['User-Agent']
  });
  return {
    cookie: sessionCookie(token, { headers }),
    session: {
      sid: claims.sid ? `${String(claims.sid).slice(0, 6)}…` : null,
      expiresAt
    }
  };
};

route('POST', '/api/admin/login', async ({ body, headers }) => {
  const ip = clientIp(headers);
  const { username = 'admin', password = '' } = body || {};

  // Anti brute force: 5 percobaan / 15 menit per IP.
  const limit = rateLimit(`login:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) {
    await recordAudit(store, {
      action: 'login.diblokir',
      actor: 'percobaan-luar',
      ip,
      status: 'blocked',
      detail: { retryAfterSeconds: limit.retryAfterSeconds }
    });
    return bad(
      `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit.`,
      429
    );
  }

  const passwordOk = ADMIN_LOGIN_ENABLED && String(password) === ADMIN_PASSWORD;
  const usernameOk = String(username).toLowerCase() === 'admin';

  if (!ADMIN_LOGIN_ENABLED) {
    return bad(
      'Login admin dinonaktifkan: ADMIN_PASSWORD belum diset di server ini. ' +
        'Set environment variable ADMIN_PASSWORD lalu redeploy.',
      503
    );
  }

  if (!passwordOk || !usernameOk) {
    await recordAudit(store, {
      action: 'login.gagal',
      actor: String(username || 'admin'),
      ip,
      status: 'failed',
      detail: { sisaPercobaan: limit.remaining ?? 0 }
    });
    return bad('Password admin salah. Cek kembali password yang diberikan pemilik toko.', 401);
  }

  const settings = await readSettings();

  // 2FA: kalau diaktifkan & Telegram siap, minta kode 6 digit dulu.
  if (otpEnabled(settings)) {
    const { challengeId, code, expiresInSeconds } = createOtpChallenge();
    const sent = await sendTelegramMessage(
      settings,
      [
        '🔐 <b>KODE LOGIN DASHBOARD</b>',
        '',
        `<b style="font-size:22px">${code}</b>`,
        '',
        `Berlaku ${Math.round(expiresInSeconds / 60)} menit.`,
        `IP: <code>${ip}</code>`,
        '',
        '<i>Jika bukan Anda yang login, segera ganti password admin.</i>'
      ].join('\n')
    );

    await recordAudit(store, {
      action: 'login.otp-diminta',
      actor: 'admin',
      ip,
      status: sent.sent ? 'ok' : 'warning',
      detail: { terkirim: sent.sent, alasan: sent.reason }
    });

    if (!sent.sent) {
      // Jangan kunci admin keluar kalau Telegram bermasalah.
      const issued = await issueSession({ headers, username });
      return ok(
        {
          otpRequired: false,
          username: 'admin',
          expiresInHours: SESSION_TTL_MS / 3_600_000,
          storage: store.mode,
          cookieAuth: true,
          ...issued.session,
          warning:
            'Kode 2FA gagal dikirim ke Telegram sehingga verifikasi dilewati. Periksa Bot Token/Chat ID di Pengaturan.'
        },
        200,
        { 'Set-Cookie': issued.cookie }
      );
    }

    return ok({
      otpRequired: true,
      challengeId,
      expiresInSeconds,
      username: 'admin'
    });
  }

  resetRateLimit(`login:${ip}`);
  await recordAudit(store, { action: 'login.sukses', actor: 'admin', ip, status: 'ok' });

  const issued = await issueSession({ headers, username });
  return ok(
    {
      // Sesi dikirim lewat cookie HttpOnly; body hanya metadata.
      username: 'admin',
      expiresInHours: SESSION_TTL_MS / 3_600_000,
      storage: store.mode,
      otpRequired: false,
      cookieAuth: true,
      ...issued.session
    },
    200,
    { 'Set-Cookie': issued.cookie }
  );
});

/** Langkah 2 login: tukar kode OTP dengan token admin. */
route('POST', '/api/admin/verify-otp', async ({ body, headers }) => {
  const ip = clientIp(headers);
  const limit = rateLimit(`otp:${ip}`, { max: 8, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(
      `Terlalu banyak percobaan kode. Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit.`,
      429
    );
  }

  const { challengeId, code } = body || {};
  const result = verifyOtpChallenge(challengeId, code);

  if (!result.ok) {
    await recordAudit(store, {
      action: 'login.otp-gagal',
      actor: 'admin',
      ip,
      status: 'failed',
      detail: { alasan: result.reason }
    });
    return bad(result.reason || 'Kode verifikasi tidak valid.', 401);
  }

  resetRateLimit(`login:${ip}`);
  await recordAudit(store, { action: 'login.sukses-2fa', actor: 'admin', ip, status: 'ok' });

  const issued = await issueSession({ headers, username: 'admin' });
  return ok(
    {
      username: 'admin',
      expiresInHours: SESSION_TTL_MS / 3_600_000,
      storage: store.mode,
      cookieAuth: true,
      ...issued.session
    },
    200,
    { 'Set-Cookie': issued.cookie }
  );
});

/**
 * Logout: cabut sesi di server (token tidak bisa dipakai ulang walau cookie
 * sempat dicuri) lalu hapus cookie di browser.
 */
route('POST', '/api/admin/logout', async ({ headers }) => {
  const session = readAdminSession(headers);
  if (session?.sid) await revokeSession(store, session.sid);
  await recordAudit(store, {
    action: 'login.logout',
    actor: 'admin',
    ip: clientIp(headers),
    status: 'ok'
  });
  return ok({ loggedOut: true }, 200, { 'Set-Cookie': clearSessionCookie(headers) });
});

/** Siapa saya? Dipakai dashboard untuk memulihkan sesi setelah reload. */
route('GET', '/api/admin/me', async ({ headers }) => {
  const session = readAdminSession(headers);
  if (!session) return bad('Belum login.', 401);
  if (session.sid && (await isSessionRevoked(store, session.sid))) {
    return bad('Sesi sudah berakhir. Silakan login lagi.', 401);
  }
  return ok({
    username: 'admin',
    via: session.via,
    expiresAt: session.exp,
    storage: store.mode
  });
});

/** Daftar sesi aktif + cabut semua perangkat lain. */
route('GET', '/api/admin/sessions', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const session = readAdminSession(headers);
  const current = session?.sid ? `${String(session.sid).slice(0, 6)}…` : null;
  const list = await activeSessions();
  return ok({
    sessions: list.map((s) => ({ ...s, current: s.sid === current })),
    currentSid: current
  });
});

route('DELETE', '/api/admin/sessions', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const ip = clientIp(headers);
  const result = await revokeAllSessions(store, { ip });
  await recordAudit(store, {
    action: 'security.sesi-dicabut',
    actor: 'admin',
    ip,
    status: 'ok',
    detail: { jumlah: result.revoked }
  });
  return ok(
    {
      revoked: result.revoked,
      message:
        'Semua sesi admin dikeluarkan. Anda perlu login ulang di perangkat ini dan perangkat lain.'
    },
    200,
    { 'Set-Cookie': clearSessionCookie(headers) }
  );
});

/** Nyalakan/matikan 2FA (hanya bisa kalau Telegram sudah terhubung). */
route('POST', '/api/admin/2fa', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const current = await readSettings();
  if (!current.telegram?.botToken || !current.telegram?.chatId) {
    return bad(
      'Hubungkan Bot Telegram lebih dulu (Pengaturan → Notifikasi Telegram) sebelum mengaktifkan 2FA.',
      400
    );
  }
  const enable = Boolean(body?.enabled);
  const next = {
    ...current,
    telegram: { ...current.telegram, otpEnabled: enable },
    updatedAt: nowIso()
  };
  await store.put('settings', { ...next, id: 'store-settings' });
  await recordAudit(store, {
    action: enable ? 'security.2fa-aktif' : 'security.2fa-nonaktif',
    actor: 'admin',
    ip: clientIp(headers),
    status: 'ok'
  });
  return ok({ enabled: enable });
});

route('GET', '/api/admin/session', async ({ headers }) => {
  const session = verifyAdminToken(bearer(headers));
  if (!session) return bad('Sesi admin tidak valid atau sudah kedaluwarsa.', 401);
  return ok({ valid: true, username: session.u, storage: store.mode });
});

/* ---------------- Admin: analytics ---------------- */

/* ------------------------------------------------------------------ */
/* Analitik trafik (event ringan, tanpa data pribadi)                   */
/* ------------------------------------------------------------------ */

/**
 * POST /api/events — penerimaan event dari frontend.
 *
 * Sengaja dibuat sangat toleran: kegagalan mencatat event TIDAK boleh
 * mengganggu pengalaman pembeli. Endpoint selalu membalas 204 walau
 * payload ditolak, dan dibatasi rate limit agar tidak bisa dibanjiri.
 */
route('POST', '/api/events', async ({ body, headers }) => {
  const ip = clientIp(headers);
  const limit = rateLimit(`events:${ip}`, { max: 120, windowMs: 10 * 60 * 1000 });
  if (!limit.allowed) return { status: 204, body: undefined };

  try {
    if (body !== null && typeof body !== 'object') return { status: 204, body: undefined };
    const list = Array.isArray(body?.events) ? body.events.slice(0, 20) : [body];
    // Lokasi kasar pengunjung (nama kota saja) — bukan IP, bukan koordinat.
    const geo = geoHintFromHeaders(headers);
    const accepted = list
      .map((raw) => normalizeEvent(geo ? { ...raw, geoZone: geo.zone } : raw, { ip, headers }))
      .filter(Boolean)
      // pembeli tidak perlu menunggu penulisan selesai
      .map((ev) => store.put('analytics_events', ev).catch(() => null));
    await Promise.all(accepted);
  } catch (err) {
    console.error('[analytics] gagal mencatat event:', err.message);
  }
  return { status: 204, body: undefined };
});

/** GET /api/admin/insights?days=30 — laporan trafik & konversi. */
route('GET', '/api/admin/insights', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const rawDays = Number(query.days) || 30;
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;

  const [events, orders, products] = await Promise.all([
    store.list('analytics_events'),
    readOrders(),
    readProducts()
  ]);

  // Retensi: event lama dibuang agar data tidak menumpuk selamanya.
  const fresh = pruneOldEvents(events || [], 180);

  return ok(buildInsights({ events: fresh, orders, products, days }));
});

/** GET /api/admin/insights/export?days=30 — CSV untuk diolah di Excel. */
route('GET', '/api/admin/insights/export', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const days = [7, 30, 90].includes(Number(query.days)) ? Number(query.days) : 30;
  const [events, orders, products] = await Promise.all([
    store.list('analytics_events'),
    readOrders(),
    readProducts()
  ]);
  const report = buildInsights({ events: pruneOldEvents(events || [], 180), orders, products, days });

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [];
  lines.push('Laporan;Cilegon Enggih');
  lines.push(`Periode;${report.period.from} s/d ${report.period.to} (${report.period.days} hari)`);
  lines.push('');
  lines.push('TRAFIK HARIAN');
  lines.push('Tanggal;Kunjungan;Pengunjung Unik;Pesanan;Pendapatan;Konversi %');
  report.traffic.daily.forEach((d) =>
    lines.push([d.day, d.views, d.visitors, d.orders, d.revenue, d.conversion].map(esc).join(';'))
  );
  lines.push('');
  lines.push('PRODUK');
  lines.push('Produk;Dilihat;Masuk Keranjang;Terjual;Pendapatan;Konversi %;Catatan');
  report.products.forEach((p) =>
    lines.push([p.name, p.views, p.carts, p.sold, p.revenue, p.conversion ?? '', p.verdict].map(esc).join(';'))
  );
  lines.push('');
  lines.push('PROYEKSI STOK');
  lines.push('Produk;Stok;Terjual;Rata-rata/hari;Perkiraan Habis (hari)');
  report.stockForecast.forEach((p) =>
    lines.push([p.name, p.stock, p.sold, p.perDay, p.daysLeft ?? ''].map(esc).join(';'))
  );
  lines.push('');
  lines.push('LOKASI');
  lines.push('Zona;Pesanan;Pendapatan;Porsi %');
  report.byZone.forEach((z) => lines.push([z.label, z.orders, z.revenue, z.share].map(esc).join(';')));
  lines.push('');
  lines.push('SUMBER TRAFIK');
  lines.push('Sumber;Pengunjung;Kunjungan');
  report.bySource.forEach((s) =>
    lines.push([s.label || s.source, s.visitors, s.views].map(esc).join(';'))
  );
  lines.push('');
  lines.push('PERANGKAT');
  lines.push('Perangkat;Pengunjung;Porsi %');
  report.byDevice.forEach((d) => lines.push([d.label, d.visitors, d.share].map(esc).join(';')));
  lines.push('');
  lines.push('HALAMAN TERATAS');
  lines.push('Halaman;Path;Kunjungan;Pengunjung');
  report.topPaths.forEach((p) => lines.push([p.label, p.path, p.views, p.visitors].map(esc).join(';')));
  lines.push('');
  lines.push('VARIAN PRODUK');
  lines.push('Produk;Varian;Dilihat;Masuk Keranjang;Terjual;Omzet');
  report.variants.forEach((v) =>
    lines.push(
      [v.productName || v.productId || '', v.label, v.views, v.carts, v.sold, v.revenue]
        .map(esc)
        .join(';')
    )
  );
  lines.push('');
  lines.push('LOKASI PENGUNJUNG (perkiraan kota, tanpa IP)');
  lines.push('Zona;Pengunjung;Porsi %');
  (report.byVisitorZone || []).forEach((z) =>
    lines.push([z.label, z.visitors, z.share].map(esc).join(';'))
  );
  lines.push('');
  lines.push('JAM TERSIBUK (hari x jam, WIB)');
  lines.push('Hari;Jam;Kunjungan');
  (report.heatmap?.peakSlots || []).forEach((p) =>
    lines.push([p.day, `${String(p.hour).padStart(2, '0')}:00`, p.views].map(esc).join(';'))
  );
  lines.push('');
  lines.push('PEMBANDING PERIODE SEBELUMNYA');
  lines.push('Ukuran;Periode Ini;Periode Lalu;Perubahan %');
  const cmp = report.comparison || {};
  lines.push(
    ['Pengunjung', report.traffic.totalVisitors, cmp.prevVisitors ?? 0, cmp.visitors ?? '']
      .map(esc)
      .join(';')
  );
  lines.push(['Kunjungan', report.traffic.totalViews, cmp.prevViews ?? 0, cmp.views ?? ''].map(esc).join(';'));
  lines.push(['Pesanan', report.traffic.totalOrders, cmp.prevOrders ?? 0, cmp.orders ?? ''].map(esc).join(';'));

  return ok(
    { csv: lines.join('\n') },
    200,
    {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="insight-cilegon-enggih-${storeDay()}.csv"`
    }
  );
});

route('GET', '/api/admin/analytics', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const [orders, products, b2b] = await Promise.all([readOrders(), readProducts(), readB2B()]);

  const paidOrders = orders.filter((o) => o.paymentStatus === 'LUNAS');
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const potentialRevenue = orders
    .filter((o) => o.paymentStatus !== 'DIBATALKAN')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const byStatus = ORDER_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  const productSales = new Map();
  orders.forEach((o) => {
    (o.items || []).forEach((it) => {
      const key = it.name;
      const prev = productSales.get(key) || { name: key, qty: 0, revenue: 0 };
      prev.qty += Number(it.qty) || 0;
      prev.revenue += Number(it.price) * Number(it.qty) || 0;
      productSales.set(key, prev);
    });
  });

  const lowStock = products
    .filter((p) => Number(p.stock) <= 20)
    .map((p) => ({ id: p.id, name: p.shortName, stock: p.stock }));

  return ok({
    totalRevenue: revenue,
    potentialRevenue,
    totalOrders: orders.length,
    paidOrders: paidOrders.length,
    awaitingVerification: orders.filter((o) => o.paymentStatus === 'MENUNGGU_VERIFIKASI').length,
    awaitingResi: orders.filter((o) => !o.resi && o.status !== 'DIBATALKAN' && o.status !== 'SELESAI')
      .length,
    b2bOpen: b2b.filter((b) => !/deal|selesai|done|batal/i.test(String(b.status))).length,
    byStatus,
    topProducts: [...productSales.values()].sort((a, b) => b.qty - a.qty).slice(0, 5),
    lowStock,
    storage: store.mode
  });
});

/* ---------------- Admin: orders ---------------- */

route('GET', '/api/admin/orders', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  let orders = await readOrders();
  const status = String(query.status || '').trim();
  const keyword = String(query.q || '').trim().toLowerCase();
  if (status) orders = orders.filter((o) => o.status === status);
  if (keyword) {
    orders = orders.filter((o) =>
      [o.orderId, o.resi, o.customerName, o.customerPhone, o.invoiceNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(keyword))
    );
  }
  return ok({ orders: orders.map(decorateOrder) });
});

route('PATCH', '/api/admin/orders/:orderId', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const order = await store.get('orders', params.orderId);
  if (!order) return bad('Pesanan tidak ditemukan.', 404);

  const payload = body || {};
  const next = { ...order };
  const timeline = [...(order.timeline || [])];
  const pushTimeline = (status, location = 'Dashboard Admin Cilegon Enggih') => {
    timeline.push({ time: wibStamp(), status, location });
  };

  if (payload.paymentStatus && PAYMENT_STATUSES.includes(payload.paymentStatus)) {
    next.paymentStatus = payload.paymentStatus;
    pushTimeline(
      payload.paymentStatus === 'LUNAS'
        ? `Pembayaran diverifikasi LUNAS oleh Admin${
            payload.verifiedAmount ? ` (Rp ${Number(payload.verifiedAmount).toLocaleString('id-ID')})` : ''
          }`
        : `Status pembayaran diubah menjadi ${payload.paymentStatus}`
    );
  }

  if (payload.status && ORDER_STATUSES.includes(payload.status)) {
    next.status = payload.status;
    pushTimeline(`Status pesanan diperbarui: ${payload.status}`);
  }

  if (typeof payload.resi === 'string') {
    const resi = payload.resi.trim();
    if (resi) {
      next.resi = resi;
      next.resiInputAt = nowIso();
      pushTimeline(`Resi ${payload.courier || order.courier} ${resi} diinput oleh Admin`);
    } else {
      next.resi = null;
      next.resiInputAt = null;
      pushTimeline('Nomor resi dikosongkan (menunggu input ulang)');
    }
  }

  if (payload.courier) {
    next.courier = payload.courier;
    next.courierService = payload.courierService || payload.courier;
  }

  if (payload.addressDetail !== undefined) next.addressDetail = payload.addressDetail;
  if (payload.notes !== undefined) next.notes = payload.notes;
  if (payload.adminNote) pushTimeline(`Catatan admin: ${payload.adminNote}`, 'Catatan Internal');
  if (payload.timelineNote) pushTimeline(payload.timelineNote);

  // Pesanan dibatalkan → kembalikan stok yang sudah direservasi.
  const becameCancelled =
    next.status === 'DIBATALKAN' && order.status !== 'DIBATALKAN';
  if (becameCancelled && order.stockAppliedAt && !order.stockReleasedAt) {
    try {
      const movement = await applyStockMovement(store, order.items, { direction: -1 });
      if (movement.changed) {
        next.stockReleasedAt = nowIso();
        pushTimeline(`Stok dikembalikan otomatis (${movement.changed} produk)`);
      }
    } catch (err) {
      console.error('[stock] gagal mengembalikan stok:', err.message);
    }
  }

  // Pesanan dibatalkan lalu diaktifkan lagi → potong stok kembali.
  if (order.status === 'DIBATALKAN' && next.status !== 'DIBATALKAN' && order.stockReleasedAt) {
    try {
      const movement = await applyStockMovement(store, order.items, { direction: 1 });
      if (movement.changed) {
        next.stockReleasedAt = null;
        next.stockAppliedAt = nowIso();
        pushTimeline('Stok dipotong kembali karena pesanan diaktifkan lagi');
      }
    } catch (err) {
      console.error('[stock] gagal memotong ulang stok:', err.message);
    }
  }

  next.timeline = timeline;
  next.updatedAt = nowIso();
  await store.put('orders', next);

  await recordAudit(store, {
    action: 'order.diubah',
    actor: 'admin',
    ip: clientIp(headers),
    target: order.orderId,
    detail: {
      pembayaran: { dari: order.paymentStatus, ke: next.paymentStatus },
      status: { dari: order.status, ke: next.status },
      resi: next.resi || null,
      jumlahTerverifikasi: payload.verifiedAmount ?? null
    }
  });

  // Notifikasi Telegram ke admin (kalau admin mengaktifkannya).
  const notifySettings = await readSettings();
  const notifyCfg = telegramConfig(notifySettings);
  if (payload.paymentStatus === 'LUNAS' && notifyCfg.notifyPaid !== false) {
    await notifySafe(notifySettings, templatePaid(next));
  }
  if (payload.status === 'DIKIRIM' && notifyCfg.notifyShipped !== false) {
    await notifySafe(notifySettings, templateShipped(next));
  }

  return ok({ order: decorateOrder(next) });
});

/**
 * Hapus satu pesanan. Stok dikembalikan bila belum pernah dikembalikan.
 * Dipakai untuk membersihkan data uji/demo, atau permintaan penghapusan data
 * pembeli (hak privasi).
 */
route('DELETE', '/api/admin/orders/:orderId', async ({ headers, params }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const order = await store.get('orders', params.orderId);
  if (!order) return bad('Pesanan tidak ditemukan.', 404);

  let stockRestored = false;
  if (order.stockAppliedAt && !order.stockReleasedAt) {
    try {
      const movement = await applyStockMovement(store, order.items, { direction: -1 });
      stockRestored = movement.changed > 0;
    } catch (err) {
      console.error('[stock] gagal mengembalikan stok saat hapus order:', err.message);
    }
  }

  await store.remove('orders', order.orderId);

  await recordAudit(store, {
    action: 'order.dihapus',
    actor: 'admin',
    ip: clientIp(headers),
    target: order.orderId,
    status: 'ok',
    detail: {
      pelanggan: order.customerName,
      total: order.totalAmount,
      stokDikembalikan: stockRestored
    }
  });

  return ok({
    deleted: order.orderId,
    stockRestored,
    message: `Pesanan ${order.orderId} dihapus${stockRestored ? ' dan stok dikembalikan' : ''}.`
  });
});

/**
 * Bersihkan SEMUA pesanan uji/demo sekaligus.
 * `confirm` wajib berisi teks "HAPUS SEMUA" agar tidak terpicu tidak sengaja.
 */
route('POST', '/api/admin/orders/reset', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  if (String(body?.confirm || '').trim().toUpperCase() !== 'HAPUS SEMUA') {
    return bad('Konfirmasi tidak cocok. Kirim confirm: "HAPUS SEMUA" untuk melanjutkan.');
  }

  const orders = await readOrders();
  // Kembalikan stok untuk pesanan yang belum dibatalkan.
  let restored = 0;
  for (const order of orders) {
    if (!order.stockAppliedAt || order.stockReleasedAt) continue;
    if (order.status === 'DIBATALKAN') continue;
    try {
      const movement = await applyStockMovement(store, order.items, { direction: -1 });
      if (movement.changed) restored += 1;
    } catch (err) {
      console.error('[stock] gagal mengembalikan stok saat reset:', err.message);
    }
  }

  await store.replaceAll('orders', []);
  await store.replaceAll('b2b', []);

  await recordAudit(store, {
    action: 'data.demo-dibersihkan',
    actor: 'admin',
    ip: clientIp(headers),
    status: 'ok',
    detail: { jumlahOrder: orders.length, stokDikembalikan: restored }
  });

  return ok({
    deletedOrders: orders.length,
    stockRestored: restored,
    message: `${orders.length} pesanan dihapus. ${
      restored ? `Stok ${restored} produk dikembalikan. ` : ''
    }Data B2B juga dikosongkan.`
  });
});

/* ---------------- Admin: products CRUD ---------------- */

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 70);

route('GET', '/api/admin/products', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  return ok({ products: await readProducts() });
});

/**
 * Normalisasi + validasi payload produk dari dashboard admin.
 * Dipakai oleh POST (buat baru) dan PUT (perbarui) supaya aturannya identik.
 */
const CATEGORY_LABELS = {
  'apparel-tas': 'Apparel & Tas',
  drinkware: 'Drinkware',
  'aksesoris-dekorasi': 'Aksesoris & Dekorasi',
  'perlengkapan-cetak': 'Perlengkapan & Cetak',
  'paket-bundling': 'Paket Bundling / Hampers'
};

const cleanVariants = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v, idx) => {
      const label = String((v && v.label) || '').trim();
      if (!label) return null;
      const price = Math.max(0, Number(v.price) || 0);
      const originalPrice = Math.max(Number(v.originalPrice) || 0, price);
      return {
        id: String((v && v.id) || '').trim() || `var-${Date.now().toString(36)}-${idx}`,
        label,
        price,
        originalPrice: originalPrice || price,
        stock: Math.max(0, Math.round(Number(v.stock) || 0)),
        // HPP per varian (opsional; fallback ke HPP produk).
        costPrice: Math.max(0, Number(v.costPrice) || 0),
        extraCost: Math.max(0, Number(v.extraCost) || 0),
        vendorId: v.vendorId || null,
        vendorName: String(v.vendorName || '').trim(),
        /*
         * Foto khusus varian. Tanpa ini, unggahan admin akan hilang setiap
         * produk disimpan ulang — karena fungsi ini hanya menyalin field yang
         * disebutkan secara eksplisit.
         */
        image: cleanStringList([v.image])[0] || '',
        images: cleanStringList(v.images).slice(0, 4)
      };
    })
    .filter(Boolean);
};

/**
 * Bersihkan daftar video produk.
 *
 * Aturan:
 *  - maks 3 video per produk (batas kuota + halaman tidak jadi berat)
 *  - source 'embed' hanya untuk domain yang dikenal; selain itu ditolak,
 *    supaya tidak ada iframe sembarang yang bisa menyisipkan skrip.
 *  - source 'file' hanya menerima URL http(s) hasil unggahan kita.
 */
const ALLOWED_EMBED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'instagram.com',
  'www.instagram.com',
  'tiktok.com',
  'www.tiktok.com',
  'vt.tiktok.com'
];

const cleanVideos = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((v, idx) => {
      const url = String((v && v.url) || '').trim();
      if (!url) return null;

      /*
       * URL relatif (/uploads/...) berasal dari penyimpanan lokal saat dev.
       * `new URL()` melempar untuk path relatif, jadi ditangani lebih dulu —
       * tanpa ini video hasil unggahan lokal hilang saat produk disimpan.
       */
      const isRelative = url.startsWith('/') && !url.startsWith('//');
      let host = '';
      if (!isRelative) {
        let parsed;
        try {
          parsed = new URL(url);
        } catch {
          return null;
        }
        if (!/^https?:$/.test(parsed.protocol)) return null;
        host = parsed.hostname.toLowerCase();
      }

      const requested = v && v.source === 'embed' ? 'embed' : 'file';
      // Path relatif tidak mungkin 'embed' — itu aset kita sendiri.
      if (isRelative && requested === 'embed') return null;

      // embed hanya untuk penyedia yang dikenal; kalau tidak, simpan sebagai file
      // (hanya berguna bila memang URL aset kita sendiri).
      const source = requested === 'embed' && ALLOWED_EMBED_HOSTS.includes(host) ? 'embed' : 'file';

      return {
        id: String((v && v.id) || '').trim() || `vid-${idx}-${Date.now().toString(36)}`,
        url,
        source,
        poster: String((v && v.poster) || '').trim(),
        title: String((v && v.title) || '').trim().slice(0, 120),
        startAt: Math.max(0, Math.round(Number(v && v.startAt) || 0))
      };
    })
    .filter(Boolean)
    .slice(0, 3);
};

const cleanSpecs = (raw) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((sp) => ({
      label: String((sp && sp.label) || '').trim(),
      value: String((sp && sp.value) || '').trim()
    }))
    .filter((sp) => sp.label && sp.value);
};

const cleanStringList = (raw) =>
  Array.isArray(raw)
    ? raw.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

const uniqueSlug = async (desired, selfId) => {
  const base = slugify(desired) || `produk-${Date.now().toString(36)}`;
  const products = await readProducts();
  const taken = new Set(
    products
      .filter((p) => String(p.id) !== String(selfId || ''))
      .map((p) => String(p.slug || '').toLowerCase())
  );
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
};

/**
 * @returns {{ errors: string[], product: any }}
 */
const normalizeProduct = async (payload, existing) => {
  const errors = [];
  const src = payload || {};
  const base = existing || {};

  const name = String(src.name ?? base.name ?? '').trim();
  const price = Number(src.price ?? base.price ?? 0);
  const originalPriceRaw = Number(src.originalPrice ?? base.originalPrice ?? price);
  const stockRaw = Number(src.stock ?? base.stock ?? 0);
  const weightGrams = Number(src.weightGrams ?? base.weightGrams ?? 300);
  const minWholesaleQty = Number(src.minWholesaleQty ?? base.minWholesaleQty ?? 0);
  const wholesalePrice = Number(src.wholesalePrice ?? base.wholesalePrice ?? price);

  if (!name) errors.push('Nama produk wajib diisi.');
  if (!Number.isFinite(price) || price <= 0) errors.push('Harga jual harus lebih besar dari 0.');
  if (!Number.isFinite(originalPriceRaw) || originalPriceRaw < 0) {
    errors.push('Harga sebelum diskon tidak boleh negatif.');
  }
  if (originalPriceRaw < price) {
    errors.push('Harga sebelum diskon tidak boleh lebih kecil dari harga jual.');
  }
  if (!Number.isFinite(stockRaw) || stockRaw < 0) errors.push('Stok tidak boleh negatif.');
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) errors.push('Berat produk harus lebih dari 0 gram.');
  if (minWholesaleQty < 0) errors.push('Minimum qty grosir tidak boleh negatif.');
  if (wholesalePrice < 0) errors.push('Harga grosir tidak boleh negatif.');
  const costPrice = Math.max(0, Number(src.costPrice ?? base.costPrice ?? 0));
  const extraCost = Math.max(0, Number(src.extraCost ?? base.extraCost ?? 0));
  const totalCost = costPrice + extraCost;

  // Cegah menjual di bawah modal (kerugian nyata yang sering tidak disadari).
  if (totalCost > 0 && price > 0 && price < totalCost) {
    errors.push(
      `Harga jual (Rp ${price.toLocaleString('id-ID')}) lebih rendah dari HPP (Rp ${totalCost.toLocaleString(
        'id-ID'
      )}). Perbaiki harga atau HPP sebelum menyimpan.`
    );
  }

  if (wholesalePrice > price && minWholesaleQty > 0) {
    errors.push('Harga grosir seharusnya lebih murah daripada harga jual satuan.');
  }

  const variants = cleanVariants(src.variants ?? base.variants);
  const variantLabels = new Set();
  variants.forEach((v) => {
    const key = v.label.toLowerCase();
    if (variantLabels.has(key)) errors.push(`Label varian "${v.label}" dipakai lebih dari sekali.`);
    variantLabels.add(key);
    if (v.price <= 0) errors.push(`Harga varian "${v.label}" harus lebih besar dari 0.`);
    if (v.originalPrice < v.price) {
      errors.push(`Harga sebelum diskon varian "${v.label}" tidak boleh lebih kecil dari harga varian.`);
    }
    if (v.costPrice + v.extraCost > 0 && v.price < v.costPrice + v.extraCost) {
      errors.push(
        `Varian "${v.label}": harga jual lebih rendah dari HPP (Rp ${(
          v.costPrice + v.extraCost
        ).toLocaleString('id-ID')}).`
      );
    }
  });

  const categorySlug =
    src.categorySlug ?? base.categorySlug ?? 'aksesoris-dekorasi';
  const categoryLabel =
    src.categoryLabel || CATEGORY_LABELS[categorySlug] || base.categoryLabel || 'Aksesoris & Dekorasi';

  const galleryImages = cleanStringList(src.galleryImages ?? base.galleryImages).slice(0, 9);
  const image = String(src.image ?? base.image ?? '/products/gantungan-kunci-3d.jpg').trim();
  const videos = cleanVideos(src.videos ?? base.videos);

  if (errors.length) return { errors, product: null };

  const finalPrice = Math.round(price);
  const finalOriginal = Math.round(originalPriceRaw || price);
  // Stok total: default = jumlah stok varian; bisa dioverride manual lewat stockManual.
  const stockManual = Boolean(src.stockManual ?? base.stockManual);
  const variantStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const stock = Math.max(
    0,
    Math.round(stockManual || variants.length === 0 ? stockRaw : variantStock)
  );

  const slug = await uniqueSlug(src.slug || base.slug || src.shortName || name, existing?.id);

  return {
    errors: [],
    product: {
      ...base,
      slug,
      name,
      shortName: String(src.shortName ?? base.shortName ?? name).trim() || name,
      englishSubtitle:
        String(src.englishSubtitle ?? base.englishSubtitle ?? '').trim() ||
        'Official Cilegon Enggih Merchandise',
      categorySlug,
      categoryLabel,
      image,
      galleryImages: galleryImages.length ? galleryImages : image ? [image] : [],
      videos,
      price: finalPrice,
      priceRangeText: variants.length
        ? `Rp ${Math.min(...variants.map((v) => v.price)).toLocaleString('id-ID')} – Rp ${Math.max(
            ...variants.map((v) => v.price)
          ).toLocaleString('id-ID')}`
        : `Rp ${finalPrice.toLocaleString('id-ID')}`,
      originalPrice: finalOriginal,
      discountPercent:
        finalOriginal > finalPrice
          ? Math.round(((finalOriginal - finalPrice) / finalOriginal) * 100)
          : 0,
      rating: Number(src.rating ?? base.rating ?? 4.9) || 4.9,
      reviewCount: Number(src.reviewCount ?? base.reviewCount ?? 0) || 0,
      soldCount: Number(src.soldCount ?? base.soldCount ?? 0) || 0,
      weightGrams: Math.round(weightGrams),
      stock,
      stockManual,
      isBestSeller: Boolean(src.isBestSeller ?? base.isBestSeller),
      isFlashDeal: Boolean(src.isFlashDeal ?? base.isFlashDeal),
      isBundle: Boolean(src.isBundle ?? base.isBundle),
      isPreOrder: Boolean(src.isPreOrder ?? base.isPreOrder),
      preOrderNote: Boolean(src.isPreOrder ?? base.isPreOrder)
        ? String(src.preOrderNote ?? base.preOrderNote ?? '').trim() ||
          (DEFAULT_SETTINGS.preOrder && DEFAULT_SETTINGS.preOrder.defaultNote) ||
          'Pre Order 7–15 hari kerja'
        : '',
      bundleItems: cleanStringList(src.bundleItems ?? base.bundleItems),
      hasSizeChart: Boolean(src.hasSizeChart ?? base.hasSizeChart),
      badges: cleanStringList(src.badges ?? base.badges),
      description: String(src.description ?? base.description ?? '').trim(),
      specs: cleanSpecs(src.specs ?? base.specs),
      variants,
      costPrice: Math.round(costPrice),
      extraCost: Math.round(extraCost),
      vendorId: src.vendorId ?? base.vendorId ?? null,
      vendorName: String(src.vendorName ?? base.vendorName ?? '').trim(),
      sku: String(src.sku ?? base.sku ?? '').trim(),
      minWholesaleQty: Math.round(minWholesaleQty),
      wholesalePrice: Math.round(wholesalePrice || finalPrice),
      reviews: Array.isArray(src.reviews ?? base.reviews) ? (src.reviews ?? base.reviews) : [],
      active: (src.active ?? base.active) !== false
    }
  };
};

route('POST', '/api/admin/products', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const { errors, product } = await normalizeProduct(body || {}, null);
  if (errors.length) return bad(errors[0], 400, { errors });
  const created = {
    ...product,
    id: `prod-${Date.now().toString(36)}`,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await store.put('products', created);
  await recordAudit(store, {
    action: 'produk.dibuat',
    actor: 'admin',
    ip: clientIp(headers),
    target: created.id,
    detail: { nama: created.name, harga: created.price, hpp: created.costPrice ?? null }
  });
  return ok({ product: created, products: await readProducts() }, 201);
});

route('PUT', '/api/admin/products/:id', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('products', params.id);
  if (!existing) return bad('Produk tidak ditemukan.', 404);

  const { errors, product } = await normalizeProduct(body || {}, existing);
  if (errors.length) return bad(errors[0], 400, { errors });

  const updated = { ...product, id: existing.id, updatedAt: nowIso() };
  await store.put('products', updated);
  await recordAudit(store, {
    action: 'produk.diubah',
    actor: 'admin',
    ip: clientIp(headers),
    target: existing.id,
    detail: {
      nama: updated.name,
      harga: { dari: existing.price, ke: updated.price },
      hpp: { dari: existing.costPrice ?? null, ke: updated.costPrice ?? null },
      stok: { dari: existing.stock, ke: updated.stock }
    }
  });
  return ok({ product: updated, products: await readProducts() });
});

/** Duplikat produk (mempercepat pembuatan varian produk serupa). */
route('POST', '/api/admin/products/:id/duplicate', async ({ headers, params }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('products', params.id);
  if (!existing) return bad('Produk tidak ditemukan.', 404);
  const products = await readProducts();
  const copyName = `${existing.name} (Salinan)`;
  const copy = {
    ...existing,
    id: `prod-${Date.now().toString(36)}`,
    name: copyName,
    shortName: `${existing.shortName || existing.name} (Salinan)`,
    slug: await uniqueSlug(`${existing.slug}-salinan`, null),
    variants: (existing.variants || []).map((v, idx) => ({
      ...v,
      id: `var-${Date.now().toString(36)}-${idx}`
    })),
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await store.put('products', copy);
  await recordAudit(store, {
    action: 'produk.diduplikat',
    actor: 'admin',
    ip: clientIp(headers),
    target: copy.id,
    detail: { dari: existing.id, nama: copy.name }
  });
  return ok({ product: copy, products: await readProducts() }, 201);
});

route('DELETE', '/api/admin/products/:id', async ({ headers, params }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('products', params.id);
  if (!existing) return bad('Produk tidak ditemukan.', 404);
  await store.remove('products', params.id);
  return ok({ deleted: params.id, products: await readProducts() });
});

route('POST', '/api/admin/products/reset', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const seedProducts = SEED_PRODUCTS.map((p) => ({ ...p, active: true }));
  await store.replaceAll('products', seedProducts);
  return ok({ products: await readProducts(), restored: seedProducts.length });
});

/* ---------------- Admin: settings, banks, QRIS, vouchers ---------------- */

/**
 * Bandingkan settings lama vs baru, kembalikan daftar field sensitif yang berubah.
 * Dipakai untuk audit + notifikasi Telegram: penggantian rekening atau gambar QRIS
 * adalah jalur paling berbahaya (uang pembeli bisa dialihkan), jadi harus berjejak.
 * Nilai rahasia tidak pernah ikut dicatat — hanya nama field-nya.
 */
const SENSITIVE_SETTINGS_FIELDS = [
  ['qris', 'staticImageUrl', 'Gambar QRIS'],
  ['qris', 'nmid', 'NMID QRIS'],
  ['qris', 'merchantName', 'Nama merchant QRIS'],
  ['qris', 'mode', 'Mode QRIS'],
  ['telegram', 'chatId', 'Chat ID Telegram'],
  ['telegram', 'botToken', 'Bot Token Telegram'],
  ['telegram', 'otpEnabled', 'Verifikasi 2 langkah'],
  ['payment', 'codEnabled', 'Opsi COD']
];

const diffSensitiveSettings = (before, after) => {
  const changed = [];
  for (const [group, field, label] of SENSITIVE_SETTINGS_FIELDS) {
    const a = before?.[group]?.[field];
    const b = after?.[group]?.[field];
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) {
      changed.push({ group, field, label });
    }
  }
  // Rekening bank: bandingkan daftar nomor rekening saja (bukan nama pemilik).
  const bankSig = (s) =>
    JSON.stringify((Array.isArray(s?.banks) ? s.banks : []).map((b) => `${b.bankId || ''}:${b.accountNumber || ''}`));
  if (bankSig(before) !== bankSig(after)) {
    changed.push({ group: 'banks', field: 'accountNumber', label: 'Nomor rekening bank' });
  }
  return changed;
};

route('PUT', '/api/admin/settings', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const ip = clientIp(headers);
  const current = await readSettings();
  const payload = body || {};
  const merged = {
    ...current,
    ...payload,
    qris: { ...current.qris, ...(payload.qris || {}) },
    payment: { ...current.payment, ...(payload.payment || {}) },
    invoice: { ...current.invoice, ...(payload.invoice || {}) },
    telegram: { ...current.telegram, ...(payload.telegram || {}) },
    preOrder: { ...current.preOrder, ...(payload.preOrder || {}) },
    banks: normalizeBanks(Array.isArray(payload.banks) ? payload.banks : current.banks),
    vouchers: Array.isArray(payload.vouchers) ? payload.vouchers : current.vouchers,
    updatedAt: nowIso()
  };
  await store.put('settings', { ...merged, id: 'store-settings' });

  const changed = diffSensitiveSettings(current, merged);
  if (changed.length) {
    await recordAudit(store, {
      action: 'settings.sensitif-diubah',
      actor: 'admin',
      ip,
      status: 'ok',
      target: changed.map((c) => c.label).join(', ').slice(0, 200),
      detail: { fields: changed.map((c) => `${c.group}.${c.field}`) }
    });

    // Kabari pemilik toko lewat Telegram — kalau ini bukan Anda, langsung ketahuan.
    await notifySafe(
      merged,
      [
        '<b>⚠️ Pengaturan pembayaran diubah</b>',
        `Yang berubah: ${changed.map((c) => c.label).join(', ')}`,
        `Waktu: ${wibStamp()}`,
        `IP: ${ip || '-'}`,
        '',
        'Jika ini bukan Anda, segera ganti password admin dan matikan sesi.'
      ].join('\n')
    );
  }

  return ok({ settings: publicSettings(merged), sensitiveChanges: changed.map((c) => c.label) });
});

/** Settings lengkap untuk dashboard (termasuk kredensial Telegram). */
route('GET', '/api/admin/settings', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const settings = await readSettings();
  return ok({ settings });
});

/** Uji koneksi bot Telegram. */
route('POST', '/api/admin/telegram/test', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const current = await readSettings();
  const payload = body || {};
  const candidate = {
    ...current,
    telegram: {
      ...current.telegram,
      ...(payload.telegram || {}),
      enabled: true
    }
  };
  const cfg = telegramConfig(candidate);
  if (!cfg.botToken || !cfg.chatId) {
    return bad('Bot Token dan Chat ID wajib diisi sebelum mengetes koneksi.');
  }
  const result = await sendTelegramMessage(candidate, templateTest());
  if (!result.sent) {
    return bad(
      `Telegram menolak pesan. Periksa Bot Token & Chat ID. Detail: ${
        result.reason || 'tidak diketahui'
      }`,
      400
    );
  }
  // Simpan kalau berhasil supaya admin tidak perlu menyimpan manual.
  await store.put('settings', { ...candidate, id: 'store-settings', updatedAt: nowIso() });
  return ok({ sent: true, message: 'Pesan uji terkirim ke Telegram.' });
});

/**
 * Upload gambar (produk & bukti transfer) ke Supabase Storage atau folder lokal.
 * Body: { dataUrl, filename?, kind?: 'product' | 'proof' }
 */
const UPLOAD_KINDS = {
  product: {
    bucket: () => process.env.SUPABASE_STORAGE_BUCKET || 'product-images',
    maxBytes: MAX_UPLOAD_BYTES,
    prefix: 'produk'
  },
  qris: {
    // Aset toko (gambar QRIS): memang publik, tapi dipisah dari foto produk
    // supaya mudah diaudit dan tidak tercampur dengan unggahan rutin.
    bucket: () => process.env.SUPABASE_ASSET_BUCKET || 'store-assets',
    maxBytes: MAX_UPLOAD_BYTES,
    prefix: 'qris'
  },
  proof: {
    bucket: () => process.env.SUPABASE_PROOF_BUCKET || 'payment-proofs',
    maxBytes: MAX_PROOF_BYTES,
    prefix: 'bukti'
  },
  /*
   * Video produk. Bucket sengaja dipisah dari foto karena isinya jauh lebih
   * besar — memudahkan audit kuota dan menghapus video lama tanpa menyentuh
   * foto produk.
   */
  video: {
    bucket: () => process.env.SUPABASE_VIDEO_BUCKET || 'product-video',
    maxBytes: MAX_VIDEO_BYTES,
    prefix: 'video'
  }
};

route('POST', '/api/admin/upload', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const ip = clientIp(headers);

  const kind = Object.prototype.hasOwnProperty.call(UPLOAD_KINDS, body?.kind)
    ? body.kind
    : 'product';
  const conf = UPLOAD_KINDS[kind];

  // Batasi spam upload (kuota storage gratis) — 30 per jam per IP.
  const limit = rateLimit(`upload:${ip}`, { max: 30, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(
      `Terlalu banyak unggahan (30 per jam). Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit.`,
      429
    );
  }

  const bucket = conf.bucket();
  try {
    // Video punya jalur simpan sendiri: magic bytes MP4/WebM, batas 5 MB,
    // tanpa kompresi browser.
    const saved =
      kind === 'video'
        ? await saveVideo({
            dataUrl: body?.dataUrl,
            filename: body?.filename || conf.prefix,
            bucket
          })
        : await saveImage({
            dataUrl: body?.dataUrl,
            filename: body?.filename || `${conf.prefix}`,
            bucket,
            maxBytes: conf.maxBytes
          });

    // Jejak audit: siapa mengganti gambar apa & kapan.
    await recordAudit(store, {
      action: `upload.${kind}`,
      actor: 'admin',
      ip,
      status: 'ok',
      target: body?.filename ? String(body.filename).slice(0, 120) : conf.prefix,
      detail: { storage: saved.storage, bytes: saved.bytes, filename: saved.filename }
    });

    return ok({ ...saved, bucket, kind });
  } catch (err) {
    return bad(err.message, 400);
  }
});

route('POST', '/api/admin/settings/reset', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  await store.replaceAll('settings', [{ ...DEFAULT_SETTINGS, id: 'store-settings' }]);
  return ok({ settings: publicSettings(DEFAULT_SETTINGS) });
});

/* ---------------- Admin: keuangan ---------------- */

const readVendors = async () => {
  const docs = await store.list('vendors');
  return [...docs].sort((a, b) => String(a.name).localeCompare(String(b.name)));
};

const readExpenses = async () => {
  const docs = await store.list('expenses');
  return [...docs].sort((a, b) => String(b.date).localeCompare(String(a.date)));
};

const normalizeVendor = (payload, existing) => {
  const errors = [];
  const base = existing || {};
  const name = String(payload?.name ?? base.name ?? '').trim();
  if (!name) errors.push('Nama vendor wajib diisi.');
  return {
    errors,
    vendor: {
      ...base,
      id: base.id || payload?.id || `vendor-${Date.now().toString(36)}`,
      code: String(payload?.code ?? base.code ?? '').trim(),
      name,
      contactName: String(payload?.contactName ?? base.contactName ?? '').trim(),
      phone: String(payload?.phone ?? base.phone ?? '').trim(),
      email: String(payload?.email ?? base.email ?? '').trim(),
      address: String(payload?.address ?? base.address ?? '').trim(),
      category: String(payload?.category ?? base.category ?? 'Produksi').trim(),
      paymentTerm: Number(payload?.paymentTerm ?? base.paymentTerm ?? 0) || 0,
      bankAccount: String(payload?.bankAccount ?? base.bankAccount ?? '').trim(),
      debt: Math.max(0, Number(payload?.debt ?? base.debt ?? 0) || 0),
      dueDate: String(payload?.dueDate ?? base.dueDate ?? '').trim(),
      notes: String(payload?.notes ?? base.notes ?? '').trim(),
      active: (payload?.active ?? base.active) !== false,

      /* --- Data khusus dropship (dipakai /api/admin/dropship) --- */
      shopUrl: String(payload?.shopUrl ?? base.shopUrl ?? '').trim(),
      platform: String(payload?.platform ?? base.platform ?? 'Shopee').trim(),
      rating: Math.max(0, Math.min(5, Number(payload?.rating ?? base.rating ?? 0) || 0)),
      ratingCount: Math.max(0, Number(payload?.ratingCount ?? base.ratingCount ?? 0) || 0),
      leadTimeDays: Math.max(0, Number(payload?.leadTimeDays ?? base.leadTimeDays ?? 0) || 0),
      acceptsDropship: (payload?.acceptsDropship ?? base.acceptsDropship) === true,
      neutralPackaging: (payload?.neutralPackaging ?? base.neutralPackaging) === true,
      noInvoice: (payload?.noInvoice ?? base.noInvoice) === true,
      supportsCustomLogo: (payload?.supportsCustomLogo ?? base.supportsCustomLogo) === true,
      hasRealPhotos: (payload?.hasRealPhotos ?? base.hasRealPhotos) === true,
      responsiveChat: (payload?.responsiveChat ?? base.responsiveChat) === true,
      createdAt: base.createdAt || nowIso(),
      updatedAt: nowIso()
    }
  };
};

route('GET', '/api/admin/finance/meta', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const [vendors, products] = await Promise.all([readVendors(), readProducts()]);
  return ok({
    expenseCategories: EXPENSE_CATEGORIES,
    vendors,
    products: products.map((p) => ({
      id: p.id,
      name: p.shortName || p.name,
      sku: p.sku || '',
      costPrice: p.costPrice || 0,
      extraCost: p.extraCost || 0,
      vendorId: p.vendorId || null,
      vendorName: p.vendorName || '',
      price: p.price,
      variants: (p.variants || []).map((v) => ({
        id: v.id,
        label: v.label,
        price: v.price,
        costPrice: v.costPrice || 0,
        extraCost: v.extraCost || 0,
        vendorId: v.vendorId || null
      }))
    }))
  });
});

/* --- Vendor CRUD --- */

route('GET', '/api/admin/vendors', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  return ok({ vendors: await readVendors() });
});

route('POST', '/api/admin/vendors', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const { errors, vendor } = normalizeVendor(body || {}, null);
  if (errors.length) return bad(errors[0], 400, { errors });
  await store.put('vendors', vendor);
  await recordAudit(store, {
    action: 'vendor.dibuat',
    actor: 'admin',
    ip: clientIp(headers),
    target: vendor.id,
    detail: { nama: vendor.name }
  });
  return ok({ vendor, vendors: await readVendors() }, 201);
});

route('PUT', '/api/admin/vendors/:id', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('vendors', params.id);
  if (!existing) return bad('Vendor tidak ditemukan.', 404);
  const { errors, vendor } = normalizeVendor(body || {}, existing);
  if (errors.length) return bad(errors[0], 400, { errors });
  await store.put('vendors', vendor);
  await recordAudit(store, {
    action: 'vendor.diubah',
    actor: 'admin',
    ip: clientIp(headers),
    target: vendor.id,
    detail: { nama: vendor.name }
  });
  return ok({ vendor, vendors: await readVendors() });
});

route('DELETE', '/api/admin/vendors/:id', async ({ headers, params }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('vendors', params.id);
  if (!existing) return bad('Vendor tidak ditemukan.', 404);
  await store.remove('vendors', params.id);
  await recordAudit(store, {
    action: 'vendor.dihapus',
    actor: 'admin',
    ip: clientIp(headers),
    target: params.id,
    detail: { nama: existing.name }
  });
  return ok({ deleted: params.id, vendors: await readVendors() });
});

/* --- Pengeluaran (biaya) --- */

const normalizeExpense = (payload, existing) => {
  const errors = [];
  const base = existing || {};
  const amount = Number(payload?.amount ?? base.amount ?? 0);
  const date = String(payload?.date ?? base.date ?? '').trim() || new Date().toISOString().slice(0, 10);
  if (!(amount > 0)) errors.push('Nominal pengeluaran harus lebih besar dari 0.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push('Tanggal pengeluaran tidak valid (format YYYY-MM-DD).');
  const category = String(payload?.category ?? base.category ?? 'lain-lain');
  if (!EXPENSE_CATEGORY_LABEL[category]) errors.push('Kategori pengeluaran tidak dikenal.');
  return {
    errors,
    expense: {
      ...base,
      id: base.id || `expense-${Date.now().toString(36)}`,
      date,
      category,
      description: String(payload?.description ?? base.description ?? '').trim(),
      amount: Math.round(amount),
      account: String(payload?.account ?? base.account ?? 'Kas Toko').trim(),
      vendorId: payload?.vendorId ?? base.vendorId ?? null,
      notes: String(payload?.notes ?? base.notes ?? '').trim(),
      createdAt: base.createdAt || nowIso(),
      updatedAt: nowIso()
    }
  };
};

route('GET', '/api/admin/expenses', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  let docs = await readExpenses();
  const from = String(query.from || '');
  const to = String(query.to || '');
  if (from) docs = docs.filter((d) => d.date >= from);
  if (to) docs = docs.filter((d) => d.date <= to);
  return ok({ expenses: docs, categories: EXPENSE_CATEGORIES });
});

route('POST', '/api/admin/expenses', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const { errors, expense } = normalizeExpense(body || {}, null);
  if (errors.length) return bad(errors[0], 400, { errors });
  await store.put('expenses', expense);
  await recordAudit(store, {
    action: 'pengeluaran.dibuat',
    actor: 'admin',
    ip: clientIp(headers),
    target: expense.id,
    detail: { kategori: expense.category, nominal: expense.amount }
  });
  return ok({ expense, expenses: await readExpenses() }, 201);
});

route('PUT', '/api/admin/expenses/:id', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('expenses', params.id);
  if (!existing) return bad('Pengeluaran tidak ditemukan.', 404);
  const { errors, expense } = normalizeExpense(body || {}, existing);
  if (errors.length) return bad(errors[0], 400, { errors });
  await store.put('expenses', expense);
  return ok({ expense, expenses: await readExpenses() });
});

route('DELETE', '/api/admin/expenses/:id', async ({ headers, params }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  await store.remove('expenses', params.id);
  await recordAudit(store, {
    action: 'pengeluaran.dihapus',
    actor: 'admin',
    ip: clientIp(headers),
    target: params.id
  });
  return ok({ deleted: params.id, expenses: await readExpenses() });
});

/* --- Laporan --- */

route('GET', '/api/admin/finance/profit-loss', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const [orders, expenses, products] = await Promise.all([
    readOrders(),
    readExpenses(),
    readProducts()
  ]);
  return ok(
    buildProfitLoss(
      { orders, expenses, products },
      { from: String(query.from || ''), to: String(query.to || '') }
    )
  );
});

route('GET', '/api/admin/finance/margin', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const products = await readProducts();
  return ok({ products: await readProducts(), rows: buildMarginReport(products) });
});

route('GET', '/api/admin/finance/sales', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const orders = await readOrders();
  return ok(
    buildSalesReport(orders, { from: String(query.from || ''), to: String(query.to || '') })
  );
});

route('GET', '/api/admin/finance/cash', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const [orders, expenses] = await Promise.all([readOrders(), readExpenses()]);
  return ok(
    buildCashReport(orders, expenses, { from: String(query.from || ''), to: String(query.to || '') })
  );
});

route('GET', '/api/admin/finance/receivables', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const [orders, vendors] = await Promise.all([readOrders(), readVendors()]);
  return ok({
    receivables: buildReceivables(orders),
    payables: buildPayables(vendors),
    totalReceivable: buildReceivables(orders).reduce((sum, r) => sum + num(r.totalAmount), 0)
  });
});

/* ---------------- Admin: B2B ---------------- */

route('GET', '/api/admin/b2b', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  return ok({ inquiries: await readB2B() });
});

route('PATCH', '/api/admin/b2b/:quoteId', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('b2b', params.quoteId);
  if (!existing) return bad('Inquiry B2B tidak ditemukan.', 404);
  const updated = {
    ...existing,
    ...(body || {}),
    quoteId: existing.quoteId,
    id: existing.quoteId,
    updatedAt: nowIso()
  };
  await store.put('b2b', updated);
  return ok({ inquiry: updated, inquiries: await readB2B() });
});

route('POST', '/api/admin/seed-demo', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existingOrders = await readOrders();
  if (existingOrders.length === 0) {
    await store.replaceAll('orders', SEED_ORDERS);
  }
  const existingB2B = await readB2B();
  if (existingB2B.length === 0) {
    await store.replaceAll('b2b', SEED_B2B);
  }
  return ok({ orders: (await readOrders()).length, inquiries: (await readB2B()).length });
});

/** Ekspor data untuk backup — TANPA kredensial & dengan nomor HP dimasking. */
route('GET', '/api/admin/export', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const ip = clientIp(headers);
  const limit = rateLimit(`export:${ip}`, { max: 3, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(
      `Ekspor dibatasi 3 kali per jam. Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit.`,
      429
    );
  }

  const [orders, products, b2b, settings] = await Promise.all([
    readOrders(),
    readProducts(),
    readB2B(),
    readSettings()
  ]);

  const { botToken, chatId, ...safeTelegram } = settings.telegram || {};

  await recordAudit(store, {
    action: 'data.ekspor',
    actor: 'admin',
    ip,
    status: 'ok',
    detail: { orders: orders.length, products: products.length, b2b: b2b.length }
  });

  return ok({
    exportedAt: nowIso(),
    note: 'Ekspor ini menyembunyikan kredensial (Telegram) dan menutup sebagian nomor HP pembeli.',
    orders: orders.map((o) => ({
      ...o,
      customerPhone: maskPhone(o.customerPhone)
    })),
    products,
    b2b: b2b.map((b) => ({ ...b, phone: maskPhone(b.phone) })),
    settings: {
      ...settings,
      telegram: {
        ...safeTelegram,
        connected: Boolean(botToken && chatId)
      }
    }
  });
});

/* ---------------- Backup & pemulihan ---------------- */

/** Status backup untuk dashboard (dipakai tab Keamanan). */
route('GET', '/api/admin/backups', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  try {
    const [items, status] = await Promise.all([listBackups(), backupStatus()]);
    return ok({
      total: items.length,
      items: items.slice(0, 40),
      schedule: 'Harian otomatis pukul 18:00 WIB (Vercel Cron)',
      retention: status.retention,
      configured: status.storageConfigured && status.bucketReachable,
      // Diagnostik: menunjukkan nama bucket yang dicari server, sehingga
      // salah kapitalisasi / salah nama langsung kelihatan di dashboard.
      bucket: status.bucket,
      bucketReachable: status.bucketReachable,
      cronSecretConfigured: status.cronSecretConfigured,
      diagnostic: status.error
    });
  } catch (err) {
    return bad(`Gagal membaca daftar backup: ${err.message}`, 502);
  }
});

/** Jalankan backup manual dari dashboard. */
route('POST', '/api/admin/backups', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const ip = clientIp(headers);
  // Batasi supaya tidak dipakai menjejali storage.
  const limit = rateLimit(`backup:${ip}`, { max: 6, windowMs: 60 * 60 * 1000 });
  if (!limit.allowed) {
    return bad(
      `Backup manual dibatasi 6 kali per jam. Coba lagi dalam ${Math.ceil(
        limit.retryAfterSeconds / 60
      )} menit.`,
      429
    );
  }
  try {
    const result = await runBackup(store);
    await recordAudit(store, {
      action: 'backup.dibuat',
      actor: 'admin',
      ip,
      status: 'ok',
      target: result.filename,
      detail: { bytes: result.bytes, compressed: result.compressedBytes, counts: result.counts }
    });
    return ok({
      ...result,
      message: 'Backup tersimpan di Supabase Storage (bucket backups).'
    });
  } catch (err) {
    await recordAudit(store, {
      action: 'backup.gagal',
      actor: 'admin',
      ip,
      status: 'failed',
      detail: { alasan: String(err.message).slice(0, 200) }
    });
    return bad(err.message, 502);
  }
});

/** Pulihkan dari berkas backup. `mode=replace` menimpa total. */
route('POST', '/api/admin/backups/restore', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const ip = clientIp(headers);
  const filename = String(body?.filename || '');
  const mode = body?.mode === 'replace' ? 'replace' : 'merge';
  if (!filename) return bad('Nama berkas backup wajib diisi.');

  try {
    const snapshot = await readBackup(filename);
    const report = await restoreBackup(store, snapshot, { mode });
    await recordAudit(store, {
      action: 'backup.dipulihkan',
      actor: 'admin',
      ip,
      status: 'ok',
      target: filename,
      detail: { mode, report }
    });
    return ok({
      restored: report,
      mode,
      message:
        mode === 'replace'
          ? 'Data diganti sepenuhnya dari backup. Muat ulang dashboard.'
          : 'Data digabungkan dari backup (per ID). Muat ulang dashboard.'
    });
  } catch (err) {
    return bad(err.message, 400);
  }
});

/**
 * Endpoint cron untuk backup harian.
 * Vercel Cron memanggil ini dengan header `Authorization: Bearer $CRON_SECRET`.
 * Sengaja TIDAK memakai sesi admin — cron tidak punya cookie.
 */
route('GET', '/api/cron/backup', async ({ headers }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return bad(
      'CRON_SECRET belum diisi di environment. Tambahkan lalu redeploy agar backup harian aktif.',
      503
    );
  }
  const provided = bearer(headers);
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(secret));
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return bad('Tidak diizinkan.', 401);

  try {
    const result = await runBackup(store);
    await recordAudit(store, {
      action: 'backup.otomatis',
      actor: 'cron',
      ip: clientIp(headers),
      status: 'ok',
      target: result.filename,
      detail: { bytes: result.bytes, counts: result.counts }
    });
    return ok({ ok: true, ...result });
  } catch (err) {
    console.error('[cron] backup gagal:', err.message);
    return bad(`Backup otomatis gagal: ${err.message}`, 500);
  }
});

/**
 * Endpoint cron untuk digest harian ke Telegram.
 *
 * Dipanggil Vercel Cron tiap pagi. Sama seperti backup: memakai CRON_SECRET,
 * bukan sesi admin, karena cron tidak punya cookie.
 * Bisa juga dipicu manual dari dashboard (POST /api/admin/digest).
 */
route('GET', '/api/cron/digest', async ({ headers }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return bad(
      'CRON_SECRET belum diisi di environment. Tambahkan lalu redeploy agar digest harian aktif.',
      503
    );
  }
  const provided = bearer(headers);
  const a = Buffer.from(String(provided));
  const b = Buffer.from(String(secret));
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return bad('Tidak diizinkan.', 401);

  const settings = await readSettings();
  const result = await sendDailyDigest({
    store,
    settings,
    readOrders,
    readProducts
  });

  await recordAudit(store, {
    action: 'digest.harian',
    actor: 'cron',
    ip: clientIp(headers),
    status: result.sent ? 'ok' : 'failed',
    detail: { reason: result.reason || null }
  });

  if (!result.sent) {
    return bad(`Digest tidak terkirim: ${result.reason}`, 502);
  }
  return ok({ ok: true, sent: true });
});

/** POST /api/admin/digest — kirim digest sekarang (untuk uji coba & preview). */
route('POST', '/api/admin/digest', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const settings = await readSettings();
  const result = await sendDailyDigest({ store, settings, readOrders, readProducts });

  await recordAudit(store, {
    action: 'digest.manual',
    actor: 'admin',
    ip: clientIp(headers),
    status: result.sent ? 'ok' : 'failed',
    detail: { reason: result.reason || null }
  });

  if (!result.sent) return bad(`Digest tidak terkirim: ${result.reason}`, 502);
  return ok({ ok: true, sent: true });
});

/* ------------------------------------------------------------------ */
/* Dropship                                                            */
/* ------------------------------------------------------------------ */

/**
 * GET /api/admin/dropship — kesiapan dropship seluruh vendor + produk.
 *
 * Memakai data `vendors` dan `costPrice`/`vendorId` pada produk yang sudah
 * diisi lewat tab Keuangan. Tidak ada koleksi baru; ini murni analisis.
 */
route('GET', '/api/admin/dropship', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const [vendors, products] = await Promise.all([readVendors(), readProducts()]);
  const settings = await readSettings();
  const adminFeePercent = Number(settings?.finance?.adminFeePercent) || 0;

  return ok({
    ...buildDropshipReadiness({ vendors, products, adminFeePercent }),
    requiredChecks: REQUIRED_CHECKS,
    bonusChecks: BONUS_CHECKS,
    returnReservePercent: DEFAULT_RETURN_RESERVE_PERCENT,
    adminFeePercent
  });
});

/**
 * GET /api/admin/dropship/checklist — prosedur operasional harian.
 * Disimpan di server supaya bisa diperbarui tanpa mengubah UI.
 */
route('GET', '/api/admin/dropship/checklist', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  return ok({
    steps: [
      {
        title: '1. Sebelum jualan — pilih & uji vendor',
        items: [
          'Tanyakan lewat chat: "Bisa dropship? Kirim ke alamat pembeli, packing netral, tanpa invoice?" Simpan jawabannya.',
          'Beli 1 unit sebagai sampel. Periksa: ada nama toko lain di box? ada nota harga di dalam?',
          'Foto produk sampel sendiri untuk katalog — jangan pakai foto milik vendor lain.',
          'Isi data vendor di tab Keuangan → Vendor, lalu centang 3 syarat wajib dropship.',
          'Isi HPP per produk di tab Produk supaya margin terhitung otomatis.'
        ]
      },
      {
        title: '2. Saat ada pesanan masuk',
        items: [
          'Pastikan status pembayaran LUNAS sebelum memesan ke vendor.',
          'Pesan dengan alamat pembeli sebagai alamat pengiriman.',
          'Tulis di catatan pesanan vendor: "DROPSHIP — packing netral, tanpa invoice/harga di dalam paket."',
          'Simpan nomor pesanan vendor di catatan internal pesanan kita.',
          'Input nomor resi di dashboard agar pembeli bisa melacak sendiri.'
        ]
      },
      {
        title: '3. Kalau ada masalah',
        items: [
          'Barang rusak/salah kirim: klaim ke vendor DULU sebelum mengganti ke pembeli.',
          'Kalau vendor menolak bertanggung jawab, ganti dulu ke pembeli, lalu hentikan pemakaian vendor itu.',
          'Catat insiden di catatan vendor — ini dasar memutuskan pindah pemasok.'
        ]
      }
    ],
    restrictions: [
      'JANGAN menjanjikan pengiriman instan 1–2 jam. Paket berangkat dari gudang vendor, bukan dari Cilegon.',
      'JANGAN menjanjikan stok pasti. Stok ada di tangan vendor dan bisa habis kapan saja.',
      'Sebutkan kota asal pengiriman yang sebenarnya di halaman produk, bukan "Dikirim dari Kota Cilegon".',
      'JANGAN mengaku memproduksi sendiri kalau barang dipasok vendor.'
    ]
  });
});

/* ---------------- Audit log ---------------- */
/* ---------------- Audit log ---------------- */


route('GET', '/api/admin/audit', async ({ headers, query }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  await pruneAudit(store, 90);
  let docs = await store.list('audit');
  docs = docs.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const action = String(query.action || '').trim();
  const q = String(query.q || '').trim().toLowerCase();
  if (action) docs = docs.filter((d) => String(d.action).startsWith(action));
  if (q) {
    docs = docs.filter((d) =>
      [d.action, d.actor, d.ip, d.target, JSON.stringify(d.detail || '')]
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }
  return ok({ total: docs.length, entries: docs.slice(0, 300) });
});

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const compiled = routes.map((r) => {
  const keys = [];
  const pattern = r.path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1));
        return '([^/]+)';
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  return { ...r, regex: new RegExp(`^${pattern}/?$`), keys };
});

export const matchRoute = (method, pathname) => {
  const cleanPath = pathname.replace(/\/+$/, '') || '/';
  for (const r of compiled) {
    if (r.method !== method.toUpperCase()) continue;
    const m = r.regex.exec(cleanPath);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => {
      params[k] = decodeURIComponent(m[i + 1]);
    });
    return { handler: r.handler, params };
  }
  return null;
};

export const knownMethodsFor = (pathname) =>
  compiled.filter((r) => r.regex.test(pathname.replace(/\/+$/, '') || '/')).map((r) => r.method);

/**
 * Entry utama untuk runtime fetch-style (Cloudflare) maupun adapter Node.
 */
export const dispatch = async ({ method = 'GET', path = '/', query = {}, body = null, headers = {} }) => {
  const url = new URL(path, 'http://localhost');
  const match = matchRoute(method, url.pathname);
  const mergedQuery = { ...Object.fromEntries(url.searchParams.entries()), ...query };

  if (!match) {
    const allowed = knownMethodsFor(url.pathname);
    if (allowed.length) return bad(`Method ${method} tidak didukung untuk endpoint ini.`, 405, { allowed });
    return bad(`Endpoint ${url.pathname} tidak ditemukan.`, 404);
  }

  try {
    const result = await match.handler({
      params: match.params,
      query: mergedQuery,
      body,
      headers
    });
    const out = result || ok({ success: true });
    return await guardRevokedSession(method, url.pathname, headers, out);
  } catch (err) {
    console.error('[api] handler error:', err);
    return bad(`Terjadi kesalahan server: ${err.message}`, 500);
  }
};

export {
  STORE,
  DEFAULT_SETTINGS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  ADMIN_PASSWORD,
  ADMIN_LOGIN_ENABLED,
  IS_DEV_PASSWORD,
  SEED_PRODUCTS,
  SEED_CATEGORIES,
  SEED_SIZE_CHART
};
