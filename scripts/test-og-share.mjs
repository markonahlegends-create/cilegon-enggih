/**
 * AUDIT KARTU SHARE (Open Graph) — memastikan preview link di medsos benar.
 *
 * LATAR BELAKANG (laporan 20 Nov 2026)
 * "Thumbnail produk saat share link di medsos gambarnya tidak sesuai."
 *
 * Ada tiga rantai yang harus lengkap agar WhatsApp/Facebook menampilkan foto
 * produk yang tepat. Bila satu saja putus, yang muncul adalah gambar toko
 * (atau tidak ada gambar sama sekali):
 *
 *   1. Data     : src/data/og-meta.json memuat entri /produk/<slug>
 *   2. Halaman  : public/og/produk--<slug>.html berisi <meta og:image> yang benar
 *   3. Routing  : vercel.json mengarahkan crawler ke halaman itu
 *   4. Gambar   : berkas gambarnya ada, 1200x630, dan < 300 KB
 *                 (WhatsApp membuang preview di atas ~300 KB tanpa pesan error)
 *
 * Uji ini memeriksa KEEMPATNYA untuk setiap produk dan setiap halaman statis.
 *
 * Cara pakai: node scripts/test-og-share.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

let gagal = 0;
const gagalDaftar = [];

const benar = (nama, kondisi, detail = '') => {
  if (!kondisi) {
    gagal += 1;
    gagalDaftar.push(`${nama}${detail ? ` — ${detail}` : ''}`);
  }
  return Boolean(kondisi);
};

const meta = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'og-meta.json'), 'utf8'));
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

/** Semua entri: halaman statis + produk. */
const entri = [
  ...Object.entries(meta.pages || {}).map(([route, m]) => ({ route, ...m, jenis: 'halaman' })),
  ...Object.entries(meta.products || {}).map(([route, m]) => ({ route, ...m, jenis: 'produk' }))
];

/**
 * Nama berkas halaman share, mengikuti konvensi generator (generate-og-pages.mjs):
 * garis miring jadi `--`. Beranda "/" SENGAJA tidak punya berkas sendiri karena
 * index.html sudah memuat meta OG beranda.
 */
const namaHalamanShare = (route) => `${route.replace(/^\//, '').replace(/\//g, '--')}.html`;
const punyaHalamanSendiri = (route) => route !== '/';

/** Cek apakah gambar yang dirujuk ada di repo. */
const gambarLokal = (url) => {
  try {
    const { pathname } = new URL(url);
    return path.join(ROOT, 'public', pathname.replace(/^\//, ''));
  } catch {
    return null;
  }
};

/**
 * Baca dimensi & ukuran JPEG/PNG tanpa dependensi.
 * JPEG: cari penanda SOF. PNG: baca IHDR.
 */
const infoGambar = (file) => {
  const buf = fs.readFileSync(file);
  const bytes = buf.length;
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { bytes, lebar: buf.readUInt32BE(16), tinggi: buf.readUInt32BE(20), tipe: 'png' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const panjang = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          bytes,
          tinggi: buf.readUInt16BE(i + 5),
          lebar: buf.readUInt16BE(i + 7),
          tipe: 'jpeg'
        };
      }
      i += 2 + panjang;
    }
  }
  return { bytes, lebar: 0, tinggi: 0, tipe: 'tidak dikenal' };
};

console.log(`Diperiksa: ${entri.length} halaman (${Object.keys(meta.products || {}).length} produk)\n`);

const callbackUrl = (meta.baseUrl || '').replace(/\/$/, '');
benar('baseUrl memakai https', callbackUrl.startsWith('https://'));
benar('defaultImage ada', Boolean(meta.defaultImage));

const masalahGambar = [];
const masalahHalaman = [];
const masalahRouting = [];

for (const e of entri) {
  const label = `${e.jenis} ${e.route}`;

  // --- 1. Data ---
  benar(`[${label}] punya judul`, Boolean(e.title), 'og:title kosong');
  benar(`[${label}] punya deskripsi`, Boolean(e.description), 'og:description kosong');
  benar(`[${label}] punya gambar`, Boolean(e.image), 'og:image kosong');
  benar(`[${label}] gambar memakai https`, String(e.image || '').startsWith('https://'));
  benar(
    `[${label}] url absolut ke domain toko`,
    String(e.url || '').startsWith(callbackUrl),
    e.url
  );

  /*
   * --- 2. Halaman share ---
   *
   * PRODUK tidak lagi punya halaman statis. Kartunya dibangun saat diminta
   * dari database (`/api/share/produk/:slug`) supaya foto/nama/harga selalu
   * terbaru dan produk baru langsung punya pratinjau. Yang perlu dipastikan:
   *   - `og:image` produk = `/bi/<slug>.jpg` dan berkasnya BENAR-BENAR ada,
   *   - rewrite crawler `:slug` menangkap bot chat (bukan Googlebot).
   */
  if (e.jenis === 'produk') {
    const slugProduk = e.route.replace(/^\/produk\//, '');
    const berkasBi = path.join(ROOT, 'public', 'bi', `${slugProduk}.jpg`);
    if (!fs.existsSync(berkasBi)) {
      masalahHalaman.push(`${e.route} → tidak ada public/bi/${slugProduk}.jpg`);
    } else {
      const info = infoGambar(berkasBi);
      if (info.lebar !== 1200 || info.tinggi !== 630) {
        masalahHalaman.push(`${e.route} → thumbnail ${info.lebar}x${info.tinggi}, seharusnya 1200x630`);
      }
      if (info.bytes > 300 * 1024) {
        masalahHalaman.push(`${e.route} → thumbnail ${info.bytes} byte (> 300 KB)`);
      }
    }
    /* Rewrite dinamis harus ada dan tidak menangkap search engine. */
    const dinamis = (vercel.rewrites || []).find((r) => r.source === '/produk/:slug');
    if (!dinamis) {
      masalahRouting.push(`${e.route} → tidak ada rewrite /produk/:slug`);
    } else {
      const re = new RegExp(dinamis.has?.[0]?.value?.re || '');
      if (!re.test('facebookexternalhit/1.1')) masalahRouting.push(`${e.route} → Facebook tidak tertangkap`);
      if (!re.test('WhatsApp/2.23')) masalahRouting.push(`${e.route} → WhatsApp tidak tertangkap`);
      if (re.test('Mozilla/5.0 (compatible; Googlebot/2.1)'))
        masalahRouting.push(`${e.route} → Googlebot ikut tertangkap (halaman hilang dari Google)`);
      /*
       * Tujuan WAJIB berbentuk satu segmen `/api?__path=...`.
       * Vercel mencocokkan rewrite berdasarkan path tujuan, dan
       * `api/[...route].js` hanya satu segmen — tujuan
       * `/api/share/produk/:slug` menghasilkan 404 produksi.
       */
      if (dinamis.destination !== '/api?__path=/api/share/produk/:slug')
        masalahRouting.push(`${e.route} → tujuan rewrite salah (${dinamis.destination})`);
    }
    continue;
  }

  const berkasHalaman = path.join(ROOT, 'public', 'og', namaHalamanShare(e.route));
  if (!punyaHalamanSendiri(e.route)) {
    // Beranda: meta OG dibaca dari index.html.
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    if (!index.includes('og:image')) masalahHalaman.push('/ → index.html tanpa og:image');
  } else if (!fs.existsSync(berkasHalaman)) {
    masalahHalaman.push(`${e.route} → tidak ada ${namaHalamanShare(e.route)}`);
  } else {
    const html = fs.readFileSync(berkasHalaman, 'utf8');
    const og = (prop) => {
      const m = html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`));
      return m ? m[1] : '';
    };
    if (og('og:image') !== e.image) {
      masalahHalaman.push(`${e.route} → og:image halaman tidak sama dengan data`);
    }
    if (!html.includes('og:image:width') || !html.includes('og:image:height')) {
      masalahHalaman.push(`${e.route} → tanpa og:image:width/height`);
    }
    if (og('og:title') !== e.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')) {
      masalahHalaman.push(`${e.route} → og:title halaman tidak sama dengan data`);
    }
    if (!html.includes('twitter:card')) {
      masalahHalaman.push(`${e.route} → tanpa twitter:card`);
    }
  }

  // --- 3. Routing crawler di vercel.json ---
  // Beranda tidak butuh rewrite: crawler langsung menerima index.html.
  const aturan = !punyaHalamanSendiri(e.route)
    ? true
    : (vercel.rewrites || []).find(
    (r) =>
      r.source === e.route &&
      Array.isArray(r.has) &&
      r.has.some((h) => h.type === 'header' && h.key === 'user-agent' && h.value?.re) &&
      r.destination === `/og/${namaHalamanShare(e.route)}`
  );
  if (!aturan) masalahRouting.push(e.route);

  // --- 4. Berkas gambar ---
  const lokal = gambarLokal(e.image);
  if (!lokal || !fs.existsSync(lokal)) {
    masalahGambar.push(`${e.route} → gambar tidak ada: ${e.image}`);
  } else {
    const info = infoGambar(lokal);
    if (info.lebar !== 1200 || info.tinggi !== 630) {
      masalahGambar.push(
        `${e.route} → ukuran ${info.lebar}x${info.tinggi}, seharusnya 1200x630`
      );
    }
    if (info.bytes > 300 * 1024) {
      masalahGambar.push(
        `${e.route} → ${Math.round(info.bytes / 1024)} KB, WhatsApp membuang gambar >300 KB`
      );
    }
  }
}

console.log('— Halaman share statis —');
if (masalahHalaman.length === 0) console.log('  OK   semua halaman lengkap & konsisten');
else masalahHalaman.forEach((m) => {
  gagal += 1;
  gagalDaftar.push(m);
  console.log(`  SALAH ${m}`);
});

console.log('\n— Routing crawler (vercel.json) —');
if (masalahRouting.length === 0) console.log('  OK   semua route punya aturan crawler');
else masalahRouting.forEach((m) => {
  gagal += 1;
  gagalDaftar.push(`tanpa aturan crawler: ${m}`);
  console.log(`  SALAH tanpa aturan crawler: ${m}`);
});

console.log('\n— Berkas gambar (1200x630, <300 KB) —');
if (masalahGambar.length === 0) console.log('  OK   semua gambar valid');
else masalahGambar.forEach((m) => {
  gagal += 1;
  gagalDaftar.push(m);
  console.log(`  SALAH ${m}`);
});

/* --- Pemeriksaan tambahan: halaman detail yang ada di app tapi TANPA kartu --- */
console.log('\n— Kelengkapan terhadap katalog aplikasi —');
{
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.ts'), 'utf8');
  /*
   * Hanya slug PRODUK. Pola `slug:` juga dipakai oleh kategori
   * ("apparel-tas", "drinkware", …) — kalau ikut dihitung, hasilnya
   * peringatan palsu yang menyembunyikan masalah sebenarnya.
   */
  const blokProduk = src.slice(src.indexOf('export const PRODUCTS'));
  const slugs = [...blokProduk.matchAll(/^\s{4}slug:\s*'([^']+)'/gm)].map((m) => m[1]);
  const tanpaKartu = slugs.filter((s) => !meta.products?.[`/produk/${s}`]);
  benar(
    'setiap produk di katalog punya kartu share',
    tanpaKartu.length === 0,
    tanpaKartu.join(', ')
  );
  if (tanpaKartu.length) {
    console.log(`  SALAH produk tanpa kartu: ${tanpaKartu.join(', ')}`);
  } else {
    console.log(`  OK   ${slugs.length} produk, semua punya kartu share`);
  }
}

console.log(
  gagal === 0
    ? '\n✅ SEMUA UJI KARTU SHARE LULUS\n'
    : `\n❌ ${gagal} MASALAH DITEMUKAN\n`
);
if (gagal) console.log(gagalDaftar.slice(0, 20).join('\n'), '\n');
process.exit(gagal === 0 ? 0 : 1);
