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
  'CE-ST-4': { transaction_status: 'expire', gross_amount: '50000.00' }
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

const total = { 'CE-ST-1': 50000, 'CE-ST-2': 50000, 'CE-ST-3': 70000, 'CE-ST-4': 50000 };
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

globalThis.fetch = asli;
fs.rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? '\nSTATUS CHECK MIDTRANS LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
