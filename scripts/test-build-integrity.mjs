/**
 * UJI INTEGRITAS BUILD — mencegah "situs tampil tanpa CSS".
 *
 * GEJALA YANG PERNAH TERJADI
 * Di satu profil Chrome, cilegon-enggih.vercel.app tampil sebagai HTML mentah:
 * teks biru bergaris bawah tanpa tata letak, dan favicon SVG raksasa memenuhi
 * layar. Profil lain di komputer yang sama menampilkannya normal.
 *
 * PENYEBABNYA TIDAK PERNAH BISA DIBUKTIKAN DARI SINI, tetapi ada SATU kelas
 * kegagalan yang bisa dipastikan: HTML menyebut berkas `/assets/index-<hash>.css`
 * yang TIDAK ADA di dalam build. Keadaan itu terjadi kalau:
 *
 *   - `npm run build` dijalankan sebagian (mis. `vite build` gagal setelah
 *     `index.html` ditulis), atau
 *   - berkas di `dist/` tertinggal dari build lama lalu terunggah bersama, atau
 *   - HTML dan aset berasal dari dua build berbeda.
 *
 * Dalam keadaan itu peramban menampilkan halaman tanpa gaya SELAMANYA — bukan
 * sesaat — karena tidak ada yang bisa dimuat ulang. Persis seperti tangkapan
 * layar yang dilaporkan.
 *
 * KEBIJAKAN CACHE YANG SALING BERTENTANGAN
 * `/assets/*` di-cache `immutable` selama setahun (benar: namanya ber-hash),
 * sedangkan dokumen HTML dulu masuk pola header umum TANPA `Cache-Control`
 * sama sekali. Akibatnya peramban bebas menyimpan HTML lama dan memakainya
 * kembali. HTML lama menunjuk aset lama; begitu aset lama hilang dari
 * deployment baru, halaman tampil tanpa gaya. Uji ini juga memastikan
 * dokumen HTML SELALU `no-cache`, supaya HTML dan aset tidak pernah berasal
 * dari dua versi berbeda.
 *
 * Cara pakai: node scripts/test-build-integrity.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const AKAR = process.cwd();
const DIST = path.join(AKAR, 'dist');

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, nilai, detail = '') =>
  cek(nama, Boolean(nilai), true) || (detail && console.log(`         ${detail}`));

console.log('\n▶ 1. Artefak build ada');

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('  SALAH dist/index.html tidak ada — jalankan `npm run build` dulu.');
  process.exit(1);
}

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

/* ---------------------------------------------------------------------- */
console.log('\n▶ 2. Setiap aset yang dirujuk HTML BENAR-BENAR ada di dist/');

/*
 * Inilah pemeriksaan yang menangkap "situs tanpa CSS". Tanpa uji ini,
 * build yang setengah jadi lolos ke produksi tanpa satu pun peringatan.
 */
const rujukan = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
benar('HTML merujuk setidaknya satu CSS', rujukan.some((r) => r.endsWith('.css')), rujukan.join(', '));
benar('HTML merujuk setidaknya satu JS', rujukan.some((r) => r.endsWith('.js')));

for (const r of rujukan) {
  const abs = path.join(DIST, r.replace(/^\//, ''));
  benar(`aset ada: ${r}`, fs.existsSync(abs));
}

/* ---------------------------------------------------------------------- */
console.log('\n▶ 3. Tidak ada aset yatim (sisa build lama)');

/*
 * Aset ber-hash yang tidak dirujuk HTML mana pun berarti `dist/` bercampur
 * dua build. Ini bukan hanya boros: kalau HTML yang terunggah merujuk salah
 * satunya, halaman bisa tampil tanpa gaya.
 */
const isiAset = fs.existsSync(path.join(DIST, 'assets'))
  ? fs.readdirSync(path.join(DIST, 'assets'))
  : [];
const dirujuk = new Set(rujukan.map((r) => r.split('/').pop()));
const yatim = isiAset.filter((f) => !dirujuk.has(f));
cek('tidak ada aset yatim di dist/assets', yatim, []);

/* ---------------------------------------------------------------------- */
console.log('\n▶ 4. Kebijakan cache: HTML tidak boleh disimpan peramban');

/*
 * Tanpa `no-cache`, peramban boleh memakai HTML lama setelah deploy baru.
 * HTML lama menunjuk aset lama yang sudah tidak ada → halaman tanpa gaya,
 * dan itu bertahan sampai cache-nya dibersihkan manual. Persis keluhan
 * "hanya di satu akun Chrome".
 */
const vercel = JSON.parse(fs.readFileSync(path.join(AKAR, 'vercel.json'), 'utf8'));
const headerUntuk = (src) => {
  const h = (vercel.headers || []).find((x) => x.source === src);
  if (!h) return {};
  return Object.fromEntries(h.headers.map((x) => [x.key, x.value]));
};

const htmlHeader = headerUntuk('/((?!assets/).*)');
benar(
  'dokumen HTML punya Cache-Control',
  Boolean(htmlHeader['Cache-Control']),
  'tanpa ini peramban bisa memakai HTML lama'
);
benar(
  'Cache-Control HTML melarang pemakaian tanpa validasi',
  /no-cache|no-store|max-age=0/.test(htmlHeader['Cache-Control'] || ''),
  `nilai: ${htmlHeader['Cache-Control'] || '(kosong)'}`
);

const asetHeader = headerUntuk('/assets/(.*)');
benar(
  'aset ber-hash boleh immutable',
  /immutable/.test(asetHeader['Cache-Control'] || '')
);

/* ---------------------------------------------------------------------- */
console.log('\n▶ 5. Catch-all SPA tidak boleh menelan aset');

/*
 * Kalau `/assets/x.css` yang tidak ada jatuh ke catch-all SPA, server
 * membalas `index.html` ber-Content-Type text/html untuk permintaan CSS.
 * Peramban mengabaikannya karena MIME salah — dan sebabnya jadi jauh lebih
 * sulit dilihat daripada 404 biasa.
 */
const rewrites = vercel.rewrites || [];
const catchAll = rewrites[rewrites.length - 1];
benar('rewrite SPA ada di urutan terakhir', catchAll && catchAll.destination === '/index.html');
benar(
  'catch-all mengecualikan jalur api',
  /api/.test((catchAll && catchAll.source) || ''),
  `source: ${(catchAll && catchAll.source) || '(kosong)'}`
);

/* ---------------------------------------------------------------------- */
console.log('\n▶ 6. Tidak ada service worker liar');

/*
 * Service worker yang menyajikan aset dari cache bisa membuat satu profil
 * peramban terus menampilkan versi lama meski server sudah benar. Toko ini
 * tidak memakai PWA offline, jadi keberadaannya hanya menambah risiko.
 */
const swKemungkinan = ['sw.js', 'service-worker.js', 'workbox-sw.js'].filter((f) =>
  fs.existsSync(path.join(DIST, f))
);
cek('tidak ada service worker di dist', swKemungkinan, []);

console.log(gagal === 0 ? '\nINTEGRITAS BUILD LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
