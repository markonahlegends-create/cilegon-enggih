/**
 * UJI AUTOPLAY VIDEO PRODUK — memastikan video menarik perhatian tanpa
 * merusak pengalaman pembeli.
 *
 * LATAR BELAKANG
 * Video produk sudah didukung sejak lama, tetapi hanya berjalan SETELAH
 * diklik, dan diletakkan jauh di bawah halaman (setelah tabel spesifikasi).
 * Praktis tidak ada pembeli yang melihatnya.
 *
 * Sekarang video tampil di galeri (layar pertama) dan berjalan sendiri.
 * Autoplay adalah fitur yang paling mudah salah: salah sedikit, hasilnya
 * video beku, suara menyalak di ruang rapat, atau kuota pembeli terkuras.
 *
 * YANG DIUJI
 *   1. autoplay SELALU senyap (satu-satunya bentuk yang diizinkan browser)
 *   2. wajib playsInline (tanpa ini iPhone membuka pemutar layar penuh)
 *   3. loop aktif — video pendek tidak berhenti di hitam
 *   4. preload="metadata" — berkas penuh tidak diunduh sebelum terlihat
 *   5. prefers-reduced-motion → TIDAK autoplay
 *   6. IntersectionObserver → hanya berjalan saat terlihat
 *   7. embed (YouTube/TikTok) tidak memuat iframe sebelum ditekan
 *   8. video tanpa poster jatuh ke foto produk, bukan kotak hitam
 *
 * Cara pakai: node scripts/test-video-autoplay.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const AKAR = path.resolve(import.meta.dirname, '..');
const baca = (f) => fs.readFileSync(path.join(AKAR, f), 'utf8');

const komponen = baca('src/components/ProductVideoPlayer.tsx');
const halaman = baca('src/pages/ProductDetailPage.tsx');

let gagal = 0;
const cek = (nama, kondisi, keterangan = '') => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  ✅' : '  ❌'} ${nama}${!kondisi && keterangan ? ` → ${keterangan}` : ''}`);
};

console.log('\n▶ Komponen GaleriVideo');

cek('komponen GaleriVideo tersedia', /export const GaleriVideo/.test(komponen));

/*
 * Autoplay bersuara DIBLOKIR browser. Kalau `muted` hilang, video tidak akan
 * pernah berjalan sendiri — dan kalau berjalan, ia menyalak.
 */
const blokVideo = komponen.slice(komponen.indexOf('<video'), komponen.indexOf('</video>'));
cek('elemen <video> memakai muted', /\bmuted\b/.test(blokVideo));
cek('elemen <video> memakai playsInline', /playsInline/.test(blokVideo), 'iPhone akan buka layar penuh');
cek('elemen <video> memakai loop', /\bloop\b/.test(blokVideo));
cek('preload="metadata" (bukan auto)', /preload="metadata"/.test(blokVideo));
cek('tidak ada autoplay bersuara tersembunyi', !/onCanPlay=.*\.muted = false/.test(komponen));

cek('menghormati prefers-reduced-motion', /prefers-reduced-motion/.test(komponen));
cek('autoplay hanya saat terlihat (IntersectionObserver)', /IntersectionObserver/.test(komponen));
cek('berhenti saat tab disembunyikan', /document\.hidden/.test(komponen));

/*
 * Suara: elemen video harus mulai SENYAP (`muted={!suaraAktif}`), dan
 * `suaraAktif` hanya boleh diubah oleh tombol speaker — bukan otomatis.
 * Kalau ada `setSuaraAktif(true)` di luar handler tombol, autoplay bersuara
 * akan diblokir browser dan video membeku.
 */
cek('elemen video mulai senyap', /muted=\{!suaraAktif\}/.test(komponen));
const jumlahSuaraAktif = (komponen.match(/setSuaraAktif\(/g) || []).length;
cek(
  'suara hanya diubah oleh tombol speaker',
  jumlahSuaraAktif > 0 && jumlahSuaraAktif <= 2,
  `setSuaraAktif dipanggil ${jumlahSuaraAktif}× (deklarasi state tidak dihitung)`
);

/*
 * Penolakan autoplay BUKAN kegagalan. Browser menolak (iOS low-power, mode
 * hemat data) → cukup diam. Yang memicu layar error hanyalah event `onError`
 * dari elemen video, yaitu saat berkasnya benar-benar tidak bisa dimuat.
 * Kalau `setGagal(true)` juga dipanggil di dalam catch, video yang sekadar
 * ditolak autoplay akan menampilkan "Video tidak bisa dimuat" — menakut-nakuti
 * pembeli tanpa sebab.
 */
const blokCatch = (komponen.match(/catch\s*\{[\s\S]{0,300}?\}/) || [''])[0];
cek(
  'penolakan autoplay tidak dianggap error',
  blokCatch.length > 0 && !/setGagal\(true\)/.test(blokCatch),
  blokCatch.replace(/\s+/g, ' ').slice(0, 80)
);
cek('kegagalan berkas asli tetap dilaporkan', /onError=\{\(\) => setGagal\(true\)\}/.test(komponen));

cek('embed dimuat hanya setelah ditekan', /embedDibuka/.test(komponen) && /setEmbedDibuka\(true\)/.test(komponen));
cek('embed memakai autoplay=1 setelah ditekan', /autoplay=1/.test(komponen));
cek('iframe embed tidak dimuat di awal', !/loading="lazy"[\s\S]{0,80}autoplay=1/.test(komponen));

console.log('\n▶ Halaman produk');

cek('video dipasang DI GALERI (layar pertama)', /<GaleriVideo/.test(halaman));
cek('galeri memakai autoplay', /<GaleriVideo[\s\S]{0,300}?autoplay/.test(halaman));
cek('ada poster cadangan dari foto produk', /fallbackPoster=\{activeImage \|\| gallery\[0\]\}/.test(halaman));
cek('thumbnail video bertanda play', /aria-label="Putar video produk"/.test(halaman));
cek('bisa kembali ke foto', /Lihat foto/.test(halaman));
cek('penghitung gambar tidak muncul saat mode video', /modeGaleri === 'foto' && gallery\.length > 1/.test(halaman));
cek(
  'bagian video lama disembunyikan bila hanya 1 video',
  /filter\(\(v\) => v && v\.url\)\.length > 1/.test(halaman)
);

/*
 * ------------------------------------------------------------------
 * UJI RENDER NYATA — menangkap bug yang tidak terlihat oleh grep.
 * ------------------------------------------------------------------
 *
 * Versi pertama suite ini hanya memeriksa teks kode sumber, dan karena itu
 * LULUS padahal video sama sekali tidak bisa diputar. Dua bug yang lolos:
 *
 *   1. Tombol play bergantung pada prop `onOpen` yang tidak pernah dikirim
 *      halaman produk, sehingga onClick jatuh ke `setGagal(false)` — no-op.
 *      Tidak ada error, tombol mati diam-diam.
 *   2. `<video>` dirender tanpa atribut `controls`, jadi video tidak bisa
 *      dijeda atau digeser.
 *
 * Keduanya hanya bisa ditangkap dengan benar-benar MERENDER komponen dan
 * memeriksa HTML yang dihasilkan. Itulah yang dilakukan di bawah.
 */
console.log('\n▶ Render nyata komponen');

const esbuild = await import('esbuild');
const os = await import('node:os');
const pathMod = await import('node:path');

const dirUji = fs.mkdtempSync(pathMod.join(os.tmpdir(), 'ce-video-'));
const sumberUji = pathMod.join(dirUji, 'uji.tsx');
const keluaran = pathMod.join(dirUji, 'out.cjs');

/* Berkas uji ditulis di dalam folder repo supaya `react` bisa di-resolve. */
const berkasUji = pathMod.join(AKAR, '.uji-video-sementara.tsx');
fs.writeFileSync(
  berkasUji,
  [
    "import React from 'react';",
    "import { renderToStaticMarkup } from 'react-dom/server';",
    "import { GaleriVideo } from './src/components/ProductVideoPlayer';",
    'const video = [{ id: "v1", url: "https://contoh.supabase.co/v/uji.mp4", source: "file", poster: "https://contoh.supabase.co/p.jpg", title: "Uji" }];',
    'process.stdout.write(renderToStaticMarkup(React.createElement(GaleriVideo, { videos: video, autoplay: true })));'
  ].join('\n'),
  'utf8'
);

let html = '';
try {
  await esbuild.build({
    entryPoints: [berkasUji],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: keluaran,
    logLevel: 'silent'
  });
  /* Berkas uji dijalankan sebagai proses terpisah; hasilnya lewat stdout. */
  const { execFileSync } = await import('node:child_process');
  html = execFileSync(process.execPath, [keluaran], { encoding: 'utf8', cwd: AKAR });
} finally {
  fs.rmSync(berkasUji, { force: true });
}

cek('komponen benar-benar merender <video>', /<video/.test(html), html.slice(0, 120));
cek('elemen video punya `controls` (bisa dijeda & digeser)', /controls/.test(html));
cek('elemen video punya `autoplay`', /autoplay/.test(html));
cek('elemen video `muted` (syarat autoplay browser)', /muted/.test(html));
cek('elemen video `playsinline` (syarat iOS)', /playsinline/.test(html));
cek('elemen video punya `poster`', /poster=/.test(html));
cek('src video mengarah ke berkas asli', /contoh\.supabase\.co\/v\/uji\.mp4/.test(html));

fs.rmSync(dirUji, { recursive: true, force: true });

console.log(gagal === 0 ? '\nVIDEO PRODUK LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
