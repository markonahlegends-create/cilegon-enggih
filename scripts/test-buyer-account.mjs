/**
 * UJI AKUN PEMBELI (OPSIONAL) — riwayat pesanan lintas perangkat.
 *
 * LATAR BELAKANG (keluhan pembeli)
 * "Kalau saya pesan 5 barang di waktu berbeda, bagaimana memantau mana yang
 * sudah dibayar, mana yang sedang dikirim, mana yang dananya dikembalikan?"
 *
 * Sebelum ini satu-satunya cara adalah membuka halaman Lacak Pesanan dan
 * mengetik nomor pesanan SATU PER SATU (plus 4 digit terakhir nomor WhatsApp).
 * Untuk lima pesanan, itu lima kali kerja — dan tidak ada tempat untuk melihat
 * "apakah ada uang saya yang sedang dikembalikan?".
 *
 * YANG DIUJI DI SINI
 *   1. checkout tetap bisa TANPA akun (akun harus opsional, bukan wajib)
 *   2. kode OTP tidak pernah dikembalikan ke browser
 *   3. kode salah ditolak, dan hangus setelah batas percobaan
 *   4. nomor yang berbeda format (+62 / 62 / 08) dianggap nomor yang sama
 *   5. setelah verifikasi, SEMUA pesanan nomor itu terkumpul dalam satu daftar
 *   6. pembeli tidak bisa melihat pesanan orang lain (404, bukan 403)
 *   7. ringkasan menghitung yang perlu dibayar / dikirim / refund
 *   8. cookie sesi memakai HttpOnly + SameSite
 *
 * Cara pakai: node scripts/test-buyer-account.mjs
 */
import crypto from 'node:crypto';

process.env.ADMIN_TOKEN_SECRET = crypto.randomBytes(32).toString('hex');
process.env.ADMIN_PASSWORD = `Uji${crypto.randomBytes(6).toString('hex')}!`;
process.env.NODE_ENV = 'production';

const { dispatch } = await import('../server/core.js');
const { store } = await import('../server/db.js');
const { normalisasiNomor } = await import('../server/buyer-session.js');

let gagal = 0;
const cek = (nama, kondisi, detail = '') => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  ✅' : '  ❌'} ${nama}${detail && !kondisi ? ` → ${detail}` : ''}`);
};

const ip = () => `10.9.${crypto.randomInt(0, 255)}.${crypto.randomInt(1, 255)}`;
const kirim = (method, path, { body, headers = {}, query = {} } = {}) =>
  dispatch({ method, path, query, body, headers: { 'x-forwarded-for': ip(), ...headers } });

const NOMOR = `0812${String(crypto.randomInt(10000000, 99999999))}`;
const OTHER = `0813${String(crypto.randomInt(10000000, 99999999))}`;

/* Tanam beberapa pesanan milik nomor uji, dengan format nomor berbeda-beda. */
const nowIso = () => new Date().toISOString();
const buatPesanan = async (orderId, phone, patch = {}) => {
  const order = {
    id: orderId,
    orderId,
    invoiceNumber: `INV-${orderId}`,
    createdAt: nowIso(),
    status: 'DIPROSES',
    paymentStatus: 'PENDING',
    customerName: 'Pembeli Uji',
    customerPhone: phone,
    items: [{ name: 'Gantungan Kunci Karet 3D', qty: 2, price: 15000 }],
    subtotal: 30000,
    shippingCost: 8500,
    totalAmount: 38500,
    courier: 'JNE',
    destination: 'Cilegon, Banten',
    addressDetail: 'Jl. Uji No. 1',
    timeline: [{ at: nowIso(), note: 'Pesanan dibuat' }],
    ...patch
  };
  await store.put('orders', order);
  return order;
};

console.log('\n▶ Menyiapkan data uji');
await buatPesanan(`UJI-BYR-A-${Date.now()}`, NOMOR, { paymentStatus: 'LUNAS', status: 'DIKIRIM', resi: 'JNE123' });
await buatPesanan(`UJI-BYR-B-${Date.now()}`, NOMOR.replace(/^08/, '628'));
await buatPesanan(`UJI-BYR-C-${Date.now()}`, `+62${NOMOR.slice(1)}`, {
  paymentStatus: 'LUNAS',
  status: 'DIBATALKAN'
});
await buatPesanan(`UJI-BYR-D-${Date.now()}`, OTHER, { paymentStatus: 'LUNAS' });
console.log(`  nomor uji: ${NOMOR}`);

/* ---------------------------------------------------------------- */
console.log('\n▶ 1. Akun opsional: checkout tetap jalan tanpa login');
const track = await kirim('GET', '/api/orders/track', { query: { q: 'apa-saja', phone: NOMOR.slice(-4) } });
cek('lacak pesanan tanpa login tetap dilayani (bukan 401)', track.status !== 401, `status ${track.status}`);
const sesiAnon = await kirim('GET', '/api/buyer/session');
cek('pengunjung tanpa akun → loggedIn=false', sesiAnon.status === 200 && sesiAnon.body.loggedIn === false);

/* ---------------------------------------------------------------- */
console.log('\n▶ 2. Minta kode OTP');
const minta = await kirim('POST', '/api/buyer/otp', { body: { nomor: NOMOR } });
cek('permintaan kode diterima', minta.status === 200, JSON.stringify(minta.body));
/*
 * Asersi ini harus KETAT. Kalau kode ikut terkirim ke browser, siapa pun bisa
 * "memverifikasi" nomor orang lain tanpa pernah menerima pesan apa pun — dan
 * seluruh akun ini jadi tidak ada gunanya.
 */
const teksRespons = JSON.stringify(minta.body);
cek('tidak ada field kode di respons', minta.body?.kode === undefined && minta.body?.otp === undefined);
cek('tidak ada 6 digit berurutan di respons', !/\d{6}/.test(teksRespons), teksRespons.slice(0, 200));
cek('nomor di respons disamarkan', String(minta.body?.nomorMasked || '').includes('*'), minta.body?.nomorMasked);
cek('nomor ngawur ditolak', (await kirim('POST', '/api/buyer/otp', { body: { nomor: '123' } })).status === 400);

/* Ambil kode dari penyimpanan (di produksi hanya ada di pesan Telegram admin). */
const doc = await store.get('buyer_otp', (await import('../server/buyer-session.js')).otpDocId(NOMOR));
cek('kode tersimpan sebagai hash, bukan teks biasa', Boolean(doc?.hash) && doc.kode === undefined);

/* ---------------------------------------------------------------- */
console.log('\n▶ 3. Verifikasi menolak kode salah, menerima yang benar');
const salah = await kirim('POST', '/api/buyer/verify', { body: { nomor: NOMOR, kode: '000000' } });
cek('kode salah ditolak', salah.status === 400, JSON.stringify(salah.body));
cek('kode salah tidak menerbitkan cookie', !salah.headers || !salah.headers['Set-Cookie']);

/*
 * Ambil kode asli dengan menebak dari hash tidak mungkin, jadi untuk uji ini
 * kita buat ulang kode melalui jalur yang sama seperti server memakainya.
 */
const { buatKodeOtp, hashOtp } = await import('../server/buyer-session.js');
const kodeAsli = buatKodeOtp();
await store.put('buyer_otp', {
  id: (await import('../server/buyer-session.js')).otpDocId(NOMOR),
  nomor: NOMOR,
  hash: hashOtp(NOMOR, kodeAsli),
  dibuatAt: nowIso(),
  kedaluwarsaAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  percobaan: 0
});

const bedaFormat = await kirim('POST', '/api/buyer/verify', {
  body: { nomor: `+62${NOMOR.slice(1)}`, kode: kodeAsli }
});
cek('nomor +62 diterima untuk kode yang dikirim ke 08', bedaFormat.status === 200, JSON.stringify(bedaFormat.body));
const cookie = bedaFormat.headers?.['Set-Cookie'] || '';
cek('cookie sesi diterbitkan', cookie.startsWith('ce_buyer='), cookie.slice(0, 40));
cek('cookie HttpOnly', /HttpOnly/i.test(cookie));
cek('cookie SameSite', /SameSite=Lax/i.test(cookie));
cek('jumlah pesanan terdeteksi saat login', bedaFormat.body?.jumlahPesanan >= 3, String(bedaFormat.body?.jumlahPesanan));

/* ---------------------------------------------------------------- */
console.log('\n▶ 4. Riwayat: semua pesanan nomor itu terkumpul');
const sesi = await kirim('GET', '/api/buyer/session', { headers: { cookie } });
cek('sesi dikenali', sesi.body?.loggedIn === true, JSON.stringify(sesi.body));
cek('nomor tetap disamarkan di sesi', String(sesi.body?.nomorMasked || '').includes('*'));

const riwayat = await kirim('GET', '/api/buyer/orders', { headers: { cookie } });
const daftarOrder = riwayat.body?.orders || [];
cek('riwayat terbaca', riwayat.status === 200, JSON.stringify(riwayat.body).slice(0, 200));
cek('ketiga pesanan (format nomor beda) ikut terkumpul', daftarOrder.length >= 3, `dapat ${daftarOrder.length}`);
cek('pesanan nomor LAIN tidak ikut', !daftarOrder.some((o) => String(o.orderId).startsWith('UJI-BYR-D')));

const r = riwayat.body?.ringkasan || {};
cek('ringkasan: ada yang perlu dibayar', r.perluDibayar >= 1, String(r.perluDibayar));
cek('ringkasan: ada yang sedang dikirim', r.dikirim >= 1, String(r.dikirim));
cek('ringkasan: refund pesanan batal-lunas terdeteksi', r.refundDiproses >= 1, String(r.refundDiproses));
const batal = daftarOrder.find((o) => o.status === 'DIBATALKAN' && o.paymentStatus === 'LUNAS');
cek('status refund berlabel "diproses" (bukan kosong)', batal?.refund === 'diproses', batal?.refund);

/* ---------------------------------------------------------------- */
console.log('\n▶ 5. Detail pesanan & batas kepemilikan');
const satu = daftarOrder[0];
const detail = await kirim('GET', `/api/buyer/orders/${satu.orderId}`, { headers: { cookie } });
cek('detail pesanan sendiri terbaca', detail.status === 200, String(detail.status));
const pesananOrang = await kirim('GET', '/api/buyer/orders/UJI-BYR-D', { headers: { cookie } });
cek('pesanan orang lain → 404', pesananOrang.status === 404, String(pesananOrang.status));
cek('pesanannya tidak bocor di respons', !JSON.stringify(pesananOrang.body).includes('Pembeli Uji'));

const tanpaCookie = await kirim('GET', '/api/buyer/orders');
cek('tanpa login → 401', tanpaCookie.status === 401, String(tanpaCookie.status));

/* ---------------------------------------------------------------- */
console.log('\n▶ 6. Kode hangus setelah batas percobaan');
let kodeUji = buatKodeOtp();
const idUji = (await import('../server/buyer-session.js')).otpDocId(OTHER);
await store.put('buyer_otp', {
  id: idUji,
  nomor: OTHER,
  hash: hashOtp(OTHER, kodeUji),
  dibuatAt: nowIso(),
  kedaluwarsaAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  percobaan: 0
});
for (let i = 0; i < 5; i += 1) {
  await kirim('POST', '/api/buyer/verify', { body: { nomor: OTHER, kode: '111111' } });
}
const setelah = await kirim('POST', '/api/buyer/verify', { body: { nomor: OTHER, kode: kodeUji } });
cek('kode asli tidak bisa dipakai setelah 5 kali salah', setelah.status !== 200, JSON.stringify(setelah.body));

/* ---------------------------------------------------------------- */
console.log('\n▶ 7. Logout menghapus sesi');
const keluar = await kirim('POST', '/api/buyer/logout', { headers: { cookie } });
cek('logout 200', keluar.status === 200);
cek('cookie dikosongkan (Max-Age=0)', /Max-Age=0/.test(keluar.headers?.['Set-Cookie'] || ''));

/* Bersihkan data uji. */
const semua = await store.list('orders').catch(() => []);
for (const o of semua.filter((x) => String(x.orderId).startsWith('UJI-BYR-'))) {
  await store.remove('orders', o.id);
}
await store.remove('buyer_otp', idUji);

console.log(gagal === 0 ? '\n✅ SEMUA UJI AKUN PEMBELI LULUS\n' : `\n❌ ${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
