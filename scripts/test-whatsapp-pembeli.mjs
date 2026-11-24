/**
 * UJI WHATSAPP PEMBELI: kode OTP langsung ke pembeli, dan pengingat tagihan.
 *
 * DUA HAL YANG DIUJI, keduanya berasal dari permintaan pemilik toko:
 *
 *   1. "kode otp seharusnya dikirim ke no whatsapp user bukan ke admin"
 *      Kode verifikasi adalah bukti kepemilikan nomor. Kalau ia melewati
 *      admin, gunanya hilang: admin bisa masuk ke akun pembeli mana pun, dan
 *      pembeli harus menunggu admin bangun.
 *
 *   2. "pengingat otomatis"
 *      Pembeli menutup popup pembayaran lalu lupa. Tanpa pengingat, tagihan
 *      kedaluwarsa, stok dikembalikan, penjualan hilang tanpa jejak.
 *
 * Uji ini memakai gateway WhatsApp TIRUAN — tidak ada pesan sungguhan yang
 * terkirim, dan token palsu tidak pernah menyentuh jaringan.
 *
 * Cara pakai: node scripts/test-whatsapp-pembeli.mjs
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-wa-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-wa';
process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-wa';
process.env.MIDTRANS_IS_PRODUCTION = 'false';
process.env.ADMIN_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.FONNTE_TOKEN;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');
const { nomorUntukWhatsApp } = await import('../server/whatsapp.js');
const {
  perluPengingatLengkap,
  waktuPengingat,
  dalamJamTenang,
  jamWIB,
  sisaWaktuTeks
} = await import('../server/pengingat.js');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, nilai) => cek(nama, Boolean(nilai), true);

/* -------------------------- Gateway WhatsApp tiruan ---------------------- */

const terkirim = [];
const asli = globalThis.fetch;

/**
 * `mode` menentukan jawaban gateway.
 *   ok      → {"status": true}
 *   gagal   → {"status": false, "reason": "device disconnected"} DENGAN HTTP 200
 *
 * Mode `gagal` itu inti pengujiannya: Fonnte membalas 200 walaupun gagal.
 * Kalau kode hanya memeriksa `res.ok`, kegagalan akan terlihat sukses.
 */
let mode = 'ok';

globalThis.fetch = async (url, opsi = {}) => {
  const u = String(url);
  if (u.includes('api.fonnte.com') || u.includes('/send')) {
    const body = new URLSearchParams(String(opsi.body || ''));
    terkirim.push({
      target: body.get('target'),
      message: body.get('message'),
      auth: opsi.headers?.Authorization
    });
    if (mode === 'gagal') {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ status: false, reason: 'device disconnected' })
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ status: true, detail: 'success! message in queue' })
    };
  }
  /* Midtrans dan lain-lain: tidak dipakai di sini. */
  return { ok: false, status: 404, text: async () => '{}' };
};

/* ------------------------------- Pengaturan ----------------------------- */

const simpanPengaturan = async (wa) => {
  const sekarang = await store.get('settings', 'main');
  const dasar = sekarang || { id: 'main', storeName: 'Cilegon Enggih' };
  await store.put('settings', {
    ...dasar,
    storeName: 'Cilegon Enggih',
    payment: { ...(dasar.payment || {}), paymentWindowHours: 24 },
    whatsappApi: {
      enabled: true,
      token: 'TOKEN-RAHASIA-UJI',
      endpoint: 'https://api.fonnte.com/send',
      reminderEnabled: true,
      reminderHoursBefore: 3,
      reminderAfterHours: 6,
      ...wa
    }
  });
};

await simpanPengaturan({});

/* ======================================================================= */
console.log('\n▶ 1. Normalisasi nomor WhatsApp');

cek('08xxx → 62xxx', nomorUntukWhatsApp('082249879873'), '6282249879873');
cek('+62 dengan strip', nomorUntukWhatsApp('+62 822-4987-9873'), '6282249879873');
cek('62 tanpa plus', nomorUntukWhatsApp('6282249879873'), '6282249879873');
cek('spasi dan titik', nomorUntukWhatsApp('0822.4987.9873'), '6282249879873');
cek('kosong ditolak', nomorUntukWhatsApp(''), '');
cek('terlalu pendek ditolak', nomorUntukWhatsApp('0812'), '');

/* ======================================================================= */
console.log('\n▶ 2. Kode OTP dikirim ke WHATSAPP PEMBELI, bukan ke admin');

terkirim.length = 0;
const r1 = await core.dispatch({
  method: 'POST',
  path: '/api/buyer/otp',
  headers: { 'x-forwarded-for': '10.0.0.1' },
  body: { nomor: '082249879873' }
});

cek('HTTP 200', r1.status, 200);
cek('jalur = whatsapp', r1.body.jalur, 'whatsapp');
cek('terkirim = true', r1.body.terkirim, true);
cek('pesan menyebut WhatsApp', /WhatsApp/.test(r1.body.pesan), true);
const wa1 = terkirim.filter((t) => t.target === '6282249879873');
benar('pesan dikirim ke nomor pembeli (format 62)', wa1.length === 1);
if (wa1.length) {
  benar('pesan memuat kode 6 digit', /\b\d{6}\b/.test(wa1[0].message));
  benar('pesan memuat nama toko', /Cilegon Enggih/.test(wa1[0].message));
  cek('token dikirim sebagai Authorization', wa1[0].auth, 'TOKEN-RAHASIA-UJI');
}
/*
 * Yang TIDAK boleh terjadi: kode dikembalikan ke browser. Kalau itu terjadi,
 * verifikasi tidak ada gunanya — siapa pun yang memanggil endpoint ini
 * dengan nomor orang lain akan langsung mendapat kodenya.
 */
cek('kode TIDAK pernah dikembalikan ke browser', /"kode"/.test(JSON.stringify(r1.body)), false);
cek('isi pesan TIDAK ikut ke respons', /berlaku \d+ menit/i.test(JSON.stringify(r1.body)), false);

/* ======================================================================= */
console.log('\n▶ 3. Gateway gagal (HTTP 200 tapi status:false) → tidak dianggap sukses');

mode = 'gagal';
terkirim.length = 0;
const r2 = await core.dispatch({
  method: 'POST',
  path: '/api/buyer/otp',
  headers: { 'x-forwarded-for': '10.0.0.2' },
  body: { nomor: '081234567890' }
});
cek('HTTP tetap 200 (pembeli tidak melihat error server)', r2.status, 200);
benar('jalur menandai kegagalan WhatsApp', /^whatsapp-gagal/.test(r2.body.jalur));
cek('pesan memberi tahu lewat admin', /admin/i.test(r2.body.pesan), true);
mode = 'ok';

/* ======================================================================= */
console.log('\n▶ 4. Tanpa token WhatsApp → cadangan Telegram, pesan jujur');

await simpanPengaturan({ token: '' });
terkirim.length = 0;
const r3 = await core.dispatch({
  method: 'POST',
  path: '/api/buyer/otp',
  headers: { 'x-forwarded-for': '10.0.0.3' },
  body: { nomor: '089999888777' }
});
/*
 * Di lingkungan uji, Telegram juga belum dikonfigurasi. Jawaban yang benar
 * adalah 'tidak-ada' — artinya kode belum terkirim ke mana pun, dan UI harus
 * mengatakannya apa adanya, bukan menjanjikan pesan yang tidak akan datang.
 * Yang penting: TIDAK ada upaya mengirim WhatsApp tanpa token.
 */
cek('tanpa token WhatsApp → tidak mengirim WhatsApp', terkirim.length, 0);
benar('jalur bukan whatsapp', r3.body.jalur !== 'whatsapp');
benar('pesan menyebut admin', /admin/i.test(r3.body.pesan));

await simpanPengaturan({});

/* ======================================================================= */
console.log('\n▶ 5. Aturan pengingat');

const kini = Date.now();
const pesanan = (tambahan = {}) => ({
  orderId: 'CE-RM-1',
  customerName: 'Rizky Pratama',
  customerPhone: '082249879873',
  totalAmount: 62000,
  paymentStatus: 'MENUNGGU_VERIFIKASI',
  status: 'MENUNGGU_KONFIRMASI',
  createdAt: new Date(kini - 7 * 3_600_000).toISOString(),
  midtransOrderId: 'CE-RM-1-R1',
  snapRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/TOKEN-X',
  ...tambahan
});
const aturan = { sekarang: kini, windowHours: 24, beforeHours: 3, afterHours: 6 };

cek(
  'pesanan 7 jam → tahap 1 (masih banyak waktu)',
  perluPengingatLengkap(pesanan(), aturan).tahap,
  1
);
cek(
  'pesanan 7 jam → dikirim',
  perluPengingatLengkap(pesanan(), aturan).kirim,
  true
);
cek(
  'pesanan 22 jam (jendela 24 jam) → tahap 2 (kesempatan terakhir)',
  perluPengingatLengkap(
    pesanan({ createdAt: new Date(kini - 22 * 3_600_000).toISOString() }),
    aturan
  ).tahap,
  2
);
cek(
  'tahap 1 sudah terkirim, belum sampai tahap 2 → tidak diulang',
  perluPengingatLengkap(pesanan({ pengingatKe: 1 }), aturan).alasan,
  'sudah-diingatkan'
);
cek(
  'tahap 1 terkirim, sekarang tahap 2 → tetap boleh (kesempatan terakhir)',
  perluPengingatLengkap(
    pesanan({ pengingatKe: 1, createdAt: new Date(kini - 22 * 3_600_000).toISOString() }),
    aturan
  ).kirim,
  true
);
cek(
  'kedua tahap sudah terkirim → berhenti',
  perluPengingatLengkap(pesanan({ pengingatKe: 2 }), aturan).alasan,
  'sudah-diingatkan'
);
cek(
  'pesanan baru 1 jam → belum waktunya',
  perluPengingatLengkap(pesanan({ createdAt: new Date(kini - 3_600_000).toISOString() }), aturan).alasan,
  'belum-waktunya'
);
cek(
  'sudah lunas → tidak',
  perluPengingatLengkap(pesanan({ paymentStatus: 'LUNAS' }), aturan).alasan,
  'sudah-lunas'
);
cek(
  'sudah dibatalkan → tidak',
  perluPengingatLengkap(pesanan({ status: 'DIBATALKAN' }), aturan).alasan,
  'dibatalkan'
);
cek(
  'sudah diingatkan → tidak diulang',
  perluPengingatLengkap(pesanan({ pengingatTerkirimAt: new Date(kini).toISOString() }), aturan).alasan,
  'sudah-diingatkan'
);
cek(
  'tanpa nomor → tidak',
  perluPengingatLengkap(pesanan({ customerPhone: '' }), aturan).alasan,
  'tanpa-nomor'
);
cek(
  'tagihan sudah kedaluwarsa → tidak',
  perluPengingatLengkap(
    pesanan({ createdAt: new Date(kini - 25 * 3_600_000).toISOString() }),
    aturan
  ).alasan,
  'tagihan-kedaluwarsa'
);
cek(
  'tanpa tagihan → tidak',
  perluPengingatLengkap(pesanan({ midtransOrderId: null, snapRedirectUrl: null }), aturan).alasan,
  'tanpa-tagihan'
);

/*
 * Ambang "setelah dibuat" penting untuk jendela pembayaran pendek.
 * Jendela 2 jam, "3 jam sebelum kedaluwarsa" akan jatuh SEBELUM pesanan
 * dibuat (waktu negatif) — pengingat akan langsung terkirim. Tanpa ambang
 * kedua, pembeli diingatkan begitu saja.
 */
const jendelaPendek = { sekarang: kini, windowHours: 2, beforeHours: 3, afterHours: 1 };
const sasaran = waktuPengingat(pesanan({ createdAt: new Date(kini).toISOString() }), jendelaPendek);
cek(
  'jendela 2 jam: pengingat menunggu 1 jam setelah pesanan dibuat',
  sasaran - kini,
  3_600_000
);

/* ======================================================================= */
console.log('\n▶ 6. Jam tenang (tidak mengirim WhatsApp tengah malam)');

/* 01:00 WIB = 18:00 UTC hari sebelumnya. */
const dini = Date.UTC(2026, 10, 24, 18, 0, 0);
cek('jam WIB dihitung benar (18 UTC = 01 WIB)', jamWIB(dini), 1);
cek('01.00 WIB termasuk jam tenang', dalamJamTenang(dini), true);
const siang = Date.UTC(2026, 10, 24, 5, 0, 0); /* 12.00 WIB */
cek('12.00 WIB bukan jam tenang', dalamJamTenang(siang), false);

/*
 * Waktu acuan dihitung SEKALI. Memakai Date.now() dua kali membuat sisa
 * waktu bergeser beberapa milidetik dan pembulatan menit bisa meleset —
 * gagal di uji, bukan di kode.
 */
const acuan = Date.now();
cek(
  'sisa waktu terbaca manusiawi',
  sisaWaktuTeks(acuan + 5 * 3_600_000 + 12 * 60_000 + 30_000, acuan),
  '5 jam 12 menit'
);

/* ======================================================================= */
console.log('\n▶ 7. Pengingat dikirim lewat WhatsApp, isinya bisa langsung dipakai');

await store.put('orders', {
  ...pesanan({ orderId: 'CE-RM-9' }),
  createdAt: new Date(Date.now() - 22 * 3_600_000).toISOString(),
  timeline: []
});
terkirim.length = 0;

const r4 = await core.dispatch({
  method: 'GET',
  path: '/api/orders/track',
  headers: { 'x-forwarded-for': '10.0.0.9' },
  query: { q: 'CE-RM-9', phone: '9873' }
});
cek('pelacakan tetap 200', r4.status, 200);

/* Pemicu di endpoint pelacakan berjalan tanpa ditunggu. */
await new Promise((r) => setTimeout(r, 120));

const waPengingat = terkirim.filter((t) => t.target === '6282249879873');
benar('pengingat terkirim saat pesanan dibuka', waPengingat.length >= 1);
if (waPengingat.length) {
  const p = waPengingat[0].message;
  benar('memuat nomor pesanan', p.includes('CE-RM-9'));
  benar('memuat nominal', /Rp\s?62\.000/.test(p));
  benar('memuat sisa waktu', /Sisa waktu/.test(p));
  /*
   * Tautan pembayaran adalah inti jawaban "bagaimana pembeli menemukan
   * kode/QRIS-nya": ia tidak perlu mencari — tautannya ada di pesan.
   */
  benar('memuat tautan pembayaran', /app\.midtrans\.com\/snap/.test(p));
  benar('memuat tautan lacak', /lacak-pesanan\?q=CE-RM-9/.test(p));
}

/*
 * Jejak audit WAJIB ada. Dulu `catatNotifikasi` (closure lokal di webhook
 * Midtrans) dipakai di sini; hasilnya ReferenceError yang tertelan dan
 * audit pengingat tidak pernah tersimpan — tanpa satu pun tanda.
 */
const auditPengingat = (await store.list('audit')).filter(
  (a) => a.action === 'pembayaran.pengingat-terkirim'
);
benar('pengingat tercatat di audit', auditPengingat.length > 0);
if (auditPengingat.length) {
  cek('audit menyebut pesanannya', auditPengingat[0].target, 'CE-RM-9');
}
benar(
  'tidak ada audit pengingat-galat (tidak ada error tertelan)',
  (await store.list('audit')).filter((a) => a.action === 'pembayaran.pengingat-galat').length === 0
);

const setelah = await store.get('orders', 'CE-RM-9');
benar('penanda pengingat tersimpan', Boolean(setelah.pengingatTerkirimAt));
benar(
  'timeline mencatat pengingat',
  (setelah.timeline || []).some((t) => /Pengingat pembayaran/i.test(t.status))
);

/* ======================================================================= */
console.log('\n▶ 8. Idempoten — membuka halaman berulang tidak membanjiri pembeli');

terkirim.length = 0;
for (let i = 0; i < 3; i++) {
  await core.dispatch({
    method: 'GET',
    path: '/api/orders/track',
    headers: { 'x-forwarded-for': `10.0.1.${i}` },
    query: { q: 'CE-RM-9', phone: '9873' }
  });
  await new Promise((r) => setTimeout(r, 60));
}
cek('tidak ada pengingat kedua', terkirim.filter((t) => t.target === '6282249879873').length, 0);

/* ======================================================================= */
console.log('\n▶ 9. Pengingat dimatikan admin → tidak ada pesan');

await simpanPengaturan({ reminderEnabled: false });
await store.put('orders', {
  ...pesanan({ orderId: 'CE-RM-10' }),
  createdAt: new Date(Date.now() - 22 * 3_600_000).toISOString()
});
terkirim.length = 0;
await core.dispatch({
  method: 'GET',
  path: '/api/orders/track',
  headers: { 'x-forwarded-for': '10.0.0.11' },
  query: { q: 'CE-RM-10', phone: '9873' }
});
await new Promise((r) => setTimeout(r, 120));
cek('tidak ada pesan saat pengingat dimatikan', terkirim.length, 0);
await simpanPengaturan({});

/* ======================================================================= */
console.log('\n▶ 10. Endpoint admin dilindungi');

const adminDitolak = await core.dispatch({
  method: 'POST',
  path: '/api/admin/pengingat/kirim',
  headers: {},
  body: {}
});
cek('tanpa sesi admin → 401', adminDitolak.status, 401);

const cronDitolak = await core.dispatch({
  method: 'GET',
  path: '/api/cron/pengingat',
  headers: {},
  query: {}
});
benar('cron tanpa secret ditolak (401/503)', [401, 503].includes(cronDitolak.status));

/* ======================================================================= */

globalThis.fetch = asli;
fs.rmSync(DIR, { recursive: true, force: true });

console.log(gagal === 0 ? '\nWHATSAPP PEMBELI LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
