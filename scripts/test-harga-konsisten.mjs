/**
 * UJI KONSISTENSI HARGA — satu harga untuk satu barang, di semua tempat.
 *
 * LATAR BELAKANG (laporan 24 Nov 2026)
 * "Saya checkout produk baru stiker dengan harga 500 x 10 pcs seharusnya total
 *  harga = 5.000 namun yang terjadi harga 9.000."
 *
 * DUA PENYEBAB yang ditemukan, keduanya nyata di data produksi:
 *
 *   A. KERANJANG TIDAK DIKOSONGKAN setelah pesanan dibuat
 *      Produksi: CE-20261124-442 (11:59) = 1 × stiker Rp 8.000.
 *      Lalu CE-20261124-779 (12:26) = 1 × Rp 8.000 + 2 × Rp 500 = Rp 9.000.
 *      Stiker lama masih di keranjang, ditambah stiker baru 2 pcs. Pembeli
 *      membaca Rp 9.000 sebagai "harga 500 × 10" padahal isinya dua barang.
 *
 *   B. RUMUS HARGA DITULIS ULANG DI EMPAT TEMPAT dengan hasil berbeda:
 *      halaman produk, keranjang, checkout, dan server. Keranjang & checkout
 *      MENGABAIKAN priceDelta pilihan; halaman produk & keranjang memakai
 *      `qty >= minWholesaleQty` tanpa cek > 0 sehingga produk baru (bawaan
 *      editor: minimal grosir 0) tampil seharga grosir untuk 1 pcs.
 *
 * Uji ini menjaga agar:
 *   1. `unitPriceFor` (sumber tunggal) menghitung benar untuk semua kasus
 *   2. server menghitung harga yang SAMA dengan klien (uji lewat dispatch)
 *   3. keranjang dikosongkan segera setelah pesanan dibuat
 *   4. dashboard tidak lagi mengosongkan data lain saat satu endpoint gagal
 *
 * Cara pakai: node scripts/test-harga-konsisten.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import os_ from 'node:os';

const ROOT = process.cwd();
let gagal = 0;

const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `  ${ok ? 'OK  ' : 'SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

/* ------------------------------------------------------------------ */
/* 1. unitPriceFor — sumber tunggal                                    */
/* ------------------------------------------------------------------ */

console.log('\n— 1. unitPriceFor(): sumber tunggal rumus harga —');

/*
 * Fungsi ini ada di src/lib/variantPricing.ts (TypeScript). Daripada
 * menduplikasi logikanya di sini (justru mengulang kesalahan yang diperbaiki),
 * ambil badan fungsinya lalu jalankan sebagai JS biasa — file-nya hanya berisi
 * tipe + fungsi murni tanpa impor runtime.
 */
const ts = baca('src/lib/variantPricing.ts');
const mulai = ts.indexOf('export const unitPriceFor');
const akhir = ts.indexOf('/** Apakah pembelian ini sedang menikmati harga grosir?');
if (mulai < 0 || akhir < 0) {
  console.error('  SALAH tidak menemukan unitPriceFor di src/lib/variantPricing.ts');
  process.exit(1);
}
const badan = ts
  .slice(mulai, akhir)
  .replace('export const unitPriceFor', 'const unitPriceFor')
  .replace(/: PriceInput/g, '')
  .replace(/: number/g, '')
  .replace(/\}: \{?[\s\S]*?\}\): number =>/g, '}) =>')
  .replace(/\): number =>/, ') =>');
// Badan fungsi memakai destrukturisasi objek + komentar; jalankan di scope sendiri.
const unitPriceFor = new Function(`${badan.replace(/\n\/\*\*[\s\S]*?\*\//g, '')}\nreturn unitPriceFor;`)();

cek('harga dasar, qty 1', unitPriceFor({ price: 8000, qty: 1 }), 8000);
cek('harga dasar, qty 10', unitPriceFor({ price: 8000, qty: 10 }), 8000);

/* Kasus laporan: stiker Rp 500 × 10 pcs. */
cek(
  'stiker 500 × 10 pcs = tetap 500/pcs (minimal grosir 0)',
  unitPriceFor({ price: 500, qty: 10 }) * 10,
  5000
);

/* Cacat lama: produk baru (minimal grosir 0) dianggap grosir. */
cek(
  'produk baru minimal grosir 0 TIDAK memakai harga grosir',
  unitPriceFor({ price: 120000, wholesalePrice: 50000, minWholesaleQty: 0, qty: 5 }),
  120000
);

cek(
  'grosir aktif saat qty mencapai minimal',
  unitPriceFor({ price: 8000, wholesalePrice: 5000, minWholesaleQty: 100, qty: 100 }),
  5000
);
cek(
  'grosir belum aktif di bawah minimal',
  unitPriceFor({ price: 8000, wholesalePrice: 5000, minWholesaleQty: 100, qty: 99 }),
  8000
);
cek(
  'harga grosir lebih MAHAL diabaikan (jangan rugikan pembeli)',
  unitPriceFor({ price: 500, wholesalePrice: 900, minWholesaleQty: 10, qty: 20 }),
  500
);
cek(
  'harga varian dipakai untuk produk tanpa pilihan',
  unitPriceFor({ price: 1000, variantPrice: 500, qty: 3 }),
  500
);
cek(
  'harga pilihan (sudah termasuk priceDelta) menang atas harga varian',
  unitPriceFor({ price: 120000, variantPrice: 120000, optionPrice: 125000, qty: 1 }),
  125000
);
cek(
  'pilihan + grosir: grosir menang bila lebih murah',
  unitPriceFor({ price: 120000, optionPrice: 125000, wholesalePrice: 110000, minWholesaleQty: 24, qty: 24 }),
  110000
);

/* ------------------------------------------------------------------ */
/* 2. Klien memakai fungsi itu, bukan rumus sendiri                    */
/* ------------------------------------------------------------------ */

console.log('\n— 2. Tidak ada lagi rumus harga yang ditulis ulang —');

const berkasKlien = [
  'src/context/StoreContext.tsx',
  'src/components/CartDrawer.tsx',
  'src/components/CheckoutModal.tsx',
  'src/pages/ProductDetailPage.tsx'
];
for (const rel of berkasKlien) {
  const isi = baca(rel);
  cek(`${rel}: memakai unitPriceFor`, /unitPriceFor/.test(isi), true);
  /*
   * Rumus lama: membandingkan qty dengan minimal grosir secara langsung di
   * kode. Komentar boleh menyebutnya (itu menjelaskan sejarah), jadi komentar
   * dibuang dulu sebelum diperiksa.
   */
  const kodeSaja = isi
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const rumusLama = /qty\s*>=\s*[a-zA-Z.]*minWholesaleQty/.test(kodeSaja);
  cek(`${rel}: rumus grosir lama sudah hilang`, rumusLama, false);
}

/* ------------------------------------------------------------------ */
/* 3. Keranjang dikosongkan SETELAH pesanan dibuat                     */
/* ------------------------------------------------------------------ */

console.log('\n— 3. Keranjang tidak menyisakan barang pesanan sebelumnya —');

const checkout = baca('src/components/CheckoutModal.tsx');
/*
 * Ambil sampai AKHIR fungsi handler checkout (catch/finally), bukan sampai
 * `setStep('payment')` yang pertama — komentar di antaranya bisa memuat kata
 * yang membuat uji lolos palsu.
 */
const blokSukses = checkout.slice(
  checkout.indexOf('setCreatedOrder(result.order)'),
  checkout.indexOf('const handleFinish')
);
cek(
  'clearCart() dipanggil TEPAT setelah pesanan berhasil dibuat',
  /clearCart\(\)\s*;\s*\n\s*setStep\('payment'\)/.test(blokSukses),
  true
);
/*
 * Tanpa ini, penghapusan `clearCart()` dari blok tersebut lolos uji karena
 * `clearCart()` masih ada di handleFinish() — persis bug yang diperbaiki.
 */
cek(
  'clearCart() tidak hanya bergantung pada tombol "Lacak Status Pesanan"',
  checkout.slice(0, checkout.indexOf('const handleFinish')).includes('clearCart();'),
  true
);

/* Produk di keranjang disegarkan dari katalog terbaru. */
const ctx = baca('src/context/StoreContext.tsx');
cek(
  'produk di keranjang disinkronkan dari katalog terbaru',
  /SINKRONKAN PRODUK DI KERANJANG/i.test(ctx) && /setCart\(\(prev\)/.test(ctx),
  true
);

/* ------------------------------------------------------------------ */
/* 4. Dashboard tidak mengosongkan data saat satu endpoint gagal       */
/* ------------------------------------------------------------------ */

console.log('\n— 4. Satu endpoint dashboard gagal tidak mengosongkan sisanya —');

const dash = baca('src/pages/AdminDashboardPage.tsx');
cek('loadAll memakai Promise.allSettled', /Promise\.allSettled\(/.test(dash), true);
cek(
  'kegagalan sebagian dilaporkan ke admin',
  /Sebagian Data Gagal Dimuat/.test(dash),
  true
);

/*
 * Data dashboard tidak boleh basi: dulu loadAll() hanya berjalan sekali saat
 * halaman dibuka, sehingga admin yang membiarkan tab terbuka melihat
 * "Pesanan (0)" sepanjang hari walau pembeli terus masuk.
 */
cek('dashboard menyegarkan saat tab kembali aktif', /visibilitychange/.test(dash), true);
cek('dashboard menyegarkan berkala (interval)', /setInterval\(/.test(dash), true);
cek(
  'membuka tab Pesanan memuat data terbaru',
  /tab === 'orders'\) loadAll\(/.test(dash),
  true
);

/* ------------------------------------------------------------------ */
/* 5. Server: harga sama dengan klien, dan menolak kombinasi ngawur    */
/* ------------------------------------------------------------------ */

console.log('\n— 5. Server menghitung dengan aturan yang sama —');

const DIR = fs.mkdtempSync(path.join(os_.tmpdir(), 'ce-harga-'));
process.env.CE_DATA_DIR = DIR;
process.env.MIDTRANS_SERVER_KEY = 'Mid-server-harga';
process.env.MIDTRANS_CLIENT_KEY = 'Mid-client-harga';
process.env.MIDTRANS_IS_PRODUCTION = 'true';
process.env.ADMIN_PASSWORD = 'cilegonenggih2026f@';
process.env.ADMIN_TOKEN_SECRET = 'b'.repeat(64);
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const core = await import('../server/core.js');
const { store } = await import('../server/db.js');
const { createSessionToken, sessionSecret, COOKIE_NAME } = await import('../server/session.js');

const produk = (extra = {}) => ({
  id: 'uji-1',
  name: 'Stiker Uji Harga',
  shortName: 'Stiker Uji',
  slug: 'stiker-uji-harga',
  image: '/products/stiker-die-cut.jpg',
  price: 500,
  stock: 1000,
  active: true,
  weightGrams: 10,
  categorySlug: 'aksesoris-dekorasi',
  variants: [],
  optionGroups: [],
  combinations: [],
  ...extra
});

await store.put('products', produk());
await store.put('products', produk({ id: 'uji-2', slug: 'kaos-uji', price: 120000, wholesalePrice: 50000, minWholesaleQty: 0 }));
await store.put('products', produk({
  id: 'uji-3',
  slug: 'kaos-pilihan',
  price: 120000,
  optionGroups: [
    { id: 'warna', name: 'Warna', values: [
      { id: 'putih', label: 'Putih', priceDelta: 0 },
      { id: 'navy', label: 'Navy', priceDelta: 5000 }
    ] }
  ]
}));

const buat = (payload) =>
  core.dispatch({
    method: 'POST',
    path: '/api/orders',
    headers: {},
    query: {},
    body: {
      customerName: 'Uji',
      customerPhone: '082249879873',
      customerEmail: 'uji@contoh.com',
      destination: 'Kota Cilegon',
      addressDetail: 'Jl. Uji Nomor 12 RT 01',
      courier: 'JNE',
      shippingCost: 0,
      paymentMethod: 'Midtrans',
      ...payload
    }
  });

const r1 = await buat({ items: [{ productId: 'uji-1', qty: 10, price: 500 }] });
cek('500 × 10 pcs ditagih 5.000', [r1.status, r1.body.order?.subtotal], [201, 5000]);

const r2 = await buat({ items: [{ productId: 'uji-2', qty: 1, price: 120000 }] });
cek(
  'minimal grosir 0 tidak memakai harga grosir (server)',
  [r2.status, r2.body.order?.items?.[0]?.price],
  [201, 120000]
);

const r3 = await buat({ items: [{ productId: 'uji-3', qty: 1, options: { warna: 'navy' }, price: 125000 }] });
cek('priceDelta pilihan dihitung server', [r3.status, r3.body.order?.items?.[0]?.price], [201, 125000]);

const r4 = await buat({ items: [{ productId: 'uji-1', qty: 2, price: 1 }] });
cek(
  'harga kiriman browser tidak dipercaya (tetap 500)',
  [r4.status, r4.body.order?.items?.[0]?.price],
  [201, 500]
);

/* Validasi kombinasi produk di dashboard admin. */
const { token } = createSessionToken({ secret: sessionSecret(process.env.ADMIN_PASSWORD) });
const adminHeaders = { cookie: `${COOKIE_NAME}=${encodeURIComponent(token)}` };

const simpanProduk = (body) =>
  core.dispatch({ method: 'POST', path: '/api/admin/products', headers: adminHeaders, query: {}, body });

const kombinasiSetengah = await simpanProduk({
  name: 'Produk Kombinasi Uji',
  price: 8000,
  stock: 10,
  weightGrams: 100,
  optionGroups: [
    { id: 'g1', name: 'Momen', values: [{ id: 'a', label: 'A', priceDelta: 0 }] },
    { id: 'g2', name: 'Varian', values: [{ id: 'b', label: 'B', priceDelta: 0 }] }
  ],
  /* hanya menyebut satu grup → kombinasi tidak akan pernah cocok */
  combinations: [{ price: 20000, optionValueIds: ['a'] }]
});
cek('kombinasi yang tidak menyebut semua pilihan DITOLAK', kombinasiSetengah.status, 400);

const kombinasiNilaiPalsu = await simpanProduk({
  name: 'Produk Kombinasi Uji',
  price: 8000,
  stock: 10,
  weightGrams: 100,
  optionGroups: [
    { id: 'g1', name: 'Momen', values: [{ id: 'a', label: 'A', priceDelta: 0 }] },
    { id: 'g2', name: 'Varian', values: [{ id: 'b', label: 'B', priceDelta: 0 }] }
  ],
  combinations: [{ price: 20000, optionValueIds: ['a', 'zzz'] }]
});
cek('kombinasi dengan nilai yang tidak ada DITOLAK', kombinasiNilaiPalsu.status, 400);

const kombinasiNormal = await simpanProduk({
  name: 'Produk Kombinasi Uji',
  price: 8000,
  stock: 10,
  weightGrams: 100,
  optionGroups: [
    { id: 'g1', name: 'Momen', values: [{ id: 'a', label: 'A', priceDelta: 0 }] },
    { id: 'g2', name: 'Varian', values: [{ id: 'b', label: 'B', priceDelta: 4000 }] }
  ],
  combinations: [{ price: 20000, optionValueIds: ['a', 'b'] }]
});
cek('kombinasi yang benar DITERIMA', kombinasiNormal.status, 201);

fs.rmSync(DIR, { recursive: true, force: true });

console.log(gagal === 0 ? '\nHARGA KONSISTEN — SEMUA LULUS' : `\n${gagal} GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
