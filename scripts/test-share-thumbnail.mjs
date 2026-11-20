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

check('URL thumbnail memakai jalur STATIS /bi/', ogImageUrl(BASE, produkLokal), `${BASE}/bi/tumbler-bpa-500ml.jpg`);

const metaSinkron = await metaProduk(produkLokal, BASE, ({ normal }) => normal);
check('og:image memakai /bi/ (bukan /api/)', metaSinkron.image, `${BASE}/bi/tumbler-bpa-500ml.jpg`);
benar(
  'og:image TIDAK lewat /api/ (batas body fungsi Vercel)',
  !metaSinkron.image.includes('/api/'),
  metaSinkron.image
);
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
  `${BASE}/bi/kaos-edisi-cilegon-enggih.jpg`
);
benar('produk baru tidak 404 di og:image', !metaBaru.image.includes('/og/'), metaBaru.image);

/* ------------------------------------------------------------------ */
console.log('\n2. Tidak ada "[object Promise]" yang bocor ke HTML');

const metaAsync = metaProduk(produkLokal, BASE, async ({ normal }) => normal);
const htmlAsync = await buildShareHtml(metaAsync, { siteName: 'Cilegon Enggih Official Store' });
benar('buildShareHtml menunggu metaProduk async', typeof htmlAsync === 'string' && htmlAsync.includes('<meta property="og:image"'));
benar('HTML tidak memuat [object Promise]', !htmlAsync.includes('[object Promise]'), 'masih bocor');
benar(
  'og:image di HTML = jalur statis /bi/',
  htmlAsync.includes(`og:image" content="${BASE}/bi/tumbler-bpa-500ml.jpg"`),
  'tidak ditemukan'
);
benar(
  'ada <noscript> redirect agar crawler tidak tertahan di halaman kartu',
  htmlAsync.includes('<noscript><meta http-equiv="refresh"'),
  'tidak ada'
);
benar('tanpa tautan feed rusak (stray "L")', !/[\u0000-\u0008]/.test(htmlAsync), 'ada karakter kontrol');

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
console.log('\n6. Halaman NON-produk tetap memakai kartu toko + dimensi benar');

const ogDir = path.join(ROOT, 'public', 'og');
const halamanNonProduk = fs.readdirSync(ogDir).filter((f) => f.endsWith('.html'));
benar('ada halaman share non-produk', halamanNonProduk.length > 0, '0 berkas');

/*
 * Halaman produk statis SENGAJA tidak dibuat lagi (`produk--*.html`).
 * Kartu produk dibangun saat diminta dari database. Kalau berkas lama muncul
 * kembali, itu tanda generator belum diperbaiki — dan salinan basi itulah yang
 * dulu membuat foto produk tidak pernah terlihat berubah.
 */
const halamanProdukBasi = fs.readdirSync(ogDir).filter((f) => f.startsWith('produk--'));
benar('tidak ada halaman produk statis (sumber basi)', halamanProdukBasi.length === 0, `${halamanProdukBasi.length} masih ada`);

for (const berkas of halamanNonProduk) {
  const isi = fs.readFileSync(path.join(ogDir, berkas), 'utf8');
  benar(`${berkas} mendeklarasikan dimensi 1200x630`, isi.includes('og:image:width" content="1200"') && isi.includes('og:image:height" content="630"'));
}

/* ------------------------------------------------------------------ */
console.log('\n7. vercel.json mengarahkan crawler dengan pola yang diterima Vercel');

const rewrites = vercel.rewrites || [];
benar('ada rewrite /api/* (fungsi)', rewrites.some((r) => String(r.source) === '/api/(.*)'));
benar(
  'ada cadangan /bi/:slug → endpoint dinamis (produk baru)',
  rewrites.some((r) => r.source === '/bi/:slug' && r.destination === '/api?__path=/api/og-image/:slug'),
  'tidak ada'
);
const cadangan = rewrites.find((r) => r.source === '/produk/:slug');
benar('cadangan crawler pakai pola :slug (bukan character class)', Boolean(cadangan), 'tidak ada');
benar(
  'cadangan → endpoint share dinamis',
  cadangan?.destination === '/api?__path=/api/share/produk/:slug',
  cadangan?.destination
);
for (const r of rewrites) {
  benar(
    `source "${r.source}" tidak memakai character class [ ] (ditolak Vercel)`,
    !/\[[^\]]/.test(String(r.source))
  );
}

/* ------------------------------------------------------------------ */
console.log('\n9. Rewrite Vercel lolos lewat __path (bug 404 produksi)');

/*
 * REGRESI PALING MAHAL.
 *
 * Diukur dari produksi: `/api/share/produk/<slug>` LANGSUNG = 200, tetapi
 * rewrite `/produk/:slug -> /api/share/produk/:slug` = 404. Penyebabnya:
 * Vercel mencocokkan rewrite berdasarkan PATH TUJUAN, dan `api/[...route].js`
 * di luar Next.js dikompilasi menjadi SATU segmen (`^/api/([^/]+)$`).
 * Tujuan multi-segmen karena itu tidak cocok dengan fungsi mana pun dan
 * Vercel membalas 404-nya sendiri.
 *
 * Perbaikan: semua tujuan dinamis memakai bentuk satu segmen
 * `/api?__path=<path asli>`, dan handler memulihkan path asli dari `__path`.
 */
{
  const rewritesDinamis = (vercel.rewrites || []).filter((r) =>
    String(r.destination).startsWith('/api?__path=')
  );
  benar('ada rewrite dinamis berbentuk /api?__path=', rewritesDinamis.length > 0, 'tidak ada');

  for (const r of rewritesDinamis) {
    const tujuan = String(r.destination);
    benar(
      `${r.source} → tujuan satu segmen (cocok dengan api/[...route])`,
      /^\/api\?__path=\/api\/[^?]+$/.test(tujuan),
      tujuan
    );
  }

  /* Tujuan multi-segmen di bawah /api/ TIDAK boleh dipakai lagi. */
  const tujuanTerlarang = (vercel.rewrites || []).filter(
    (r) => String(r.destination).startsWith('/api/') && !String(r.destination).startsWith('/api/[...route]')
  );
  benar(
    'tidak ada rewrite ke path multi-segmen /api/ (pasti 404)',
    tujuanTerlarang.length === 0,
    tujuanTerlarang.map((r) => `${r.source}→${r.destination}`).join(', ')
  );

  /* Handler harus benar-benar memulihkan __path. */
  const srcHandler = fs.readFileSync(path.join(ROOT, 'api', '[...route].js'), 'utf8');
  benar('handler membaca __path', srcHandler.includes('__path'), 'tidak ditemukan');
  benar('handler menolak path di luar /api/', srcHandler.includes("startsWith('/api/')"), 'tidak ada penjagaan');

  /* Uji langsung: __path harus menghasilkan kartu produk yang benar. */
  const { default: handler } = await import('../api/[...route].js');
  const panggil = async (query) => {
    const headers = {};
    let status = 200;
    let body = null;
    const res = {
      setHeader: (k, v) => {
        headers[k.toLowerCase()] = v;
      },
      getHeader: (k) => headers[k.toLowerCase()],
      status(c) {
        status = c;
        return this;
      },
      json(b) {
        body = b;
        return this;
      },
      send(b) {
        body = b;
        return this;
      },
      end() {
        return this;
      }
    };
    await handler(
      { method: 'GET', url: '/api', query, body: undefined, headers: { host: 'x' } },
      res
    );
    return { status, body, headers };
  };

  const hasilShare = await panggil({ __path: '/api/share/produk/tumbler-bpa-500ml' });
  check('__path → kartu share 200', hasilShare.status, 200);
  benar(
    '__path → HTML kartu dengan og:image /bi/',
    String(hasilShare.body).includes('og:image" content="https://cilegon-enggih.vercel.app/bi/tumbler-bpa-500ml.jpg"'),
    'og:image tidak sesuai'
  );

  const hasilGambar = await panggil({ __path: '/api/og-image/tumbler-bpa-500ml.jpg' });
  check('__path → thumbnail 200', hasilGambar.status, 200);
  check('__path → thumbnail bertipe JPEG', hasilGambar.headers['content-type'], 'image/jpeg');
  benar('__path → thumbnail berupa Buffer', Buffer.isBuffer(hasilGambar.body), 'bukan Buffer');

  /* Penjagaan keamanan: __path tidak boleh keluar dari /api/. */
  for (const jahat of ['/etc/passwd', '/api/../secret', '//evil/path']) {
    const r = await panggil({ __path: jahat });
    benar(`__path "${jahat}" ditolak`, r.status === 404 || r.status === 400, `status ${r.status}`);
  }
}

/* ------------------------------------------------------------------ */
console.log('\n8. Thumbnail statis /bi/ untuk SEMUA produk katalog');

const biDir = path.join(ROOT, 'public', 'bi');
benar('folder public/bi ada', fs.existsSync(biDir), 'belum dibuat — jalankan npm run og:thumbs');

const produkKatalog = (() => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const PRODUCTS'));
  return body
    .split(/\n  \{\n/)
    .slice(1)
    .map((c) => c.match(/slug: '([^']+)'/)?.[1])
    .filter(Boolean);
})();

let biHilang = 0;
let biGemuk = 0;
if (fs.existsSync(biDir)) {
  for (const slug of produkKatalog) {
    const berkas = path.join(biDir, `${slug}.jpg`);
    if (!fs.existsSync(berkas)) {
      biHilang += 1;
      console.log(`         hilang: ${slug}.jpg`);
      continue;
    }
    if (fs.statSync(berkas).size > OG_MAX_BYTES) {
      biGemuk += 1;
      console.log(`         kegemukan: ${slug}.jpg (${fs.statSync(berkas).size} byte)`);
    }
  }
}
benar(`semua ${produkKatalog.length} produk katalog punya /bi/<slug>.jpg`, biHilang === 0, `${biHilang} hilang`);
benar('semua thumbnail < 300 KB', biGemuk === 0, `${biGemuk} kegemukan`);

/*
 * REGRESI: crawler menerima 404 sehingga Facebook menampilkan
 * "The page could not be found" — bukan kartu produk.
 * Penyebabnya: `source: '/produk/:slug'` + `has` user-agent menangkap SEMUA
 * bot, termasuk Googlebot, padahal tujuannya `/api/share/produk/:slug`.
 */
for (const r of vercel.rewrites || []) {
  if (r.source === '/produk/:slug') {
    const re = new RegExp(r.has?.[0]?.value?.re || '');
    benar(
      'rewrite /produk/:slug TIDAK menangkap Googlebot',
      !re.test('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
      'Googlebot ikut tertangkap → halaman produk hilang dari Google'
    );
    benar(
      'rewrite /produk/:slug TIDAK menangkap Bingbot',
      !re.test('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'),
      'Bingbot ikut tertangkap'
    );
    benar(
      'rewrite /produk/:slug TETAP menangkap facebookexternalhit',
      re.test('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'),
      'Facebook tidak tertangkap'
    );
    benar(
      'rewrite /produk/:slug TETAP menangkap WhatsApp',
      re.test('WhatsApp/2.23.20.0 A'),
      'WhatsApp tidak tertangkap'
    );
  }
}

/* Halaman produk statis tidak boleh lagi dipakai lewat rewrite crawler. */
const aturanProdukStatis = (vercel.rewrites || []).filter(
  (r) => String(r.source).startsWith('/produk/') && r.source !== '/produk/:slug'
);
benar(
  'tidak ada rewrite crawler per-produk yang bertabrakan',
  aturanProdukStatis.length === 0,
  `${aturanProdukStatis.length} aturan masih ada`
);

/* ------------------------------------------------------------------ */
console.log(`\n${gagal === 0 ? 'SEMUA UJI THUMBNAIL LULUS' : `${gagal} UJI GAGAL`}\n`);
process.exit(gagal === 0 ? 0 : 1);
