/**
 * UJI PEMBAYARAN YANG DITUNDA — tagihan dipakai ulang, bukan digandakan.
 *
 * LATAR BELAKANG (pertanyaan pemilik toko)
 * "Kalau pembeli ada kebutuhan mendesak lalu menutup popup pembayaran, dan
 *  beberapa jam atau besoknya ingin membayar, bagaimana ia menemukan kode
 *  pembayaran atau QRIS-nya?"
 *
 * Ada dua kegagalan yang HARUS dicegah, dan keduanya tidak kelihatan sampai
 * ada uang yang salah:
 *
 *   1. KODE HILANG.
 *      Popup Snap tidak bisa dibuka kembali tanpa token. Kalau server selalu
 *      membuat tagihan baru, pembeli yang sudah menyimpan/memotret QRIS
 *      kehilangan rujukannya — kode yang ia simpan tidak lagi ditampilkan.
 *
 *   2. BAYAR DUA KALI.
 *      Ini yang lebih berbahaya. Membuat tagihan baru TIDAK mematikan tagihan
 *      lama. Dua QRIS bisa aktif bersamaan untuk satu pesanan, dan pembeli
 *      bisa membayar keduanya.
 *
 * Perilaku yang benar:
 *   - tagihan lama masih berlaku  → token yang SAMA dikembalikan (reused)
 *   - tagihan lama sudah mati     → tagihan baru dibuat, tagihan lama
 *                                   DIBATALKAN lebih dulu
 *
 * Cara pakai: node scripts/test-midtrans-tagihan-tertunda.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-tertunda-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-tertunda';
process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-tertunda';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');

/*
 * Midtrans tiruan.
 *
 * `status` mengubah jawaban endpoint /status, sehingga satu tabel yang sama
 * bisa dipakai untuk menguji "tagihan masih hidup" dan "tagihan sudah mati".
 */
const status = {
  /* Pesanan 1: tagihan lama masih PENDING → harus dipakai ulang. */
  'CE-TD-1': { transaction_status: 'pending', gross_amount: '75000.00' },
  /* Pesanan 2: tagihan lama sudah EXPIRE → tagihan baru + lama dibatalkan. */
  'CE-TD-2': { transaction_status: 'expire', gross_amount: '85000.00' },
  /* Pesanan 3: idem, tetapi dengan akhiran percobaan (-R2). */
  'CE-TD-3': { transaction_status: 'cancel', gross_amount: '95000.00' }
};

const jejak = { dibuat: [], dibatalkan: [], dicek: [], peristiwa: [] };

const asli = globalThis.fetch;
globalThis.fetch = async (url, opsi = {}) => {
  const u = String(url);

  /* Cek status transaksi. */
  const cekId = u.match(/\/v2\/([^/]+)\/status/)?.[1];
  if (cekId) {
    jejak.dicek.push(cekId);
    const d = status[cekId];
    return {
      ok: Boolean(d),
      status: d ? 200 : 404,
      text: async () => JSON.stringify(d || { status_message: 'not found' })
    };
  }

  /* Pembatalan transaksi. */
  const batalId = u.match(/\/v2\/([^/]+)\/cancel/)?.[1];
  if (batalId) {
    jejak.dibatalkan.push(batalId);
    jejak.peristiwa.push(`batal:${batalId}`);
    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({ status_code: '200', transaction_status: 'cancel' })
    };
  }

  /* Pembuatan token Snap. */
  if (u.includes('/snap/v1/transactions')) {
    const body = JSON.parse(opsi.body || '{}');
    const orderId = body.transaction_details?.order_id;
    jejak.dibuat.push(orderId);
    jejak.peristiwa.push(`buat:${orderId}`);
    /*
     * Token sengaja dibuat unik per order_id: uji harus bisa membedakan
     * "token yang sama dikembalikan" dari "token baru dibuat".
     */
    return {
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          token: `TOKEN-${orderId}`,
          redirect_url: `https://app.midtrans.com/snap/v4/redirection/TOKEN-${orderId}`
        })
    };
  }

  return { ok: false, status: 404, text: async () => '{}' };
};

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, nilai) => cek(nama, Boolean(nilai), true);

/* --- Data uji ------------------------------------------------------------ */

const pesanan = (id, tambahan = {}) => ({
  orderId: id,
  invoiceNumber: `INV/${id}`,
  customerName: 'Pembeli Uji',
  customerPhone: '082249879873',
  phoneLast4: '9873',
  customerEmail: '-',
  items: [],
  totalAmount: { 'CE-TD-1': 75000, 'CE-TD-2': 85000, 'CE-TD-3': 95000 }[id],
  paymentStatus: 'MENUNGGU_VERIFIKASI',
  status: 'MENUNGGU_KONFIRMASI',
  createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
  timeline: [],
  ...tambahan
});

const mintaToken = (orderId) =>
  core.dispatch({
    method: 'POST',
    path: '/api/payments/midtrans/token',
    headers: {},
    body: { orderId }
  });

/* ---------------------------------------------------------------------- */
console.log('\n▶ Tagihan lama masih berlaku — harus DIPAKAI ULANG');

await store.put(
  'orders',
  pesanan('CE-TD-1', {
    paymentAttempt: 1,
    midtransOrderId: 'CE-TD-1-R1',
    snapToken: 'TOKEN-LAMA-TD1',
    snapRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/TOKEN-LAMA-TD1'
  })
);
status['CE-TD-1-R1'] = status['CE-TD-1'];

const r1 = await mintaToken('CE-TD-1');
cek('HTTP 200', r1.status, 200);
cek('token yang SAMA dikembalikan', r1.body.token, 'TOKEN-LAMA-TD1');
cek('ditandai reused', r1.body.reused, true);
cek(
  'tautan tagihan ikut dikirim',
  r1.body.redirectUrl,
  'https://app.midtrans.com/snap/v4/redirection/TOKEN-LAMA-TD1'
);
cek('TIDAK ada tagihan baru dibuat', jejak.dibuat.filter((x) => x.startsWith('CE-TD-1')).length, 0);
cek('percobaan tidak bertambah', (await store.get('orders', 'CE-TD-1')).paymentAttempt, 1);

/* ---------------------------------------------------------------------- */
console.log('\n▶ Tagihan lama sudah mati — tagihan baru, dan yang lama DIBATALKAN');

await store.put(
  'orders',
  pesanan('CE-TD-2', {
    paymentAttempt: 1,
    midtransOrderId: 'CE-TD-2-R1',
    snapToken: 'TOKEN-LAMA-TD2',
    snapRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/TOKEN-LAMA-TD2'
  })
);
status['CE-TD-2-R1'] = status['CE-TD-2'];

const r2 = await mintaToken('CE-TD-2');
cek('HTTP 200', r2.status, 200);
benar('token baru dibuat', r2.body.token && r2.body.token !== 'TOKEN-LAMA-TD2');
cek('BUKAN reused', Boolean(r2.body.reused), false);
cek(
  'tagihan lama dibatalkan lebih dulu',
  jejak.dibatalkan.includes('CE-TD-2-R1'),
  true
);

const o2 = await store.get('orders', 'CE-TD-2');
cek('percobaan bertambah jadi 2', o2.paymentAttempt, 2);
cek('tagihan baru tersimpan', o2.snapToken, r2.body.token);
cek('id Midtrans baru memakai akhiran -R2', o2.midtransOrderId, 'CE-TD-2-R2');

/*
 * Urutan penting: pembatalan HARUS terjadi sebelum token baru dibuat.
 * Kalau terbalik, ada jeda ketika dua tagihan aktif bersamaan — dan di jeda
 * itulah pembeli bisa membayar dua kali.
 */
const urutanBatal = jejak.peristiwa.lastIndexOf('batal:CE-TD-2-R1');
const urutanBuat = jejak.peristiwa.lastIndexOf('buat:CE-TD-2-R2');
cek(
  'pembatalan dilakukan SEBELUM pembuatan tagihan baru',
  urutanBatal !== -1 && urutanBuat !== -1 && urutanBatal < urutanBuat,
  true
);

/* ---------------------------------------------------------------------- */
console.log('\n▶ Pembatalan tagihan lama gagal — pembeli tetap bisa membayar');

await store.put(
  'orders',
  pesanan('CE-TD-3', {
    paymentAttempt: 1,
    midtransOrderId: 'CE-TD-3-R1',
    snapToken: 'TOKEN-LAMA-TD3',
    snapRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/TOKEN-LAMA-TD3'
  })
);
status['CE-TD-3-R1'] = status['CE-TD-3'];

/*
 * Gangguan sungguhan: Midtrans membalas 500 pada permintaan pembatalan.
 *
 * Catatan: 412 BUKAN kegagalan — arti 412 adalah "transaksi tidak bisa
 * dibatalkan" karena memang sudah mati (settle/expire/cancel), dan
 * `cancelTransaction` sudah memperlakukannya sebagai berhasil.
 */
const fetchSebelum = globalThis.fetch;
globalThis.fetch = async (url, opsi = {}) => {
  if (/\/cancel/.test(String(url))) {
    return {
      ok: false,
      status: 500,
      text: async () =>
        JSON.stringify({ status_code: '500', status_message: 'Internal server error' })
    };
  }
  return fetchSebelum(url, opsi);
};

const r3 = await mintaToken('CE-TD-3');
cek('HTTP 200 — pembeli TIDAK dihalangi', r3.status, 200);
benar('tagihan baru tetap dibuat', r3.body.token && r3.body.token !== 'TOKEN-LAMA-TD3');

/* Kegagalan pembatalan harus meninggalkan jejak audit, bukan ditelan. */
const audit = await store.list('audit');
const catatan = (audit || []).filter(
  (a) => a.action === 'pembayaran.tagihan-lama-gagal-dibatalkan'
);
benar('kegagalan pembatalan tercatat di audit', catatan.length > 0);
if (catatan.length) {
  cek('audit menyebut pesanannya', catatan[0].target, 'CE-TD-3');
  cek('audit memuat status HTTP', catatan[0].detail?.httpStatus, 500);
}

globalThis.fetch = fetchSebelum;

/* ---------------------------------------------------------------------- */
console.log('\n▶ Jejak pemakaian ulang juga diaudit');

await store.put(
  'orders',
  pesanan('CE-TD-4', {
    paymentAttempt: 1,
    midtransOrderId: 'CE-TD-4-R1',
    snapToken: 'TOKEN-LAMA-TD4',
    snapRedirectUrl: 'https://app.midtrans.com/snap/v4/redirection/TOKEN-LAMA-TD4'
  })
);
status['CE-TD-4-R1'] = { transaction_status: 'pending', gross_amount: '105000.00' };
const r4 = await mintaToken('CE-TD-4');
cek('token sama dikembalikan', r4.body.token, 'TOKEN-LAMA-TD4');
const audit2 = await store.list('audit');
benar(
  'pemakaian ulang tercatat di audit',
  (audit2 || []).some((a) => a.action === 'pembayaran.tagihan-dipakai-ulang')
);

/* ---------------------------------------------------------------------- */
console.log('\n▶ Pengaman yang tidak boleh hilang');

cek('pesanan lunas tetap ditolak', (await (async () => {
  await store.put(
    'orders',
    pesanan('CE-TD-5', { paymentStatus: 'LUNAS', midtransOrderId: 'CE-TD-5-R1' })
  );
  return mintaToken('CE-TD-5');
})()).status, 409);

cek('pesanan dibatalkan tetap ditolak', (await (async () => {
  await store.put(
    'orders',
    pesanan('CE-TD-6', {
      status: 'DIBATALKAN',
      paymentStatus: 'DIBATALKAN',
      midtransOrderId: 'CE-TD-6-R1'
    })
  );
  return mintaToken('CE-TD-6');
})()).status, 409);

cek('pesanan tak dikenal tetap 404', (await mintaToken('TIDAK-ADA')).status, 404);

globalThis.fetch = asli;
fs.rmSync(DIR, { recursive: true, force: true });

console.log(gagal === 0 ? '\nTAGIHAN TERTUNDA LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
