/**
 * GENERATOR THUMBNAIL STATIS UNTUK LINK SHARE (`public/bi/<slug>.jpg`).
 *
 * MENGAPA ADA
 * `og:image` versi sebelumnya menunjuk `/api/og-image/<slug>.jpg`. Itu jalur
 * Serverless Function, dan crawler yang mengambil gambar lewat jalur fungsi
 * berisiko menerima 404/500 — apalagi di paket Hobby yang membatasi ukuran
 * body respons. Bila gambar gagal diambil, WhatsApp/Facebook **tidak menampilkan
 * thumbnail sama sekali**, walau HTML kartunya sempurna.
 *
 * Jalur statis `/bi/*` dilayani CDN tanpa batas itu dan bisa di-cache lama,
 * jadi semua produk katalog dibuatkan thumbnail di sini saat build.
 *
 * SUMBER GAMBAR = FOTO UTAMA PRODUK (`image` di `src/data/products.ts`),
 * bukan kartu templat. Bila admin mengganti foto produk di database, kartu
 * HTML-nya (dilayani endpoint dinamis) langsung memakai foto baru; thumbnail
 * statis ini menyusul pada build berikutnya.
 *
 * PRODUK BARU DARI DASHBOARD
 * Tidak ada di katalog statis, jadi tidak punya berkas di sini. `vercel.json`
 * mengarahkan `/bi/:slug` ke `/api/og-image/:slug` sebagai cadangan, sehingga
 * produk baru tetap punya thumbnail (dibangun dari database saat diminta).
 *
 * Hasil di-commit ke repo supaya build Vercel tidak perlu ImageMagick.
 * Jalankan manual bila foto produk berubah:
 *   node scripts/generate-og-thumbs.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { normalisasi, adaImageMagick, OG_W, OG_H } from '../server/og-image.js';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'bi');
const SUMBER_DIR = path.join(ROOT, 'public', 'products');

/** Ambil slug + foto utama dari katalog tanpa perlu build TypeScript. */
const bacaKatalog = () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const PRODUCTS'));
  const chunks = body.split(/\n  \{\n/).slice(1);
  const hasil = [];
  for (const chunk of chunks) {
    const slug = chunk.match(/slug: '([^']+)'/)?.[1];
    const image = chunk.match(/image: '([^']+)'/)?.[1];
    if (!slug || !image) continue;
    hasil.push({ slug, image });
  }
  return hasil;
};

const main = async () => {
  const katalog = bacaKatalog();
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const siap = await adaImageMagick();
  if (!siap) {
    console.error(
      '[og-thumbs] ImageMagick (`convert`) tidak tersedia. Jalankan skrip ini di mesin yang punya ImageMagick, lalu commit hasilnya.'
    );
    process.exit(1);
  }

  let dibuat = 0;
  let dilewati = 0;
  const hilang = [];

  for (const { slug, image } of katalog) {
    const sumber = path.join(ROOT, 'public', image.replace(/^\//, ''));
    const tujuan = path.join(OUT_DIR, `${slug}.jpg`);

    if (!fs.existsSync(sumber)) {
      hilang.push(`${slug} → ${image}`);
      continue;
    }

    /*
     * Lewati bila hasil sudah lebih baru dari foto sumbernya. Membuat ulang
     * 22 gambar setiap build hanya memperlambat tanpa manfaat.
     */
    if (fs.existsSync(tujuan)) {
      const tSumber = fs.statSync(sumber).mtimeMs;
      const tTujuan = fs.statSync(tujuan).mtimeMs;
      if (tTujuan >= tSumber) {
        dilewati += 1;
        continue;
      }
    }

    const { buf } = await normalisasi(fs.readFileSync(sumber), 'jpeg');
    fs.writeFileSync(tujuan, buf);
    dibuat += 1;

    /* Verifikasi hasil benar-benar kanvas yang dijanjikan. */
    const dim = execFileSync('identify', ['-format', '%wx%h', tujuan]).toString().trim();
    if (dim !== `${OG_W}x${OG_H}`) {
      console.error(`[og-thumbs] ${slug}: dimensi ${dim}, seharusnya ${OG_W}x${OG_H}`);
      process.exit(1);
    }
  }

  /* Hapus thumbnail yatim (produk sudah tidak ada di katalog). */
  const slugKatalog = new Set(katalog.map((p) => `${p.slug}.jpg`));
  let dibersihkan = 0;
  for (const berkas of fs.readdirSync(OUT_DIR)) {
    if (!berkas.endsWith('.jpg')) continue;
    if (!slugKatalog.has(berkas)) {
      fs.unlinkSync(path.join(OUT_DIR, berkas));
      dibersihkan += 1;
    }
  }

  console.log(
    `[og-thumbs] ${katalog.length} produk · dibuat ${dibuat} · dilewati ${dilewati} · yatim dibersihkan ${dibersihkan}`
  );
  if (hilang.length) {
    console.error(`[og-thumbs] foto sumber tidak ditemukan:\n  ${hilang.join('\n  ')}`);
    process.exit(1);
  }
};

await main();
