/**
 * NORMALISASI GAMBAR THUMBNAIL LINK SHARE.
 *
 * MASALAH YANG DISELESAIKAN
 * Thumbnail pratinjau (WhatsApp, Facebook, Telegram, X) diambil dari
 * `og:image`. Crawler menolak atau membuang gambar bila:
 *   - rasionya jauh dari 1,91:1 (foto produk portrait 1086x1448),
 *   - dimensi berkas tidak sama dengan `og:image:width/height`,
 *   - ukurannya kegedean (foto Supabase bisa > 400 KB),
 *   - tipe/ruang warna tidak jelas.
 * Kalau gambar ditolak, yang muncul adalah tautan tanpa gambar — persis
 * keluhan "tidak muncul thumbnail-nya".
 *
 * SOLUSI
 * Satu endpoint yang mengubah FOTO UTAMA PRODUK menjadi kanvas 1200x630
 * (JPEG sRGB, kualitas 82, di bawah ~300 KB). Dengan begitu semua produk —
 * lama maupun baru — punya thumbnail dengan bentuk yang sama dan sudah
 * terbukti diterima crawler.
 *
 * CARA KERJA
 * 1. Ambil produk dari database (sumber kebenaran foto utama).
 * 2. Kalau foto berupa URL absolut (Supabase Storage) → unduh.
 *    Kalau berupa path lokal (`/products/x.jpg`) → baca dari `public/`.
 * 3. Normalisasi lewat ImageMagick bila tersedia (build/dev lokal).
 *    Bila tidak tersedia (runtime Vercel tanpa binary), kirim foto apa adanya
 *    dengan `Content-Type` yang benar — tetap lebih baik daripada 404.
 *
 * Hasil disimpan di memori singkat supaya crawler yang meminta berkali-kali
 * (WhatsApp sering 2-3 kali) tidak memicu unduhan berulang.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';

/** Kanvas kartu pratinjau. Rasio 1,91:1 — standar yang dipakai semua platform. */
export const OG_W = 1200;
export const OG_H = 630;

/** Batas aman berkas yang diterima WhatsApp (~300 KB). */
export const OG_MAX_BYTES = 300 * 1024;

/** Ukuran maksimum foto sumber yang mau diunduh (jaga-jaga salah konfigurasi). */
const SUMBER_MAX_BYTES = 12 * 1024 * 1024;

/** Lama cache di memori. */
const TTL_MS = 10 * 60 * 1000;

/** cache: key → { buf, type, at } */
const cache = new Map();

const sekarang = () => Date.now();

const jalankan = (cmd, args) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 1 << 26, timeout: 20000 }, (err, stdout) =>
      err ? reject(err) : resolve(stdout)
    );
  });

let magickSiap = null;
let sharpSiap = null;

/**
 * Deteksi `sharp` (tersedia di runtime Vercel lewat dependency npm).
 * Diutamakan SETELAH ImageMagick gagal — ImageMagick hanya ada di mesin
 * pengembang, sedangkan di produksi `sharp` yang dipakai.
 */
const adaSharp = async () => {
  if (sharpSiap !== null) return sharpSiap;
  try {
    const mod = await import('sharp');
    sharpSiap = Boolean(mod?.default || mod);
  } catch {
    sharpSiap = false;
  }
  return sharpSiap;
};

/**
 * Normalisasi memakai `sharp` — jalur yang dipakai DI PRODUKSI.
 *
 * Tanpa ini, produk yang ditambahkan admin setelah build menerima foto MENTAH
 * (bisa 118-160 KB, rasio sembarang) sehingga crawler berisiko membuangnya.
 * Tekniknya sama dengan jalur ImageMagick: latar blur + produk utuh di tengah.
 */
const normalisasiSharp = async (inputBuf) => {
  const { default: sharp } = await import('sharp');

  const latar = await sharp(inputBuf)
    .rotate()
    .resize(OG_W, OG_H, { fit: 'cover', position: 'center' })
    .blur(28)
    .modulate({ brightness: 0.72 })
    .toColourspace('srgb')
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  const depan = await sharp(inputBuf)
    .rotate()
    .resize(OG_W - 80, OG_H - 40, { fit: 'inside', withoutEnlargement: false })
    .toColourspace('srgb')
    .png()
    .toBuffer();

  const depanUkuran = await sharp(depan).metadata();

  let buf = await sharp(latar)
    .composite([
      {
        input: depan,
        gravity: 'center',
        left: Math.max(0, Math.round((OG_W - (depanUkuran.width || OG_W)) / 2)),
        top: Math.max(0, Math.round((OG_H - (depanUkuran.height || OG_H)) / 2))
      }
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();

  /* Turunkan kualitas bertahap bila masih di atas batas aman ~300 KB. */
  for (const q of [72, 62, 52]) {
    if (buf.length <= OG_MAX_BYTES) break;
    buf = await sharp(latar)
      .composite([
        {
          input: depan,
          left: Math.max(0, Math.round((OG_W - (depanUkuran.width || OG_W)) / 2)),
          top: Math.max(0, Math.round((OG_H - (depanUkuran.height || OG_H)) / 2))
        }
      ])
      .jpeg({ quality: q, mozjpeg: true })
      .toBuffer();
  }

  return { buf, type: 'image/jpeg', lebar: OG_W, tinggi: OG_H, dinormalisasi: true };
};

/**
 * Deteksi sekali apakah ImageMagick bisa dipakai.
 * Di Vercel binary ini biasanya TIDAK ada, jadi hasilnya `false` dan kita
 * memakai jalur "kirim apa adanya".
 */
export const adaImageMagick = async () => {
  if (magickSiap !== null) return magickSiap;
  try {
    await jalankan('convert', ['-version']);
    magickSiap = true;
  } catch {
    magickSiap = false;
  }
  return magickSiap;
};

/**
 * Ubah sembarang gambar menjadi JPEG 1200x630.
 *
 * TEKNIK: "blur background + produk utuh".
 *
 * `-extent` saja (crop paksa / "cover") akan memotong produk portrait tinggi
 * sampai tinggal bagian tengahnya — pembeli tidak bisa melihat barangnya.
 * Karena itu dipakai dua lapis:
 *   1. latar  : foto di-zoom mengisi kanvas lalu di-blur kuat + digelapkan,
 *   2. depan  : foto UTUH (contain, tanpa potong) di tengah dengan bayangan.
 * Hasilnya kanvas 1200x630 penuh, produk tetap terlihat seluruhnya.
 */
export const normalisasi = async (inputBuf, ext = 'jpg') => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'og-img-'));
  const masuk = path.join(dir, `in.${ext.replace(/[^a-z0-9]/gi, '') || 'jpg'}`);
  const keluar = path.join(dir, 'out.jpg');
  const latar = path.join(dir, 'bg.jpg');
  const depan = path.join(dir, 'fg.png');

  const bangun = async (kualitas) => {
    /* 1. Latar: isi kanvas, blur berat, gelapkan sedikit. */
    await jalankan('convert', [
      masuk,
      '-auto-orient',
      '-colorspace',
      'sRGB',
      '-resize',
      `${OG_W}x${OG_H}^`,
      '-gravity',
      'center',
      '-extent',
      `${OG_W}x${OG_H}`,
      '-blur',
      '0x28',
      '-fill',
      'rgba(13,25,45,0.35)',
      '-colorize',
      '100',
      latar
    ]);

    /* 2. Depan: produk utuh, tidak dipotong, latar transparan. */
    await jalankan('convert', [
      masuk,
      '-auto-orient',
      '-colorspace',
      'sRGB',
      '-resize',
      `${OG_W - 80}x${OG_H - 40}>`,
      '-background',
      'none',
      '-gravity',
      'center',
      '-extent',
      `${OG_W - 80}x${OG_H - 40}`,
      depan
    ]);

    /* 3. Gabung + beri bayangan halus di tepi produk. */
    await jalankan('convert', [
      latar,
      depan,
      '-gravity',
      'center',
      '-composite',
      '-strip',
      '-interlace',
      'Plane',
      '-quality',
      String(kualitas),
      keluar
    ]);
  };

  try {
    await fs.writeFile(masuk, inputBuf);

    let buf;
    /* Turunkan kualitas bertahap bila masih di atas batas aman ~300 KB. */
    for (const q of [84, 74, 64, 54]) {
      await bangun(q);
      buf = await fs.readFile(keluar);
      if (buf.length <= OG_MAX_BYTES) break;
    }
    return { buf, type: 'image/jpeg', lebar: OG_W, tinggi: OG_H, dinormalisasi: true };
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
};

/** Tebak ekstensi dari URL/path. */
const ekstensiDari = (sumber) => {
  const m = String(sumber).match(/\.(jpe?g|png|webp)(\?|#|$)/i);
  return m ? m[1].toLowerCase().replace('jpg', 'jpeg') : 'jpg';
};

/**
 * Ambil byte foto utama produk.
 * `base` dipakai untuk melengkapi path relatif (`/products/x.jpg`).
 */
export const ambilFoto = async (image, base) => {
  const nilai = String(image || '').trim();
  if (!nilai) throw new Error('Produk tidak punya foto utama.');

  if (/^https?:\/\//i.test(nilai)) {
    const res = await fetch(nilai, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Gagal mengunduh foto (HTTP ${res.status}).`);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > SUMBER_MAX_BYTES) throw new Error('Foto sumber terlalu besar.');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > SUMBER_MAX_BYTES) throw new Error('Foto sumber terlalu besar.');
    const type = String(res.headers.get('content-type') || '').split(';')[0].trim();
    return { buf, ext: ekstensiDari(nilai), type };
  }

  /*
   * Path lokal. Dua bentuk perlu ditangani:
   *   `/products/kaos-distro.jpg`  → public/products/kaos-distro.jpg
   *   `/uploads/xyz.jpg`           → public/uploads/xyz.jpg (mode dev)
   * Path absolut dari `base` juga diterima agar aman.
   */
  let rel = nilai;
  if (/^https?:\/\//i.test(rel)) rel = new URL(rel).pathname;
  if (base && rel.startsWith(base)) rel = rel.slice(base.length);
  const bersih = rel.replace(/^\/+/, '').replace(/\.\./g, '');
  const berkas = path.join(process.cwd(), 'public', bersih);
  const buf = await fs.readFile(berkas);
  return { buf, ext: ekstensiDari(berkas), type: '' };
};

/** Tipe MIME dari signature byte — jangan percaya nama berkas saja. */
export const tipeDariByte = (buf) => {
  if (!buf || buf.length < 4) return 'application/octet-stream';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP')
    return 'image/webp';
  if (buf.slice(0, 3).toString('ascii') === 'GIF') return 'image/gif';
  return 'application/octet-stream';
};

/**
 * Bangun (atau ambil dari cache) thumbnail untuk satu produk.
 *
 * @returns {Promise<{buf:Buffer, type:string, dinormalisasi:boolean}>}
 */
export const thumbnailProduk = async (product, base) => {
  const image = String(product?.image || '').trim();
  const kunci = crypto
    .createHash('sha1')
    .update(`${String(product?.slug || '')}|${image}|${product?.updatedAt || ''}`)
    .digest('hex');

  const tersimpan = cache.get(kunci);
  if (tersimpan && sekarang() - tersimpan.at < TTL_MS) return tersimpan.hasil;

  const foto = await ambilFoto(image, base);

  /*
   * Hanya JPEG/PNG/WebP yang bisa diproses ImageMagick di sini. Selain itu
   * (mis. AVIF) kirim apa adanya — crawler modern masih bisa membacanya.
   */
  const tipeAsli = tipeDariByte(foto.buf);
  const bisaTipe = tipeAsli === 'image/jpeg' || tipeAsli === 'image/png' || tipeAsli === 'image/webp';

  /*
   * Urutan jalur: ImageMagick (mesin pengembang) → `sharp` (runtime Vercel)
   * → kirim apa adanya (jaring terakhir).
   */
  let hasil = { buf: foto.buf, type: tipeAsli, dinormalisasi: false };
  if (bisaTipe) {
    if (await adaImageMagick()) {
      hasil = await normalisasi(foto.buf, foto.ext);
    } else if (await adaSharp()) {
      hasil = await normalisasiSharp(foto.buf);
    }
  }

  /* Jaga ukuran cache agar tidak tumbuh tanpa batas. */
  if (cache.size > 64) cache.clear();
  cache.set(kunci, { at: sekarang(), hasil });
  return hasil;
};

/** Hapus cache — dipakai uji dan saat foto produk diganti. */
export const kosongkanCache = () => cache.clear();

/**
 * Lupakan hasil deteksi ImageMagick/sharp.
 *
 * Dipakai uji yang sengaja mengubah `PATH` untuk memaksa jalur `sharp`
 * (meniru runtime Vercel yang tidak punya binary ImageMagick). Tanpa reset,
 * hasil deteksi lama tetap terpakai dan uji menjadi tidak sah.
 */
export const resetDeteksi = () => {
  magickSiap = null;
  sharpSiap = null;
};
