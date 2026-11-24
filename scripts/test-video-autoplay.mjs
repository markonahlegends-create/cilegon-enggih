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

cek('suara hanya aktif lewat tombol', /toggleSuara/.test(komponen));
cek('kegagalan autoplay tidak menampilkan error', /catch\s*\{[\s\S]{0,400}?setSedangJalan\(false\)/.test(komponen));

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

console.log(gagal === 0 ? '\nVIDEO PRODUK LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
