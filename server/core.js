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
import {
  saveImage,
  saveVideo,
  createVideoUploadTicket,
  MAX_UPLOAD_BYTES,
  MAX_PROOF_BYTES,
  MAX_VIDEO_BYTES
} from './storage.js';
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
import { summarizeSales, salesOrders } from './reports.js';
import { markOrderPaid } from './payments.js';
import {
  BUYER_COOKIE,
  BUYER_SESSION_TTL_MS,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  normalisasiNomor,
  empatTerakhir,
  nomorSama,
  createBuyerToken,
  verifyBuyerToken,
  buyerCookie,
  clearBuyerCookie,
  buatKodeOtp,
  otpDocId,
  hashOtp,
  otpCocok
} from './buyer-session.js';
import {
  midtransConfig,
  snapScriptUrl,
  verifySignature,
  grossAmountToRupiah,
  mapTransactionStatus,
  buildMidtransOrderId,
  createSnapToken,
  fetchTransactionStatus,
  cancelTransaction,
  sidikKunci
} from './midtrans.js';
import { metaProduk, buildShareHtml, TOKO_IMAGE } from './og-share.js';
import { thumbnailProduk } from './og-image.js';
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
  paymentProofKeyboard,
  answerCallbackQuery,
  editTelegramMessage,
  templatePaid,
  templateShipped,
  templateB2B,
  templateTest,
  telegramApiBase,
  esc
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

/**
 * Rapikan nilai password dari formulir sebelum dibandingkan.
 *
 * MENGAPA PERLU
 * Menyalin password dari WhatsApp/Notion/Catatan HP hampir selalu menyertakan
 * spasi di ujung, dan papan ketik seluler sering menambahkan baris baru saat
 * menekan "Enter". Sebelumnya perbandingan memakai `===` mentah sehingga
 * "RahasiaToko2026 " ditolak dan admin melihat "Password admin salah"
 * padahal password yang diketik benar. Bug ini terbukti terukur: tanpa
 * normalisasi, variasi spasi/baris baru menghasilkan 401.
 *
 * Spasi & baris baru di UJUNG dibuang; karakter di TENGAH tidak disentuh
 * karena password boleh mengandung spasi.
 */
const rapikanPassword = (nilai) => String(nilai ?? '').trim();

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
    .filter((d) => d.sid && !d.revokedAt)
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

/**
 * CATATAN STATUS NOTIFIKASI
 *
 * KENAPA: notifikasi Telegram sengaja tidak pernah menggagalkan alur pesanan.
 * Efek sampingnya, kegagalan kirim jadi SENYAP — seperti yang dilaporkan:
 * pembeli mengunggah bukti, tetapi chat bot tidak menerima apa pun, dan tidak
 * ada satu pun tanda bahwa ada yang salah.
 *
 * Sekarang setiap percobaan kirim menyimpan hasil terakhirnya. Dashboard
 * menampilkannya, jadi penyebabnya (token salah, bot belum di-/start, webhook
 * belum didaftarkan, chat id keliru) bisa diketahui tanpa membaca log server.
 */
const catatStatusNotifikasi = async (hasil, jenis) => {
  try {
    const docs = await store.list('settings');
    const saved = docs[0] || {};
    await store.put('settings', {
      ...saved,
      id: saved.id || 'store-settings',
      telegramHealth: {
        ...(saved.telegramHealth || {}),
        [jenis]: {
          sent: Boolean(hasil && hasil.sent),
          reason: (hasil && hasil.reason) || '',
          at: nowIso()
        }
      }
    });
  } catch (err) {
    // Kegagalan mencatat status tidak boleh mengganggu alur pesanan.
    console.error('[telegram] gagal mencatat status notifikasi:', err.message);
  }
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
    telegramHealth: { ...(saved.telegramHealth || {}) },
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
    ongkir: { ...DEFAULT_SETTINGS.ongkir, ...(saved.ongkir || {}) },
    banks: normalizeBanks(
      Array.isArray(saved.banks) && saved.banks.length ? saved.banks : DEFAULT_BANKS
    ),
    vouchers:
      Array.isArray(saved.vouchers) && saved.vouchers.length
        ? saved.vouchers
        : SEED_VOUCHERS
  };
};

/**
 * Pengaturan pembayaran untuk browser — dibersihkan dari sisa jalur manual.
 *
 * Teks `payment.instructions` tersimpan di database sejak era transfer bank
 * manual. Setelah pindah ke Midtrans, teks itu berbunyi "termasuk 3 angka
 * unik ... tanpa biaya gateway" — dan tetap dikirim apa adanya ke halaman
 * checkout serta halaman lacak. Pembeli membacanya sebagai tagihan yang
 * berbeda dari total, padahal Midtrans menagih angka bulat.
 *
 * Jadi teks lama itu DIGANTI saat Midtrans aktif. Instruksi kustom admin
 * tetap dihormati kalau admin memang sudah menulis versi baru.
 */
const TEKS_MANUAL_LAMA = /angka unik|kode unik|NOMINAL AKHIR/i;

const publicPayment = (settings) => {
  const payment = settings.payment || {};
  if (!midtransConfig().ready) return payment;

  const instruksi = String(payment.instructions || '');
  if (instruksi && !TEKS_MANUAL_LAMA.test(instruksi)) return payment;

  return {
    ...payment,
    uniqueCodeEnabled: false,
    instructions:
      'Pembayaran diproses otomatis lewat Midtrans (QRIS, GoPay, OVO, DANA, ShopeePay, kartu, atau virtual account). Nominal dibayar sama persis dengan total tagihan — tidak ada biaya layanan tambahan.'
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
  /*
   * Aturan gratis ongkir dikirim ke browser supaya checkout bisa menampilkan
   * "GRATIS" dan menghitung total yang SAMA dengan server. Server tetap
   * menghitung ulang saat pesanan dibuat — nilai dari browser tidak pernah
   * dipercaya.
   */
  ongkir: {
    promoGratisOngkir: Math.max(0, Math.round(Number(settings.ongkir?.promoGratisOngkir) || 0)),
    gratisOngkirSelalu: settings.ongkir?.gratisOngkirSelalu === true
  },
  payment: publicPayment(settings),
  /**
   * Status pembayaran otomatis untuk browser.
   *
   * Hanya `enabled` dan `clientKey` yang dikirim — clientKey memang publik
   * (dipakai snap.js di peramban). serverKey TIDAK PERNAH ikut di sini.
   *
   * Dipakai checkout untuk memutuskan: tampilkan tombol Midtrans, atau
   * kembali ke jalur lama kalau kuncinya belum diisi. Dengan begitu toko
   * tidak pernah mati total gara-gara konfigurasi yang belum lengkap.
   */
  paymentGateway: (() => {
    const mt = midtransConfig();
    return {
      enabled: mt.ready,
      provider: 'midtrans',
      clientKey: mt.ready ? mt.clientKey : '',
      isProduction: mt.isProduction
    };
  })(),
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

/** Zona tujuan yang dikenal, mis. saat pesanan harus divalidasi ulang. */
export const daftarZonaOngkir = () => SHIPPING_ZONES;

/** "Rp 8.000" — untuk pesan yang dibaca pembeli/admin. */
const rupiahRingkas = (nilai) =>
  `Rp ${Math.round(Number(nilai) || 0).toLocaleString('id-ID')}`;

/**
 * Tarif zona terdekat dari nominal yang dikirim browser.
 *
 * Dipakai saat nominal kiriman tidak cocok tarif mana pun: pilih tarif SAH
 * yang paling dekat, bukan sekadar percaya angka dari browser.
 */
const pilihTarifZona = (diminta, tarifSah, beratKg) => {
  const daftar = [...tarifSah].sort((a, b) => a - b);
  if (!daftar.length) return 0;
  if (!diminta) {
    /* Tidak ada kiriman yang bisa dipakai — pakai tarif termurah. */
    return daftar[0];
  }
  return daftar.reduce((dekat, t) => (Math.abs(t - diminta) < Math.abs(dekat - diminta) ? t : dekat));
};

/**
 * Apakah pesanan ini berhak GRATIS ONGKIR?
 *
 * Dua sumber, dan keduanya harus eksplisit diatur admin:
 *   1. `settings.ongkir.promoGratisOngkir` > 0 → gratis bila subtotal mencapai
 *      angka itu (0 = promo dimatikan).
 *   2. `settings.ongkir.gratisOngkirSelalu` → gratis tanpa syarat (dipakai
 *      untuk masa uji coba atau kampanye).
 *
 * KENAPA DIBUAT: supaya pembeli bisa menguji pembayaran dengan produk murah
 * (mis. Rp 1.000) tanpa ikut membayar ongkir Rp 8.000. Tanpa ini, satu-satunya
 * cara adalah mengirim `shippingCost: 0` dari browser — yang justru celah
 * keamanan yang baru saja ditutup.
 */
const kalkulasiGratisOngkir = (settings, subtotal) => {
  const o = settings.ongkir || {};
  const minBelanja = Math.max(0, Math.round(Number(o.promoGratisOngkir) || 0));
  if (o.gratisOngkirSelalu === true) return { gratis: true, aktif: true, minBelanja: 0 };
  if (minBelanja > 0 && subtotal >= minBelanja) return { gratis: true, aktif: true, minBelanja };
  return { gratis: false, aktif: minBelanja > 0, minBelanja };
};

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

  /*
   * Riwayat notifikasi diisi belakangan (butuh `mt`), tetapi harus sudah
   * dideklarasikan di sini: `notifikasiMidtrans` ikut di respons walau
   * Midtrans belum dikonfigurasi.
   */
  let notifikasi = [];

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
  /*
   * Bentuk password (BUKAN isinya) — hanya terlihat oleh admin yang sudah
   * login. Ini yang membedakan "lupa password" dari "environment tersimpan
   * dengan spasi/baris baru sehingga tidak mungkin diketik cocok".
   */
  add(
    'password-shape',
    'Bentuk ADMIN_PASSWORD',
    ADMIN_PASSWORD && ADMIN_PASSWORD.trim() === ADMIN_PASSWORD ? 'ok' : 'fail',
    ADMIN_PASSWORD
      ? ADMIN_PASSWORD.trim() === ADMIN_PASSWORD
        ? `${ADMIN_PASSWORD.length} karakter, tanpa spasi di ujung`
        : `ADA spasi/baris baru di ujung (${ADMIN_PASSWORD.length} karakter) — hapus di dashboard Vercel lalu Redeploy`
      : 'tidak ada',
    'Buka Vercel → Settings → Environment Variables → ADMIN_PASSWORD, pastikan tidak ada spasi/Enter di akhir nilai.'
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
    /Karang Asem/.test(settings.address) && settings.whatsapp === '6282249879873' ? 'ok' : 'warn',
    `${settings.whatsappDisplay} • ${settings.email}`,
    'Pengaturan → Identitas: pastikan alamat Karang Asem & WhatsApp 082249879873.'
  );

  /*
   * 3b. Midtrans — pembayaran otomatis.
   *
   * Pemeriksaan ini HANYA melaporkan terisi/tidak dan mode sandbox/produksi.
   * Nilai kuncinya tidak pernah dikembalikan, sehingga endpoint diagnosa tetap
   * aman dibuka tanpa login (sudah begitu sejak awal untuk kenyamanan admin).
   *
   * Gunanya: memastikan env var benar-benar terbaca DI DALAM Vercel. Env yang
   * baru diubah tidak berlaku pada deploy lama, dan gejalanya persis sama
   * dengan "kunci belum diisi" — mudah tertukar.
   */
  const mt = midtransConfig();
  const labelMode = mt.isProduction ? 'PRODUKSI' : 'SANDBOX';
  const statusMidtrans = !mt.ready ? 'warn' : mt.isProduction ? 'ok' : 'warn';

  let detailMidtrans;
  if (!mt.ready) {
    const kosong = [
      !mt.serverKey ? 'MIDTRANS_SERVER_KEY' : null,
      !mt.clientKey ? 'MIDTRANS_CLIENT_KEY' : null
    ].filter(Boolean);
    detailMidtrans = `belum aktif — ${kosong.join(' & ')} kosong`;
  } else if (mt.konflik) {
    /* Detail konflik dilaporkan apa adanya (tanpa membocorkan kunci). */
    /*
     * Kejadian nyata: kunci produksi (Mid-*) dipasang, tetapi
     * MIDTRANS_IS_PRODUCTION masih false. Mode sekarang DITEBAK dari kunci
     * (lihat midtrans.js), jadi transaksi tetap jalan — tetapi flag yang
     * salah harus dilaporkan, bukan didiamkan, karena kalau nanti kuncinya
     * diganti orang lain, flag yang salah ini akan menyesatkan.
     */
    detailMidtrans = `aktif • mode ${labelMode} • MIDTRANS_IS_PRODUCTION tidak cocok dengan kunci`;
  } else {
    detailMidtrans =
      `aktif • mode ${labelMode} • clientKey ${mt.clientKey.slice(0, 12)}…` +
      /*
       * KUNCI MANA YANG MENANDATANGANI NOTIFIKASI — disebut eksplisit.
       *
       * Ini pertanyaan yang menjawab 8 notifikasi yang ditolak: sejak
       * 28 Oktober 2026 Midtrans menandatangani dengan Signature Secret Key,
       * bukan Server Key. Kalau baris ini berbunyi "server-key", berarti
       * MIDTRANS_SIGNATURE_SECRET_KEY masih kosong dan kemungkinan besar
       * itulah sebab penolakan.
       */
      (mt.signatureKeyTerpisah ? ' • tanda tangan: signature-secret-key' : ' • tanda tangan: server-key');
  }

  add(
    'midtrans',
    'Pembayaran otomatis (Midtrans)',
    statusMidtrans,
    detailMidtrans,
    mt.konflik
      ? `Kunci Anda berpola ${mt.isProduction ? 'PRODUKSI' : 'SANDBOX'}, tetapi MIDTRANS_IS_PRODUCTION bernilai sebaliknya. Sistem mengikuti KUNCI (sudah benar), tapi rapikan: set MIDTRANS_IS_PRODUCTION=${mt.isProduction ? 'true' : 'false'} lalu Redeploy.`
      : mt.ready && !mt.isProduction
        ? 'Kunci Anda berpola SANDBOX (SB-*) — pembeli akan "berhasil bayar" tanpa uang masuk. Ganti ke kunci produksi (Mid-*) untuk uang sungguhan, lalu Redeploy.'
        : 'Vercel → Settings → Environment Variables: tambah MIDTRANS_SERVER_KEY, MIDTRANS_CLIENT_KEY, MIDTRANS_IS_PRODUCTION=true untuk Production, lalu REDEPLOY. Env baru tidak berlaku pada deploy lama.'
  );

  /*
   * 3b-2. Signature Secret Key — kunci KETIGA yang paling sering terlewat.
   *
   * Sejak 28 Oktober 2026 Midtrans memisahkan kunci untuk memverifikasi
   * notifikasi dari Server Key. Merchant yang mendaftar sebelum tanggal itu
   * memulai dengan kedua nilai identik, jadi kekurangan ini tidak terlihat
   * sampai salah satu kunci dibuat ulang — lalu pembayaran masuk tetapi
   * semua notifikasinya ditolak.
   */
  add(
    'midtrans-signature-key',
    'Kunci verifikasi notifikasi (Signature Secret Key)',
    mt.signatureKeyTerpisah ? 'ok' : 'warn',
    mt.signatureKeyTerpisah
      ? 'terpasang terpisah dari Server Key'
      : 'belum terpisah — verifikasi masih memakai Server Key',
    mt.signatureKeyTerpisah
      ? 'Tidak ada yang perlu diperbaiki.'
      : 'Buka dashboard Midtrans → Settings → Access Keys → baris "Signature Secret Key", klik ikon mata untuk melihatnya, lalu simpan sebagai MIDTRANS_SIGNATURE_SECRET_KEY di Vercel (Production) dan REDEPLOY. Tanpa ini, selama Server Key dan Signature Secret Key masih bernilai sama tidak ada masalah — tetapi begitu salah satunya di-generate ulang, SEMUA notifikasi pembayaran akan ditolak (uang masuk, pesanan tidak pernah lunas).'
  );

  /*
   * 3c. Host Core API Midtrans.
   *
   * Bukan sekadar teori: seluruh panggilan /v2/* pernah memakai
   * app.midtrans.com (host Snap) sehingga cek status & cancel SELALU 404.
   * Akibatnya pembeli yang sudah membayar tidak pernah dilunaskan otomatis.
   *
   * Pemeriksaan ini memastikan host yang dipakai memang host Core API, dan
   * menyebutkan URL notifikasi yang WAJIB diisi di dashboard Midtrans —
   * penyebab paling sering "uang masuk tapi pesanan tetap menunggu".
   */
  if (mt.ready) {
    const hostBenar = /^https:\/\/api(\.sandbox)?\.midtrans\.com$/.test(String(mt.apiBase || ''));
    add(
      'midtrans-host',
      'Host Core API Midtrans (cek status & pembatalan)',
      hostBenar ? 'ok' : 'fail',
      hostBenar ? `${mt.apiBase}/v2/{order_id}/status` : `SALAH: ${mt.apiBase} (host Snap, bukan Core API)`,
      hostBenar
        ? ''
        : 'Host Core API wajib api.midtrans.com (api.sandbox.midtrans.com untuk sandbox). Jangan memakai app.midtrans.com untuk /v2/*.'
    );

    /*
     * Statusnya `ok` (bukan `warn`) karena URL ini TIDAK BISA dibaca lewat API
     * Midtrans — memaksa `warn` permanen hanya membuat daftar diagnosa selalu
     * terlihat bermasalah. Yang penting: URL persisnya DITAMPILKAN di sini,
     * jadi admin tinggal salin-tempel.
     */
    add(
      'midtrans-notification',
      'URL notifikasi pembayaran Midtrans',
      'ok',
      `isi di dashboard Midtrans (Settings → Configuration, environment ${labelMode})`,
      `Tempel persis: ${baseUrlDari(process.env)}/api/payments/midtrans/notification — di environment ${labelMode}. URL notifikasi Midtrans TERPISAH untuk Sandbox dan Production, jadi mengisi salah satunya saja membuat pembayaran tidak pernah masuk otomatis.`
    );
  }

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

  /*
   * 6. RIWAYAT NOTIFIKASI MIDTRANS.
   *
   * Ini penentu diagnosa yang paling sering dibutuhkan: apakah Midtrans
   * benar-benar mengirim notifikasi ke server kita, atau tidak sama sekali?
   *
   *   - tidak ada satu pun entri  → Midtrans tidak pernah mengirim. Perbaiki
   *     Notification URL di dashboard Midtrans (environment yang benar).
   *   - ada entri "ditolak-signature" → notifikasi sampai, tetapi ServerKey
   *     kita berbeda dari kunci akun tempat transaksi dibuat.
   *   - ada entri "lunas-otomatis" → webhook sehat, tidak ada yang perlu
   *     diperbaiki.
   *
   * Hanya 8 karakter terakhir ServerKey yang pernah dicatat (lihat sidikKunci);
   * nilai kunci penuh tidak pernah tersimpan di audit.
   */
  if (mt.ready) {
    try {
      const audit = await store.list('audit');
      notifikasi = audit
        .filter((d) => String(d.action || '').startsWith('pembayaran.'))
        .sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .slice(0, 8)
        .map((d) => ({
          at: d.at,
          action: d.action,
          target: d.target || '',
          status: d.status || 'ok',
          alasan: d.detail?.alasan || d.detail?.keterangan || null,
          transactionStatus: d.detail?.transaction_status || null,
          serverKeyEkor: d.detail?.sidikEkor || null,
          /* Bentuk nilai yang dipakai menyusun tanda tangan — untuk diagnosa. */
          grossAmount: d.detail?.grossAmountDiterima || d.detail?.gross_amount || null,
          grossAmountTanpaDesimal: d.detail?.grossAmountTanpaDesimal ?? null,
          serverKeyAdaSpasi: d.detail?.serverKeyAdaSpasi ?? null
        }));
    } catch (err) {
      console.error('[diagnose] gagal membaca riwayat notifikasi:', err.message);
    }

    if (notifikasi.length === 0) {
      add(
        'midtrans-notifikasi-terakhir',
        'Notifikasi Midtrans yang pernah diterima',
        'warn',
        'belum pernah ada — server ini belum menerima satu pun notifikasi Midtrans',
        `Kalau sudah ada pembeli yang membayar, artinya notifikasi TIDAK sampai: isi Payment Notification URL di dashboard Midtrans → Settings → Payment → Notification URL untuk environment ${labelMode}, persis: ${baseUrlDari(process.env)}/api/payments/midtrans/notification. Setelah itu lakukan satu pembayaran uji kecil.`
      );
    } else {
      const terakhir = notifikasi[0];
      const ditolak = notifikasi.filter((n) => n.action.includes('ditolak-signature'));

      /*
       * Status hanya BERMASALAH kalau penolakan terakhir LEBIH BARU daripada
       * notifikasi sukses terakhir.
       *
       * Tanpa pembanding ini, satu penolakan lama (mis. sebelum kunci diganti)
       * membuat diagnosa merah SELAMANYA — dan peringatan yang selalu menyala
       * sama saja dengan tidak ada peringatan.
       */
      const suksesTerakhir = notifikasi.find(
        (n) => n.action === 'pembayaran.lunas-otomatis' || n.action === 'pembayaran.notifikasi-ulang'
      );
      const tolakTerakhir = ditolak[0];
      const masihBermasalah =
        Boolean(tolakTerakhir) &&
        (!suksesTerakhir || String(tolakTerakhir.at) > String(suksesTerakhir.at));

      add(
        'midtrans-notifikasi-terakhir',
        'Notifikasi Midtrans yang pernah diterima',
        masihBermasalah ? 'fail' : 'ok',
        masihBermasalah
          ? `${notifikasi.length} terakhir • ${ditolak.length} DITOLAK karena tanda tangan tidak cocok • terakhir ${terakhir.action}`
          : `${notifikasi.length} terakhir • terakhir ${terakhir.action} pada ${terakhir.at}${
              ditolak.length > 0 ? ` • ${ditolak.length} penolakan lama (sudah terlewati)` : ''
            }`,
        masihBermasalah
          ? `Notifikasi SAMPAI tetapi tanda tangannya ditolak — MIDTRANS_SERVER_KEY di server berbeda dari akun Midtrans tempat transaksi dibuat. Server memakai kunci berakhiran "…${tolakTerakhir.serverKeyEkor || '?'}". Untuk memastikan tanpa menunggu notifikasi berikutnya: buka salah satu pesanan yang sudah dibayar di halaman Lacak Pesanan, tekan "Saya Sudah Bayar — Periksa Status". Bila kuncinya salah, halaman itu akan mengatakannya (dan audit mencatat pembayaran.kunci-tidak-cocok-dengan-akun). Perbaiki dengan menyalin ServerKey PRODUKSI dari dashboard Midtrans → Settings → Access Keys ke MIDTRANS_SERVER_KEY di Vercel, lalu Redeploy.`
          : 'Tidak ada yang perlu diperbaiki.'
      );
    }
  }

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
    notifikasiMidtrans: notifikasi,
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

    /*
     * PRODUK MULTI-DIMENSI (Model x Ukuran x Warna).
     *
     * Harga TIDAK diambil dari kiriman browser. Nilai `price` yang dikirim
     * pembeli hanya dipakai untuk MEMBANDINGKAN (kalau beda, dicatat sebagai
     * peringatan), lalu server menghitung sendiri:
     *   harga = kombinasi.price ?? (harga produk + jumlah priceDelta)
     * Ini menutup celah pembeli mengubah selisih harga di browser.
     */
    const groups = Array.isArray(product.optionGroups) ? product.optionGroups : [];
    const chosen = raw.options && typeof raw.options === 'object' ? raw.options : {};
    const chosenIds = groups.map((g) => String(chosen[g.id] || ''));
    const selectionComplete = groups.every(
      (g, i) => g.required === false || Boolean(chosenIds[i])
    );

    let optionPrice = null;
    let optionLabel = '';
    let comboImage = '';
    if (groups.length) {
      if (!selectionComplete) {
        priceIssues.push(
          `${product.shortName || product.name}: pilihan belum lengkap (${groups
            .map((g) => g.name)
            .join(', ')}).`
        );
        return null;
      }

      let delta = 0;
      const labels = [];
      for (let i = 0; i < groups.length; i += 1) {
        const value = groups[i].values.find((v) => v.id === chosenIds[i]);
        if (!value) {
          priceIssues.push(
            `${product.shortName || product.name}: pilihan "${groups[i].name}" tidak dikenal.`
          );
          return null;
        }
        delta += Number(value.priceDelta) || 0;
        labels.push(value.label);
        if (!comboImage && value.image) comboImage = value.image;
      }

      const combos = Array.isArray(product.combinations) ? product.combinations : [];
      const combo = combos.find(
        (c) =>
          Array.isArray(c.optionValueIds) &&
          c.optionValueIds.length === chosenIds.length &&
          c.optionValueIds.every((id, i) => id === chosenIds[i])
      );

      if (combo && combo.available === false) {
        priceIssues.push(
          `${product.shortName || product.name} (${labels.join(' / ')}): kombinasi ini sedang tidak tersedia.`
        );
        return null;
      }

      optionPrice = Math.max(0, Number(combo?.price ?? (Number(product.price) || 0) + delta));
      optionLabel = labels.join(' · ');
      if (combo?.image) comboImage = combo.image;
    }

    /*
     * HARGA SATUAN — aturan yang SAMA dengan `unitPriceFor()` di
     * src/lib/variantPricing.ts (dipakai halaman produk, keranjang, checkout).
     *
     * Urutan: pilihan/kombinasi → varian → harga produk; lalu harga grosir
     * hanya bila (a) minimal grosir diisi > 0, (b) qty mencapai minimal, dan
     * (c) harga grosir memang lebih murah.
     */
    const unitPrice = groups.length
      ? Number(optionPrice) || 0
      : Number(variant?.price ?? product.price) || 0;
    const minGrosir = Number(product.minWholesaleQty) || 0;
    const hargaGrosir = Number(product.wholesalePrice) || 0;
    const wholesaleApplies =
      minGrosir > 0 && qty >= minGrosir && hargaGrosir > 0 && hargaGrosir < unitPrice;
    const effectivePrice = wholesaleApplies ? hargaGrosir : unitPrice;

    const sentPrice = Number(raw.price);
    if (Number.isFinite(sentPrice) && Math.abs(sentPrice - effectivePrice) > 1) {
      priceIssues.push(
        `${product.shortName || product.name}: harga kiriman Rp ${sentPrice.toLocaleString(
          'id-ID'
        )} berbeda dari harga server Rp ${effectivePrice.toLocaleString('id-ID')} — memakai harga server.`
      );
    }

    /*
     * Item pesanan menyimpan pilihan sebagai struktur, bukan satu string
     * panjang. Dengan begitu invoice, laporan, dan WhatsApp bisa menampilkan
     * "Model: Oversize / Ukuran: XL / Warna: Navy" apa adanya, dan gudang
     * tidak perlu memecah teks.
     */
    const optionEntries = groups.length
      ? groups.map((g, i) => ({
          groupId: g.id,
          groupName: g.name,
          valueId: chosenIds[i],
          valueLabel:
            g.values.find((v) => v.id === chosenIds[i])?.label || ''
        }))
      : [];

    return {
      productId: product.id,
      /*
       * Simpan nama produk TANPA label pilihan. `name` di bawah memuat
       * "(Oversize · XL · Navy)" sehingga satu produk pecah menjadi banyak
       * baris bila dipakai sebagai kunci laporan. `productName` dipakai
       * reports.js untuk mengelompokkan penjualan per produk.
       */
      productName: product.shortName || product.name,
      variantId: variant?.id || raw.variantId || null,
      variantLabel: groups.length ? optionLabel : variant?.label || raw.variantLabel || '',
      options: optionEntries,
      optionKey: groups.length ? chosenIds.join('|') : '',
      image: comboImage || product.image || '',
      name: `${product.shortName || product.name}${
        groups.length
          ? optionLabel
            ? ` (${optionLabel})`
            : ''
          : variant?.label
            ? ` (${variant.label})`
            : ''
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
    /*
     * Item bisa null karena dua sebab berbeda: produknya memang tidak ada,
     * ATAU pilihannya tidak valid (belum lengkap, nilai tidak dikenal,
     * kombinasi tidak tersedia). Menampilkan "produk tidak ditemukan" untuk
     * kasus kedua menyesatkan — pembeli akan mencari produk yang sebenarnya
     * ada. Karena itu `priceIssues` jadi kalimat utama bila terisi.
     */
    const sebab = priceIssues.length
      ? priceIssues.join(' ')
      : 'Produk pada pesanan tidak ditemukan di katalog kami.';
    return bad(
      `${sebab} Silakan muat ulang halaman lalu pilih kembali.`,
      400,
      { problems: priceIssues }
    );
  }

  const subtotal = pricedItems.reduce((sum, it) => sum + it.price * it.qty, 0);

  /*
   * BERAT TOTAL pesanan — dasar perhitungan ongkir.
   *
   * Berat diambil dari katalog (bukan dari browser), sama seperti harga.
   * Produk tanpa berat dianggap 0 gram, lalu TOTAL-nya dinaikkan ke minimum
   * 1 kg oleh `beratKg` — supaya produk digital/ringan tidak mendapat ongkir
   * Rp 0 hanya karena beratnya belum diisi admin.
   */
  const beratPeta = new Map(catalog.map((prod) => [String(prod.id), Number(prod.weightGrams) || 0]));
  const totalBeratGram = pricedItems.reduce(
    (sum, it) => sum + (beratPeta.get(String(it.productId)) || 0) * it.qty,
    0
  );

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

  /*
   * VOUCHER DIVALIDASI DI SERVER — bukan dipercaya dari browser.
   *
   * Celah yang ditutup di sini: dulu `voucherDiscount` dari browser dipakai
   * apa adanya (hanya dibatasi ≤ subtotal), dan `voucherCode` disimpan tanpa
   * pernah dicocokkan ke daftar voucher. Terbukti lewat uji: pesanan Rp 1.500
   * + ongkir Rp 8.000 dengan kode karangan "KODEPALSU" menghasilkan diskon
   * yang diklaim sendiri, dan pesanan tetap dibuat (HTTP 201).
   *
   * Aturan sekarang: hanya kode voucher AKTIF yang dikenal yang dihormati,
   * nominal diskon diambil dari definisinya (bukan dari kiriman browser), dan
   * minimal belanja diperiksa.
   *
   * Untuk rilis ini sengaja TIDAK ada penolakan keras (400) saat kode tidak
   * dikenal: kalau daftar voucher admin berubah, pesanan yang sudah tampil di
   * layar checkout tidak boleh mendadak gagal. Diskonnya saja yang diabaikan,
   * dan alasannya dikembalikan supaya pembeli tahu.
   */
  const voucherCatatan = [];
  let safeDiscount = 0;
  let voucherTerpakai = null;
  const kodeVoucher = String(voucherCode || '').trim().toUpperCase();

  if (kodeVoucher) {
    const daftar = (settings.vouchers || []).filter((v) => v.active !== false);
    const ketemu = daftar.find((v) => String(v.code || '').toUpperCase() === kodeVoucher);

    if (!ketemu) {
      voucherCatatan.push(`Kode "${kodeVoucher}" tidak berlaku lagi, jadi tidak dipakai.`);
    } else if (Number(ketemu.minPurchase) > 0 && subtotal < Number(ketemu.minPurchase)) {
      voucherCatatan.push(
        `Kode "${kodeVoucher}" butuh belanja minimal ${rupiahRingkas(ketemu.minPurchase)}, jadi belum bisa dipakai.`
      );
    } else {
      /* Nominal dari DEFINISI voucher, bukan dari browser. */
      safeDiscount = Math.max(0, Math.min(Math.round(Number(ketemu.discountAmount) || 0), subtotal));
      voucherTerpakai = ketemu.code;
    }
  }

  /*
   * ONGKIR TIDAK BOLEH DIKIRIM SEBAGAI 0 SEMAU PEMBELI.
   *
   * Dulu `shippingCost` dari browser dipakai apa adanya (dibatasi ≤ Rp 500.000),
   * jadi pembeli bisa mengubah total tagihannya sendiri menjadi jauh lebih
   * kecil — terbukti lewat uji: ongkir 0 menghasilkan total Rp 1.825 untuk
   * pesanan yang seharusnya Rp 10.374.
   *
   * Ongkir yang SAH sekarang hanya salah satu dari:
   *   a. salah satu tarif zona yang benar-benar dihitung server (cocok persis),
   *   b. 0, bila admin menandai pesanan ini sebagai Gratis Ongkir, atau
   *   c. 0, bila promo Gratis Ongkir sedang aktif dan minimal belanjanya
   *      terpenuhi.
   * Selain itu, tarif zona TERDEKAT dipakai dan pembeli diberi tahu.
   */
  const beratKg = Math.max(1, Math.ceil(totalBeratGram / 1000));
  const ongkirDiminta = Math.max(0, Math.min(Math.round(Number(shippingCost) || 0), 500000));

  /* Semua tarif sah = baseReg setiap zona × berat, sesuai calcShipping. */
  const tarifSah = new Set(
    SHIPPING_ZONES.map((z) => Math.round(Number(z.baseReg) || 0) * beratKg)
  );

  const promo = kalkulasiGratisOngkir(settings, subtotal);

  /*
   * Urutan keputusan (dari yang paling menguntungkan-dan-sah ke yang menolak):
   *   1. Promo gratis ongkir aktif & minimal belanja terpenuhi → 0.
   *      Ini juga yang membuat pembeli bisa memesan produk murah tanpa ongkir.
   *   2. Kiriman browser cocok PERSIS dengan salah satu tarif zona → dipakai.
   *   3. Selain itu, tarif zona terdekat dipakai dan pembeli diberi tahu.
   *
   * Catatan: kasus "pembeli mengirim 0" masuk ke langkah 3, KECUALI promo
   * aktif di langkah 1. Itulah penutup celah ongkir gratis tanpa hak.
   */
  let safeShipping;
  let ongkirCatatan = null;
  let ongkirGratis = false;

  if (promo.gratis) {
    safeShipping = 0;
    ongkirGratis = true;
  } else if (ongkirDiminta === 0 && promo.aktif) {
    /*
     * Pengganti yang dikirim 0 padahal promo aktif tetapi minimal belanja
     * belum tercapai. Jangan diam-diam dibebani tarif penuh tanpa penjelasan:
     * beri tahu selisih minimal belanjanya.
     */
    safeShipping = Math.min(pilihTarifZona(ongkirDiminta, tarifSah, beratKg), 500000);
    ongkirCatatan =
      `Gratis ongkir berlaku mulai belanja ${rupiahRingkas(promo.minBelanja)}, jadi ongkir tetap dihitung ` +
      `(${rupiahRingkas(safeShipping)}). Tambah ${rupiahRingkas(Math.max(0, promo.minBelanja - subtotal))} lagi untuk mendapatkannya.`;
  } else if (tarifSah.has(ongkirDiminta)) {
    safeShipping = ongkirDiminta;
  } else {
    safeShipping = Math.min(pilihTarifZona(ongkirDiminta, tarifSah, beratKg), 500000);
    ongkirCatatan =
      `Ongkir yang dikirim tidak sesuai tarif kurir, jadi kami memakai tarif resmi ` +
      `(${rupiahRingkas(safeShipping)}).`;
  }

  const safeDiscountFinal = Math.max(0, Math.min(safeDiscount, subtotal));
  const totalBeforeCode = Math.max(0, subtotal + safeShipping - safeDiscountFinal);

  /*
   * Kode unik 3 digit HANYA untuk jalur transfer manual.
   *
   * Fungsinya supaya admin bisa mencocokkan nominal di mutasi bank. Dengan
   * Midtrans, pencocokan itu dilakukan webhook — dan kode unik justru merusak
   * alurnya: server membandingkan `gross_amount` Midtrans dengan `totalAmount`,
   * jadi kalau total digelembungi kode unik, pembayaran yang benar pun akan
   * ditolak sebagai "nominal tidak cocok".
   *
   * Selama Midtrans belum dikonfigurasi, perilaku lama dipertahankan supaya
   * toko yang masih memakai transfer manual tidak berubah.
   */
  const pakaiMidtrans = midtransConfig().ready;
  const uniqueCode =
    pakaiMidtrans || settings.payment.uniqueCodeEnabled === false
      ? 0
      : makeUniqueCode(existing, totalBeforeCode);
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
    /*
     * 4 digit terakhir No. WhatsApp disimpan terpisah sebagai bukti kedua
     * untuk MEMBUKA & MEMBAYAR pesanan (cek status, batalkan). Tidak pernah
     * dikirim ke pihak lain; hanya dikembalikan ke pemesan yang tahu nomornya.
     */
    phoneLast4: String(customerPhone || '').replace(/\D/g, '').slice(-4),
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
    voucherCode: voucherTerpakai,
    voucherDiscount: safeDiscountFinal,
    totalBeforeCode,
    totalAmount,
    notes,
    paymentProofNote,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
    items: pricedItems,
    /*
     * Penyesuaian yang dilakukan server DICERITAKAN, tidak disembunyikan.
     * Pembeli berhak tahu kalau diskonnya tidak dipakai atau ongkirnya
     * disesuaikan — supaya total di layar dan total di tagihan bisa
     * dipertanggungjawabkan.
     */
    ongkirGratis,
    penyesuaian: [...voucherCatatan, ...(ongkirCatatan ? [ongkirCatatan] : [])],
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
    /*
     * Instruksi pembayaran hanya relevan untuk jalur manual. Saat Midtrans aktif
     * (kondisi produksi), halaman pembayaran memakai Snap, jadi jangan kirim
     * nomor rekening/QRIS statis + narasi "kode unik" yang sudah tidak berlaku —
     * pembeli sempat bingung harus transfer ke mana.
     */
    instructions: pakaiMidtrans
      ? {
          amount: totalAmount,
          windowHours: settings.payment.paymentWindowHours,
          note: publicPayment(settings).instructions
        }
      : {
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
    const hasil = await notifySafe(settings, templateNewOrder(newOrder));
    // Dicatat supaya kegagalan kirim tidak lagi senyap: admin bisa melihatnya
    // di Dashboard → Pengaturan → Notifikasi Telegram.
    await catatStatusNotifikasi(hasil, 'pesanan-baru');
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

/* ─────────────────────────── MIDTRANS ─────────────────────────── */

/**
 * Alamat publik situs untuk `finishUrl` Snap dan tautan absolut lainnya.
 *
 * Urutan: PUBLIC_BASE_URL (kalau pemilik toko mengisinya) → header Host
 * permintaan → domain bawaan. Memakai header Host penting karena hasilnya
 * mengikuti domain yang sedang dibuka pembeli (domain asli maupun domain
 * vercel), sehingga tautan "kembali ke pesanan" tidak pernah menunjuk ke
 * domain yang belum aktif.
 */
const baseUrlDari = (env, headers = {}) => {
  const eksplisit = String(env.PUBLIC_BASE_URL || '').trim();
  if (eksplisit) return eksplisit.replace(/\/$/, '');

  const host = String(headers['x-forwarded-host'] || headers.host || '').split(',')[0].trim();
  if (host) {
    const proto = String(headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https';
    return `${proto}://${host}`;
  }
  return 'https://cilegon-enggih.vercel.app';
};



/**
 * Cari pesanan dari `order_id` yang dikirim Midtrans.
 *
 * `order_id` Midtrans tidak selalu sama persis dengan nomor pesanan kita:
 * percobaan kedua dan seterusnya memakai akhiran -R2, -R3, dst (Midtrans
 * menolak order_id yang sudah dipakai). Jadi pencarian dilakukan dua tahap:
 * cocokkan `midtransOrderId` yang tersimpan, lalu kalau tidak ketemu,
 * buang akhiran percobaan.
 */
const findOrderByMidtransId = async (midtransOrderId) => {
  const id = String(midtransOrderId || '').trim();
  if (!id) return null;

  const semua = await store.list('orders');
  const langsung = semua.find((o) => o.midtransOrderId === id);
  if (langsung) return langsung;

  const tanpaAkhiran = id.replace(/-R\d+$/, '');
  return semua.find((o) => o.orderId === tanpaAkhiran) || null;
};



/**
 * Buat token Snap untuk sebuah pesanan.
 *
 * Nominal SELALU diambil dari pesanan di database, tidak pernah dari browser.
 * Kalau nominal dipercaya dari browser, pembeli bisa mengubah total tagihannya
 * sendiri menjadi Rp 1.000.
 *
 * Endpoint ini sengaja tidak butuh login admin: yang memanggilnya adalah
 * pembeli di halaman checkout, tepat setelah pesanannya dibuat. Pengamannya:
 * orderId harus ada, dan pesanan yang sudah LUNAS tidak bisa ditagih lagi.
 */
route('POST', '/api/payments/midtrans/token', async ({ body, headers }) => {
  const cfg = midtransConfig();
  if (!cfg.ready) {
    return bad('Pembayaran otomatis belum aktif. Hubungi admin toko.', 503);
  }

  const orderId = String(body?.orderId || '').trim();
  if (!orderId) return bad('Nomor pesanan wajib dikirim.', 400);

  const order = await store.get('orders', orderId);
  if (!order) return bad('Pesanan tidak ditemukan.', 404);

  if (order.paymentStatus === 'LUNAS') {
    return bad('Pesanan ini sudah lunas.', 409, { alreadyPaid: true });
  }
  if (order.status === 'DIBATALKAN') {
    return bad('Pesanan ini sudah dibatalkan.', 409);
  }

  /*
   * ------------------------------------------------------------------
   * PAKAI ULANG TAGIHAN YANG MASIH HIDUP — JANGAN BUAT YANG BARU.
   * ------------------------------------------------------------------
   *
   * Skenario nyata yang ditanyakan pemilik toko: pembeli membuka popup,
   * melihat QRIS, lalu ada kebutuhan mendesak dan menutupnya. Beberapa jam
   * kemudian ia ingin membayar. Kalau setiap kali tombol ditekan kita
   * membuat tagihan baru, terjadi dua hal buruk:
   *
   *   1. Pembeli yang sudah menyimpan/memotret QRIS lama kehilangan
   *      rujukannya — begitu halaman dibuka lagi, yang tampil QR berbeda.
   *   2. Lebih berbahaya: QRIS lama TIDAK ikut mati saat tagihan baru
   *      dibuat. Dua tagihan bisa aktif bersamaan, dan pembeli bisa
   *      membayar DUA KALI untuk satu pesanan.
   *
   * Karena itu: selama tagihan sebelumnya masih berlaku di Midtrans,
   * kembalikan token yang sama. Tagihan baru hanya dibuat kalau yang lama
   * benar-benar sudah kedaluwarsa/dibatalkan.
   *
   * Pemeriksaan ke Midtrans sengaja tidak menggagalkan permintaan bila
   * jaringan bermasalah — dalam kasus itu kita lanjut membuat tagihan baru
   * seperti sebelumnya, karena pembeli tetap harus bisa membayar.
   */
  if (order.snapToken && order.midtransOrderId) {
    try {
      const cek = await fetchTransactionStatus(order.midtransOrderId, cfg);
      const status = String(cek.data?.transaction_status || '').toLowerCase();
      const masihHidup = cek.ok && (status === 'pending' || status === 'authorize');

      if (masihHidup) {
        await recordAudit(store, {
          action: 'pembayaran.tagihan-dipakai-ulang',
          actor: 'pembeli',
          ip: clientIp(headers) || 'unknown',
          target: order.orderId,
          detail: {
            midtransOrderId: order.midtransOrderId,
            status,
            keterangan:
              'Tagihan lama masih berlaku — token yang sama dikembalikan supaya pembeli tidak membayar dua kali.'
          }
        });

        return ok({
          token: order.snapToken,
          redirectUrl: order.snapRedirectUrl || null,
          clientKey: cfg.clientKey,
          isProduction: cfg.isProduction,
          snapScriptUrl: snapScriptUrl(cfg.isProduction),
          /* Ditandai supaya UI bisa memberi tahu: ini tagihan yang SAMA. */
          reused: true,
          expiresAt: cek.data?.expiry_time || null
        });
      }
    } catch (err) {
      console.warn('[midtrans] gagal memeriksa tagihan lama:', err.message);
    }
  }

  /*
   * Percobaan ke berapa untuk pesanan ini. Midtrans menolak order_id yang
   * sudah pernah dipakai, jadi pembeli yang membiarkan tagihan kedaluwarsa
   * lalu mencoba lagi harus mendapat order_id baru (-R2, -R3, dst).
   */
  const attempt = Number(order.paymentAttempt) || 0;
  const midtransOrderId = buildMidtransOrderId(order.orderId, attempt);

  /*
   * ------------------------------------------------------------------
   * MATIKAN TAGIHAN LAMA SEBELUM MEMBUAT YANG BARU.
   * ------------------------------------------------------------------
   *
   * Sampai di sini tagihan lama sudah diketahui TIDAK dipakai ulang (sudah
   * kedaluwarsa, dibatalkan, atau Midtrans tidak bisa dihubungi). Tetapi
   * "tidak dipakai ulang" belum berarti "mati": kalau pembeli menutup popup
   * lalu menekan "Coba Bayar Lagi" selagi tagihan pertama masih berjalan,
   * dua QRIS bisa aktif bersamaan. Pembeli yang memotret QR pertama, lalu
   * kembali ke halaman dan melihat QR kedua, bisa membayar DUA KALI untuk
   * satu pesanan — dan mengembalikan uangnya merepotkan semua pihak.
   *
   * Jadi tagihan lama dibatalkan lebih dulu. Kegagalannya TIDAK
   * menggagalkan pembuatan tagihan baru (Midtrans bisa menolak membatalkan
   * transaksi yang sudah settlement — dan itu justru kabar baik), tetapi
   * selalu dicatat supaya admin bisa memeriksanya.
   */
  if (order.midtransOrderId && order.midtransOrderId !== midtransOrderId) {
    try {
      const batal = await cancelTransaction(order.midtransOrderId, cfg);
      if (!batal.ok) {
        console.warn(
          `[midtrans] tagihan lama ${order.midtransOrderId} tidak bisa dibatalkan: HTTP ${batal.status}`
        );
        await recordAudit(store, {
          action: 'pembayaran.tagihan-lama-gagal-dibatalkan',
          actor: 'sistem',
          ip: 'midtrans',
          target: order.orderId,
          detail: {
            midtransOrderId: order.midtransOrderId,
            httpStatus: batal.status,
            alasan: batal.alasan || null,
            keterangan:
              'Tagihan lama mungkin masih bisa dibayar. Periksa dashboard Midtrans bila pembeli mengaku sudah membayar tagihan sebelumnya.'
          }
        });
      }
    } catch (err) {
      console.warn('[midtrans] gagal membatalkan tagihan lama:', err.message);
    }
  }

  /*
   * PENTING: `paymentAttempt` HARUS dinaikkan setiap kali token dibuat.
   *
   * Midtrans menolak `order_id` yang sudah pernah dipakai. Dulu nilai ini
   * tidak pernah bertambah, sehingga pembeli yang menutup popup lalu menekan
   * "Coba Bayar Lagi" akan ditolak dengan galat dari Midtrans — dan itu
   * terlihat persis seperti "tombol bayar rusak".
   */
  const attemptBerikut = attempt + 1;

  /*
   * finishUrl WAJIB menunjuk halaman yang benar-benar ada.
   *
   * Dulu diarahkan ke /pesanan/<id> — rute itu tidak pernah ada di aplikasi,
   * sehingga pembeli yang menutup popup Snap mendarat di halaman 404.
   * Sekarang: halaman lacak pesanan, dengan nomor pesanan sudah terisi.
   */
  const finishUrl = `${baseUrlDari(process.env, headers)}/lacak-pesanan?q=${encodeURIComponent(
    order.orderId
  )}`;

  let snap;
  try {
    snap = await createSnapToken({ ...order, midtransOrderId }, cfg, { finishUrl });
  } catch (err) {
    console.error('[midtrans] gagal membuat token:', err.message);
    return bad(err.message || 'Gagal membuat tagihan pembayaran.', 502);
  }

  const updated = {
    ...order,
    paymentAttempt: attemptBerikut,
    midtransOrderId: snap.midtransOrderId,
    snapToken: snap.token,
    snapRedirectUrl: snap.redirectUrl || null,
    paymentGateway: 'midtrans',
    updatedAt: nowIso(),
    timeline: [
      ...(order.timeline || []),
      {
        time: wibStamp(),
        status: `Tagihan pembayaran otomatis dibuat (percobaan ke-${attemptBerikut})`,
        location: 'Midtrans'
      }
    ]
  };
  await store.put('orders', updated);

  return ok({
    token: snap.token,
    redirectUrl: snap.redirectUrl,
    clientKey: cfg.clientKey,
    // isProduction dipakai frontend untuk memilih URL snap.js yang benar.
    isProduction: cfg.isProduction,
    snapScriptUrl: snapScriptUrl(cfg.isProduction)
  });
});

/**
 * Notifikasi pembayaran dari Midtrans (webhook).
 *
 * TIDAK memakai login admin — yang memanggil endpoint ini adalah server
 * Midtrans. Keamanannya bertumpu pada tanda tangan, ditambah empat pengaman:
 *
 *   1. Fail-closed kalau MIDTRANS_SERVER_KEY kosong (503).
 *   2. Tanda tangan SHA512 wajib cocok (403).
 *   3. Nominal wajib sama dengan total pesanan di database (tolak kalau beda).
 *   4. Idempoten: pesanan yang sudah LUNAS langsung dibalas 200 tanpa diubah,
 *      karena Midtrans mengirim ulang notifikasi yang gagal direspons.
 */
route('POST', '/api/payments/midtrans/notification', async ({ body }) => {
  const cfg = midtransConfig();
  if (!cfg.serverKey) return bad('Midtrans belum dikonfigurasi.', 503);

  const payload = body || {};

  /*
   * SETIAP notifikasi DICATAT — termasuk yang ditolak.
   *
   * Dulu hanya jalur "lunas" yang meninggalkan jejak. Akibatnya dua situasi
   * yang sangat berbeda terlihat sama saja dari dashboard (sama-sama diam):
   *
   *   1. Midtrans TIDAK mengirim notifikasi → tidak ada audit sama sekali.
   *   2. Midtrans mengirim, tetapi tanda tangannya ditolak (ServerKey kita
   *      beda dari akun tempat transaksi dibuat) → 403, tanpa jejak.
   *
   * Sekarang keduanya bisa dibedakan. Untuk kasus (2), `sidikKunci` mencatat
   * 8 karakter terakhir ServerKey kita sehingga admin bisa mencocokkannya
   * dengan dashboard Midtrans → Settings → Access Keys.
   *
   * Catatan privasi: nilai kunci TIDAK pernah dicatat, hanya ekornya.
   */
  const sidik = sidikKunci(cfg.signatureKey);
  const catatNotifikasi = (action, detail, status = 'ok') =>
    recordAudit(store, {
      action,
      actor: 'midtrans',
      ip: 'midtrans',
      target: String(payload.order_id || ''),
      status,
      detail: {
        ...detail,
        transaction_status: payload.transaction_status || null,
        status_code: payload.status_code || null,
        gross_amount: payload.gross_amount || null,
        transaction_id: payload.transaction_id || null,
        payment_type: payload.payment_type || null,
        /*
         * Nama field SENGAJA tidak mengandung "key"/"serverKey": `redact()` di
         * security.js menyensor setiap field yang namanya cocok
         * /password|token|secret|key/i, sehingga nilai ini akan berubah jadi
         * "[disembunyikan]" dan sidik kunci justru hilang.
         *
         * Yang dicatat hanya 8 karakter TERAKHIR (lihat sidikKunci) — cukup
         * untuk dicocokkan dengan dashboard Midtrans, tidak cukup untuk
         * menebak kunci.
         */
        sidikEkor: sidik?.ekor || null,
        sidikPanjang: sidik?.panjang || null,
        /*
         * Kunci mana yang dipakai memverifikasi. Bila "server-key", berarti
         * MIDTRANS_SIGNATURE_SECRET_KEY masih kosong dan kita memakai
         * perilaku lama — petunjuk pertama yang harus diperiksa.
         */
        kunciVerifikasi: cfg.signatureKeyTerpisah ? 'signature-secret-key' : 'server-key'
      }
    });

  /*
   * KUNCI UNTUK MEMVERIFIKASI ≠ KUNCI UNTUK API.
   *
   * Sejak 28 Oktober 2026 Midtrans menghitung signature_key dengan Signature
   * Secret Key, bukan Server Key. Memakai Server Key untuk verifikasi adalah
   * penyebab 8 notifikasi toko ini ditolak padahal pembayarannya sah.
   *
   * Kandidat diuji berurutan supaya tetap aman dalam dua keadaan:
   *   - Signature Secret Key belum diisi  → jatuh ke Server Key (perilaku lama)
   *   - baru saja "Regenerate"            → kunci lama masih diterima sebentar
   * Kandidat tidak pernah dikirim ke UI atau dicatat; hanya statusnya.
   */
  const kandidatKunci = [cfg.signatureKey, cfg.signatureKeyLama, cfg.serverKey]
    .map((k) => String(k || '').trim())
    .filter((k, i, arr) => Boolean(k) && arr.indexOf(k) === i);

  if (!verifySignature(payload, kandidatKunci)) {
    /*
     * DIAGNOSTIK TANDA TANGAN — urutan "kenapa cocok/tidak cocok".
     *
     * Saat 5 notifikasi sungguhan ditolak, tidak ada cara membedakan:
     *   - kunci server salah akun,
     *   - ada spasi/baris baru di nilai env,
     *   - Midtrans mengirim `gross_amount` dengan format berbeda (mis. "8000"
     *     vs "8000.00"), yang membuat SHA512 tidak pernah cocok.
     *
     * Jejak ini menjawabnya tanpa perlu menebak, dan TIDAK membocorkan kunci:
     * hanya panjang, ekor, keberadaan spasi, dan bentuk gross_amount.
     */
    const formatAmount = String(payload.gross_amount ?? '');
    const cocokTanpaDesimal = /^\d+$/.test(formatAmount);
    await catatNotifikasi(
      'pembayaran.notifikasi-ditolak-signature',
      {
        alasan:
          'Tanda tangan tidak cocok. ServerKey di server berbeda dari kunci akun Midtrans tempat transaksi ini dibuat, ATAU notifikasi bukan dari Midtrans.',
        kemungkinan:
          'Buka dashboard Midtrans → Settings → Access Keys, bandingkan 8 karakter terakhir ServerKey dengan nilai di atas. Bila berbeda, MIDTRANS_SERVER_KEY di Vercel harus diganti lalu Redeploy.',
        /* Bentuk nilai yang dipakai menyusun tanda tangan. */
        grossAmountDiterima: formatAmount || null,
        grossAmountTanpaDesimal: cocokTanpaDesimal,
        signatureDiterima: String(payload.signature_key || '').length || null,
        serverKeyAdaSpasi: String(cfg.serverKey || '') !== String(cfg.serverKey || '').trim()
      },
      'fail'
    );
    console.warn(
      `[midtrans] notifikasi dengan tanda tangan tidak sah ditolak (order ${payload.order_id || '?'}, ServerKey berakhiran ${sidik?.ekor || '?'})`
    );
    return bad('Tanda tangan notifikasi tidak sah.', 403);
  }

  const midtransOrderId = String(payload.order_id || '');
  const order = await findOrderByMidtransId(midtransOrderId);
  if (!order) {
    // 200 supaya Midtrans berhenti mengirim ulang pesanan yang tidak kita kenal.
    console.warn('[midtrans] notifikasi untuk pesanan tak dikenal:', midtransOrderId);
    await catatNotifikasi('pembayaran.notifikasi-tak-dikenal', {
      alasan: 'Tanda tangan sah, tetapi nomor pesanan ini tidak ada di database kita.',
      kemungkinan: 'Notifikasi dari aplikasi/akun Midtrans lain, atau pesanan sudah dihapus admin.'
    }, 'warn');
    return ok({ ignored: true, reason: 'order-tidak-dikenal' });
  }

  const gross = grossAmountToRupiah(payload.gross_amount);
  const expected = Math.round(Number(order.totalAmount) || 0);
  if (!Number.isFinite(gross) || gross !== expected) {
    /*
     * Tanda tangan sah hanya berarti "pesan ini dari Midtrans", bukan
     * "nominalnya benar". Tanpa pemeriksaan ini, transaksi Rp 1.000 yang sah
     * bisa melunaskan pesanan Rp 300.000.
     */
    console.error(
      `[midtrans] nominal tidak cocok untuk ${order.orderId}: dibayar ${gross}, seharusnya ${expected}`
    );
    await catatNotifikasi(
      'pembayaran.nominal-tidak-cocok',
      {
        alasan: 'Notifikasi sah, tetapi nominal yang dibayar berbeda dari total pesanan kita — pesanan TIDAK dilunaskan.',
        dibayar: gross,
        seharusnya: expected
      },
      'fail'
    );
    return bad('Nominal pembayaran tidak cocok.', 400);
  }

  const keputusan = mapTransactionStatus(payload);

  if (keputusan === 'LUNAS') {
    const sudahLunas = order.paymentStatus === 'LUNAS';
    const paid = await markOrderPaid(order, {
      via: 'midtrans',
      actor: `midtrans:${payload.payment_type || 'unknown'}`,
      verifiedAmount: gross
    });

    if (!paid.ok) {
      console.warn('[midtrans] tidak bisa melunaskan:', paid.reason);
      return ok({ ignored: true, reason: paid.reason });
    }

    const final = {
      ...paid.order,
      paymentGateway: 'midtrans',
      midtransOrderId,
      midtransTransactionId: payload.transaction_id || null,
      midtransPaymentType: payload.payment_type || null,
      midtransTransactionStatus: payload.transaction_status || null,
      midtransSettledAt: payload.settlement_time || null
    };
    await store.put('orders', final);

    // Notifikasi Telegram hanya kalau status BENAR-BENAR berubah, supaya
    // notifikasi ganda dari Midtrans tidak membanjiri Telegram admin.
    if (paid.changed) {
      const settings = await readSettings();
      if (telegramConfig(settings).notifyPaid !== false) {
        const hasil = await notifySafe(settings, templatePaid(final));
        await catatStatusNotifikasi(hasil, 'pembayaran-lunas');
      }
      await catatNotifikasi('pembayaran.lunas-otomatis', {
        via: payload.payment_type || 'midtrans',
        nominal: gross,
        keterangan: 'Notifikasi Midtrans diterima & verified — webhook berjalan normal.'
      });
    }

    /*
     * Notifikasi ulang untuk pesanan yang SUDAH lunas tetap dicatat. Ini bukti
     * paling kuat bahwa webhook berfungsi — tanpa ini, pembayaran yang datang
     * dua kali terlihat sama seperti webhook yang mati.
     */
    if (!paid.changed) {
      await catatNotifikasi('pembayaran.notifikasi-ulang', {
        keterangan: 'Notifikasi diterima, pesanan sudah LUNAS sebelumnya — tidak ada perubahan (idempoten).',
        sudahLunas: sudahLunas
      });
    }

    return ok({ ok: true, orderId: order.orderId, changed: Boolean(paid.changed) });
  }

  if (keputusan === 'BATAL') {
    if (order.status === 'DIBATALKAN') return ok({ ok: true, changed: false });

    const cancelled = {
      ...order,
      status: 'DIBATALKAN',
      paymentStatus: order.paymentStatus === 'LUNAS' ? order.paymentStatus : 'DIBATALKAN',
      midtransTransactionStatus: payload.transaction_status || null,
      updatedAt: nowIso(),
      timeline: [
        ...(order.timeline || []),
        {
          time: wibStamp(),
          status: `Pembayaran ${
            payload.transaction_status === 'expire' ? 'kedaluwarsa' : 'dibatalkan'
          } di Midtrans`,
          location: 'Midtrans (webhook terverifikasi)'
        }
      ]
    };

    /*
     * Kembalikan stok. Tanpa ini, stok menyusut sendiri setiap ada pembeli
     * yang membuka halaman bayar lalu meninggalkannya — dan itu terjadi
     * jauh lebih sering daripada pembelian sungguhan.
     */
    if (order.stockAppliedAt && !order.stockReleasedAt) {
      try {
        const movement = await applyStockMovement(store, order.items, { direction: -1 });
        if (movement.changed) {
          cancelled.stockReleasedAt = nowIso();
          cancelled.timeline.push({
            time: wibStamp(),
            status: `Stok dikembalikan otomatis (${movement.changed} produk)`,
            location: 'Sistem Cilegon Enggih'
          });
        }
      } catch (err) {
        console.error('[stock] gagal mengembalikan stok (midtrans):', err.message);
      }
    }

    await store.put('orders', cancelled);
    await catatNotifikasi('pembayaran.notifikasi-batal', {
      keterangan: 'Notifikasi Midtrans diterima — tagihan kedaluwarsa/dibatalkan, stok dikembalikan.',
      statusPesanan: 'DIBATALKAN'
    });
    return ok({ ok: true, orderId: order.orderId, status: 'DIBATALKAN' });
  }

  if (keputusan === 'TINJAU') {
    /*
     * Kartu yang ditandai berisiko (fraud_status = challenge). JANGAN
     * dilunaskan otomatis: barang bisa dikirim tanpa uang benar-benar masuk.
     * Cukup catat supaya admin melihatnya di dashboard.
     */
    const flagged = {
      ...order,
      midtransTransactionStatus: payload.transaction_status || null,
      midtransFraudStatus: payload.fraud_status || null,
      needsManualReview: true,
      updatedAt: nowIso(),
      timeline: [
        ...(order.timeline || []),
        {
          time: wibStamp(),
          status: 'Pembayaran ditandai berisiko oleh Midtrans — perlu ditinjau manual',
          location: 'Midtrans (webhook terverifikasi)'
        }
      ]
    };
    await store.put('orders', flagged);
    await catatNotifikasi('pembayaran.perlu-tinjau', {
      alasan: 'Kartu ditandai berisiko (fraud_status challenge) — TIDAK dilunaskan otomatis.',
      fraud_status: payload.fraud_status || null
    }, 'warn');
    return ok({ ok: true, needReview: true });
  }

  /*
   * 'TUNGGU' — belum lunas. Tidak ada yang perlu diubah, TETAPI tetap dicatat:
   * inilah bukti bahwa notifikasi Midtrans benar-benar sampai ke server kita.
   * Tanpa catatan ini, "webhook mati" dan "pembeli belum bayar" terlihat sama.
   */
  await catatNotifikasi('pembayaran.notifikasi-pending', {
    keterangan: 'Notifikasi Midtrans diterima, status masih menunggu pembayaran.'
  });
  return ok({ ok: true, pending: true });
});

/**
 * Cek status langsung ke Midtrans.
 *
 * Jaring pengaman kalau webhook telat atau gagal masuk. Tanpa ini, pembeli
 * yang sudah membayar bisa melihat pesanannya masih "menunggu pembayaran"
 * sampai berjam-jam.
 */
route('GET', '/api/payments/midtrans/status/:orderId', async ({ params, query }) => {
  const cfg = midtransConfig();
  if (!cfg.ready) return bad('Midtrans belum dikonfigurasi.', 503);

  const order = await store.get('orders', String(params.orderId || ''));
  if (!order) return bad('Pesanan tidak ditemukan.', 404);

  /*
   * OTORISASI — dua faktor, sama seperti halaman lacak pesanan.
   *
   * Nomor pesanan saja TIDAK cukup. Endpoint ini bukan sekadar membaca:
   * ia bisa MELUNASKAN pesanan dan memicu notifikasi Telegram. Tanpa
   * pemeriksaan, siapa pun yang bisa menebak/melihat nomor pesanan
   * (formatnya berurutan: CE-YYYYMMDD-NNN) dapat memicu aksi pada pesanan
   * orang lain — dan Midtrans bisa dibanjiri permintaan cek status.
   *
   * Bukti kedua: 4 digit terakhir nomor WhatsApp pemesan, yang hanya
   * diketahui pembeli dan admin.
   */
  const last4 = String(query?.phone || '').replace(/\D/g, '');
  const phoneDigits = String(order.customerPhone || '').replace(/\D/g, '');
  if (last4.length !== 4 || !phoneDigits.endsWith(last4)) {
    return bad('Nomor pesanan dan 4 digit terakhir No. WhatsApp tidak cocok.', 403);
  }

  if (!order.midtransOrderId) {
    return ok({ orderId: order.orderId, paymentStatus: order.paymentStatus, gateway: null });
  }

  /*
   * JARING PENGAMAN WEBHOOK — sekaligus penambal, bukan sekadar pelapor.
   *
   * Skenario yang ditangani: webhook gagal masuk (Midtrans gangguan, deploy
   * baru sedang berjalan, galat sesaat di serverless). Pembeli sudah membayar
   * tetapi pesanan tetap "menunggu pembayaran", dan pembeli akan menghubungi
   * admin — persis beban manual yang ingin dihilangkan.
   *
   * Kenapa di sini, bukan lewat cron: plan Vercel Hobby hanya mengizinkan
   * 2 cron dan minimal sekali sehari (cron tiap 15 menit membuat deploy
   * GAGAL). Endpoint ini dipanggil justru saat paling dibutuhkan — ketika
   * pembeli menekan "Saya Sudah Bayar — Periksa Status".
   *
   * Kalau Midtrans menyatakan settlement, pesanan DILUNASKAN di sini juga.
   * Tidak ada cron yang perlu diandalkan.
   */
  try {
    const res = await fetchTransactionStatus(order.midtransOrderId, cfg);
    const keputusan = res.ok ? mapTransactionStatus(res.data) : 'TUNGGU';

    /*
     * GAGAL CEK STATUS HARUS DIKATAKAN + DICATAT.
     *
     * Dulu kegagalan hanya menghasilkan `ok:false` di JSON, tanpa audit dan
     * tanpa sebab. Kasus nyata: host Core API salah (app.midtrans.com, selalu
     * 404) sehingga pembeli yang SUDAH membayar tidak pernah dilunaskan dan
     * tidak ada satu pun jejak yang bisa diperiksa admin.
     *
     * Yang dikembalikan adalah sebabnya (host + HTTP + pesan Midtrans), dan
     * kegagalannya masuk audit supaya kelihatan di riwayat.
     */
    if (!res.ok) {
      console.warn(
        `[midtrans] cek status ${order.midtransOrderId} gagal: HTTP ${res.status} — ${res.alasan}`
      );
      await recordAudit(store, {
        action: 'pembayaran.status-check-gagal',
        actor: 'midtrans',
        ip: 'midtrans',
        target: order.orderId,
        detail: {
          httpStatus: res.status,
          apiBase: cfg.apiBase,
          alasan: res.alasan,
          status_message: res.data?.status_message || null
        }
      });
    }

    if (keputusan === 'LUNAS' && order.paymentStatus !== 'LUNAS') {
      const gross = grossAmountToRupiah(res.data.gross_amount);
      const seharusnya = Math.round(Number(order.totalAmount) || 0);

      if (gross !== seharusnya) {
        /*
         * Tanda tangan dan status sudah sah, tetapi nominalnya beda. Jangan
         * pernah melunaskan: ini persis kasus "pesanan Rp 300.000 dibayar
         * Rp 1.000" yang harus ditolak.
         */
        console.error(
          `[midtrans] status LUNAS tapi nominal tidak cocok untuk ${order.orderId}: ${gross} vs ${seharusnya}`
        );
        await recordAudit(store, {
          action: 'pembayaran.nominal-tidak-cocok',
          actor: 'midtrans',
          ip: 'midtrans',
          target: order.orderId,
          detail: { dibayar: gross, seharusnya }
        });
        return ok({
          orderId: order.orderId,
          paymentStatus: order.paymentStatus,
          nominalTidakCocok: true,
          gateway: { ok: res.ok, transactionStatus: res.data?.transaction_status || null }
        });
      }

      const paid = await markOrderPaid(order, {
        via: 'midtrans',
        actor: 'midtrans:status-check',
        verifiedAmount: gross
      });

      if (paid.ok && paid.changed) {
        const final = {
          ...paid.order,
          midtransTransactionStatus: res.data?.transaction_status || null,
          midtransPaymentType: res.data?.payment_type || null
        };
        await store.put('orders', final);

        const settings = await readSettings();
        if (telegramConfig(settings).notifyPaid !== false) {
          await notifySafe(settings, templatePaid(final));
        }
        await recordAudit(store, {
          action: 'pembayaran.lunas-via-status-check',
          actor: 'midtrans',
          ip: 'midtrans',
          target: order.orderId,
          detail: { nominal: gross }
        });

        return ok({
          orderId: order.orderId,
          paymentStatus: 'LUNAS',
          gateway: {
            ok: res.ok,
            httpStatus: res.status,
            alasan: null,
            transactionStatus: res.data?.transaction_status || null,
            fraudStatus: res.data?.fraud_status || null,
            paymentType: res.data?.payment_type || null
          }
        });
      }
    }

    /*
     * Tagihan yang sudah kedaluwarsa/dibatalkan harus DIKATAKAN ke pembeli.
     *
     * Tanpa `kedaluwarsa`, halaman hanya menampilkan "belum lunas" selamanya,
     * dan pembeli menyimpulkan tombolnya rusak — padahal tagihannya memang
     * sudah mati. Tombol "bayar lagi" tetap tersedia (token baru dibuat
     * dengan order_id -R2).
     */
    const trx = String(res.data?.transaction_status || '');
    const kedaluwarsa =
      res.ok && ['expire', 'cancel', 'deny', 'failure'].includes(trx)
        ? trx === 'expire'
          ? 'kedaluwarsa'
          : 'dibatalkan-midtrans'
        : null;

    /*
     * UJI TANDA TANGAN MANDIRI — jawaban pasti, bukan tebakan.
     *
     * Masalah yang diselesaikan: 8 notifikasi pembayaran ditolak karena
     * "tanda tangan tidak cocok", dan sampai sekarang tidak ada cara
     * memastikan apakah penyebabnya kunci yang beda, spasi tak terlihat di
     * nilai env, atau notifikasi yang bukan dari Midtrans. Admin dan pembeli
     * hanya bisa menebak, sementara uangnya sudah masuk.
     *
     * Setiap respons Core API Midtrans ikut membawa `signature_key` yang
     * dihitung MEMAKAI SERVER KEY AKUN PEMILIK TRANSAKSI. Jadi bila kita
     * menghitung ulang tanda tangan itu dengan kunci yang kita punya dan
     * hasilnya cocok, kunci kita PASTI benar untuk akun ini — tanpa perlu
     * menunggu satu pun notifikasi. Kalau tidak cocok, kuncinya memang beda,
     * dan itu bisa dikatakan sekarang juga.
     *
     * Hanya statusnya yang dilaporkan; tidak ada nilai kunci yang dikirim.
     */
    const kandidatKunciUji = [cfg.signatureKey, cfg.signatureKeyLama, cfg.serverKey]
      .map((k) => String(k || '').trim())
      .filter((k, i, arr) => Boolean(k) && arr.indexOf(k) === i);

    const signatureUji = (() => {
      const data = res.data || {};
      if (!data.signature_key) return { tersedia: false, cocok: null };
      if (!data.order_id || !data.status_code || data.gross_amount == null) {
        return { tersedia: false, cocok: null };
      }
      return {
        tersedia: true,
        cocok: verifySignature(data, kandidatKunciUji),
        ekor: sidikKunci(cfg.signatureKey)?.ekor || null
      };
    })();

    /*
     * Dicatat HANYA saat hasilnya "tidak cocok". Kalau kunci benar (kasus
     * normal), tidak ada gunanya memenuhi audit dengan catatan sukses setiap
     * kali pembeli menekan "Periksa Status".
     */
    if (signatureUji.tersedia && signatureUji.cocok === false) {
      await recordAudit(store, {
        action: 'pembayaran.kunci-tidak-cocok-dengan-akun',
        actor: 'midtrans',
        ip: 'midtrans',
        target: order.orderId,
        status: 'fail',
        detail: {
          alasan:
            'ServerKey di server BUKAN kunci akun Midtrans tempat transaksi ini dibuat: Midtrans mengirim tanda tangan yang dihitung dengan kunci akun tersebut, dan kunci kita tidak menghasilkan nilai yang sama.',
          tindakan:
            'Buka dashboard Midtrans → Settings → Access Keys, salin ServerKey untuk environment PRODUKSI, ganti MIDTRANS_SERVER_KEY di hosting, lalu REDEPLOY. Setelah itu tekan "Periksa Status" lagi — hasilnya akan berubah tanpa perlu menunggu notifikasi.',
          sidikEkor: signatureUji.ekor,
          kunciCocok: false
        }
      });
    }

    return ok({
      orderId: order.orderId,
      paymentStatus: order.paymentStatus,
      kedaluwarsa,
      /*
       * `kunciCocok` diteruskan ke UI supaya pembeli/admin melihat sebabnya,
       * bukan sekadar "belum lunas" yang tidak menjelaskan apa pun. Nilai
       * `null` berarti Midtrans tidak mengirim tanda tangan (tidak bisa
       * disimpulkan) — jangan pernah dianggap gagal.
       */
      kunciCocok: signatureUji.tersedia ? signatureUji.cocok : null,
      gateway: {
        ok: res.ok,
        httpStatus: res.status,
        alasan: res.alasan || null,
        transactionStatus: trx || null,
        fraudStatus: res.data?.fraud_status || null,
        paymentType: res.data?.payment_type || null
      }
    });
  } catch (err) {
    /*
     * Galat jaringan/DNS. Sebabnya ikut dikirim supaya tidak jadi tebakan:
     * "tidak bisa menghubungi" saja tidak memberi tahu apakah masalahnya
     * kunci, host, atau Midtrans yang sedang down.
     */
    console.error('[midtrans] gagal cek status:', err.message);
    return bad(`Tidak bisa menghubungi Midtrans saat ini (${err.message}).`, 502);
  }
});

/**
 * POST /api/payments/midtrans/cancel
 *
 * Pembeli membatalkan pesanannya sendiri selama BELUM dibayar.
 *
 * KENAPA ADA
 * Tokopedia dan Shopee selalu memberi jalan keluar "Batalkan Pesanan". Tanpa
 * itu, pembeli yang berubah pikiran meninggalkan pesanan menggantung, dan
 * stoknya tertahan sampai admin membersihkan manual — pekerjaan yang justru
 * ingin dihilangkan.
 *
 * PENGAMAN
 *  - hanya boleh kalau BELUM lunas; pesanan lunas harus lewat admin (refund)
 *  - wajib 4 digit terakhir nomor WhatsApp, sama seperti cek status
 *  - stok dikembalikan lewat jalur yang sama dengan pembatalan manual
 */
route('POST', '/api/payments/midtrans/cancel', async ({ body }) => {
  const orderId = String(body?.orderId || '').trim();
  if (!orderId) return bad('Nomor pesanan wajib dikirim.', 400);

  const order = await store.get('orders', orderId);
  if (!order) return bad('Pesanan tidak ditemukan.', 404);

  const last4 = String(body?.phone || '').replace(/\D/g, '');
  const phoneDigits = String(order.customerPhone || '').replace(/\D/g, '');
  if (last4.length !== 4 || !phoneDigits.endsWith(last4)) {
    return bad('Nomor pesanan dan 4 digit terakhir No. WhatsApp tidak cocok.', 403);
  }

  if (order.paymentStatus === 'LUNAS') {
    return bad(
      'Pesanan ini sudah lunas, jadi tidak bisa dibatalkan sendiri. Hubungi admin untuk pengembalian dana.',
      409
    );
  }
  if (order.status === 'DIBATALKAN') {
    return ok({ ok: true, changed: false, order });
  }
  if (order.status === 'DIKIRIM' || order.status === 'SELESAI') {
    return bad('Pesanan sudah dikirim, jadi tidak bisa dibatalkan.', 409);
  }

  /*
   * Batalkan DULU di Midtrans, baru di database kita.
   *
   * Kalau urutannya dibalik dan pembatalan Midtrans gagal, akan ada tagihan
   * yang masih hidup untuk pesanan yang sudah kita tutup: pembeli memindai
   * QRIS lama, uang masuk, dan admin harus mengembalikannya manual.
   *
   * Kalau Midtrans menolak karena transaksi sudah tidak aktif (expire/cancel),
   * itu hasil yang kita inginkan juga, jadi pembatalan tetap dilanjutkan.
   */
  const cfg = midtransConfig();
  let catatanGateway = null;
  if (order.midtransOrderId && cfg.ready) {
    try {
      const batal = await cancelTransaction(order.midtransOrderId, cfg);
      catatanGateway = batal.alasan;
      if (!batal.ok) {
        console.error(
          `[midtrans] gagal membatalkan transaksi ${order.midtransOrderId}: HTTP ${batal.status}`
        );
        return bad(
          `Midtrans belum bisa membatalkan tagihan ini (HTTP ${batal.status}). Coba lagi sebentar, atau biarkan tagihan kedaluwarsa sendiri (stok tetap aman).`,
          502
        );
      }
    } catch (err) {
      console.error('[midtrans] galat saat membatalkan transaksi:', err.message);
      return bad('Midtrans belum bisa dihubungi untuk membatalkan tagihan. Coba lagi.', 502);
    }
  }

  const cancelled = {
    ...order,
    status: 'DIBATALKAN',
    paymentStatus: 'DIBATALKAN',
    midtransTransactionStatus: order.midtransTransactionStatus || 'cancel',
    updatedAt: nowIso(),
    timeline: [
      ...(order.timeline || []),
      {
        time: wibStamp(),
        status: 'Pesanan dibatalkan oleh pembeli (belum dibayar)',
        location: 'Halaman pembayaran'
      },
      ...(order.midtransOrderId
        ? [
            {
              time: wibStamp(),
              status: 'Tagihan di Midtrans ikut dibatalkan — kode pembayaran lama tidak bisa dipakai lagi',
              location: 'Midtrans'
            }
          ]
        : [])
    ]
  };

  /* Kembalikan stok — sama seperti pembatalan manual & kedaluwarsa Midtrans. */
  if (order.stockAppliedAt && !order.stockReleasedAt) {
    try {
      const movement = await applyStockMovement(store, order.items, { direction: -1 });
      if (movement.changed) {
        cancelled.stockReleasedAt = nowIso();
        cancelled.timeline.push({
          time: wibStamp(),
          status: `Stok dikembalikan otomatis (${movement.changed} produk)`,
          location: 'Sistem Cilegon Enggih'
        });
      }
    } catch (err) {
      console.error('[stock] gagal mengembalikan stok (batal pembeli):', err.message);
    }
  }

  await store.put('orders', cancelled);
  await recordAudit(store, {
    action: 'order.dibatalkan-pembeli',
    actor: 'pembeli',
    ip: 'web',
    target: order.orderId,
    detail: { dari: order.status, ke: 'DIBATALKAN', midtrans: catatanGateway }
  });

  return ok({ ok: true, changed: true, order: cancelled });
});

/* ───────────────────────── AKHIR MIDTRANS ───────────────────────── */

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
    /*
     * Tombol "✅ Verifikasi LUNAS" disertakan supaya admin bisa memverifikasi
     * langsung dari Telegram, tanpa membuka dashboard — inilah yang memangkas
     * penantian pembeli saat admin sedang di luar.
     */
    const hasil = await notifySafe(proofSettings, templatePaymentProof(updated), {
      replyMarkup: paymentProofKeyboard(updated)
    });
    await catatStatusNotifikasi(hasil, 'bukti-transfer');
    if (!hasil.sent) {
      console.error(
        `[telegram] notifikasi bukti transfer GAGAL untuk ${updated.orderId}: ${hasil.reason}`
      );
    }
  }

  return ok({ order: decorateOrder(updated) });
});

/* ---------------- Telegram: verifikasi sekali-klik ---------------- */

/**
 * WEBHOOK TELEGRAM — admin menekan tombol "✅ Verifikasi LUNAS" di Telegram.
 *
 * KENAPA ADA ENDPOINT PUBLIK
 * Telegram memanggil URL ini sendiri, jadi tidak bisa memakai sesi admin.
 * Keamanannya bertumpuk:
 *   1. Header `X-Telegram-Bot-Api-Secret-Token` harus sama dengan secret yang
 *      kita daftarkan ke Telegram (setWebhook). Tanpa secret, ditolak.
 *   2. Tombol hanya memuat nomor pesanan — tidak ada nominal atau data pembeli
 *      yang bisa dipalsukan dari luar.
 *   3. Hanya chat ID admin yang diizinkan; chat lain diabaikan.
 *   4. Setiap tindakan dicatat di audit.
 *
 * Bila TELEGRAM_WEBHOOK_SECRET belum diset, endpoint menolak semua permintaan
 * (fail-closed) supaya tidak ada celah default terbuka.
 */
route('POST', '/api/telegram/webhook', async ({ headers, body }) => {
  const expected = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!expected) return bad('Webhook Telegram belum dikonfigurasi.', 503);
  const got = String(headers['x-telegram-bot-api-secret-token'] || '').trim();
  if (got !== expected) return bad('Token webhook tidak sah.', 401);

  const settings = await readSettings();
  const cfg = telegramConfig(settings);
  if (!cfg.botToken) return bad('Bot Telegram belum dikonfigurasi.', 503);

  /* --- Ketukan tombol --- */
  const cq = body?.callback_query;
  if (cq) {
    const fromChat = String(cq.message?.chat?.id ?? '');
    if (fromChat !== String(cfg.chatId)) {
      await answerCallbackQuery(cfg.botToken, cq.id, 'Chat ini tidak berwenang.');
      return ok({ ignored: true, reason: 'chat-bukan-admin' });
    }

    const data = String(cq.data || '');
    const sep = data.indexOf(':');
    const aksi = sep > 0 ? data.slice(0, sep) : data;
    const orderId = sep > 0 ? data.slice(sep + 1) : '';
    if (!orderId || (aksi !== 'paid' && aksi !== 'void')) {
      await answerCallbackQuery(cfg.botToken, cq.id, 'Perintah tidak dikenal.');
      return ok({ ignored: true, reason: 'aksi-tidak-dikenal' });
    }

    const order = await store.get('orders', orderId);
    if (!order) {
      await answerCallbackQuery(cfg.botToken, cq.id, 'Pesanan tidak ditemukan.');
      return ok({ ignored: true, reason: 'order-tidak-ada' });
    }

    const actor = `telegram:${cq.from?.username || cq.from?.id || 'admin'}`;

    if (aksi === 'void') {
      if (order.status === 'DIBATALKAN') {
        await answerCallbackQuery(cfg.botToken, cq.id, 'Sudah dibatalkan sebelumnya.');
        return ok({ changed: false });
      }
      const cancelled = {
        ...order,
        status: 'DIBATALKAN',
        ...(order.paymentStatus !== 'LUNAS' ? { paymentStatus: 'DIBATALKAN' } : {}),
        updatedAt: nowIso(),
        timeline: [
          ...(order.timeline || []),
          {
            time: wibStamp(),
            status: `Pesanan dibatalkan via Telegram oleh ${actor}`,
            location: 'Bot Telegram Admin'
          }
        ]
      };
      if (order.stockAppliedAt && !order.stockReleasedAt) {
        try {
          const movement = await applyStockMovement(store, order.items, { direction: -1 });
          if (movement.changed) {
            cancelled.stockReleasedAt = nowIso();
            cancelled.timeline.push({
              time: wibStamp(),
              status: `Stok dikembalikan otomatis (${movement.changed} produk)`,
              location: 'Sistem Cilegon Enggih'
            });
          }
        } catch (err) {
          console.error('[stock] gagal mengembalikan stok (telegram):', err.message);
        }
      }
      await store.put('orders', cancelled);
      await recordAudit(store, {
        action: 'order.dibatalkan-via-telegram',
        actor,
        ip: 'telegram',
        target: order.orderId,
        detail: { dari: order.status, ke: 'DIBATALKAN' }
      });
      await answerCallbackQuery(cfg.botToken, cq.id, 'Pesanan dibatalkan.');
      await editTelegramMessage(
        cfg.botToken,
        cq.message?.chat?.id,
        cq.message?.message_id,
        `${cq.message?.text || ''}\n\n🚫 <b>DIBATALKAN</b> ${esc(orderId)} oleh ${esc(actor)}`
      );
      return ok({ changed: true, status: 'DIBATALKAN' });
    }

    const result = await markOrderPaid(order, { via: 'telegram', actor });
    if (!result.ok) {
      await answerCallbackQuery(cfg.botToken, cq.id, result.reason || 'Gagal.');
      return ok({ changed: false, reason: result.reason });
    }
    if (!result.changed) {
      await answerCallbackQuery(cfg.botToken, cq.id, 'Pesanan sudah LUNAS.');
      return ok({ changed: false });
    }

    await recordAudit(store, {
      action: 'pembayaran.diverifikasi-via-telegram',
      actor,
      ip: 'telegram',
      target: order.orderId,
      detail: { total: order.totalAmount, status: result.order.status }
    });

    await answerCallbackQuery(cfg.botToken, cq.id, 'Pembayaran ditandai LUNAS.');
    await editTelegramMessage(
      cfg.botToken,
      cq.message?.chat?.id,
      cq.message?.message_id,
      `${cq.message?.text || ''}\n\n✅ <b>LUNAS</b> diverifikasi oleh ${esc(actor)}`
    );

    if (cfg.notifyPaid !== false) {
      await notifySafe(settings, templatePaid(result.order));
    }
    return ok({ changed: true, status: 'LUNAS' });
  }

  /* --- /start: jelaskan cara pakai --- */
  const msg = body?.message;
  if (msg && String(msg.text || '').startsWith('/start')) {
    if (String(msg.chat?.id ?? '') === String(cfg.chatId)) {
      await notifySafe(
        settings,
        '🤖 <b>Bot Cilegon Enggih aktif</b>\n\nSaat ada bukti transfer masuk, bot mengirim pesan berisi tombol <b>✅ Verifikasi LUNAS</b>. Tekan tombol itu — pembayaran langsung diverifikasi tanpa membuka dashboard.'
      );
    }
    return ok({ welcomed: true });
  }

  return ok({ ignored: true });
});

/**
 * KARTU SHARE DINAMIS — untuk produk yang ditambahkan admin.
 *
 * KENAPA ADA
 * Halaman share statis (`public/og/*.html`) dibuat saat build dari katalog.
 * Produk yang ditambahkan setelah deploy tidak punya halaman itu, sehingga
 * crawler WhatsApp/Facebook menerima index.html dan menampilkan kartu beranda.
 * Endpoint ini membangun kartu dari database, jadi produk baru langsung punya
 * pratinjau yang benar.
 *
 * `vercel.json` hanya mengarahkan crawler ke sini untuk produk yang TIDAK
 * punya berkas statis — produk lama tetap dilayani file statis (nol invocation).
 */
route('GET', '/api/share/produk/:slug', async ({ params }) => {
  const slug = String(params.slug || '').trim().toLowerCase();
  if (!slug) return bad('Slug produk wajib diisi.', 400);

  const products = await readProducts();
  const product = products.find(
    (p) => String(p.slug || '').toLowerCase() === slug && p.active !== false
  );
  if (!product) return bad('Produk tidak ditemukan.', 404);

  const base = String(process.env.PUBLIC_BASE_URL || 'https://cilegon-enggih.vercel.app').replace(
    /\/+$/,
    ''
  );
  const settings = await readSettings().catch(() => ({}));

  /*
   * Pilih gambar: kartu OG lebih dulu, lalu foto produk (bila ukurannya wajar),
   * terakhir kartu toko. Fungsi ini sengaja TIDAK melakukan request ke internet
   * — cukup memeriksa ketersediaan berkas lokal, karena kartu OG dibuat saat
   * build dan ada di repo.
   */
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  /*
   * PRIORITAS GAMBAR (diperbaiki): foto utama → endpoint normalisasi.
   *
   * Versi lama mendahulukan kartu templat `/og/<slug>.jpg`, sehingga produk
   * yang fotonya diganti admin tetap tampil dengan gambar LAMA. Sekarang foto
   * utama produk yang menentukan; kartu templat hanya cadangan bila produk
   * tidak punya foto sama sekali. Endpoint `/api/og-image/<slug>.jpg`
   * menormalkan foto ke 1200x630 + <300 KB supaya crawler mau menampilkannya.
   */
  const adaFoto = Boolean(String(product.image || '').trim());
  const pilihGambar = async ({ kartu, foto, toko, normal }) => {
    if (adaFoto && normal) return normal;
    // Tanpa foto: pakai kartu templat yang benar-benar ada, lalu kartu toko.
    const adaKartu = await fs
      .stat(path.join(process.cwd(), 'public', 'og', `${slug}.jpg`))
      .then((st) => st.size > 0)
      .catch(() => false);
    if (adaKartu) return kartu;
    return foto || toko;
  };

  const html = buildShareHtml(await metaProduk(product, base, pilihGambar), {
    siteName: settings.storeName ? `${settings.storeName} Official Store` : undefined
  });

  return ok(html, 200, {
    'Content-Type': 'text/html; charset=utf-8',
    /*
     * Jangan di-cache lama: produk bisa berganti foto/harga, dan pratinjau
     * yang terkunci membuat admin mengira perbaikannya tidak berhasil.
     */
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'X-Robots-Tag': 'noindex, follow'
  });
});

/**
 * THUMBNAIL LINK SHARE — gambar pratinjau dari FOTO UTAMA PRODUK.
 *
 * Kenapa endpoint terpisah: `og:image` harus menunjuk ke berkas nyata dengan
 * dimensi & tipe yang pasti. Foto yang diunggah admin bentuknya bermacam-macam
 * (portrait 1086x1448, 1920x1280, > 400 KB), dan crawler membuang gambar yang
 * tidak sesuai. Endpoint ini menormalkan semuanya ke 1200x630 JPEG < 300 KB.
 *
 * URL: /api/og-image/<slug>.jpg
 */
route('GET', '/api/og-image/:slug', async ({ params }) => {
  const slug = String(params.slug || '')
    .trim()
    .toLowerCase()
    .replace(/\.(jpe?g|png|webp)$/i, '');
  if (!slug) return bad('Slug produk wajib diisi.', 400);

  const products = await readProducts();
  const product = products.find(
    (p) => String(p.slug || '').toLowerCase() === slug && p.active !== false
  );
  if (!product) return bad('Produk tidak ditemukan.', 404);

  const base = String(process.env.PUBLIC_BASE_URL || 'https://cilegon-enggih.vercel.app').replace(
    /\/+$/,
    ''
  );

  let gambar;
  try {
    gambar = await thumbnailProduk(product, base);
  } catch (err) {
    /*
     * Foto gagal diambil. Jangan 404 — crawler hanya akan menampilkan tautan
     * tanpa gambar. Arahkan ke kartu toko yang pasti ada supaya pratinjau tetap
     * tampil, dan catat alasannya di header agar mudah didiagnosa.
     */
    return ok(Buffer.alloc(0), 302, {
      Location: `${base}${TOKO_IMAGE}`,
      'Cache-Control': 'no-store',
      'X-Og-Fallback': String(err?.message || 'gagal').slice(0, 120)
    });
  }

  return ok(gambar.buf, 200, {
    'Content-Type': gambar.type || 'image/jpeg',
    'Content-Length': String(gambar.buf.length),
    /*
     * `immutable` SALAH di sini: admin bisa mengganti foto produk kapan saja,
     * dan pratinjau yang terkunci membuat perbaikan terlihat gagal. Cache
     * pendek + revalidate memastikan crawler mengambil versi terbaru.
     */
    'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400',
    'X-Content-Type-Options': 'nosniff',
    'X-Og-Normalized': gambar.dinormalisasi ? '1' : '0'
  });
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
  /*
   * Bukti yang dipegang pembeli.
   *
   * Sebelumnya pembeli tidak mendapat konfirmasi apa pun setelah mengunggah
   * bukti transfer — statusnya tetap sama persis, sehingga ia ragu apakah
   * usahanya tercatat. Sekarang dikirim jam unggah dan jam verifikasi agar
   * halaman lacak bisa menampilkan kepastian.
   */
  paymentProofAt: order.paymentProofAt || null,
  paymentProofNote: order.paymentProofNote || '',
  paidAt: order.paidAt || null,
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

  /*
   * STATUS PENGEMBALIAN DANA yang boleh dilihat pembeli.
   *
   * Sengaja diturunkan dari data pesanan, bukan tabel terpisah: kalau suatu
   * saat admin menandai pesanan dibatalkan setelah lunas, pembeli langsung
   * melihat bahwa uangnya sedang/di proses kembali.
   */
  const ringkasRefund = (order) => {
    const lunas = order.paymentStatus === 'LUNAS';
    const batal = order.status === 'DIBATALKAN';
    if (!lunas) return 'tidak-ada';
    if (!batal) return 'tidak-ada';
    if (order.refundedAt) return 'selesai';
    return 'diproses';
  };

  /**
   * Ringkasan pesanan untuk PEMILIK nomor WhatsApp-nya sendiri.
   *
   * Tidak memakai publicTrackingView apa adanya karena pemilik akun berhak
   * melihat lebih banyak (alamat penuh, metode pembayaran, status refund)
   * tanpa harus mengetik nomor pesanan satu per satu.
   */
  const ringkasPesananSaya = (order) => ({
    orderId: order.orderId,
    invoiceNumber: order.invoiceNumber,
    createdAt: order.createdAt,
    status: order.status,
    paymentStatus: order.paymentStatus,
    refund: ringkasRefund(order),
    courier: order.courier,
    resi: order.resi || null,
    trackingLinks: trackLinksFor(order.courier, order.resi),
    totalAmount: order.totalAmount,
    subtotal: order.subtotal,
    shippingCost: order.shippingCost,
    voucherDiscount: order.voucherDiscount || 0,
    ongkirGratis: Boolean(order.ongkirGratis),
    items: (order.items || []).map((it) => ({
      name: it.name,
      qty: it.qty,
      price: it.price,
      optionsLabel: it.optionsLabel || it.variantLabel || ''
    })),
    paymentMethod: order.paymentMethod,
    destination: order.destination,
    addressDetail: order.addressDetail || '',
    paidAt: order.paidAt || null,
    timeline: (order.timeline || []).slice(-12)
  });

  /** Ambil sesi pembeli dari cookie. Null kalau tidak ada/tidak sah. */
  const sesiPembeli = (headers) => {
    const cookies = parseCookies(headers);
    return verifyBuyerToken(cookies[BUYER_COOKIE]);
  };

  /**
   * GET /api/buyer/session
   * Siapa yang sedang login (kalau ada). Tidak pernah mengembalikan nomor penuh.
   */
  route('GET', '/api/buyer/session', async ({ headers }) => {
    const klaim = sesiPembeli(headers);
    if (!klaim) return ok({ loggedIn: false });
    return ok({
      loggedIn: true,
      nama: klaim.n || '',
      nomorMasked: `${klaim.wa.slice(0, 4)}${'*'.repeat(Math.max(0, klaim.wa.length - 7))}${klaim.wa.slice(-3)}`
    });
  });

  /**
   * POST /api/buyer/otp
   * Minta kode verifikasi untuk nomor WhatsApp.
   *
   * KENAPA OTP WA, BUKAN PASSWORD/EMAIL
   * Nomor WhatsApp sudah menjadi identitas pembeli di toko ini sejak awal
   * (4 digit terakhir dipakai untuk lacak pesanan). Memakai nomor yang sama
   * membuat riwayat otomatis lengkap tanpa meminta pembeli mengingat password
   * baru — dan tanpa menambah data pribadi yang harus dijaga.
   *
   * Kode dikirim ke admin lewat Telegram karena toko belum punya kanal SMS/
   * WhatsApp Business API. Admin meneruskan kode itu ke pembeli. Ini tetap
   * aman: kode tetap 6 digit acak, berlaku 10 menit, dan hangus setelah 5 kali
   * salah — jadi admin tidak bisa "menebak" kode milik pembeli.
   */
  route('POST', '/api/buyer/otp', async ({ body, headers }) => {
    const ip = clientIp(headers);
    const nomor = normalisasiNomor(body?.nomor);
    if (!nomor) {
      return bad('Nomor WhatsApp tidak valid. Gunakan format 08xxxxxxxxxx.', 400);
    }

    const limit = rateLimit(`buyer-otp:${ip}`, { max: 5, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) {
      return bad('Terlalu banyak permintaan kode. Coba lagi beberapa menit lagi.', 429);
    }

    const settings = await readSettings();
    const kode = buatKodeOtp();
    const now = Date.now();

    await store.put('buyer_otp', {
      id: otpDocId(nomor),
      nomor,
      hash: hashOtp(nomor, kode),
      dibuatAt: new Date(now).toISOString(),
      kedaluwarsaAt: new Date(now + OTP_TTL_MS).toISOString(),
      percobaan: 0
    });

    /*
     * Kode TIDAK dikembalikan ke browser dalam bentuk apa pun — kalau
     * dikembalikan, verifikasi ini tidak ada gunanya.
     */
    const pesan = [
      '🔐 <b>Kode verifikasi akun pembeli</b>',
      `Nomor: <code>${nomor}</code>`,
      `Kode: <b>${kode}</b>`,
      `Berlaku ${OTP_TTL_MS / 60000} menit, hangus setelah ${OTP_MAX_ATTEMPTS} kali salah.`,
      '',
      'Teruskan kode ini <b>hanya</b> kepada pemilik nomor tersebut di atas.',
      'Petugas toko tidak pernah meminta kode ini untuk keperluan lain.'
    ].join('\n');
    const terkirim = await notifySafe(settings, pesan);
    await catatStatusNotifikasi(terkirim, 'kode-verifikasi-pembeli');

    return ok({
      ok: true,
      nomorMasked: `${nomor.slice(0, 4)}${'*'.repeat(Math.max(0, nomor.length - 7))}${nomor.slice(-3)}`,
      berlakuDetik: OTP_TTL_MS / 1000,
      /*
       * Kalau Telegram belum dikonfigurasi, pembeli tidak boleh dibiarkan
       * menunggu kode yang tidak akan pernah datang. Katakan apa adanya.
       */
      terkirim: Boolean(terkirim?.sent),
      pesan: terkirim?.sent
        ? 'Kode dikirim ke admin toko. Hubungi admin untuk menerima kode Anda.'
        : 'Admin belum mengaktifkan pengiriman kode. Hubungi admin toko lewat menu Bantuan.'
    });
  });

  /**
   * POST /api/buyer/verify
   * Tukar kode OTP menjadi sesi pembeli (cookie HttpOnly, 30 hari).
   */
  route('POST', '/api/buyer/verify', async ({ body, headers }) => {
    const ip = clientIp(headers);
    const nomor = normalisasiNomor(body?.nomor);
    const kode = String(body?.kode || '').replace(/\D/g, '');
    if (!nomor || kode.length !== 6) {
      return bad('Nomor WhatsApp dan 6 digit kode wajib diisi.', 400);
    }

    const limit = rateLimit(`buyer-verify:${ip}`, { max: 15, windowMs: 15 * 60 * 1000 });
    if (!limit.allowed) {
      return bad('Terlalu banyak percobaan verifikasi. Coba lagi nanti.', 429);
    }

    const doc = await store.get('buyer_otp', otpDocId(nomor));
    if (!doc) return bad('Kode tidak ditemukan. Minta kode baru.', 400);

    if (new Date(doc.kedaluwarsaAt).getTime() < Date.now()) {
      await store.remove('buyer_otp', doc.id);
      return bad('Kode sudah kedaluwarsa. Minta kode baru.', 400);
    }

    /*
     * Percobaan salah dibatasi. Tanpa ini, 6 digit bisa ditebak dengan skrip:
     * satu juta kombinasi terlalu banyak untuk manusia, tetapi tidak untuk
     * komputer yang bisa mengirim ribuan permintaan.
     */
    if (Number(doc.percobaan) >= OTP_MAX_ATTEMPTS) {
      await store.remove('buyer_otp', doc.id);
      return bad('Terlalu banyak kode salah. Minta kode baru.', 429);
    }

    if (!otpCocok(nomor, kode, doc.hash)) {
      await store.put('buyer_otp', { ...doc, percobaan: Number(doc.percobaan) + 1 });
      return bad('Kode verifikasi salah.', 400);
    }

    /* Sekali pakai. */
    await store.remove('buyer_otp', doc.id);

    /* Nama diambil dari pesanan terakhir nomor ini (kalau ada) supaya terasa akrab. */
    const pesanan = await readOrders();
    /*
     * Pencocokan PERSIS, bukan 4 digit terakhir.
     *
     * Halaman lacak boleh memakai 4 digit karena nomor pesanan ikut diminta.
     * Di sini tidak: sekali masuk, seluruh riwayat nomor itu terbuka.
     */
    const milik = pesanan
      .filter((o) => nomorSama(o.customerPhone, nomor))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const nama = milik[0]?.customerName || '';

    const { token } = createBuyerToken({ nomor, nama });

    await recordAudit(store, {
      action: 'buyer.login',
      actor: 'pembeli',
      ip,
      target: nomor.slice(-4),
      status: 'ok',
      detail: { pesananTerkait: milik.length }
    });

    return ok(
      { ok: true, jumlahPesanan: milik.length, nama },
      200,
      { 'Set-Cookie': buyerCookie(token, { headers }) }
    );
  });

  /** POST /api/buyer/logout */
  route('POST', '/api/buyer/logout', async ({ headers }) =>
    ok({ ok: true }, 200, { 'Set-Cookie': clearBuyerCookie(headers) })
  );

  /**
   * GET /api/buyer/orders
   *
   * SELURUH pesanan milik nomor yang sudah diverifikasi — inilah inti keluhan
   * "kalau pesan 5 barang di waktu berbeda, bagaimana memantaunya?".
   *
   * Satu akun = satu nomor WhatsApp. Semua pesanan dengan nomor itu terkumpul
   * tanpa perlu mengetik nomor pesanan satu per satu.
   */
  route('GET', '/api/buyer/orders', async ({ headers }) => {
    const klaim = sesiPembeli(headers);
    if (!klaim) return bad('Masuk dulu untuk melihat riwayat pesanan Anda.', 401);

    const semua = await readOrders();
    const milik = semua
      .filter((o) => nomorSama(o.customerPhone, klaim.wa))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

    /*
     * Ringkasan angka supaya pembeli langsung tahu posisinya: berapa yang
     * masih perlu dibayar, berapa yang sedang dikirim, berapa yang sudah
     * selesai, dan apakah ada uang yang sedang dikembalikan.
     */
    const ringkasan = {
      total: milik.length,
      perluDibayar: milik.filter((o) => o.paymentStatus !== 'LUNAS' && o.status !== 'DIBATALKAN').length,
      dikirim: milik.filter((o) => o.status === 'DIKIRIM').length,
      selesai: milik.filter((o) => o.status === 'SELESAI').length,
      refundDiproses: milik.filter((o) => ringkasRefund(o) === 'diproses').length,
      totalBelanjaLunas: milik
        .filter((o) => o.paymentStatus === 'LUNAS')
        .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0)
    };

    return ok({ ringkasan, orders: milik.map(ringkasPesananSaya) });
  });

  /**
   * GET /api/buyer/orders/:orderId
   * Detail satu pesanan milik sendiri. Pesanan orang lain = 404, bukan 403 —
   * supaya keberadaan pesanan orang lain tidak bisa dipastikan.
   */
  route('GET', '/api/buyer/orders/:orderId', async ({ headers, params }) => {
    const klaim = sesiPembeli(headers);
    if (!klaim) return bad('Masuk dulu untuk melihat pesanan Anda.', 401);

    const order = await store.get('orders', String(params.orderId || ''));
    if (!order || !nomorSama(order.customerPhone, klaim.wa)) {
      return bad('Pesanan tidak ditemukan.', 404);
    }
    return ok({ order: ringkasPesananSaya(order) });
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

  const passwordDikirim = rapikanPassword(password);
  const passwordOk = ADMIN_LOGIN_ENABLED && passwordDikirim === ADMIN_PASSWORD;
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
      /*
       * Catat BENTUK password, tidak pernah isinya. `adaSpasiUjung` menandai
       * kasus yang paling sering: password benar tapi tersalin dengan spasi /
       * baris baru. Tanpa metadata ini, keluhan "password salah" tidak bisa
       * dibedakan dari "password memang beda".
       */
      detail: {
        sisaPercobaan: limit.remaining ?? 0,
        panjangDikirim: passwordDikirim.length,
        panjangTersimpan: ADMIN_PASSWORD.length,
        adaSpasiUjung: passwordDikirim !== String(password ?? ''),
        kemungkinanBedaHurufBesarKecil:
          passwordDikirim.toLowerCase() === ADMIN_PASSWORD.toLowerCase() && passwordDikirim !== ADMIN_PASSWORD
      }
    });
    /*
     * Pesan galat harus BISA DITINDAKLANJUTI.
     *
     * Kasus nyata (22 Nov 2026): admin mengetik 19 karakter, sedangkan nilai
     * yang terpasang di hosting 43 karakter. Dengan pesan "password salah"
     * biasa, admin mengira salah ketik dan mencoba berulang — padahal yang
     * terpasang memang nilai yang sama sekali berbeda, mungkin dibuat acak
     * saat deploy pertama dan tidak pernah dicatat.
     *
     * Menyebut PANJANG (bukan isi) sudah cukup untuk membedakan tiga kondisi
     * yang penanganannya berbeda jauh:
     *   - panjang sama   → salah ketik / beda kapitalisasi → periksa ulang
     *   - panjang beda   → nilai terpasang memang lain → harus diganti
     *   - beda kapitalisasi saja → disebut eksplisit
     * Panjang password bukan rahasia yang berguna bagi penyerang, sementara
     * bagi pemilik toko ini satu-satunya petunjuk yang menentukan.
     */
    const panjangDikirim = passwordDikirim.length;
    const panjangTersimpan = ADMIN_PASSWORD.length;

    if (passwordDikirim.toLowerCase() === ADMIN_PASSWORD.toLowerCase() && passwordDikirim !== ADMIN_PASSWORD) {
      return bad(
        'Password hampir benar — periksa HURUF BESAR/kecil. Password membedakan kapitalisasi.',
        401
      );
    }

    if (panjangDikirim !== panjangTersimpan) {
      return bad(
        `Password tidak cocok: yang Anda kirim ${panjangDikirim} karakter, ` +
          `sedangkan yang terpasang di server ${panjangTersimpan} karakter. ` +
          'Artinya nilai di hosting memang berbeda — ganti ADMIN_PASSWORD di ' +
          'Vercel → Settings → Environment Variables, lalu Redeploy.',
        401,
        { panjangDikirim, panjangTersimpan }
      );
    }

    return bad(
      `Password admin salah (${panjangDikirim} karakter, sama panjang dengan yang terpasang). ` +
        'Periksa kembali ejaan dan kapitalisasinya.',
      401,
      { panjangDikirim, panjangTersimpan }
    );
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

  const csvEsc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [];
  lines.push('Laporan;Cilegon Enggih');
  lines.push(`Periode;${report.period.from} s/d ${report.period.to} (${report.period.days} hari)`);
  lines.push('');
  lines.push('TRAFIK HARIAN');
  lines.push('Tanggal;Kunjungan;Pengunjung Unik;Pesanan;Pendapatan;Konversi %');
  report.traffic.daily.forEach((d) =>
    lines.push([d.day, d.views, d.visitors, d.orders, d.revenue, d.conversion].map(csvEsc).join(';'))
  );
  lines.push('');
  lines.push('PRODUK');
  lines.push('Produk;Dilihat;Masuk Keranjang;Terjual;Pendapatan;Konversi %;Catatan');
  report.products.forEach((p) =>
    lines.push([p.name, p.views, p.carts, p.sold, p.revenue, p.conversion ?? '', p.verdict].map(csvEsc).join(';'))
  );
  lines.push('');
  lines.push('PROYEKSI STOK');
  lines.push('Produk;Stok;Terjual;Rata-rata/hari;Perkiraan Habis (hari)');
  report.stockForecast.forEach((p) =>
    lines.push([p.name, p.stock, p.sold, p.perDay, p.daysLeft ?? ''].map(csvEsc).join(';'))
  );
  lines.push('');
  lines.push('LOKASI');
  lines.push('Zona;Pesanan;Pendapatan;Porsi %');
  report.byZone.forEach((z) => lines.push([z.label, z.orders, z.revenue, z.share].map(csvEsc).join(';')));
  lines.push('');
  lines.push('SUMBER TRAFIK');
  lines.push('Sumber;Pengunjung;Kunjungan');
  report.bySource.forEach((s) =>
    lines.push([s.label || s.source, s.visitors, s.views].map(csvEsc).join(';'))
  );
  lines.push('');
  lines.push('PERANGKAT');
  lines.push('Perangkat;Pengunjung;Porsi %');
  report.byDevice.forEach((d) => lines.push([d.label, d.visitors, d.share].map(csvEsc).join(';')));
  lines.push('');
  lines.push('HALAMAN TERATAS');
  lines.push('Halaman;Path;Kunjungan;Pengunjung');
  report.topPaths.forEach((p) => lines.push([p.label, p.path, p.views, p.visitors].map(csvEsc).join(';')));
  lines.push('');
  lines.push('VARIAN PRODUK');
  lines.push('Produk;Varian;Dilihat;Masuk Keranjang;Terjual;Omzet');
  report.variants.forEach((v) =>
    lines.push(
      [v.productName || v.productId || '', v.label, v.views, v.carts, v.sold, v.revenue]
        .map(csvEsc)
        .join(';')
    )
  );
  lines.push('');
  lines.push('LOKASI PENGUNJUNG (perkiraan kota, tanpa IP)');
  lines.push('Zona;Pengunjung;Porsi %');
  (report.byVisitorZone || []).forEach((z) =>
    lines.push([z.label, z.visitors, z.share].map(csvEsc).join(';'))
  );
  lines.push('');
  lines.push('JAM TERSIBUK (hari x jam, WIB)');
  lines.push('Hari;Jam;Kunjungan');
  (report.heatmap?.peakSlots || []).forEach((p) =>
    lines.push([p.day, `${String(p.hour).padStart(2, '0')}:00`, p.views].map(csvEsc).join(';'))
  );
  lines.push('');
  lines.push('PEMBANDING PERIODE SEBELUMNYA');
  lines.push('Ukuran;Periode Ini;Periode Lalu;Perubahan %');
  const cmp = report.comparison || {};
  lines.push(
    ['Pengunjung', report.traffic.totalVisitors, cmp.prevVisitors ?? 0, cmp.visitors ?? '']
      .map(csvEsc)
      .join(';')
  );
  lines.push(['Kunjungan', report.traffic.totalViews, cmp.prevViews ?? 0, cmp.views ?? ''].map(csvEsc).join(';'));
  lines.push(['Pesanan', report.traffic.totalOrders, cmp.prevOrders ?? 0, cmp.orders ?? ''].map(csvEsc).join(';'));

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

  /*
   * Angka omzet memakai `summarizeSales` (reports.js) — definisi yang SAMA
   * dengan halaman Keuangan, supaya Overview dan Keuangan tidak pernah
   * berbeda. Lihat catatan di reports.js.
   */
  const salesSummary = summarizeSales(orders);
  const revenue = salesSummary.revenue;
  const potentialRevenue = orders
    .filter((o) => o.status !== 'DIBATALKAN')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

  const byStatus = ORDER_STATUSES.reduce((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length;
    return acc;
  }, {});

  /*
   * Penjualan per produk diambil dari PESANAN NYATA, bukan dari `soldCount`
   * pada data produk. `soldCount` adalah angka isian tangan yang tidak pernah
   * bertambah saat ada pesanan masuk, sehingga selama ini isinya tidak
   * mencerminkan penjualan sebenarnya.
   *
   * Dikelompokkan per `productId` (bukan nama), agar produk yang punya
   * beberapa pilihan tidak terpecah menjadi banyak baris.
   */
  const productRows = salesSummary.productRows;

  const lowStock = products
    .filter((p) => Number(p.stock) <= 20)
    .map((p) => ({ id: p.id, name: p.shortName, stock: p.stock }));

  return ok({
    totalRevenue: revenue,
    potentialRevenue,
    totalOrders: orders.length,
    paidOrders: salesSummary.ordersCount,
    itemsSold: salesSummary.units,
    cancelledOrders: salesSummary.cancelledCount,
    unpaidOrders: salesSummary.unpaidCount,
    awaitingVerification: orders.filter((o) => o.paymentStatus === 'MENUNGGU_VERIFIKASI').length,
    awaitingResi: orders.filter((o) => !o.resi && o.status !== 'DIBATALKAN' && o.status !== 'SELESAI')
      .length,
    b2bOpen: b2b.filter((b) => !/deal|selesai|done|batal/i.test(String(b.status))).length,
    byStatus,
    topProducts: [...productRows].sort((a, b) => b.qty - a.qty).slice(0, 5),
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

  /*
   * Perubahan status pembayaran.
   *
   * Jalur LUNAS memakai `markOrderPaid` (payments.js) — modul yang SAMA
   * dengan tombol verifikasi di Telegram. Dengan begitu timeline, `paidAt`,
   * dan pemindahan otomatis ke antrean proses selalu konsisten, dari jalur
   * mana pun pesanan diverifikasi.
   */
  if (payload.paymentStatus && PAYMENT_STATUSES.includes(payload.paymentStatus)) {
    if (payload.paymentStatus === 'LUNAS') {
      const paid = await markOrderPaid(
        { ...next, timeline },
        {
          via: 'admin',
          actor: 'admin',
          verifiedAmount: payload.verifiedAmount
        }
      );
      if (paid.ok) {
        Object.assign(next, paid.order);
        next.timeline = paid.order.timeline;
      } else {
        // Tidak bisa dilunaskan (mis. pesanan sudah dibatalkan) — jangan diam.
        return bad(paid.reason || 'Pesanan tidak bisa ditandai lunas.', 409);
      }
    } else {
      next.paymentStatus = payload.paymentStatus;
      pushTimeline(`Status pembayaran diubah menjadi ${payload.paymentStatus}`);
    }
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

  /*
   * `soldCount` dihitung ULANG dari pesanan nyata.
   *
   * Sebelumnya `soldCount` hanyalah angka isian tangan yang tidak pernah
   * bertambah saat ada pesanan masuk — jadi admin melihat "145 terjual" di
   * katalog padahal tidak ada pesanan yang mendukungnya, sementara laporan
   * penjualan menunjukkan angka lain. Sekarang keduanya berasal dari sumber
   * yang sama: pesanan yang LUNAS dan tidak dibatalkan.
   *
   * Angka yang tersimpan tidak diubah di database; ini hanya tampilan.
   * `soldCountManual` (bila diisi admin) tetap disertakan sebagai rujukan.
   */
  const [products, orders] = await Promise.all([readProducts(), readOrders()]);
  const sold = new Map();
  salesOrders(orders).forEach((order) => {
    (order.items || []).forEach((item) => {
      const id = item.productId;
      if (!id) return;
      sold.set(id, (sold.get(id) || 0) + (Number(item.qty) || 0));
    });
  });

  const withSold = products.map((product) => ({
    ...product,
    soldCountManual: Number(product.soldCount) || 0,
    soldCount: sold.get(product.id) ?? 0
  }));

  return ok({ products: withSold });
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

/**
 * Bersihkan grup pilihan multi-dimensi (Model / Ukuran / Warna).
 *
 * Aturan yang ditegakkan:
 *  - maks 4 grup (kombinasi berlebih membuat halaman tidak terpakai di HP)
 *  - maks 30 nilai per grup
 *  - ID nilai harus unik dalam satu grup; duplikat dibuang karena akan
 *    membuat harga ambigu saat diklik pembeli
 *  - `priceDelta` dibatasi ±50% harga produk, supaya salah ketik
 *    (150000 alih-alih 15000) langsung terlihat, bukan menghasilkan harga gila
 *  - `colorHex` hanya menerima format #RGB / #RRGGBB
 */
/**
 * 4 grup, bukan 3. Produk apparel memakai Kode × Warna × Ukuran (3 grup) dan
 * masih perlu satu grup "Momen" (akhir tahun, Ramadhan, Idul Fitri, ulang
 * tahun, wisuda, ...). Dengan batas 3, grup Momen dibuang diam-diam saat
 * admin menyimpan — data yang terlihat di dashboard tapi hilang di toko.
 */
const MAX_OPTION_GROUPS = 4;
const MAX_OPTION_VALUES = 30;

const cleanOptionGroups = (raw, basePrice = 0, catatan = null) => {
  if (!Array.isArray(raw)) return [];
  /*
   * Batas selisih harga per nilai pilihan.
   *
   * KENAPA ADA BATAS: mencegah salah ketik (mis. 1900000 untuk +19.000) yang
   * membuat harga produk melonjak tanpa terlihat.
   *
   * KENAPA DICATAT: dulu nilai di atas batas dipotong DIAM-DIAM. Admin melihat
   * 19.000 di form tetapi yang tersimpan angka lain, tanpa penjelasan apa pun —
   * persis keluhan "input 19.000 tapi tersimpan 8.000". Sekarang setiap
   * pemotongan dikembalikan sebagai peringatan yang bisa ditampilkan.
   */
  const maxDelta = Math.max(1000, Math.round(basePrice * 0.5));

  return raw
    .map((g, gi) => {
      const name = String((g && g.name) || '').trim().slice(0, 40);
      if (!name) return null;

      const seen = new Set();
      const values = (Array.isArray(g.values) ? g.values : [])
        .map((v, vi) => {
          const label = String((v && v.label) || '').trim().slice(0, 40);
          if (!label) return null;
          const id =
            String((v && v.id) || '').trim().slice(0, 60) ||
            `v${gi}-${vi}-${Date.now().toString(36)}`;
          if (seen.has(id)) return null;
          seen.add(id);

          const deltaRaw = Math.round(Number(v && v.priceDelta) || 0);
          const priceDelta = Math.max(-maxDelta, Math.min(maxDelta, deltaRaw));
          if (catatan && priceDelta !== deltaRaw) {
            catatan.push(
              `Selisih harga "${label}" pada ${name} di luar batas (maks ${
                maxDelta.toLocaleString('id-ID')
              } dari harga dasar), disimpan ${priceDelta.toLocaleString('id-ID')}.`
            );
          }

          const hex = String((v && v.colorHex) || '').trim();
          const colorHex = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex) ? hex : '';

          return {
            id,
            label,
            priceDelta,
            colorHex,
            image: cleanStringList([v && v.image])[0] || '',
            available: (v && v.available) !== false
          };
        })
        .filter(Boolean)
        .slice(0, MAX_OPTION_VALUES);

      if (!values.length) return null;

      const displayRaw = String((g && g.display) || 'button');
      const display = ['button', 'swatch', 'select'].includes(displayRaw) ? displayRaw : 'button';

      return {
        id: String((g && g.id) || '').trim().slice(0, 40) || `grup-${gi + 1}`,
        name,
        display,
        required: (g && g.required) !== false,
        values
      };
    })
    .filter(Boolean)
    .slice(0, MAX_OPTION_GROUPS);
};

/**
 * Bersihkan kombinasi yang menyimpang.
 *
 * `optionValueIds` harus sepanjang jumlah grup dan semuanya merujuk nilai yang
 * benar-benar ada — kalau tidak, kombinasi tidak akan pernah cocok dan lebih
 * baik dibuang daripada menjadi data mati yang membingungkan admin.
 */
const cleanCombinations = (raw, groups) => {
  if (!Array.isArray(raw) || !groups.length) return [];
  const groupCount = groups.length;
  const validIds = groups.map((g) => new Set(g.values.map((v) => v.id)));

  const seen = new Set();
  return raw
    .map((c) => {
      const ids = Array.isArray(c && c.optionValueIds)
        ? c.optionValueIds.map((x) => String(x || ''))
        : [];
      if (ids.length !== groupCount) return null;
      if (!ids.every((id, i) => validIds[i].has(id))) return null;

      const key = ids.join('|');
      if (seen.has(key)) return null;
      seen.add(key);

      const entry = { optionValueIds: ids };

      if (c.price != null && Number.isFinite(Number(c.price))) {
        entry.price = Math.max(0, Math.round(Number(c.price)));
      }
      if (c.originalPrice != null && Number.isFinite(Number(c.originalPrice))) {
        entry.originalPrice = Math.max(0, Math.round(Number(c.originalPrice)));
      }
      if (c.stock != null && Number.isFinite(Number(c.stock))) {
        entry.stock = Math.max(0, Math.round(Number(c.stock)));
      }
      if (c.sku) entry.sku = String(c.sku).trim().slice(0, 40);
      const img = cleanStringList([c && c.image])[0];
      if (img) entry.image = img;
      if (c.available === false) entry.available = false;

      // Kombinasi tanpa satu pun nilai penyimpang tidak berguna.
      const hasOverride =
        entry.price != null ||
        entry.stock != null ||
        entry.image ||
        entry.available === false ||
        entry.originalPrice != null;
      return hasOverride ? entry : null;
    })
    .filter(Boolean)
    .slice(0, 200);
};

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

  /*
   * VALIDASI KOMBINASI HARGA.
   *
   * Kombinasi adalah DAFTAR PENGECUALIAN: begitu satu kombinasi ada, harga
   * produk untuk pilihan lain dihitung dari harga dasar + selisih, bukan dari
   * kombinasi. Ini pernah menghasilkan harga yang membingungkan di produksi —
   * mis. produk Rp 8.000 dengan satu kombinasi Rp 20.000, sehingga "Paket Isi
   * 3" tampak jauh lebih mahal daripada 3 × harga satuan.
   *
   * Aturan yang ditegakkan di sini:
   *   1. setiap kombinasi wajib menyebut SEMUA grup pilihan (kalau tidak,
   *      kombinasi itu tidak akan pernah cocok dan harganya tidak terpakai)
   *   2. nilai yang disebut harus benar-benar ada di grupnya
   *   3. harga kombinasi harus > 0
   */
  const opsiGrup = Array.isArray(src.optionGroups ?? base.optionGroups)
    ? src.optionGroups ?? base.optionGroups
    : [];
  const kombinasiMasuk = Array.isArray(src.combinations ?? base.combinations)
    ? src.combinations ?? base.combinations
    : [];
  if (opsiGrup.length) {
    kombinasiMasuk.forEach((c, idx) => {
      const ids = Array.isArray(c?.optionValueIds) ? c.optionValueIds : [];
      if (ids.length !== opsiGrup.length) {
        errors.push(
          `Kombinasi ke-${idx + 1} harus memilih semua ${opsiGrup.length} pilihan (${opsiGrup
            .map((g) => g.name)
            .join(', ')}).`
        );
        return;
      }
      opsiGrup.forEach((g, i) => {
        const ada = (g.values || []).some((v) => v.id === ids[i]);
        if (!ada) {
          errors.push(
            `Kombinasi ke-${idx + 1}: nilai "${ids[i]}" tidak ada di pilihan "${g.name}".`
          );
        }
      });
      if (Number(c?.price) <= 0) {
        errors.push(`Harga kombinasi ke-${idx + 1} harus lebih besar dari 0.`);
      }
      if (c?.available !== false && Number(c?.price) > 0 && price > 0 && Number(c.price) > price * 20) {
        errors.push(
          `Harga kombinasi ke-${idx + 1} (Rp ${Number(c.price).toLocaleString(
            'id-ID'
          )}) lebih dari 20x harga satuan — periksa kembali.`
        );
      }
    });
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
  /*
   * Pilihan multi-dimensi (Model x Ukuran x Warna). Hanya dipakai bila benar-
   * benar diisi; produk yang belum mengisinya tetap memakai `variants[]` lama.
   * Kombinasi dibersihkan SETELAH grup, karena referensinya harus valid.
   */
  const catatanSelisih = [];
  const optionGroups = cleanOptionGroups(
    src.optionGroups ?? base.optionGroups,
    Number(src.price ?? base.price) || 0,
    catatanSelisih
  );
  /* Dikembalikan bersama produk agar dashboard bisa menampilkan peringatan. */
  const peringatanSelisih = catatanSelisih;
  const combinations = cleanCombinations(
    src.combinations ?? base.combinations,
    optionGroups
  );

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
    warnings: peringatanSelisih,
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
      optionGroups,
      combinations,
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
  const { errors, product, warnings } = await normalizeProduct(body || {}, null);
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
  return ok({ product: created, warnings, products: await readProducts() }, 201);
});

route('PUT', '/api/admin/products/:id', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('products', params.id);
  if (!existing) return bad('Produk tidak ditemukan.', 404);

  const { errors, product, warnings } = await normalizeProduct(body || {}, existing);
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
  return ok({ product: updated, warnings, products: await readProducts() });
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
    /*
     * Aturan gratis ongkir. Disanitasi di sini (bukan hanya di browser):
     * nilai negatif atau bukan angka akan membuat total tagihan kacau.
     */
    ongkir: {
      promoGratisOngkir: Math.max(0, Math.round(Number(payload.ongkir?.promoGratisOngkir ?? current.ongkir?.promoGratisOngkir) || 0)),
      gratisOngkirSelalu:
        payload.ongkir?.gratisOngkirSelalu !== undefined
          ? payload.ongkir.gratisOngkirSelalu === true
          : current.ongkir?.gratisOngkirSelalu === true
    },
    banks: normalizeBanks(Array.isArray(payload.banks) ? payload.banks : current.banks),
    vouchers: Array.isArray(payload.vouchers) ? payload.vouchers : current.vouchers,
    /*
     * Status kirim terakhir adalah catatan SISTEM, bukan pengaturan toko.
     * Tanpa baris ini, setiap kali admin menekan Simpan Pengaturan, riwayat
     * "notifikasi terakhir gagal/berhasil" ikut terhapus — persis informasi
     * yang dibutuhkan saat mendiagnosis bot yang diam.
     */
    telegramHealth: current.telegramHealth,
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
 * Daftarkan (atau periksa) webhook Telegram.
 *
 * Tanpa webhook, tombol "✅ Verifikasi LUNAS" hanya bisa ditekan tetapi
 * Telegram tidak punya tempat mengirim ketukannya. Endpoint ini memanggil
 * `setWebhook` milik Telegram memakai secret dari env, sehingga admin cukup
 * menekan satu tombol di dashboard.
 *
 * Secret TIDAK dikirim balik ke browser — hanya statusnya.
 */
route('POST', '/api/admin/telegram/webhook', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const settings = await readSettings();
  const cfg = telegramConfig(settings);
  if (!cfg.botToken) return bad('Bot Token Telegram belum diisi.', 400);

  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return bad(
      'TELEGRAM_WEBHOOK_SECRET belum diset di server. Tambahkan env var itu di Vercel (nilai bebas, mis. 32 karakter acak), lalu Redeploy.',
      400
    );
  }

  const base = String(
    body?.publicUrl || process.env.PUBLIC_BASE_URL || 'https://cilegon-enggih.vercel.app'
  ).replace(/\/+$/, '');
  const url = `${base}/api/telegram/webhook`;

  try {
    const res = await fetch(`${telegramApiBase()}/bot${cfg.botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: secret,
        allowed_updates: ['callback_query', 'message'],
        drop_pending_updates: false
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      return bad(
        `Telegram menolak webhook: ${data.description || res.status}. Pastikan URL publik memakai https.`,
        400
      );
    }

    await recordAudit(store, {
      action: 'telegram.webhook-didaftarkan',
      actor: 'admin',
      ip: clientIp(headers),
      target: url,
      detail: { ok: true }
    });

    return ok({
      registered: true,
      url,
      message:
        'Webhook terdaftar. Tombol "Verifikasi LUNAS" di Telegram sekarang berfungsi. Uji dengan mengirim bukti transfer baru.'
    });
  } catch (err) {
    await catatStatusNotifikasi({ sent: false, reason: err.message }, 'webhook');
    return bad(`Gagal menghubungi Telegram: ${err.message}`, 502);
  }
});

/**
 * DIAGNOSA NOTIFIKASI TELEGRAM.
 *
 * Menjawab satu pertanyaan: "kenapa chat bot saya diam?". Pemeriksaannya
 * berurutan dari yang paling sering salah:
 *   1. token & chat id terisi?
 *   2. bot bisa dihubungi (getMe)?
 *   3. chat id benar & bot sudah pernah di-/start (getChat)?
 *   4. webhook terdaftar (supaya tombol berfungsi)?
 *   5. hasil kirim terakhir berhasil atau tidak?
 *
 * Token tidak pernah dikirim balik ke browser.
 */
route('GET', '/api/admin/telegram/diagnosa', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const settings = await readSettings();
  const cfg = telegramConfig(settings);
  const secret = String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim();
  const langkah = [];

  if (!cfg.botToken || !cfg.chatId) {
    return ok({
      sehat: false,
      langkah: [
        {
          nama: 'Konfigurasi tersimpan',
          ok: false,
          pesan: 'Bot Token dan Chat ID Admin belum diisi di Pengaturan.'
        }
      ],
      saran: 'Isi Bot Token (dari @BotFather) dan Chat ID Admin, lalu klik Tes Koneksi.'
    });
  }

  const panggil = async (metode) => {
    try {
      const res = await fetch(`${telegramApiBase()}/bot${cfg.botToken}/${metode}`);
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok && data.ok !== false, data, description: data.description || '' };
    } catch (err) {
      return {
        ok: false,
        data: {},
        description: `tidak bisa menghubungi Telegram: ${err.message}`
      };
    }
  };

  const me = await panggil('getMe');
  langkah.push({
    nama: 'Token bot sah',
    ok: me.ok,
    pesan: me.ok
      ? `Bot @${me.data?.result?.username || 'tak bernama'} dapat dihubungi.`
      : `Telegram menolak token: ${me.description}`
  });

  if (me.ok) {
    const chat = await panggil('getChat');
    langkah.push({
      nama: 'Chat ID dapat dijangkau',
      ok: chat.ok,
      pesan: chat.ok
        ? `Chat "${chat.data?.result?.title || chat.data?.result?.first_name || cfg.chatId}" ditemukan.`
        : `Chat ID ${cfg.chatId} tidak ditemukan (${chat.description}). Pastikan Anda sudah menekan Start di bot, dan chat id disalin dari chat tersebut.`
    });
  }

  const info = me.ok ? await panggil('getWebhookInfo') : { ok: false, data: {} };
  const webhookUrl = info.data?.result?.url || '';
  langkah.push({
    nama: 'Webhook terdaftar (tombol verifikasi)',
    ok: Boolean(webhookUrl),
    pesan: webhookUrl
      ? `Webhook aktif di ${webhookUrl}. Tombol Verifikasi LUNAS akan berfungsi.`
      : 'Webhook belum terdaftar. Notifikasi tetap masuk, tetapi tombol verifikasi belum bisa ditekan. Klik "Aktifkan Verifikasi Sekali-Klik".'
  });

  langkah.push({
    nama: 'Kunci webhook tersedia',
    ok: Boolean(secret),
    pesan: secret
      ? 'TELEGRAM_WEBHOOK_SECRET sudah diset di server.'
      : 'TELEGRAM_WEBHOOK_SECRET belum diset — webhook akan menolak semua permintaan. Isi env ini di Vercel lalu redeploy.'
  });

  const health = settings.telegramHealth || {};
  const webhookTerakhir = health.webhook;
  if (webhookTerakhir) {
    langkah.push({
      nama: 'Pendaftaran webhook terakhir',
      ok: Boolean(webhookTerakhir.sent),
      pesan: webhookTerakhir.sent
        ? `Berhasil${webhookTerakhir.at ? ` pada ${webhookTerakhir.at}` : ''} - ${String(
            webhookTerakhir.reason || ''
          ).replace(/^webhook:\s*/, '')}`
        : `GAGAL${webhookTerakhir.at ? ` pada ${webhookTerakhir.at}` : ''}: ${
            webhookTerakhir.reason || 'tanpa keterangan'
          }`
    });
  }

  const terakhir = health['bukti-transfer'];
  if (terakhir) {
    langkah.push({
      nama: 'Pengiriman terakhir (bukti transfer)',
      ok: Boolean(terakhir.sent),
      pesan: terakhir.sent
        ? `Berhasil dikirim${terakhir.at ? ` pada ${terakhir.at}` : ''}.`
        : `GAGAL${terakhir.at ? ` pada ${terakhir.at}` : ''}: ${terakhir.reason || 'tanpa keterangan'}`
    });
  }

  const masalah = langkah.filter((l) => !l.ok);
  const urutanSaran = {
    'Token bot sah': 'Periksa Bot Token di Pengaturan — salin ulang dari BotFather, tanpa spasi.',
    'Chat ID dapat dijangkau':
      'Buka bot di Telegram, tekan Start, lalu salin chat id dari chat tersebut.',
    'Kunci webhook tersedia': 'Tambahkan env TELEGRAM_WEBHOOK_SECRET di Vercel lalu redeploy.',
    'Webhook terdaftar (tombol verifikasi)':
      'Klik "Aktifkan Verifikasi Sekali-Klik" di kartu Notifikasi Telegram.',
    'Pendaftaran webhook terakhir':
      'Pendaftaran webhook gagal. Baca alasannya di atas, lalu klik ulang tombolnya.',
    'Pengiriman terakhir (bukti transfer)':
      'Baca alasan gagal di atas, perbaiki, lalu uji dengan Tes Koneksi.'
  };

  return ok({
    sehat: masalah.length === 0,
    langkah,
    saran: masalah.length
      ? urutanSaran[masalah[0].nama] || 'Periksa langkah yang belum berhasil di atas.'
      : 'Semua pemeriksaan lulus. Notifikasi dan tombol verifikasi siap dipakai.'
  });
});

/** Lihat status webhook yang sedang aktif (tanpa membocorkan secret). */
route('GET', '/api/admin/telegram/webhook', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const settings = await readSettings();
  const cfg = telegramConfig(settings);
  if (!cfg.botToken) return ok({ configured: false, reason: 'bot-token-kosong' });

  try {
    const res = await fetch(`${telegramApiBase()}/bot${cfg.botToken}/getWebhookInfo`);
    const data = await res.json().catch(() => ({}));
    const info = data.result || {};
    return ok({
      configured: Boolean(info.url),
      url: info.url || '',
      pendingUpdates: info.pending_update_count || 0,
      lastError: info.last_error_message || '',
      secretDiset: Boolean(String(process.env.TELEGRAM_WEBHOOK_SECRET || '').trim())
    });
  } catch (err) {
    return bad(`Gagal menghubungi Telegram: ${err.message}`, 502);
  }
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

/**
 * Tiket unggah video langsung ke Supabase Storage.
 *
 * Video TIDAK dikirim lewat server karena Vercel menolak body > 4.5 MB (413).
 * Alur: browser minta tiket -> unggah langsung ke Supabase -> kirim publicUrl
 * sebagai field `videos[].url` produk.
 */
route('POST', '/api/admin/video-upload-ticket', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);

  const filename = String((body && body.filename) || 'video-produk');
  const sizeBytes = Number((body && body.sizeBytes) || 0);

  if (sizeBytes > MAX_VIDEO_BYTES) {
    return bad(
      `Ukuran video ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB melebihi batas 5 MB. ` +
        'Pendekkan durasi (anjuran 30 detik) atau kecilkan resolusi ke 720p.',
      413
    );
  }

  try {
    const ticket = await createVideoUploadTicket({ filename });
    return ok({ ...ticket, maxBytes: MAX_VIDEO_BYTES });
  } catch (err) {
    if (err.message === 'SUPABASE_NOT_CONFIGURED') {
      return bad(
        'Unggah video langsung butuh Supabase Storage. Set SUPABASE_URL + kunci layanan di server.',
        503
      );
    }
    return bad(err.message, 502);
  }
});

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
