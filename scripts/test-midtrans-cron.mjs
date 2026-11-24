/**
 * Uji cron reconcile Midtrans — TANPA jaringan.
 *
 * Meniru skenario paling berbahaya: webhook GAGAL masuk sehingga pembeli
 * sudah membayar tetapi pesanan tetap "menunggu pembayaran". Cron harus
 * menemukannya sendiri lewat API status Midtrans, tanpa pernah melunaskan
 * pesanan yang nominalnya tidak cocok.
 *
 * Penyimpanan diarahkan ke folder sementara (CE_DATA_DIR) supaya tidak
 * menyentuh server/data/.
 */
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-cron-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'SB-Mid-server-cron';
process.env.MIDTRANS_CLIENT_KEY = 'SB-Mid-client-cron';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
process.env.CRON_SECRET = 'rahasia-cron-uji';
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const core = await import('/home/user/cilegon-enggih/server/core.js');
const { store } = await import('/home/user/cilegon-enggih/server/db.js');
const mt = await import('/home/user/cilegon-enggih/server/midtrans.js');

// Midtrans tiruan: 1 pesanan sudah settlement, 1 beda nominal, 1 masih pending
const TABEL = {
  'CE-CRON-1': { transaction_status:'settlement', status_code:'200', gross_amount:'50000.00', payment_type:'qris' },
  'CE-CRON-2': { transaction_status:'settlement', status_code:'200', gross_amount:'1000.00', payment_type:'qris' },
  'CE-CRON-3': { transaction_status:'pending', status_code:'201', gross_amount:'70000.00' },
};
const asli = globalThis.fetch;
globalThis.fetch = async (url) => {
  const id = String(url).match(/\/v2\/([^/]+)\/status/)?.[1];
  const d = TABEL[id];
  return { ok: Boolean(d), status: d ? 200 : 404, text: async () => JSON.stringify(d || {}) };
};

let gagal = 0;
const cek = (n, d, h) => { const ok = JSON.stringify(d)===JSON.stringify(h); if(!ok)gagal++;
  console.log(`${ok?'  OK  ':'  SALAH'} ${n}${ok?'':` (dapat ${JSON.stringify(d)}, harap ${JSON.stringify(h)})`}`); };

const lama = new Date(Date.now() - 20*60*1000).toISOString(); // 20 menit lalu
for (const id of ['CE-CRON-1','CE-CRON-2','CE-CRON-3']) {
  await store.put('orders', {
    orderId:id, invoiceNumber:'INV/'+id, customerName:'Uji', customerPhone:'0822',
    customerEmail:'-', items:[], totalAmount: id==='CE-CRON-2'? 50000 : id==='CE-CRON-1'? 50000 : 70000,
    paymentStatus:'MENUNGGU_VERIFIKASI', status:'MENUNGGU_KONFIRMASI',
    midtransOrderId:id, createdAt:lama, updatedAt:lama, timeline:[]
  });
}

const panggil = async (auth) => core.dispatch({ method:'GET', path:'/api/cron/midtrans-reconcile',
  headers: auth ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {}, query:{} });

cek('tanpa token = 401', (await panggil(false)).status, 401);

const r = await panggil(true);
cek('dengan token = 200', r.status, 200);
cek('diperiksa 3 pesanan', r.body.diperiksa, 3);
cek('hanya 1 dilunaskan', r.body.dilunaskan, ['CE-CRON-1']);
cek('nominal beda ditolak', r.body.gagal[0]?.alasan, 'nominal-tidak-cocok');

const o1 = await store.get('orders','CE-CRON-1');
const o2 = await store.get('orders','CE-CRON-2');
const o3 = await store.get('orders','CE-CRON-3');
cek('CE-CRON-1 LUNAS', o1.paymentStatus, 'LUNAS');
cek('CE-CRON-1 jalur midtrans', o1.paidVerifiedVia, 'midtrans');
cek('CE-CRON-2 TETAP belum lunas (nominal beda)', o2.paymentStatus, 'MENUNGGU_VERIFIKASI');
cek('CE-CRON-3 pending tetap menunggu', o3.paymentStatus, 'MENUNGGU_VERIFIKASI');

// Idempoten: jalankan lagi, tidak ada yang berubah
const r2 = await panggil(true);
cek('jalan kedua: tidak ada yang dilunaskan ulang', r2.body.dilunaskan, []);
const o1b = await store.get('orders','CE-CRON-1');
cek('jalan kedua: timeline tidak bertambah',
  (o1b.timeline||[]).length, (o1.timeline||[]).length);

// Pesanan baru (< 10 menit) tidak diganggu
/*
 * `id` harus dibuang dulu: store.put memakai properti `id`, dan kalau ikut
 * terbawa dari o1, pesanan ini akan MENIMPA CE-CRON-1 alih-alih membuat baru.
 */
const { id: _abaikan, ...salinan } = o1;
await store.put('orders', { ...salinan, orderId:'CE-CRON-4', midtransOrderId:'CE-CRON-4',
  paymentStatus:'MENUNGGU_VERIFIKASI', status:'MENUNGGU_KONFIRMASI',
  createdAt:new Date().toISOString(), timeline:[] });
const r3 = await panggil(true);
/*
 * CE-CRON-2 & CE-CRON-3 masih menunggu dan sudah lewat 10 menit, jadi tetap
 * diperiksa (2). Yang penting: CE-CRON-4 yang baru berumur detik TIDAK ikut.
 */
cek('pesanan lama tetap diperiksa (2)', r3.body.diperiksa, 2);
const o4 = await store.get('orders','CE-CRON-4');
cek('pesanan < 10 menit TIDAK diganggu', (o4.timeline||[]).length, 0);

globalThis.fetch = asli;
fs.rmSync(DIR, { recursive:true, force:true });
console.log(gagal===0 ? '\nCRON RECONCILE LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal===0?0:1);
