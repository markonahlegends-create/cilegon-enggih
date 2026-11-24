/**
 * Uji modul Midtrans — tanpa jaringan, tanpa kredensial.
 *
 * Fokus pada hal-hal yang kalau salah bikin toko rugi:
 *   - tanda tangan palsu harus ditolak
 *   - nominal harus dibaca apa adanya, bukan dibulatkan
 *   - capture+challenge TIDAK boleh dianggap lunas
 *   - konfigurasi setengah jadi harus fail-closed
 *   - order_id percobaan ulang harus unik & tetap dikenali
 */

import {
  midtransConfig,
  buildSignature,
  verifySignature,
  grossAmountToRupiah,
  mapTransactionStatus,
  buildMidtransOrderId,
  buildSnapPayload,
  basicAuthHeader,
  snapScriptUrl
} from '../server/midtrans.js';

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

const SERVER_KEY = 'SB-Mid-server-CONTOHSERVERKEY123';
const nota = {
  order_id: 'CE-20261116-041',
  status_code: '200',
  gross_amount: '105000.00',
  transaction_status: 'settlement'
};

/* ---------- 1. Konfigurasi ---------- */
cek('config: kosong = belum siap, sandbox', midtransConfig({}), {
  serverKey: '',
  clientKey: '',
  isProduction: false,
  base: 'https://app.sandbox.midtrans.com',
  ready: false
});

const cfgLengkap = midtransConfig({
  MIDTRANS_SERVER_KEY: 'x',
  MIDTRANS_CLIENT_KEY: 'y',
  MIDTRANS_IS_PRODUCTION: 'true'
});
cek('config: lengkap + produksi = siap', [cfgLengkap.ready, cfgLengkap.isProduction], [true, true]);
cek('config: base produksi benar', cfgLengkap.base, 'https://app.midtrans.com');

/* Hanya server key terisi -> TIDAK siap (mencegah tagihan dibuat tanpa clientKey) */
cek(
  'config: serverKey saja = belum siap',
  midtransConfig({ MIDTRANS_SERVER_KEY: 'x' }).ready,
  false
);

/* ---------- 2. Tanda tangan ---------- */
const sig = buildSignature({
  orderId: nota.order_id,
  statusCode: nota.status_code,
  grossAmount: nota.gross_amount,
  serverKey: SERVER_KEY
});

cek('signature: panjang SHA512 hex = 128', sig.length, 128);
cek('signature: deterministik', sig === buildSignature({
  orderId: nota.order_id,
  statusCode: nota.status_code,
  grossAmount: nota.gross_amount,
  serverKey: SERVER_KEY
}), true);

cek('verifikasi: tanda tangan asli diterima', verifySignature({ ...nota, signature_key: sig }, SERVER_KEY), true);
cek('verifikasi: tanda tangan salah ditolak', verifySignature({ ...nota, signature_key: 'deadbeef' }, SERVER_KEY), false);
cek('verifikasi: serverKey kosong = fail-closed', verifySignature({ ...nota, signature_key: sig }, ''), false);
cek('verifikasi: tanpa signature_key ditolak', verifySignature({ ...nota }, SERVER_KEY), false);
cek('verifikasi: payload null ditolak', verifySignature(null, SERVER_KEY), false);

/* Nominal dibulatkan = tanda tangan tidak cocok (jebakan klasik) */
cek(
  'verifikasi: gross_amount yang dibulatkan TIDAK cocok',
  verifySignature({ ...nota, signature_key: sig, gross_amount: '105000' }, SERVER_KEY),
  false
);

/* Ganti nominal = tanda tangan lama tidak sah */
cek(
  'verifikasi: nominal diubah membuat tanda tangan gugur',
  verifySignature({ ...nota, gross_amount: '1000.00', signature_key: sig }, SERVER_KEY),
  false
);

/* ---------- 3. Nominal ---------- */
cek('nominal: "105000.00" -> 105000', grossAmountToRupiah('105000.00'), 105000);
cek('nominal: angka -> 105000', grossAmountToRupiah(105000), 105000);
cek('nominal: "abc" -> NaN', Number.isNaN(grossAmountToRupiah('abc')), true);

/* ---------- 4. Pemetaan status ---------- */
cek('status: settlement = LUNAS', mapTransactionStatus({ transaction_status: 'settlement' }), 'LUNAS');
cek(
  'status: capture + accept = LUNAS',
  mapTransactionStatus({ transaction_status: 'capture', fraud_status: 'accept' }),
  'LUNAS'
);
cek(
  'status: capture + challenge = TINJAU (bukan lunas)',
  mapTransactionStatus({ transaction_status: 'capture', fraud_status: 'challenge' }),
  'TINJAU'
);
cek(
  'status: capture + deny = TUNGGU',
  mapTransactionStatus({ transaction_status: 'capture', fraud_status: 'deny' }),
  'TUNGGU'
);
cek('status: pending = TUNGGU', mapTransactionStatus({ transaction_status: 'pending' }), 'TUNGGU');
cek('status: expire = BATAL', mapTransactionStatus({ transaction_status: 'expire' }), 'BATAL');
cek('status: cancel = BATAL', mapTransactionStatus({ transaction_status: 'cancel' }), 'BATAL');
cek('status: failure = BATAL', mapTransactionStatus({ transaction_status: 'failure' }), 'BATAL');
cek('status: deny = TUNGGU (boleh coba lagi)', mapTransactionStatus({ transaction_status: 'deny' }), 'TUNGGU');
cek('status: tak dikenal = TUNGGU (fail safe)', mapTransactionStatus({ transaction_status: 'kode-aneh' }), 'TUNGGU');
cek('status: kosong = TUNGGU', mapTransactionStatus({}), 'TUNGGU');
cek('status: null = TUNGGU', mapTransactionStatus(null), 'TUNGGU');

/* ---------- 5. order_id percobaan ulang ---------- */
cek('order_id: percobaan 1 = apa adanya', buildMidtransOrderId('CE-20261116-041', 0), 'CE-20261116-041');
cek('order_id: percobaan 2 = -R2', buildMidtransOrderId('CE-20261116-041', 1), 'CE-20261116-041-R2');
cek('order_id: percobaan 3 = -R3', buildMidtransOrderId('CE-20261116-041', 2), 'CE-20261116-041-R3');

const panjang = buildMidtransOrderId('X'.repeat(60), 3);
cek('order_id: maksimal 50 karakter', panjang.length <= 50, true);
cek('order_id: akhiran tetap utuh saat dipotong', panjang.endsWith('-R4'), true);

cek(
  'order_id: karakter aneh dibuang',
  buildMidtransOrderId('CE/2026 11#016', 0),
  'CE202611016'
);

/* ---------- 6. Payload Snap ---------- */
const pesanan = {
  orderId: 'CE-20261116-041',
  midtransOrderId: 'CE-20261116-041',
  totalAmount: 105123,
  customerName: 'Rizky Pratama',
  customerPhone: '082249879873',
  customerEmail: 'rizky@example.com',
  items: [{ productId: 'p1', price: 38000, qty: 2, name: 'Mug Keramik' }]
};

const payload = buildSnapPayload(pesanan);
cek('payload: gross_amount dari total pesanan', payload.transaction_details.gross_amount, 105123);
cek('payload: order_id dipakai', payload.transaction_details.order_id, 'CE-20261116-041');
cek('payload: email diteruskan', payload.customer_details.email, 'rizky@example.com');
cek('payload: expiry 24 jam bawaan', payload.expiry, { unit: 'hours', duration: 24 });
cek(
  'payload: item_details TIDAK dikirim (cegah selisih dengan ongkir/diskon)',
  'item_details' in payload,
  false
);

/* Email "-" (nilai default sistem) tidak boleh dikirim ke Midtrans */
const tanpaEmail = buildSnapPayload({ ...pesanan, customerEmail: '-' });
cek('payload: email "-" tidak dikirim', 'email' in tanpaEmail.customer_details, false);

/* Total nol harus ditolak, bukan dibuatkan tagihan Rp 0 */
let tolakNol = false;
try {
  buildSnapPayload({ ...pesanan, totalAmount: 0 });
} catch {
  tolakNol = true;
}
cek('payload: total 0 ditolak', tolakNol, true);

/* ---------- 7. Header & URL skrip ---------- */
const header = basicAuthHeader('SB-Mid-server-abc');
cek('auth: skema Basic', header.startsWith('Basic '), true);
cek(
  'auth: password kosong setelah titik dua',
  Buffer.from(header.slice(6), 'base64').toString('utf8'),
  'SB-Mid-server-abc:'
);
cek(
  'snap.js: sandbox',
  snapScriptUrl(false),
  'https://app.sandbox.midtrans.com/snap/snap.js'
);
cek('snap.js: produksi', snapScriptUrl(true), 'https://app.midtrans.com/snap/snap.js');

console.log(gagal === 0 ? '\nSEMUA UJI MIDTRANS LULUS' : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
