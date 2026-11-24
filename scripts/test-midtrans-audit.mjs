/**
 * Uji audit pembayaran: percobaan ulang, otorisasi, pembatalan, finishUrl.
 *
 * Semua temuan di audit ini adalah bug yang HANYA muncul di produksi:
 *   - tombol "Coba Bayar Lagi" selalu gagal karena order_id Midtrans tidak
 *     pernah berubah (Midtrans menolak order_id yang sudah dipakai)
 *   - finishUrl menunjuk /pesanan/<id>, rute yang tidak pernah ada → 404
 *   - endpoint status bisa melunaskan pesanan tanpa bukti apa pun
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-audit-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'Mid-server-audit';
process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-audit';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
process.env.PUBLIC_BASE_URL = '';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');

let gagal = 0;
const cek = (n, d, h) => {
  const ok = JSON.stringify(d) === JSON.stringify(h);
  if (!ok) gagal++;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${n}${ok ? '' : ` (dapat ${JSON.stringify(d)}, harap ${JSON.stringify(h)})`}`);
};

/* Tangkap permintaan ke Midtrans, balas token palsu. */
const ditangkap = [];
const asli = globalThis.fetch;
/* Dua tombol di bawah dipakai uji pembatalan & kedaluwarsa. */
let cancelHttp = 200;
let statusMidtrans = null;
globalThis.fetch = async (url, opsi = {}) => {
  const body = opsi.body ? JSON.parse(opsi.body) : null;
  const u = String(url);
  ditangkap.push({ url: u, body, method: opsi.method || 'GET' });
  if (u.includes('/snap/v1/transactions')) {
    return {
      ok: true,
      status: 201,
      text: async () => JSON.stringify({ token: 'TOKEN-' + (body?.transaction_details?.order_id || ''), redirect_url: 'https://x' })
    };
  }
  if (u.endsWith('/cancel')) {
    return { ok: cancelHttp < 400, status: cancelHttp, text: async () => JSON.stringify({
      status_code: String(cancelHttp),
      status_message: cancelHttp < 400 ? 'Success, transaction canceled.' : 'Transaction cannot be canceled.'
    }) };
  }
  if (u.endsWith('/status')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(statusMidtrans || {}) };
  }
  return { ok: false, status: 404, text: async () => '{}' };
};

const HEADERS = { 'x-forwarded-host': 'toko-contoh.com', 'x-forwarded-proto': 'https' };

/* ---------- 1. Pesanan dasar ---------- */
await store.put('orders', {
  orderId: 'CE-AUD-1', invoiceNumber: 'INV/1', customerName: 'Audit',
  customerPhone: '082249879873', phoneLast4: '9873', customerEmail: '-',
  items: [], totalAmount: 16000, paymentStatus: 'MENUNGGU_VERIFIKASI',
  status: 'MENUNGGU_KONFIRMASI', createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(), timeline: []
});

const mintaToken = (orderId, headers = HEADERS) =>
  core.dispatch({ method: 'POST', path: '/api/payments/midtrans/token',
    headers, query: {}, body: { orderId } });

/* ---------- 2. Percobaan pertama ---------- */
const t1 = await mintaToken('CE-AUD-1');
cek('token pertama = 200', t1.status, 200);
cek('order_id Midtrans tanpa akhiran',
  ditangkap.at(-1).body.transaction_details.order_id, 'CE-AUD-1');

/* finishUrl harus halaman yang ADA */
cek('finishUrl menunjuk /lacak-pesanan',
  ditangkap.at(-1).body.callbacks?.finish,
  'https://toko-contoh.com/lacak-pesanan?q=CE-AUD-1');
cek('finishUrl TIDAK menunjuk rute mati /pesanan/',
  String(ditangkap.at(-1).body.callbacks?.finish || '').includes('/pesanan/'), false);

/* ---------- 3. Percobaan kedua: order_id HARUS berubah ---------- */
const t2 = await mintaToken('CE-AUD-1');
cek('token kedua tetap 200', t2.status, 200);
cek('order_id Midtrans jadi -R2 (Midtrans menolak id yang dipakai ulang)',
  ditangkap.at(-1).body.transaction_details.order_id, 'CE-AUD-1-R2');

const o = await store.get('orders', 'CE-AUD-1');
cek('paymentAttempt tersimpan = 2', o.paymentAttempt, 2);

const t3 = await mintaToken('CE-AUD-1');
cek('percobaan ketiga = -R3', ditangkap.at(-1).body.transaction_details.order_id, 'CE-AUD-1-R3');

/* ---------- 4. Otorisasi endpoint status ---------- */
const status = (orderId, phone) =>
  core.dispatch({ method: 'GET', path: `/api/payments/midtrans/status/${orderId}`,
    headers: {}, query: phone === undefined ? {} : { phone } });

cek('status tanpa 4 digit = 403', (await status('CE-AUD-1')).status, 403);
cek('status dengan 4 digit salah = 403', (await status('CE-AUD-1', '1111')).status, 403);
cek('status dengan 3 digit = 403', (await status('CE-AUD-1', '873')).status, 403);

/* ---------- 5. Pembatalan oleh pembeli ---------- */
const batal = (orderId, phone) =>
  core.dispatch({ method: 'POST', path: '/api/payments/midtrans/cancel',
    headers: {}, query: {}, body: { orderId, phone } });

cek('batal tanpa bukti = 403', (await batal('CE-AUD-1', '0000')).status, 403);

/*
 * `id` harus dibuang: store.put memakai properti `id`, jadi kalau ikut
 * terbawa dari penyimpanan sebelumnya, pesanan ini MENIMPA yang lama alih-alih
 * membuat baru.
 */
const { id: _buang1, ...tanpaId } = await store.get('orders', 'CE-AUD-1');
const dasar = tanpaId;
await store.put('orders', { ...dasar, orderId: 'CE-AUD-2', phoneLast4: '9873',
  paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI',
  midtransOrderId: 'CE-AUD-2', timeline: [] });
const b = await batal('CE-AUD-2', '9873');
cek('batal sah = 200', b.status, 200);
const o2 = await store.get('orders', 'CE-AUD-2');
cek('batal: status DIBATALKAN', o2.status, 'DIBATALKAN');
cek('batal: paymentStatus DIBATALKAN', o2.paymentStatus, 'DIBATALKAN');

/* Penjualan lunas TIDAK boleh dibatalkan sendiri (harus lewat admin/refund). */
await store.put('orders', { ...dasar, orderId: 'CE-AUD-3', phoneLast4: '9873',
  paymentStatus: 'LUNAS', status: 'DIPROSES', timeline: [] });
cek('batal pesanan LUNAS = 409', (await batal('CE-AUD-3', '9873')).status, 409);

/* Pesanan terkirim tidak boleh dibatalkan. */
await store.put('orders', { ...dasar, orderId: 'CE-AUD-4', phoneLast4: '9873',
  paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'DIKIRIM', timeline: [] });
cek('batal pesanan DIKIRIM = 409', (await batal('CE-AUD-4', '9873')).status, 409);

/* Batalkan dua kali = idempoten, bukan galat. */
const b2 = await batal('CE-AUD-2', '9873');
cek('batal kedua kali = 200 idempoten', [b2.status, b2.body.changed], [200, false]);

/* ---------- 6. Pembatalan lokal HARUS ikut membatalkan tagihan di Midtrans ---------- */
/*
 * Kalau hanya database kita yang diubah, QRIS/link Snap yang masih tampil di
 * layar pembeli tetap bisa dibayar → uang masuk untuk pesanan yang sudah
 * DIBATALKAN. Jadi wajib ada panggilan /v2/<order_id>/cancel ke Midtrans.
 */
const panggilanCancel = ditangkap.filter((x) => x.url.endsWith('/v2/CE-AUD-2/cancel'));
cek('batal pembeli memanggil /v2/<order_id>/cancel di Midtrans', panggilanCancel.length, 1);
cek('pembatalan Midtrans memakai metode POST', panggilanCancel[0]?.method, 'POST');
const o2b = await store.get('orders', 'CE-AUD-2');
cek('timeline mencatat tagihan Midtrans dibatalkan',
  (o2b.timeline || []).some((t) => String(t.status).includes('Tagihan di Midtrans ikut dibatalkan')), true);

/* Midtrans MENOLAK pembatalan → jangan tutup pesanan diam-diam. */
cancelHttp = 500;
await store.put('orders', { ...dasar, orderId: 'CE-AUD-5', phoneLast4: '9873',
  paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI',
  midtransOrderId: 'CE-AUD-5', timeline: [] });
cek('Midtrans menolak batal = 502', (await batal('CE-AUD-5', '9873')).status, 502);
cek('pesanan TETAP aktif saat Midtrans menolak batal',
  (await store.get('orders', 'CE-AUD-5')).status, 'MENUNGGU_KONFIRMASI');
cancelHttp = 200;

/* ---------- 7. Tagihan kedaluwarsa harus DIKATAKAN ke pembeli ---------- */
/*
 * Dulu endpoint status hanya bilang "belum lunas" selamanya. Pembeli yang
 * tagihannya sudah expire mengira tombolnya rusak, padahal tagihannya memang
 * sudah mati dan harus dibuat baru.
 */
await store.put('orders', { ...dasar, orderId: 'CE-AUD-6', phoneLast4: '9873',
  paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI',
  midtransOrderId: 'CE-AUD-6', paymentAttempt: 1, timeline: [] });

statusMidtrans = { transaction_status: 'expire', status_code: '407', gross_amount: '16000.00' };
const sExpire = await status('CE-AUD-6', '9873');
cek('status tagihan expire = 200', sExpire.status, 200);
cek('status melaporkan kedaluwarsa', sExpire.body.kedaluwarsa, 'kedaluwarsa');
cek('status tetap belum lunas', sExpire.body.paymentStatus, 'MENUNGGU_VERIFIKASI');

statusMidtrans = { transaction_status: 'pending', status_code: '201', gross_amount: '16000.00' };
cek('tagihan pending TIDAK dilaporkan kedaluwarsa',
  (await status('CE-AUD-6', '9873')).body.kedaluwarsa, null);

statusMidtrans = { transaction_status: 'settlement', status_code: '200', gross_amount: '16000.00',
  transaction_id: 'trx-1', payment_type: 'qris' };
const sLunas = await status('CE-AUD-6', '9873');
cek('settlement via cek status melunaskan', sLunas.body.paymentStatus, 'LUNAS');
cek('pesanan benar-benar LUNAS di database',
  (await store.get('orders', 'CE-AUD-6')).paymentStatus, 'LUNAS');

/* ---------- 8. Teks jalur manual tidak boleh bocor ke browser ---------- */
/*
 * `payment.instructions` tersimpan di database sejak era transfer manual dan
 * berbunyi "termasuk 3 angka unik". Teks itu dipakai checkout & halaman lacak,
 * jadi harus DIGANTI saat Midtrans aktif — kalau tidak, pembeli membaca tagihan
 * yang seolah berbeda dari total.
 */
const setelanLama = (await store.get('settings', 'store')) || {};
await store.put('settings', {
  ...setelanLama,
  id: 'store',
  payment: {
    uniqueCodeEnabled: true,
    paymentWindowHours: 24,
    instructions: 'Transfer sesuai NOMINAL AKHIR (termasuk 3 angka unik di belakang).'
  }
});
const sf = await core.dispatch({ method: 'GET', path: '/api/storefront', headers: {}, query: {} });
const bayarPublik = sf.body.settings.payment;
cek('storefront: instruksi lama diganti', /angka unik/i.test(bayarPublik.instructions), false);
cek('storefront: kode unik dimatikan saat Midtrans aktif', bayarPublik.uniqueCodeEnabled, false);
cek('storefront: instruksi menyebut Midtrans', /midtrans/i.test(bayarPublik.instructions), true);
cek('storefront: serverKey TIDAK pernah dikirim',
  JSON.stringify(sf.body).includes('Mid-server-audit'), false);

globalThis.fetch = asli;
fs.rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? '\nAUDIT PEMBAYARAN LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
