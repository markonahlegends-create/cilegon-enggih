/**
 * Uji alur webhook Midtrans end-to-end — TANPA jaringan, TANPA kredensial asli.
 *
 * Memakai dispatch() dan store yang SUNGGUHAN, supaya yang diuji benar-benar
 * kode produksi: verifikasi tanda tangan, pencocokan nominal, idempotensi,
 * pengembalian stok, dan penanganan `capture` + `challenge`.
 *
 * PENTING: penyimpanan diarahkan ke folder sementara lewat CE_DATA_DIR
 * (server/db.js:60). Tanpa ini, uji akan menulis pesanan palsu ke
 * server/data/ — dan sekali `npm run seed` dijalankan, data itu bisa ikut
 * terkirim ke Supabase produksi.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR_UJI = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-uji-midtrans-'));
process.env.CE_DATA_DIR = DIR_UJI;
// Pastikan uji tidak pernah menyentuh Supabase, sekalipun env mesin terisi.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
delete process.env.SUPABASE_ANON_KEY;

const SK = 'SB-Mid-server-ujialur';
process.env.MIDTRANS_SERVER_KEY = SK;
process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-ujialur';
process.env.MIDTRANS_IS_PRODUCTION = 'false';

const core = await import('/home/user/cilegon-enggih/server/core.js');
const { store } = await import('/home/user/cilegon-enggih/server/db.js');
const { buildSignature } = await import('/home/user/cilegon-enggih/server/midtrans.js');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)})`}`);
};

const kirim = async (body) => {
  const res = await core.dispatch({
    method: 'POST', path: '/api/payments/midtrans/notification',
    body, headers: {}, query: {}
  });
  return res;
};

const total = 105123;
const midtransId = 'CE-UJI-0001';
const order = {
  orderId: 'CE-UJI-0001',
  invoiceNumber: 'INV/UJI/1',
  customerName: 'Uji Otomatis',
  customerPhone: '082249879873',
  customerEmail: '-',
  items: [],
  subtotal: total, shippingCost: 0, voucherDiscount: 0,
  totalBeforeCode: total, totalAmount: total,
  paymentStatus: 'MENUNGGU_VERIFIKASI',
  status: 'MENUNGGU_KONFIRMASI',
  midtransOrderId: midtransId,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  timeline: []
};
await store.put('orders', order);

const nota = (over = {}) => {
  const p = {
    order_id: midtransId, status_code: '200', gross_amount: `${total}.00`,
    transaction_status: 'settlement', transaction_id: 'trx-1',
    payment_type: 'qris', fraud_status: 'accept', ...over
  };
  p.signature_key = buildSignature({
    orderId: p.order_id, statusCode: p.status_code,
    grossAmount: p.gross_amount, serverKey: SK
  });
  return p;
};

// 1. Nominal tidak cocok -> 400, pesanan TIDAK lunas
const r1 = await kirim(nota({ gross_amount: '1000.00' }));
cek('nominal receh = 400', r1.status, 400);
let o = await store.get('orders', 'CE-UJI-0001');
cek('nominal receh: pesanan tetap belum lunas', o.paymentStatus, 'MENUNGGU_VERIFIKASI');

// 2. Settlement -> lunas + pindah ke DIPROSES
const r2 = await kirim(nota());
cek('settlement = 200', r2.status, 200);
o = await store.get('orders', 'CE-UJI-0001');
cek('settlement: LUNAS', o.paymentStatus, 'LUNAS');
cek('settlement: otomatis DIPROSES', o.status, 'DIPROSES');
cek('settlement: jalur tercatat midtrans', o.paidVerifiedVia, 'midtrans');
cek('settlement: transaction_id tersimpan', o.midtransTransactionId, 'trx-1');

// 3. Notifikasi ganda -> idempoten, timeline tidak bertambah
const panjangTimeline = (o.timeline || []).length;
const r3 = await kirim(nota());
cek('ganda = tetap 200', r3.status, 200);
o = await store.get('orders', 'CE-UJI-0001');
cek('ganda: timeline tidak bertambah',
  (o.timeline || []).length, panjangTimeline);
cek('ganda: changed=false', r3.body.changed, false);

// 4. Pesanan kedua: expire -> batal + stok kembali
const order2 = { ...order, orderId: 'CE-UJI-0002', midtransOrderId: 'CE-UJI-0002',
  items: [], paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI', timeline: [] };
await store.put('orders', order2);
const nota2 = (over = {}) => {
  const p = { order_id: 'CE-UJI-0002', status_code: '200', gross_amount: `${total}.00`,
    transaction_status: 'expire', ...over };
  p.signature_key = buildSignature({ orderId: p.order_id, statusCode: p.status_code,
    grossAmount: p.gross_amount, serverKey: SK });
  return p;
};
const r4 = await kirim(nota2());
cek('expire = 200', r4.status, 200);
const o2 = await store.get('orders', 'CE-UJI-0002');
cek('expire: pesanan DIBATALKAN', o2.status, 'DIBATALKAN');
cek('expire: paymentStatus DIBATALKAN', o2.paymentStatus, 'DIBATALKAN');

// 5. capture + challenge -> TIDAK lunas, ditandai tinjau manual
const order3 = { ...order, orderId: 'CE-UJI-0003', midtransOrderId: 'CE-UJI-0003',
  paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI', timeline: [] };
await store.put('orders', order3);
const nota3 = { order_id: 'CE-UJI-0003', status_code: '200', gross_amount: `${total}.00`,
  transaction_status: 'capture', fraud_status: 'challenge' };
nota3.signature_key = buildSignature({ orderId: nota3.order_id, statusCode: nota3.status_code,
  grossAmount: nota3.gross_amount, serverKey: SK });
const r5 = await kirim(nota3);
cek('challenge = 200', r5.status, 200);
cek('challenge: ditandai perlu tinjau', r5.body.needReview, true);
const o3 = await store.get('orders', 'CE-UJI-0003');
cek('challenge: TIDAK lunas', o3.paymentStatus, 'MENUNGGU_VERIFIKASI');
cek('challenge: needsManualReview tersimpan', o3.needsManualReview, true);

// 6. order_id percobaan ulang (-R2) tetap menemukan pesanannya
const order4 = { ...order, orderId: 'CE-UJI-0004', midtransOrderId: 'CE-UJI-0004-R2',
  totalAmount: total, paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI', timeline: [] };
await store.put('orders', order4);
const nota4 = { order_id: 'CE-UJI-0004-R2', status_code: '200', gross_amount: `${total}.00`,
  transaction_status: 'settlement', transaction_id: 'trx-4' };
nota4.signature_key = buildSignature({ orderId: nota4.order_id, statusCode: nota4.status_code,
  grossAmount: nota4.gross_amount, serverKey: SK });
const r6 = await kirim(nota4);
cek('percobaan ulang -R2 = 200', r6.status, 200);
cek('percobaan ulang: pesanan LUNAS', r6.body.orderId, 'CE-UJI-0004');

// 7. Pesanan tak dikenal -> 200 diam-diam (jangan bikin Midtrans kirim ulang terus)
const notaX = { order_id: 'TIDAK-ADA', status_code: '200', gross_amount: '1000.00',
  transaction_status: 'settlement' };
notaX.signature_key = buildSignature({ orderId: 'TIDAK-ADA', statusCode: '200',
  grossAmount: '1000.00', serverKey: SK });
const r7 = await kirim(notaX);
cek('pesanan tak dikenal = 200 (berhenti dikirim ulang)', r7.status, 200);

fs.rmSync(DIR_UJI, { recursive: true, force: true });

console.log(gagal === 0 ? '\nALUR WEBHOOK MIDTRANS LULUS' : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
