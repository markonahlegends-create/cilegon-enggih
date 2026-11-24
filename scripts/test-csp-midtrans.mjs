/**
 * Uji: Content-Security-Policy di vercel.json cukup longgar untuk Midtrans.
 *
 * KENAPA UJI INI ADA
 * Produksi pernah gagal dengan pesan "Tidak bisa memuat Midtrans" padahal
 * kunci Midtrans sudah benar. Penyebabnya CSP: `script-src` hanya mengizinkan
 * 'self', sehingga snap.js dari app.midtrans.com diblokir peramban TANPA pesan
 * apa pun. Build tetap sukses, tes lain tetap hijau, dan gejalanya muncul
 * hanya saat pembeli menekan tombol bayar.
 *
 * Uji ini membaca vercel.json dan memastikan setiap direktif yang dibutuhkan
 * Midtrans memuat domainnya. Cepat, tanpa jaringan, dan menangkap kesalahan
 * sebelum deploy.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

let gagal = 0;
const cek = (nama, kondisi, ket) => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  OK  ' : '  SALAH'} ${nama}${kondisi || !ket ? '' : ` — ${ket}`}`);
};

/* Ambil CSP dari blok header catch-all. */
let csp = '';
for (const blok of cfg.headers || []) {
  for (const h of blok.headers || []) {
    if (h.key === 'Content-Security-Policy') csp = h.value;
  }
}

cek('CSP ditemukan di vercel.json', Boolean(csp));

const direktif = (nama) => {
  const m = csp.match(new RegExp(`(?:^|;)\\s*${nama}\\s+([^;]+)`));
  return m ? m[1].trim() : '';
};

const punya = (nama, domain) => direktif(nama).includes(domain);

/* 1. snap.js harus boleh dimuat sebagai skrip. */
cek(
  'script-src mengizinkan app.midtrans.com',
  punya('script-src', 'https://app.midtrans.com'),
  'tanpa ini, popup pembayaran tidak akan pernah terbuka'
);
cek(
  'script-src mengizinkan app.sandbox.midtrans.com',
  punya('script-src', 'https://app.sandbox.midtrans.com'),
  'dipakai saat mode sandbox'
);

/* 2. Popup Snap adalah IFRAME dari domain Midtrans. */
cek(
  'frame-src mengizinkan app.midtrans.com',
  punya('frame-src', 'https://app.midtrans.com'),
  'popup Snap adalah iframe — tanpa ini layarnya kosong'
);

/* 3. Snap melakukan request XHR ke domain Midtrans. */
cek(
  'connect-src mengizinkan app.midtrans.com',
  punya('connect-src', 'https://app.midtrans.com')
);
cek(
  'connect-src mengizinkan api.midtrans.com',
  punya('connect-src', 'https://api.midtrans.com')
);

/* 4. Snap memuat stylesheet & font sendiri. */
cek('style-src mengizinkan app.midtrans.com', punya('style-src', 'https://app.midtrans.com'));
cek('font-src mengizinkan app.midtrans.com', punya('font-src', 'https://app.midtrans.com'));

/* 5. Jangan sampai pengaman lain ikut terhapus saat CSP diubah. */
cek('object-src tetap none', direktif('object-src') === "'none'");
cek("frame-ancestors tetap 'self'", direktif('frame-ancestors') === "'self'");
cek('default-src tetap self', direktif('default-src') === "'self'");
cek(
  'connect-src masih mengizinkan Supabase',
  punya('connect-src', 'https://*.supabase.co'),
  'Supabase dipakai untuk produk & gambar'
);
cek(
  'frame-src masih mengizinkan YouTube',
  punya('frame-src', 'https://www.youtube.com'),
  'video produk memakai embed YouTube'
);

/* 6. X-Frame-Options SAMEORIGIN tidak boleh memblokir iframe Midtrans.
      X-Frame-Options hanya membatasi siapa yang boleh MEMBINGKAI situs kita,
      bukan iframe yang kita pasang — jadi aman, tapi didokumentasikan di sini
      supaya tidak ada yang "memperbaikinya" dan merusak fitur. */
const xfo = (cfg.headers || [])
  .flatMap((b) => b.headers || [])
  .find((h) => h.key === 'X-Frame-Options');
cek(
  'X-Frame-Options tetap SAMEORIGIN (tidak memblokir iframe keluar)',
  xfo && xfo.value === 'SAMEORIGIN'
);

console.log(gagal === 0 ? '\nCSP MIDTRANS LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
