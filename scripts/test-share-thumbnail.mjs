/**
 * UJI THUMBNAIL LINK SHARE — SUMBERNYA FOTO UTAMA PRODUK.
 *
 * LATAR BELAKANG (laporan 20 Nov 2026, kedua kalinya)
 * "link share masih bermasalah, produk baru dan beberapa produk lama tidak
 *  muncul thumbnailnya… ambil gambar thumbnailnya dari gambar utama produk"
 *
 * TIGA AKAR MASALAH YANG DIKUNCI UJI INI
 *
 * 1. SUMBER GAMBAR SALAH
 *    Versi lama mendahulukan kartu templat `/og/<slug>.jpg`. Kartu dibuat
 *    sekali saat build dari katalog statis, jadi:
 *      - produk baru dari dashboard tidak punya kartu  → 404 di og:image,
 *      - produk lama yang fotonya diganti tetap memakai gambar LAMA.
 *    Perbaikan: og:image = `/api/og-image/<slug>.jpg`, dibangun dari
 *    `product.image` (foto utama) di database.
 *
 * 2. DIMENSI BERKAS ≠ YANG DIDEKLARASIKAN
 *    `og:image:width/height` dulu selalu ditulis 1200x630 padahal berkasnya
 *    bisa 1086x1448. Crawler yang menemukan ketidakcocokan membuang gambar.
 *    Perbaikan: dimensi hanya dideklarasikan bila benar-benar dijamin.
 *
 * 3. GAMBAR BINER DI-`json()`
 *    Handler Vercel/Express dulu selalu `res.json(body)`. Buffer berubah
 *    menjadi `{"type":"Buffer","data":[...]}` sehingga crawler menerima teks,
 *    bukan JPEG. Perbaikan: cabang `Buffer.isBuffer()`.
 *
 * Ditambah: `[object Promise]` bocor ke og:image karena `metaProduk` async
 * tapi `buildShareHtml` tidak menunggunya.
 *
 * Cara pakai: node scripts/test-share-thumbnail.mjs
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { metaProduk, buildShareHtml, ogImageUrl, TOKO_IMAGE } from '../server/og-share.js';
import { normalisasi, tipeDariByte, adaImageMagick, OG_W, OG_H, OG_MAX_BYTES } from '../server/og-image.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : `\n         dapat: ${JSON.stringify(dapat)}\n         harap: ${JSON.stringify(harap)}`}`
  );
};
const benar = (nama, kondisi, detail = '') => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  OK  ' : '  SALAH'} ${nama}${kondisi ? '' : ` — ${detail}`}`);
};

const BASE = 'https://cilegon-enggih.vercel.app';

/* ------------------------------------------------------------------ */
console.log('\n1. Sumber gambar = FOTO UTAMA produk, bukan kartu templat');

const produkLokal = {
  slug: 'tumbler-bpa-500ml',
  name: 'Tumbler BPA 500 ml',
  image: '/products/tumbler-bpa-500.jpg',
  price: 35000
};

check('URL thumbnail menunjuk endpoint normalisasi', ogImageUrl(BASE, produkLokal), `${BASE}/api/og-image/tumbler-bpa-500ml.jpg`);

const metaSinkron = await metaProduk(produkLokal, BASE, ({ normal }) => normal);
check('og:image memakai endpoint normalisasi', metaSinkron.image, `${BASE}/api/og-image/tumbler-bpa-500ml.jpg`);
benar(
  'og:image TIDAK memakai kartu templat /og/<slug>.jpg',
  !/\/og\/[a-z0-9-]+\.jpg$/.test(metaSinkron.image),
  metaSinkron.image
);
check('dimensi dideklarasikan 1200x630 untuk endpoint normalisasi', [metaSinkron.imageWidth, metaSinkron.imageHeight], [1200, 630]);

/* Produk baru dari dashboard: foto ada di Supabase Storage (URL absolut). */
const produkBaru = {
  slug: 'kaos-edisi-cilegon-enggih',
  name: 'Kaos / T-Shirt Edisi Cilegon Enggih',
  image:
    'https://oceqzytmiavogjivpzcw.supabase.co/storage/v1/object/public/product-images/cek-01-mwo6j3qwsga67s.jpg',
  price: 120000
};
const metaBaru = await metaProduk(produkBaru, BASE, ({ normal }) => normal);
check(
  'produk BARU (tanpa kartu statis) tetap dapat og:image',
  metaBaru.image,
  `${BASE}/api/og-image/kaos-edisi-cilegon-enggih.jpg`
);
benar('produk baru tidak 404 di og:image', !metaBaru.image.includes('/og/'), metaBaru.image);

/* ------------------------------------------------------------------ */
console.log('\n2. Tidak ada "[object Promise]" yang bocor ke HTML');

const metaAsync = metaProduk(produkLokal, BASE, async ({ normal }) => normal);
const htmlAsync = await buildShareHtml(metaAsync, { siteName: 'Cilegon Enggih Official Store' });
benar('buildShareHtml menunggu metaProduk async', typeof htmlAsync === 'string' && htmlAsync.includes('<meta property="og:image"'));
benar('HTML tidak memuat [object Promise]', !htmlAsync.includes('[object Promise]'), 'masih bocor');
benar(
  'og:image di HTML = endpoint normalisasi',
  htmlAsync.includes(`og:image" content="${BASE}/api/og-image/tumbler-bpa-500ml.jpg"`)
);

/* buildShareHtml dengan meta sinkron tetap jalan (dipakai generator statis). */
const htmlSinkron = buildShareHtml(metaSinkron);
benar('buildShareHtml menerima meta sinkron', typeof htmlSinkron === 'string' && htmlSinkron.includes('og:image'));

/* ------------------------------------------------------------------ */
console.log('\n3. Tanpa foto → jatuh ke kartu yang PASTI ada, bukan URL kosong');

const produkTanpaFoto = { slug: 'tanpa-foto', name: 'Produk Tanpa Foto', price: 10000 };
const metaTanpaFoto = await metaProduk(produkTanpaFoto, BASE, ({ kartu, foto, toko }) => foto || kartu || toko);
benar('og:image tidak kosong', Boolean(metaTanpaFoto.image), JSON.stringify(metaTanpaFoto.image));
check('cadangan terakhir = kartu toko', metaTanpaFoto.imageFallback, `${BASE}${TOKO_IMAGE}`);
benar('kartu toko benar-benar ada di repo', fs.existsSync(path.join(ROOT, 'public', TOKO_IMAGE)));

/* Dimensi TIDAK boleh dikarang bila berkasnya bukan kanvas 1200x630. */
const metaKartu = await metaProduk(produkTanpaFoto, BASE, ({ kartu }) => kartu);
check('kartu templat tetap boleh mendeklarasikan 1200x630', [metaKartu.imageWidth, metaKartu.imageHeight], [1200, 630]);
const metaFotoMentah = await metaProduk(produkLokal, BASE, ({ foto }) => foto);
check(
  'foto mentah TIDAK mendeklarasikan dimensi palsu',
  [metaFotoMentah.imageWidth, metaFotoMentah.imageHeight],
  [0, 0]
);
benar(
  'tanpa dimensi → tag og:image:width tidak dicetak',
  !buildShareHtml(metaFotoMentah).includes('og:image:width'),
  'tag dimensi palsu masih dicetak'
);

/* ------------------------------------------------------------------ */
console.log('\n4. Normalisasi gambar (ImageMagick)');

if (await adaImageMagick()) {
  /* Kanvas uji: portrait ekstrem, meniru foto produk 1086x1448. */
  const tmp = path.join(ROOT, '.tmp-e2e-share');
  fs.mkdirSync(tmp, { recursive: true });
  const sumber = path.join(tmp, 'sumber.jpg');
  const { execFileSync } = await import('node:child_process');
  execFileSync('convert', ['-size', '1086x1448', 'gradient:#1B365D-#E5A93C', sumber]);

  const hasil = await normalisasi(fs.readFileSync(sumber), 'jpeg');
  check('tipe hasil = JPEG', hasil.type, 'image/jpeg');
  benar('ukuran di bawah batas aman WhatsApp (~300 KB)', hasil.buf.length <= OG_MAX_BYTES, `${hasil.buf.length} byte`);
  benar('signature byte benar-benar JPEG', tipeDariByte(hasil.buf) === 'image/jpeg', tipeDariByte(hasil.buf));

  /* Verifikasi dimensi hasil lewat `identify`. */
  const keluar = path.join(tmp, 'hasil.jpg');
  fs.writeFileSync(keluar, hasil.buf);
  const dim = execFileSync('identify', ['-format', '%wx%h', keluar]).toString().trim();
  check('dimensi hasil = 1200x630', dim, `${OG_W}x${OG_H}`);

  fs.rmSync(tmp, { recursive: true, force: true });
} else {
  console.log('  LEWAT  ImageMagick tidak tersedia (runtime tanpa binary) — jalur "kirim apa adanya"');
}

check('tipeDariByte: JPEG', tipeDariByte(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
check('tipeDariByte: PNG', tipeDariByte(Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'image/png');
check('tipeDariByte: tidak dikenal', tipeDariByte(Buffer.from([0x00, 0x01, 0x02, 0x03])), 'application/octet-stream');

/* ------------------------------------------------------------------ */
console.log('\n5. Header cache halaman share TIDAK "immutable" setahun');

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const ogHeader = (vercel.headers || []).find((h) => String(h.source).startsWith('/og/'));
benar('aturan header /og/ ada', Boolean(ogHeader), 'tidak ditemukan');
const nilaiCache = ogHeader?.headers?.find((h) => h.key === 'Cache-Control')?.value || '';
benar('tidak memakai "immutable"', !nilaiCache.includes('immutable'), nilaiCache);
benar('memakai must-revalidate', nilaiCache.includes('must-revalidate'), nilaiCache);
benar('max-age pendek (<= 600 detik)', /max-age=(\d+)/.test(nilaiCache) && Number(nilaiCache.match(/max-age=(\d+)/)[1]) <= 600, nilaiCache);

/* ------------------------------------------------------------------ */
console.log('\n6. Setiap halaman share produk menunjuk endpoint thumbnail');

const ogDir = path.join(ROOT, 'public', 'og');
const halamanProduk = fs.readdirSync(ogDir).filter((f) => f.startsWith('produk--') && f.endsWith('.html'));
benar('ada halaman share produk', halamanProduk.length > 0, '0 berkas');

let salahGambar = 0;
for (const berkas of halamanProduk) {
  const isi = fs.readFileSync(path.join(ogDir, berkas), 'utf8');
  const img = isi.match(/property="og:image" content="([^"]+)"/)?.[1] || '';
  if (!img.includes('/api/og-image/')) {
    salahGambar += 1;
    console.log(`         ${berkas} → ${img || '(kosong)'}`);
  }
}
benar(`semua ${halamanProduk.length} halaman produk memakai /api/og-image/`, salahGambar === 0, `${salahGambar} masih kartu templat`);

/* Dimensi di HTML statis harus cocok dengan yang dijanjikan endpoint. */
const contoh = fs.readFileSync(path.join(ogDir, halamanProduk[0]), 'utf8');
benar('halaman statis mendeklarasikan 1200x630', contoh.includes('og:image:width" content="1200"') && contoh.includes('og:image:height" content="630"'));

/* ------------------------------------------------------------------ */
console.log('\n7. vercel.json mengarahkan crawler dengan pola yang diterima Vercel');

const rewrites = vercel.rewrites || [];
benar('ada rewrite /api/og-image', rewrites.some((r) => String(r.destination).includes('/api/og-image') || String(r.source).startsWith('/api/')));
const cadangan = rewrites.find((r) => r.source === '/produk/:slug');
benar('cadangan crawler pakai pola :slug (bukan character class)', Boolean(cadangan), 'tidak ada');
benar(
  'cadangan → endpoint share dinamis',
  cadangan?.destination === '/api/share/produk/:slug',
  cadangan?.destination
);
for (const r of rewrites) {
  benar(
    `source "${r.source}" tidak memakai character class [ ] (ditolak Vercel)`,
    !/\[[^\]]/.test(String(r.source))
  );
}

/* ------------------------------------------------------------------ */
console.log(`\n${gagal === 0 ? 'SEMUA UJI THUMBNAIL LULUS' : `${gagal} UJI GAGAL`}\n`);
process.exit(gagal === 0 ? 0 : 1);
