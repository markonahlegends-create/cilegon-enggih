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
  snapScriptUrl,
  fetchTransactionStatus,
  cancelTransaction,
  jelaskanGagalStatus
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
const cfgKosong = midtransConfig({});
cek('config: kosong = belum siap', cfgKosong.ready, false);
cek('config: kosong = sandbox', [cfgKosong.isProduction, cfgKosong.snapBase, cfgKosong.apiBase],
  [false, 'https://app.sandbox.midtrans.com', 'https://api.sandbox.midtrans.com']);
cek('config: kosong = tanpa konflik', cfgKosong.konflik, false);

/* --- Mode ditebak dari awalan kunci, dan KUNCI MENANG atas flag --- */
const cfgProduksi = midtransConfig({
  MIDTRANS_SERVER_KEY: 'Mid-server-Produksi123',
  MIDTRANS_CLIENT_KEY: 'Mid-client-Produksi123',
  MIDTRANS_IS_PRODUCTION: 'false' // sengaja salah
});
cek(
  'config: kunci Mid-* = PRODUKSI walau flag false',
  [cfgProduksi.isProduction, cfgProduksi.snapBase, cfgProduksi.apiBase],
  [true, 'https://app.midtrans.com', 'https://api.midtrans.com']
);
cek('config: konflik flag dilaporkan', cfgProduksi.konflik, true);

const cfgSandbox = midtransConfig({
  MIDTRANS_SERVER_KEY: 'SB-Mid-server-Sandbox123',
  MIDTRANS_CLIENT_KEY: 'SB-Mid-client-Sandbox123',
  MIDTRANS_IS_PRODUCTION: 'true' // sengaja salah
});
cek(
  'config: kunci SB-* = SANDBOX walau flag true',
  [cfgSandbox.isProduction, cfgSandbox.snapBase, cfgSandbox.apiBase],
  [false, 'https://app.sandbox.midtrans.com', 'https://api.sandbox.midtrans.com']
);
cek('config: konflik arah sebaliknya juga dilaporkan', cfgSandbox.konflik, true);

const cfgCocok = midtransConfig({
  MIDTRANS_SERVER_KEY: 'Mid-server-Produksi123',
  MIDTRANS_CLIENT_KEY: 'Mid-client-Produksi123',
  MIDTRANS_IS_PRODUCTION: 'true'
});
cek('config: flag cocok dengan kunci = tanpa konflik', cfgCocok.konflik, false);
cek('config: lengkap + produksi = siap', cfgCocok.ready, true);

const cfgTakBerpola = midtransConfig({
  MIDTRANS_SERVER_KEY: 'aneh',
  MIDTRANS_CLIENT_KEY: 'lain',
  MIDTRANS_IS_PRODUCTION: 'true'
});
cek('config: kunci tak berpola -> ikut flag', cfgTakBerpola.isProduction, true);
cek('config: kunci tak berpola -> bukan konflik', cfgTakBerpola.konflik, false);

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

/*
 * ---------- 8. HOST CORE API ----------
 *
 * REGRESI BUG PRODUKSI NYATA (order CE-20261124-701, Rp 8.000 settlement):
 * cek status dan cancel dulu memakai `app.midtrans.com`, host yang hanya
 * melayani Snap. Core API menjawab 404, sehingga:
 *   - "Saya Sudah Bayar — Periksa Status" tidak pernah bisa melunaskan,
 *   - pembatalan pesanan mengira tagihan sudah mati padahal masih bisa dibayar.
 * Uji ini mengunci host yang benar supaya tidak bisa kembali.
 */
const cfgUji = midtransConfig({
  MIDTRANS_SERVER_KEY: 'Mid-server-Uji',
  MIDTRANS_CLIENT_KEY: 'Mid-client-Uji',
  MIDTRANS_IS_PRODUCTION: 'true'
});
const rekam = [];
const fetchPalsu = async (url) => {
  rekam.push(String(url));
  return { ok: false, status: 404, text: async () => '{"status_code":"404","status_message":"The requested resource is not found"}' };
};

rekam.length = 0;
await fetchTransactionStatus('CE-1', cfgUji, { fetchImpl: fetchPalsu });
cek('status: memakai api.midtrans.com (bukan app.)', rekam[0], 'https://api.midtrans.com/v2/CE-1/status');

rekam.length = 0;
await cancelTransaction('CE-1', cfgUji, { fetchImpl: fetchPalsu });
cek('cancel: memakai api.midtrans.com (bukan app.)', rekam[0], 'https://api.midtrans.com/v2/CE-1/cancel');

const cfgUjiSandbox = midtransConfig({
  MIDTRANS_SERVER_KEY: 'SB-Mid-server-Uji',
  MIDTRANS_CLIENT_KEY: 'SB-Mid-client-Uji'
});
rekam.length = 0;
await fetchTransactionStatus('CE-1', cfgUjiSandbox, { fetchImpl: fetchPalsu });
cek('status sandbox: api.sandbox.midtrans.com', rekam[0], 'https://api.sandbox.midtrans.com/v2/CE-1/status');

/* Tidak ada satu pun panggilan Core API yang boleh menyentuh app.* */
const semuaApi = rekam.every((u) => u.startsWith('https://api.'));
cek('core API tidak pernah ke app.*', semuaApi, true);

/*
 * ---------- 9. KEGAGALAN HARUS DIKATAKAN ----------
 * Sebelumnya kegagalan hanya `ok:false` tanpa sebab, sehingga pembeli melihat
 * "Memeriksa status..." tanpa akhir dan admin tidak punya petunjuk.
 */
const gagal404 = await fetchTransactionStatus('CE-2', cfgUji, { fetchImpl: fetchPalsu });
cek('gagal 404: httpStatus ikut dikirim', gagal404.status, 404);
cek('gagal 404: ada alasan yang bisa dibaca', /404/.test(gagal404.alasan || ''), true);
cek(
  'gagal 404: alasan menyebut kemungkinan akun/lingkungan berbeda',
  /akun\/lingkungan|berbeda/i.test(gagal404.alasan || ''),
  true
);
cek(
  'gagal 401: alasan menyebut kunci',
  /kunci/i.test(jelaskanGagalStatus(401, { status_message: 'Unauthorized' }) || ''),
  true
);

/* Sukses tidak boleh punya alasan (biar UI tidak menampilkan peringatan palsu) */
const sukses = await fetchTransactionStatus('CE-3', cfgUji, {
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    text: async () => '{"transaction_status":"settlement","gross_amount":"8000.00"}'
  })
});
cek('sukses: tanpa alasan', sukses.alasan, null);
cek('sukses: status 200', sukses.status, 200);

/*
 * ---------- 10. 404 SAAT CANCEL TIDAK BOLEH DIPERCAYA BEGITU SAJA ----------
 * Setelah cek status diarahkan ke host yang benar, 404 pada cancel tetap harus
 * diverifikasi: hanya boleh dianggap "sudah mati" kalau GET status menyatakan
 * expire/cancel/deny/failure.
 */
const cancel404StatusHidup = await cancelTransaction('CE-4', cfgUji, {
  fetchImpl: async (url) => {
    const u = String(url);
    if (u.includes('/cancel')) return { ok: false, status: 404, text: async () => '{}' };
    return { ok: true, status: 200, text: async () => '{"transaction_status":"settlement"}' };
  }
});
cek('cancel 404 + transaksi settlement → DITOLAK', cancel404StatusHidup.ok, false);

const cancel404StatusMati = await cancelTransaction('CE-5', cfgUji, {
  fetchImpl: async (url) => {
    const u = String(url);
    if (u.includes('/cancel')) return { ok: false, status: 404, text: async () => '{}' };
    return { ok: true, status: 200, text: async () => '{"transaction_status":"expire"}' };
  }
});
cek('cancel 404 + transaksi expire → boleh lanjut', cancel404StatusMati.ok, true);

console.log(gagal === 0 ? '\nSEMUA UJI MIDTRANS LULUS' : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
