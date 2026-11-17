/**
 * Generator Open Graph image (1200x630).
 *
 * Kenapa ada file ini:
 * WhatsApp membuang gambar preview di atas ~300 KB tanpa pesan error. Gambar
 * produk asli di `public/products/` berukuran 0,7-1,2 MB dan portrait, sehingga
 * link yang dibagikan hanya tampil sebagai teks.
 *
 * Skrip ini membuat kartu 1200x630 (rasio 1,91:1) dari foto produk + judul.
 *
 * Butuh ImageMagick 6 (`convert`) + font DejaVu. Jalankan manual:
 *   node scripts/generate-og-images.mjs
 *
 * Hasilnya di-commit ke `public/og/` supaya build di Vercel tidak perlu
 * ImageMagick sama sekali.
 *
 * Catatan teknis: sandbox ini tidak punya delegate SVG, jadi gambar digambar
 * memakai primitive ImageMagick (-annotate + gradient), bukan SVG.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'public', 'og');
const W = 1200;
const H = 630;

const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

const NAVY = '#1B365D';
const NAVY_DARK = '#0d192d';
const FOREST = '#2E6F40';
const AMBER = '#E5A93C';
const CREAM = '#F8FAF8';
const MUTED = '#98b9dc';
const MAX_BYTES = 300 * 1024;

const run = (args) =>
  execFileSync('convert', args, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 26 });

const tmpFor = (name) => path.join(os.tmpdir(), `og-${process.pid}-${name}`);

/** Ambil daftar produk dari data TypeScript tanpa build. */
const readProducts = () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'data', 'products.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const PRODUCTS'));
  const chunks = body.split(/\n  \{\n/).slice(1);
  const products = [];
  for (const chunk of chunks) {
    const id = chunk.match(/id: '([^']+)'/)?.[1];
    const slug = chunk.match(/slug: '([^']+)'/)?.[1];
    const name = chunk.match(/name: '([^']+)'/)?.[1];
    const shortName = chunk.match(/shortName: '([^']+)'/)?.[1];
    const image = chunk.match(/image: '([^']+)'/)?.[1];
    const priceText = chunk.match(/priceRangeText: '([^']+)'/)?.[1];
    if (!id || !slug || !name || !image) continue;
    products.push({ id, slug, name, shortName, image, priceText });
  }
  return products;
};

/**
 * Pecah teks menjadi baris dengan lebar maksimum (perkiraan karakter).
 * Bila melebihi maxLines, baris terakhir diberi elipsis agar tidak terpotong
 * di tengah kata secara mendadak.
 */
const wrap = (text, maxChars, maxLines = 3) => {
  const all = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if (`${line} ${word}`.trim().length > maxChars && line) {
      all.push(line.trim());
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  }
  if (line.trim()) all.push(line.trim());
  if (all.length <= maxLines) return all;
  const kept = all.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, maxChars - 1).trimEnd()}…`;
  return kept;
};

/** Latar gradient navy diagonal. */
const background = (dest) => {
  run([
    '-size',
    `${W}x${H}`,
    `gradient:${NAVY}-${NAVY_DARK}`,
    '-rotate',
    '0',
    '-gravity',
    'northwest',
    '-extent',
    `${W}x${H}`,
    dest
  ]);
};

/**
 * Satu kartu.
 * @param {object} opts
 * @param {string} [opts.photo] path foto produk (opsional)
 * @param {string[]} opts.lines baris judul besar
 * @param {string} [opts.subtitle]
 * @param {string} [opts.eyebrow]
 */
const buildCard = ({ photo, eyebrow, lines, subtitle, accent, out }) => {
  const bg = tmpFor(`bg-${path.basename(out)}.png`);
  background(bg);

  const args = [bg];
  let compositeArgs = [];

  if (photo && fs.existsSync(photo)) {
    // Foto menempati sisi kanan (520 px), di-crop tengah agar tidak gepeng.
    const photoTmp = tmpFor(`photo-${path.basename(out)}.png`);
    run([
      photo,
      '-resize',
      `520x${H}^`,
      '-gravity',
      'center',
      '-extent',
      `520x${H}`,
      photoTmp
    ]);
    compositeArgs.push('(', photoTmp, ')', '-geometry', `+${W - 520}+0`, '-composite');
  }

  args.push('-font', FONT_BOLD);

  // Aksen hijau di tepi kiri
  args.push('-fill', FOREST, '-draw', `rectangle 0,0 10,${H}`);

  // Kolom teks kiri: foto menempati 520 px di kanan, jadi teks harus
  // berhenti sebelum x = W - 520 - margin.
  const LEFT = 70;
  const TITLE_SIZE = 52;
  const TITLE_LH = 64;

  // Eyebrow: nama toko
  args.push('-pointsize', '24', '-fill', FOREST, '-annotate', `+${LEFT}+120`, eyebrow || 'CILEGON ENGGIH');

  // Judul
  args.push('-pointsize', String(TITLE_SIZE), '-fill', CREAM);
  lines.forEach((line, i) => {
    args.push('-annotate', `+${LEFT}+${210 + i * TITLE_LH}`, line);
  });

  const afterTitle = 210 + lines.length * TITLE_LH;

  // Harga / baris aksen (boleh 2 baris)
  if (accent) {
    args.push('-font', FONT_REG, '-pointsize', '30', '-fill', AMBER);
    wrap(accent, 34, 2).forEach((line, i) => {
      args.push('-annotate', `+${LEFT}+${afterTitle + 24 + i * 40}`, line);
    });
  }

  // Subtitle
  if (subtitle) {
    const y = afterTitle + 24 + (accent ? 96 : 0);
    args.push('-font', FONT_REG, '-pointsize', '24', '-fill', MUTED, '-annotate', `+${LEFT}+${y}`, subtitle);
  }

  // Domain di bawah
  args.push('-font', FONT_BOLD, '-pointsize', '28', '-fill', AMBER, '-annotate', `+${LEFT}+${H - 62}`, 'cilegon-enggih.vercel.app');
  args.push('-font', FONT_REG, '-pointsize', '22', '-fill', MUTED, '-annotate', `+${LEFT}+${H - 26}`, 'Kirim GoSend / JNE / J&T / SiCepat');

  args.push(...compositeArgs);
  args.push('-quality', '82', '-strip', '-sampling-factor', '4:2:0', out);

  run(args);
  for (const f of [bg]) fs.rmSync(f, { force: true });
  // hapus foto sementara bila ada
  const pt = tmpFor(`photo-${path.basename(out)}.png`);
  fs.rmSync(pt, { force: true });
};

const main = () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const products = readProducts();
  console.log(`Membuat kartu OG untuk ${products.length} produk...`);

  products.forEach((p) => {
    const out = path.join(OUT_DIR, `${p.slug}.jpg`);
    buildCard({
      photo: path.join(ROOT, 'public', p.image.replace(/^\//, '')),
      eyebrow: 'CILEGON ENGGIH',
      lines: wrap(p.shortName || p.name, 17),
      accent: p.priceText,
      subtitle: 'Oleh-oleh resmi khas Kota Cilegon',
      out
    });
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`  ${p.slug}.jpg — ${kb} KB${kb > 300 ? '  ⚠ >300KB' : ''}`);
  });

  // Kartu beranda / halaman umum
  const siteOut = path.join(OUT_DIR, 'toko-cilegon-enggih.jpg');
  buildCard({
    photo: path.join(ROOT, 'public', products[0].image.replace(/^\//, '')),
    eyebrow: 'CILEGON ENGGIH · OFFICIAL STORE',
    lines: ['Oleh-Oleh &', 'Merchandise Khas', 'Kota Cilegon'],
    accent: 'Kaos · Mug · Tumbler · Souvenir',
    subtitle: 'Khas Kota Baja, Bangga Membawanya',
    out: siteOut
  });
  console.log(`  toko-cilegon-enggih.jpg — ${Math.round(fs.statSync(siteOut).size / 1024)} KB`);

  // Kartu netral untuk halaman non-produk (katalog, legal, 404, dll.)
  const genericOut = path.join(OUT_DIR, 'cilegon-enggih-toko.jpg');
  buildCard({
    eyebrow: 'CILEGON ENGGIH · OFFICIAL STORE',
    lines: ['Merchandise Resmi', 'Kota Cilegon'],
    accent: 'Guest checkout · QRIS · Transfer Bank',
    subtitle: 'Kirim ke seluruh Indonesia',
    out: genericOut
  });
  console.log(`  cilegon-enggih-toko.jpg — ${Math.round(fs.statSync(genericOut).size / 1024)} KB`);

  const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.jpg'));
  const tooBig = files.filter((f) => fs.statSync(path.join(OUT_DIR, f)).size > MAX_BYTES);
  if (tooBig.length) {
    console.error(`\n❌ Melebihi 300 KB (WhatsApp akan abaikan): ${tooBig.join(', ')}`);
    process.exit(1);
  }
  const avg = Math.round(
    files.reduce((s, f) => s + fs.statSync(path.join(OUT_DIR, f)).size, 0) / files.length / 1024
  );
  console.log(`\n✅ ${files.length} kartu di public/og/ (rata-rata ${avg} KB, batas 300 KB)`);
};

main();
