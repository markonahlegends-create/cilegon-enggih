/**
 * Uji JEJAK NOTIFIKASI MIDTRANS — webhook tidak boleh pernah "diam".
 *
 * KENAPA UJI INI ADA
 * Kasus nyata order CE-20261124-701 (Rp 8.000, QRIS settlement di akun
 * produksi) membuat pesanan tetap MENUNGGU_VERIFIKASI berjam-jam. Yang membuat
 * penyebabnya sulit ditemukan bukan cuma bug host Core API, tetapi karena
 * notifikasi webhook yang DITOLAK tidak meninggalkan jejak sama sekali.
 *
 * Dua situasi yang sangat berbeda terlihat identik dari dashboard:
 *
 *   a. Midtrans TIDAK mengirim notifikasi  → tidak ada entri apa pun.
 *   b. Midtrans mengirim, tanda tangan ditolak → juga tidak ada entri apa pun.
 *
 * Sekarang keduanya harus bisa dibedakan. Uji ini mengunci perilaku itu, plus
 * memastikan nilai ServerKey TIDAK PERNAH masuk audit (hanya 8 karakter
 * terakhir).
 *
 * Penyimpanan diarahkan ke folder sementara (CE_DATA_DIR); tanpa jaringan.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-notif-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'Mid-server-KunciKitaPANJANG123';
process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-KunciKitaPANJANG123';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');
const { buildSignature, sidikKunci, verifySignature } = await import('../server/midtrans.js');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

const HEADERS = { 'x-forwarded-host': 'toko-contoh.com', 'x-forwarded-proto': 'https' };
const kirimNotifikasi = (payload) =>
  core.dispatch({
    method: 'POST',
    path: '/api/payments/midtrans/notification',
    headers: HEADERS,
    query: {},
    body: payload
  });

const auditPembayaran = async () =>
  (await store.list('audit'))
    .filter((d) => String(d.action || '').startsWith('pembayaran.'))
    .sort((a, b) => String(a.at).localeCompare(String(b.at)));

/* ---------- 1. Sidik kunci: aman ditampilkan ---------- */
const sidik = sidikKunci(process.env.MIDTRANS_SERVER_KEY);
cek(
  'sidik: 8 karakter terakhir = ujung ServerKey',
  sidik.ekor,
  process.env.MIDTRANS_SERVER_KEY.slice(-8)
);
cek('sidik: ekor berbeda dari kunci penuh', sidik.ekor === process.env.MIDTRANS_SERVER_KEY, false);
cek('sidik: panjang kunci tercatat', sidik.panjang, process.env.MIDTRANS_SERVER_KEY.length);
cek('sidik: mode dari awalan kunci', sidik.mode, 'produksi');
cek('sidik: kunci sandbox dikenali', sidikKunci('SB-Mid-server-abcdefgh').mode, 'sandbox');
cek('sidik: kunci kosong = null', sidikKunci(''), null);

/* Pesanan uji */
const buatPesanan = (orderId, total) =>
  store.put('orders', {
    orderId,
    invoiceNumber: `INV/${orderId}`,
    customerName: 'Uji',
    customerPhone: '082249879873',
    phoneLast4: '9873',
    customerEmail: '-',
    items: [],
    totalAmount: total,
    paymentStatus: 'MENUNGGU_VERIFIKASI',
    status: 'MENUNGGU_KONFIRMASI',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: []
  });

await buatPesanan('CE-NOTIF-1', 8000);
await buatPesanan('CE-NOTIF-2', 8000);

/* ---------- 2. Tanda tangan SALAH harus TERCATAT ----------
 * Inilah kasus "kunci produksi berbeda dari akun transaksi". Dulu 403 tanpa
 * jejak; sekarang harus ada entri audit yang menyebut ekor kunci kita.
 */
const ttdPalsu = await kirimNotifikasi({
  order_id: 'CE-NOTIF-1',
  status_code: '200',
  gross_amount: '8000.00',
  transaction_status: 'settlement',
  signature_key: 'tanda-tangan-palsu'
});
cek('tanda tangan palsu = 403', ttdPalsu.status, 403);

let jejak = await auditPembayaran();
cek('tanda tangan palsu DICATAT', jejak.length, 1);
cek('jenis entri = notifikasi-ditolak-signature', jejak[0].action, 'pembayaran.notifikasi-ditolak-signature');
cek('entri berstatus fail', jejak[0].status, 'fail');
cek('entri menyebut nomor pesanan', jejak[0].target, 'CE-NOTIF-1');
cek('entri menyimpan ekor ServerKey kita', jejak[0].detail?.sidikEkor, sidik.ekor);
cek(
  'redaksi TIDAK menelan ekor sidik (nama field bebas kata kunci sensitif)',
  jejak[0].detail?.sidikEkor === '[disembunyikan]',
  false
);
cek('entri menjelaskan kemungkinan penyebab', Boolean(jejak[0].detail?.kemungkinan), true);

/* NILAI KUNCI PENUH TIDAK BOLEH TERSIMPAN DI MANA PUN */
const seluruhIsi = JSON.stringify(await store.list('audit'));
cek('ServerKey penuh TIDAK bocor ke audit', seluruhIsi.includes(process.env.MIDTRANS_SERVER_KEY), false);
cek(
  'clientKey penuh TIDAK bocor ke audit',
  seluruhIsi.includes(process.env.MIDTRANS_CLIENT_KEY),
  false
);

/* ---------- 3. Tanda tangan SAH + settlement → lunas & tercatat ---------- */
const payloadSah = {
  order_id: 'CE-NOTIF-2',
  status_code: '200',
  gross_amount: '8000.00',
  transaction_status: 'settlement',
  payment_type: 'qris',
  transaction_id: 'trx-uji-1',
  signature_key: buildSignature({
    orderId: 'CE-NOTIF-2',
    statusCode: '200',
    grossAmount: '8000.00',
    serverKey: process.env.MIDTRANS_SERVER_KEY
  })
};
cek('tanda tangan buatan kita sah', verifySignature(payloadSah, process.env.MIDTRANS_SERVER_KEY), true);

const lunas = await kirimNotifikasi(payloadSah);
cek('notifikasi sah = 200', lunas.status, 200);
cek('pesanan jadi LUNAS', (await store.get('orders', 'CE-NOTIF-2')).paymentStatus, 'LUNAS');

jejak = await auditPembayaran();
const entriLunas = jejak.filter((d) => d.action === 'pembayaran.lunas-otomatis');
cek('lunas DICATAT sebagai lunas-otomatis', entriLunas.length, 1);
cek('entri lunas menyebut nominal', entriLunas[0].detail?.nominal, 8000);
cek('entri lunas menyebut jenis pembayaran', entriLunas[0].detail?.via, 'qris');

/* ---------- 4. Notifikasi ULANG tetap tercatat (bukti webhook hidup) ---------- */
const ulang = await kirimNotifikasi(payloadSah);
cek('notifikasi ulang = 200', ulang.status, 200);
jejak = await auditPembayaran();
cek(
  'notifikasi ulang DICATAT (idempoten, bukan hilang)',
  jejak.filter((d) => d.action === 'pembayaran.notifikasi-ulang').length,
  1
);
cek('pesanan tetap LUNAS', (await store.get('orders', 'CE-NOTIF-2')).paymentStatus, 'LUNAS');

/* ---------- 5. Nominal tidak cocok → ditolak & tercatat ---------- */
const nominalSalah = {
  ...payloadSah,
  order_id: 'CE-NOTIF-3',
  gross_amount: '1000.00',
  signature_key: buildSignature({
    orderId: 'CE-NOTIF-3',
    statusCode: '200',
    grossAmount: '1000.00',
    serverKey: process.env.MIDTRANS_SERVER_KEY
  })
};
await buatPesanan('CE-NOTIF-3', 8000);
const jawabNominal = await kirimNotifikasi(nominalSalah);
cek('nominal tidak cocok = 400', jawabNominal.status, 400);
cek(
  'pesanan TIDAK dilunaskan',
  (await store.get('orders', 'CE-NOTIF-3')).paymentStatus,
  'MENUNGGU_VERIFIKASI'
);
jejak = await auditPembayaran();
cek(
  'nominal tidak cocok DICATAT',
  jejak.filter((d) => d.action === 'pembayaran.nominal-tidak-cocok').length,
  1
);

/* ---------- 6. Pesanan tak dikenal → tetap 200 & tercatat ---------- */
const asing = {
  ...payloadSah,
  order_id: 'CE-TIDAK-ADA',
  signature_key: buildSignature({
    orderId: 'CE-TIDAK-ADA',
    statusCode: '200',
    grossAmount: '8000.00',
    serverKey: process.env.MIDTRANS_SERVER_KEY
  })
};
const jawabAsing = await kirimNotifikasi(asing);
cek('pesanan tak dikenal = 200 (Midtrans berhenti kirim ulang)', jawabAsing.status, 200);
jejak = await auditPembayaran();
cek(
  'pesanan tak dikenal DICATAT',
  jejak.filter((d) => d.action === 'pembayaran.notifikasi-tak-dikenal').length,
  1
);

/* ---------- 7. Diagnosa menampilkan riwayat notifikasi ---------- */
const ambilDiagnosa = async () => {
  const res = await core.dispatch({ method: 'GET', path: '/api/diagnose', headers: {}, query: {} });
  const badan = res.body || res.json || {};
  return {
    status: res.status,
    badan,
    riwayat: badan.notifikasiMidtrans || [],
    periksa: (badan.checks || []).find((c) => c.id === 'midtrans-notifikasi-terakhir')
  };
};

const d1 = await ambilDiagnosa();
cek('diagnosa = 200', d1.status, 200);
cek('diagnosa menyertakan riwayat notifikasi', d1.riwayat.length > 0, true);
cek('diagnosa punya pemeriksaan riwayat notifikasi', Boolean(d1.periksa), true);

/*
 * Penolakan di langkah 2 terjadi SEBELUM pelunasan berhasil. Diagnosa TIDAK
 * boleh merah selamanya gara-gara kejadian lama: notifikasi sukses terakhir
 * membuktikan kuncinya sudah benar.
 */
cek(
  'penolakan LAMA yang sudah terlewati → status ok',
  d1.periksa?.status,
  'ok'
);
cek(
  'detail menyebut penolakan lama sudah terlewati',
  /penolakan lama/i.test(String(d1.periksa?.detail || '')),
  true
);

/* ---------- 8. Penolakan BARU → diagnosa merah ---------- */
await kirimNotifikasi({
  order_id: 'CE-NOTIF-BARU',
  status_code: '200',
  gross_amount: '5000.00',
  transaction_status: 'settlement',
  signature_key: 'tanda-tangan-palsu-lagi'
});

const d2 = await ambilDiagnosa();
cek('penolakan baru → diagnosa fail', d2.periksa?.status, 'fail');
cek(
  'diagnosa memperingatkan ServerKey berbeda',
  /ServerKey|MIDTRANS_SERVER_KEY/.test(String(d2.periksa?.fix || '')),
  true
);
cek(
  'saran menyebut 8 karakter terakhir kunci',
  String(d2.periksa?.fix || '').includes(sidik.ekor),
  true
);

/* Larangan: nilai kunci tidak boleh ikut di respons diagnosa */
const teksDiag = JSON.stringify(d2.badan);
cek('respons diagnosa TIDAK memuat ServerKey penuh', teksDiag.includes(process.env.MIDTRANS_SERVER_KEY), false);

fs.rmSync(DIR, { recursive: true, force: true });
console.log(gagal === 0 ? '\nJEJAK NOTIFIKASI MIDTRANS LULUS' : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
