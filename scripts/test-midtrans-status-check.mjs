/**
 * Uji endpoint status Midtrans sebagai JARING PENGAMAN WEBHOOK — tanpa jaringan.
 *
 * Skenario paling berbahaya: webhook GAGAL masuk sehingga pembeli sudah
 * membayar tetapi pesanan tetap "menunggu pembayaran". Endpoint ini dipanggil
 * saat pembeli menekan "Saya Sudah Bayar — Periksa Status", dan harus bisa
 * melunaskan sendiri — TANPA pernah melunaskan pesanan yang nominalnya tidak
 * cocok.
 *
 * Kenapa bukan cron: plan Vercel Hobby hanya mengizinkan 2 cron dan minimal
 * sekali sehari; cron tiap 15 menit membuat deploy GAGAL.
 *
 * Penyimpanan diarahkan ke folder sementara (CE_DATA_DIR).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-status-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-status';
process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-status';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');

/* Midtrans tiruan. */
const TABEL = {
  'CE-ST-1': { transaction_status: 'settlement', gross_amount: '50000.00', payment_type: 'qris' },
  'CE-ST-2': { transaction_status: 'settlement', gross_amount: '1000.00', payment_type: 'qris' },
  'CE-ST-3': { transaction_status: 'pending', gross_amount: '70000.00' },
  'CE-ST-4': { transaction_status: 'expire', gross_amount: '50000.00' },
  /*
   * Dua pesanan uji untuk membedakan "kunci beda" dari "kunci benar".
   * Midtrans menyertakan `signature_key` pada setiap respons status, dihitung
   * memakai ServerKey AKUN PEMILIK TRANSAKSI. Kalau kita hitung ulang dengan
   * kunci kita dan hasilnya sama, kunci kita pasti benar.
   */
  'CE-ST-5': { transaction_status: 'pending', gross_amount: '60000.00' },
  'CE-ST-6': { transaction_status: 'pending', gross_amount: '61000.00' }
};

/*
 * Signature dihitung dari kunci MILIK AKUN MIDTRANS, yang bisa berbeda dari
 * kunci di server. Inilah yang membuat notifikasi sungguhan ditolak.
 */
const crypto = await import('node:crypto');
const sigDengan = (kunci, o) =>
  crypto.createHash('sha512').update(`${o.order_id}${o.status_code}${o.gross_amount}${kunci}`).digest('hex');

/* CE-ST-5: tanda tangan dibuat dengan kunci yang SAMA seperti di server. */
TABEL['CE-ST-5'] = {
  ...TABEL['CE-ST-5'],
  order_id: 'CE-ST-5',
  status_code: '201',
  signature_key: sigDengan(process.env.MIDTRANS_SERVER_KEY, {
    order_id: 'CE-ST-5',
    status_code: '201',
    gross_amount: '60000.00'
  })
};

/* CE-ST-6: tanda tangan dibuat dengan kunci akun LAIN (kasus di produksi). */
TABEL['CE-ST-6'] = {
  ...TABEL['CE-ST-6'],
  order_id: 'CE-ST-6',
  status_code: '201',
  signature_key: sigDengan('SB-Mid-server-KUNCI-AKUN-LAIN', {
    order_id: 'CE-ST-6',
    status_code: '201',
    gross_amount: '61000.00'
  })
};
const asli = globalThis.fetch;
globalThis.fetch = async (url) => {
  const id = String(url).match(/\/v2\/([^/]+)\/status/)?.[1];
  const d = TABEL[id];
  return { ok: Boolean(d), status: d ? 200 : 404, text: async () => JSON.stringify(d || {}) };
};

let gagal = 0;
const cek = (n, d, h) => {
  const ok = JSON.stringify(d) === JSON.stringify(h);
  if (!ok) gagal++;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${n}${ok ? '' : ` (dapat ${JSON.stringify(d)}, harap ${JSON.stringify(h)})`}`);
};

const total = {
  'CE-ST-1': 50000,
  'CE-ST-2': 50000,
  'CE-ST-3': 70000,
  'CE-ST-4': 50000,
  'CE-ST-5': 60000,
  'CE-ST-6': 61000
};
for (const id of Object.keys(TABEL)) {
  await store.put('orders', {
    orderId: id,
    invoiceNumber: `INV/${id}`,
    customerName: 'Uji',
    customerPhone: '082249879873',
    phoneLast4: '9873',
    customerEmail: '-',
    items: [],
    totalAmount: total[id],
    paymentStatus: 'MENUNGGU_VERIFIKASI',
    status: 'MENUNGGU_KONFIRMASI',
    midtransOrderId: id,
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: []
  });
}

/*
 * 4 digit terakhir No. WhatsApp wajib dikirim: endpoint ini bisa MELUNASKAN
 * pesanan, jadi nomor pesanan saja tidak cukup sebagai bukti kepemilikan.
 */
const periksa = (id, phone = '9873') =>
  core.dispatch({
    method: 'GET',
    path: `/api/payments/midtrans/status/${id}`,
    headers: {},
    query: phone ? { phone } : {}
  });

/* 1. Settlement -> dilunaskan */
const r1 = await periksa('CE-ST-1');
cek('settlement: 200', r1.status, 200);
cek('settlement: paymentStatus LUNAS', r1.body.paymentStatus, 'LUNAS');
let o1 = await store.get('orders', 'CE-ST-1');
cek('settlement: tersimpan LUNAS', o1.paymentStatus, 'LUNAS');
cek('settlement: pindah ke DIPROSES', o1.status, 'DIPROSES');
cek('settlement: jalur midtrans', o1.paidVerifiedVia, 'midtrans');

/* 2. Nominal tidak cocok -> JANGAN dilunaskan */
const r2 = await periksa('CE-ST-2');
cek('nominal beda: ditandai', r2.body.nominalTidakCocok, true);
cek('nominal beda: tetap belum lunas', r2.body.paymentStatus, 'MENUNGGU_VERIFIKASI');
const o2 = await store.get('orders', 'CE-ST-2');
cek('nominal beda: tidak tersimpan LUNAS', o2.paymentStatus, 'MENUNGGU_VERIFIKASI');

/* 3. Pending -> tidak berubah */
const r3 = await periksa('CE-ST-3');
cek('pending: tetap menunggu', r3.body.paymentStatus, 'MENUNGGU_VERIFIKASI');

/* 4. Expire -> tidak dilunaskan */
const r4 = await periksa('CE-ST-4');
cek('expire: tidak dilunaskan', r4.body.paymentStatus, 'MENUNGGU_VERIFIKASI');

/* 5. Idempoten: periksa ulang tidak menambah timeline */
const panjang = (o1.timeline || []).length;
await periksa('CE-ST-1');
o1 = await store.get('orders', 'CE-ST-1');
cek('idempoten: timeline tidak bertambah', (o1.timeline || []).length, panjang);

/* 6. Tanpa bukti -> 403 (jangan bisa melunaskan milik orang lain) */
cek('tanpa 4 digit: 403', (await periksa('CE-ST-1', '')).status, 403);
cek('4 digit salah: 403', (await periksa('CE-ST-1', '1234')).status, 403);

/* 7. Pesanan tidak dikenal -> 404 */
cek('pesanan tidak ada: 404', (await periksa('TIDAK-ADA')).status, 404);

/*
 * 8. DETEKSI KUNCI SALAH — inti keluhan "kenapa pembayaran tidak pernah masuk".
 *
 * Notifikasi sungguhan ditolak karena tanda tangannya dihitung dengan kunci
 * akun Midtrans pemilik transaksi. Dengan membandingkan tanda tangan yang
 * Midtrans kirim di respons status, server BISA memastikan sebabnya sekarang
 * juga, tanpa menunggu notifikasi berikutnya.
 */
const r5 = await periksa('CE-ST-5');
cek('kunci sama: kunciCocok=true', r5.body.kunciCocok, true);

const r6 = await periksa('CE-ST-6');
cek('kunci beda: kunciCocok=false', r6.body.kunciCocok, false);
cek('kunci beda: pesanan TIDAK dilunaskan', r6.body.paymentStatus, 'MENUNGGU_VERIFIKASI');

/* Sebabnya harus tercatat, dan tanpa membocorkan nilai kunci. */
const audit = await store.list('audit').catch(() => []);
const catatan = audit.find((a) => a.action === 'pembayaran.kunci-tidak-cocok-dengan-akun' && a.target === 'CE-ST-6');
cek('kunci beda: tercatat di audit', Boolean(catatan), true);
const teks = JSON.stringify(catatan || {});
cek('kunci beda: nilai kunci tidak bocor', !teks.includes(process.env.MIDTRANS_SERVER_KEY), true);
cek('kunci beda: nilai kunci akun lain tidak bocor', !teks.includes('KUNCI-AKUN-LAIN'), true);

/* Tanpa signature_key dari Midtrans, jangan menyimpulkan apa pun. */
const rTanpaSig = await periksa('CE-ST-3');
cek('tanpa signature: kunciCocok=null (tidak dituduh salah)', rTanpaSig.body.kunciCocok, null);

globalThis.fetch = asli;
fs.rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? '\nSTATUS CHECK MIDTRANS LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
