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
import { store } from './db.js';
import { SEED_PRODUCTS, SEED_CATEGORIES, SEED_SIZE_CHART } from './seed/catalog.js';
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

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'enggih2026';
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET || `cilegon-enggih::${ADMIN_PASSWORD}::fadil-labs`;
const TOKEN_TTL_MS = 1000 * 60 * 60 * 12; // 12 jam

const ok = (body, status = 200) => ({ status, body });
const bad = (message, status = 400, extra = {}) => ({ status, body: { error: message, ...extra } });

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

const isAdmin = (headers) => Boolean(verifyAdminToken(bearer(headers)));

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

const readSettings = async () => {
  const docs = await store.list('settings');
  const saved = docs[0] || {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    qris: { ...DEFAULT_SETTINGS.qris, ...(saved.qris || {}) },
    payment: { ...DEFAULT_SETTINGS.payment, ...(saved.payment || {}) },
    invoice: { ...DEFAULT_SETTINGS.invoice, ...(saved.invoice || {}) },
    banks: Array.isArray(saved.banks) && saved.banks.length ? saved.banks : DEFAULT_BANKS,
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

export const SHIPPING_ZONES = [
  {
    id: 'cilegon-pusat',
    label: 'Kota Cilegon (Jombang, Purwakarta, Cibeber, Citangkil, Ramanuju)',
    zone: 'local-cilegon',
    allowInstant: true,
    baseReg: 8000,
    etaReg: '1 Hari'
  },
  {
    id: 'cilegon-industri',
    label: 'Kota Cilegon Barat & Pelabuhan (Ciwandan, Anyer, Pulomerak, Grogol)',
    zone: 'local-cilegon-west',
    allowInstant: true,
    baseReg: 9000,
    etaReg: '1 Hari'
  },
  {
    id: 'serang',
    label: 'Kota Serang & Kab. Serang (Kramatwatu, Bojonegara, Ciruas)',
    zone: 'banten-near',
    allowInstant: true,
    baseReg: 10000,
    etaReg: '1 - 2 Hari'
  },
  {
    id: 'tangerang',
    label: 'Tangerang Raya (BSD, Alam Sutera, Karawaci, Tangsel)',
    zone: 'jabodetabek',
    allowInstant: false,
    baseReg: 12000,
    etaReg: '1 - 2 Hari'
  },
  {
    id: 'jakarta',
    label: 'DKI Jakarta (Pusat, Selatan, Barat, Timur, Utara)',
    zone: 'jabodetabek',
    allowInstant: false,
    baseReg: 13000,
    etaReg: '1 - 2 Hari'
  },
  {
    id: 'bandung-jabar',
    label: 'Bandung, Bekasi, Bogor, Depok, Banjar & Jawa Barat',
    zone: 'jabar',
    allowInstant: false,
    baseReg: 16000,
    etaReg: '2 - 3 Hari'
  },
  {
    id: 'jateng-diy',
    label: 'Semarang, Yogyakarta, Solo & Jawa Tengah',
    zone: 'jateng',
    allowInstant: false,
    baseReg: 22000,
    etaReg: '2 - 4 Hari'
  },
  {
    id: 'jatim-bali',
    label: 'Surabaya, Malang, Denpasar (Jawa Timur & Bali)',
    zone: 'jatim',
    allowInstant: false,
    baseReg: 27000,
    etaReg: '3 - 5 Hari'
  },
  {
    id: 'sumatera',
    label: 'Bandar Lampung, Palembang, Medan & Sumatera (via Merak)',
    zone: 'sumatera',
    allowInstant: false,
    baseReg: 24000,
    etaReg: '2 - 5 Hari'
  },
  {
    id: 'kalimantan-sulawesi',
    label: 'Balikpapan, Banjarmasin, Makassar & Indonesia Timur',
    zone: 'luar-jawa',
    allowInstant: false,
    baseReg: 42000,
    etaReg: '4 - 7 Hari'
  }
];

const calcShipping = ({ destinationId = 'cilegon-pusat', weightGrams = 500 }) => {
  const zone = SHIPPING_ZONES.find((z) => z.id === destinationId) || SHIPPING_ZONES[0];
  const weightKg = Math.max(1, Math.ceil(Number(weightGrams) / 1000));
  const services = [];

  if (zone.allowInstant) {
    const instantBase =
      zone.id === 'cilegon-pusat' ? 14000 : zone.id === 'cilegon-industri' ? 20000 : 32000;
    const sameDayBase =
      zone.id === 'cilegon-pusat' ? 11000 : zone.id === 'cilegon-industri' ? 15000 : 22000;
    services.push(
      {
        id: 'gosend-instant',
        courier: 'GoSend Instant',
        badge: 'Lokal Cepat',
        type: 'Instan',
        eta: '1 - 2 Jam Tiba',
        cost: instantBase + Math.max(0, weightKg - 3) * 4000
      },
      {
        id: 'grab-sameday',
        courier: 'GrabExpress SameDay',
        badge: 'Hari Ini Sampai',
        type: 'Same Day',
        eta: '4 - 6 Jam Tiba',
        cost: sameDayBase + Math.max(0, weightKg - 3) * 3000
      }
    );
  }

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
      eta: zone.allowInstant ? '1 Hari' : '1 - 2 Hari',
      cost: Math.round(zone.baseReg * 1.35) * weightKg
    }
  );

  return {
    origin: SHIPPING_ORIGIN,
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

export const buildQrisPayload = ({ amount, merchantName = 'CILEGON ENGGIH' }) => {
  const merchantAccount = tlv('00', 'ID.CO.QRIS.WWW') + tlv('02', 'ID1020030405060') + tlv('03', 'UMI');
  const body =
    tlv('00', '01') +
    tlv('01', '12') +
    tlv('26', merchantAccount) +
    tlv('52', '5499') +
    tlv('53', '360') +
    tlv('54', String(Math.round(Number(amount) || 0))) +
    tlv('58', 'ID') +
    tlv('59', String(merchantName).slice(0, 25).toUpperCase()) +
    tlv('60', 'CILEGON') +
    tlv('61', '42425') +
    '6304';
  return body + crc16(body);
};

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

const routes = [];
const route = (method, path, handler) => routes.push({ method, path, handler });

/* ---------------- Public ---------------- */

route('GET', '/api/health', async () => {
  const settings = await readSettings();
  return ok({
    status: 'ok',
    store: `${settings.storeName} Official API`,
    storage: store.mode,
    dataDir: store.dataDir,
    supabase: store.mode === 'supabase',
    adminProtected: true,
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
  const payload = buildQrisPayload({
    amount,
    merchantName: settings.qris.merchantName || 'CILEGON ENGGIH'
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
    note: settings.qris.note
  });
});

/* ---------------- Orders ---------------- */

route('POST', '/api/orders', async ({ body }) => {
  const {
    customerName,
    customerPhone,
    customerEmail = '',
    destination = 'Kota Cilegon',
    addressDetail = '',
    courier = 'JNE Reguler (CTC/REG)',
    courierService = '',
    shippingCost = 0,
    paymentMethod = 'Transfer Bank BCA',
    bankId = 'bca',
    voucherCode = '',
    voucherDiscount = 0,
    items = [],
    notes = '',
    paymentProofNote = ''
  } = body || {};

  if (!customerName || !customerPhone || !Array.isArray(items) || items.length === 0) {
    return bad('Nama penerima, nomor WhatsApp, dan item pesanan wajib diisi.');
  }

  const [settings, existing] = await Promise.all([readSettings(), readOrders()]);
  const subtotal = items.reduce((sum, it) => sum + Number(it.price) * Number(it.qty), 0);
  const totalBeforeCode = Math.max(0, subtotal + Number(shippingCost) - Number(voucherDiscount));
  const uniqueCode = settings.payment.uniqueCodeEnabled === false ? 0 : makeUniqueCode(existing, totalBeforeCode);
  const totalAmount = totalBeforeCode + uniqueCode;

  const bank = (settings.banks || DEFAULT_BANKS).find((b) => b.id === bankId) || null;
  const isQris = String(paymentMethod).toLowerCase().includes('qris');

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
    bankAccount: isQris ? null : bank,
    paymentStatus: 'MENUNGGU_VERIFIKASI',
    status: 'MENUNGGU_KONFIRMASI',
    subtotal,
    shippingCost: Number(shippingCost),
    voucherCode: voucherCode || null,
    voucherDiscount: Number(voucherDiscount),
    totalBeforeCode,
    totalAmount,
    notes,
    paymentProofNote,
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
    items,
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
  const { paymentProofNote = '', paymentProofImage = '' } = body || {};
  if (!paymentProofNote && !paymentProofImage) {
    return bad('Isi catatan bukti transfer atau unggah gambar bukti.');
  }
  const updated = {
    ...order,
    paymentProofNote,
    paymentProofImage: String(paymentProofImage).slice(0, 1_600_000), // maks ±1.2 MB base64
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
  return ok({ order: decorateOrder(updated) });
});

route('GET', '/api/orders/track', async ({ query }) => {
  const raw = String(query.q || query.query || query.phone || '').trim();
  const orders = await readOrders();

  if (!raw) {
    return ok({
      recentSamples: orders.slice(0, 3).map((o) => ({
        orderId: o.orderId,
        resi: o.resi,
        status: o.status
      }))
    });
  }

  const q = raw.toUpperCase().replace(/\s|-/g, '');
  const digits = raw.replace(/\D/g, '');
  const normalizedDigits = digits.replace(/^62/, '0');

  const found = orders.find((o) => {
    const orderId = String(o.orderId || '').toUpperCase().replace(/-/g, '');
    const resi = String(o.resi || '').toUpperCase().replace(/\s/g, '');
    const phone = String(o.customerPhone || '').replace(/\D/g, '').replace(/^62/, '0');
    return (
      orderId === q ||
      (resi && resi === q) ||
      (normalizedDigits.length >= 8 && phone === normalizedDigits) ||
      String(o.invoiceNumber || '').toUpperCase() === q
    );
  });

  if (!found) {
    return bad(
      'Nomor Order / Resi / WhatsApp tidak ditemukan. Pastikan penulisan sudah benar, atau hubungi WhatsApp resmi kami.',
      404
    );
  }

  return ok({ order: decorateOrder(found) });
});

/* ---------------- B2B ---------------- */

route('POST', '/api/b2b', async ({ body }) => {
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
  return ok({ inquiry: entry }, 201);
});

/* ---------------- Admin auth ---------------- */

route('POST', '/api/admin/login', async ({ body }) => {
  const { username = 'admin', password = '' } = body || {};
  if (String(password) !== ADMIN_PASSWORD) {
    return bad('Password admin salah. Cek kembali password yang diberikan pemilik toko.', 401);
  }
  if (String(username).toLowerCase() !== 'admin') {
    return bad('Username admin tidak dikenal (default: admin).', 401);
  }
  return ok({
    token: signAdminToken(username),
    username: 'admin',
    expiresInHours: 12,
    storage: store.mode
  });
});

route('GET', '/api/admin/session', async ({ headers }) => {
  const session = verifyAdminToken(bearer(headers));
  if (!session) return bad('Sesi admin tidak valid atau sudah kedaluwarsa.', 401);
  return ok({ valid: true, username: session.u, storage: store.mode });
});

/* ---------------- Admin: analytics ---------------- */

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

  next.timeline = timeline;
  next.updatedAt = nowIso();
  await store.put('orders', next);

  return ok({ order: decorateOrder(next) });
});

/* ---------------- Admin: products CRUD ---------------- */

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 70);

route('POST', '/api/admin/products', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const payload = body || {};
  if (!payload.name) return bad('Nama produk wajib diisi.');
  const products = await readProducts();
  const id = payload.id || `prod-${Date.now().toString().slice(-6)}`;
  const price = Number(payload.price) || 0;
  const originalPrice = Number(payload.originalPrice) || Math.round(price * 1.15);
  const product = {
    id,
    slug: payload.slug || slugify(payload.shortName || payload.name),
    name: payload.name,
    shortName: payload.shortName || payload.name,
    englishSubtitle: payload.englishSubtitle || 'Official Cilegon Enggih Merchandise',
    categorySlug: payload.categorySlug || 'aksesoris-dekorasi',
    categoryLabel: payload.categoryLabel || 'Aksesoris & Dekorasi',
    image: payload.image || '/products/gantungan-kunci-3d.png',
    galleryImages: payload.galleryImages || [],
    price,
    priceRangeText: payload.priceRangeText || `Rp ${price.toLocaleString('id-ID')}`,
    originalPrice,
    discountPercent:
      Number(payload.discountPercent) ||
      (originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0),
    rating: Number(payload.rating) || 4.9,
    reviewCount: Number(payload.reviewCount) || 0,
    soldCount: Number(payload.soldCount) || 0,
    weightGrams: Number(payload.weightGrams) || 300,
    stock: Number(payload.stock) || 0,
    isBestSeller: Boolean(payload.isBestSeller),
    isFlashDeal: Boolean(payload.isFlashDeal),
    isBundle: Boolean(payload.isBundle),
    bundleItems: payload.bundleItems || [],
    hasSizeChart: Boolean(payload.hasSizeChart),
    badges: payload.badges || [],
    description: payload.description || '',
    specs: payload.specs || [],
    variants: payload.variants || [],
    minWholesaleQty: Number(payload.minWholesaleQty) || 0,
    wholesalePrice: Number(payload.wholesalePrice) || price,
    reviews: payload.reviews || [],
    active: payload.active !== false,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await store.put('products', product);
  return ok({ product, products: await readProducts() }, 201);
});

route('PUT', '/api/admin/products/:id', async ({ headers, params, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const existing = await store.get('products', params.id);
  if (!existing) return bad('Produk tidak ditemukan.', 404);
  const payload = body || {};
  const updated = { ...existing, ...payload, id: existing.id, updatedAt: nowIso() };

  // Recalculate turunan supaya konsisten dengan storefront.
  updated.price = Number(updated.price) || 0;
  updated.originalPrice = Number(updated.originalPrice) || updated.price;
  updated.priceRangeText =
    payload.priceRangeText || `Rp ${updated.price.toLocaleString('id-ID')}`;
  updated.discountPercent =
    updated.originalPrice > updated.price
      ? Math.round(((updated.originalPrice - updated.price) / updated.originalPrice) * 100)
      : 0;
  updated.stock = Number(updated.stock) || 0;
  if (Array.isArray(updated.variants)) {
    updated.variants = updated.variants.map((v) => ({
      ...v,
      price: Number(v.price) || 0,
      originalPrice: Number(v.originalPrice) || Number(v.price) || 0,
      stock: Number(v.stock) || 0
    }));
  }
  await store.put('products', updated);
  return ok({ product: updated, products: await readProducts() });
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

route('PUT', '/api/admin/settings', async ({ headers, body }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const current = await readSettings();
  const payload = body || {};
  const merged = {
    ...current,
    ...payload,
    qris: { ...current.qris, ...(payload.qris || {}) },
    payment: { ...current.payment, ...(payload.payment || {}) },
    invoice: { ...current.invoice, ...(payload.invoice || {}) },
    banks: Array.isArray(payload.banks) ? payload.banks : current.banks,
    vouchers: Array.isArray(payload.vouchers) ? payload.vouchers : current.vouchers,
    updatedAt: nowIso()
  };
  await store.put('settings', { ...merged, id: 'store-settings' });
  return ok({ settings: publicSettings(merged) });
});

route('POST', '/api/admin/settings/reset', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  await store.replaceAll('settings', [{ ...DEFAULT_SETTINGS, id: 'store-settings' }]);
  return ok({ settings: publicSettings(DEFAULT_SETTINGS) });
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

route('GET', '/api/admin/export', async ({ headers }) => {
  if (!isAdmin(headers)) return bad('Akses admin diperlukan.', 401);
  const [orders, products, b2b, settings] = await Promise.all([
    readOrders(),
    readProducts(),
    readB2B(),
    readSettings()
  ]);
  return ok({ exportedAt: nowIso(), orders, products, b2b, settings });
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
    return result || ok({ success: true });
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
  SEED_PRODUCTS,
  SEED_CATEGORIES,
  SEED_SIZE_CHART
};
