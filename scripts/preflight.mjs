#!/usr/bin/env node
/**
 * Preflight check sebelum go-live.
 *
 *   node scripts/preflight.mjs                     # cek artefak build lokal
 *   node scripts/preflight.mjs https://domain.com   # cek deployment live
 *
 * Gratis, tanpa dependency tambahan. Exit code 1 bila ada yang gagal.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const target = process.argv[2] || '';
const root = process.cwd();
const results = [];

const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fail = (name, detail = '') => results.push({ ok: false, name, detail });

/* ---------------- 1. Artefak yang wajib ada ---------------- */
const requiredFiles = [
  'dist/index.html',
  'dist/robots.txt',
  'dist/sitemap.xml',
  'dist/site.webmanifest',
  'dist/_redirects',
  'dist/products/kaos-distro.jpg',
  'supabase-schema.sql',
  'vercel.json',
  'api/[...route].js',
  'functions/api/[[route]].js',
  'server/core.js',
  'server/db.js',
  'GO-LIVE.md',
  'DEPLOYMENT.md'
];

for (const file of requiredFiles) {
  const abs = path.join(root, file);
  if (fs.existsSync(abs)) pass(`file: ${file}`);
  else fail(`file: ${file}`, 'tidak ditemukan — jalankan `npm run build` dulu');
}

/* ---------------- 1b. Integritas build: HTML ↔ aset ---------------- */
/*
 * Pemeriksaan ini menangkap keadaan yang membuat situs tampil TANPA GAYA:
 * HTML menyebut /assets/index-<hash>.css yang tidak ada di dist/. Kejadian
 * itu nyata — dilaporkan sebagai "HTML mentah + logo raksasa" di satu
 * profil Chrome. Tanpa pemeriksaan di sini, build setengah jadi lolos
 * tanpa peringatan apa pun.
 */
try {
  const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  const rujukan = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const hilang = rujukan.filter((r) => !fs.existsSync(path.join(root, 'dist', r.replace(/^\//, ''))));

  if (!rujukan.length) {
    fail('integritas aset', 'HTML tidak merujuk aset apa pun — build tidak lengkap');
  } else if (hilang.length) {
    fail(
      'integritas aset',
      `${hilang.length} aset dirujuk HTML tetapi tidak ada di dist/: ${hilang.join(', ')}`
    );
  } else {
    pass('integritas aset', `${rujukan.length} aset dirujuk dan semuanya ada`);
  }

  /* HTML wajib no-cache: kalau tidak, peramban memakai HTML lama -> aset lama. */
  const vc = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const htmlHeader = (vc.headers || []).find((x) => x.source === '/((?!assets/).*)');
  const cc = (htmlHeader?.headers || []).find((x) => x.key === 'Cache-Control')?.value || '';
  if (/no-cache|no-store|max-age=0/.test(cc)) {
    pass('cache HTML', cc);
  } else {
    fail(
      'cache HTML',
      'dokumen HTML tanpa Cache-Control no-cache — peramban bisa memakai HTML lama yang menunjuk aset yang sudah tidak ada'
    );
  }
} catch (err) {
  fail('integritas aset', `tidak bisa diperiksa: ${err.message}`);
}

/* ---------------- 2. Indikator placeholder di build ---------------- */
const indexHtml = fs.existsSync(path.join(root, 'dist/index.html'))
  ? fs.readFileSync(path.join(root, 'dist/index.html'), 'utf-8')
  : '';
const CANONICAL_DOMAINS = ['cilegon-enggih.vercel.app', 'cilegonenggih.com'];
const matchedDomain = CANONICAL_DOMAINS.find((d) => indexHtml.includes(`https://${d}`));
if (matchedDomain) {
  pass('canonical & OG meta', `domain terpasang: ${matchedDomain}`);
} else {
  fail('canonical & OG meta', 'domain belum diset di index.html');
}

/* ---- vercel.json harus lolos validasi skema (penyebab 2x deploy gagal) ---- */
try {
  execFileSync(process.execPath, [path.join(root, 'scripts/validate-vercel-config.mjs')], {
    stdio: 'pipe'
  });
  pass('vercel.json', 'pola source valid');
} catch (e) {
  const detail = String(e.stderr || e.stdout || e.message).split('\n').slice(0, 3).join(' ');
  fail('vercel.json', detail.trim() || 'tidak valid');
}

/* ---- File yang dibutuhkan build harus ter-track Git ----
   Insiden: `.gitignore` berisi `data/` sehingga `src/data/og-meta.json`
   tidak pernah ter-commit. Cek langsung, bukan mengandalkan ingatan. */
const mustBeTracked = [
  'vercel.json',
  'src/data/products.ts',
  'scripts/generate-og-data.mjs',
  'scripts/generate-og-pages.mjs',
  'scripts/validate-vercel-config.mjs',
  'public/og/toko-cilegon-enggih.jpg'
];
try {
  const untracked = mustBeTracked.filter((f) => {
    const ignored = spawnSync('git', ['check-ignore', '-q', f], { cwd: root });
    if (ignored.status === 0) return true;
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', f], { cwd: root });
    return tracked.status !== 0;
  });
  if (untracked.length) {
    fail('file ter-track Git', `tidak ter-commit / ter-ignore: ${untracked.join(', ')}`);
  } else {
    pass('file ter-track Git', `${mustBeTracked.length} file kritis`);
  }
} catch {
  /* git tidak tersedia — lewati pemeriksaan ini */
}

/* ---- Tidak boleh ada Routing Middleware (pernah mematikan seluruh situs) ---- */
for (const mw of ['middleware.ts', 'middleware.js', 'middleware.mts']) {
  if (fs.existsSync(path.join(root, mw))) {
    fail(
      'routing middleware',
      `${mw} terdeteksi — jangan pakai middleware yang memanggil fetch() ke origin sendiri (penyebab 500 MIDDLEWARE_INVOCATION_FAILED).`
    );
  }
}

/* ---- Halaman share statis untuk crawler ter-generate ---- */
const shareDir = path.join(root, 'public/og');
const sharePages = fs.existsSync(shareDir)
  ? fs.readdirSync(shareDir).filter((f) => f.endsWith('.html'))
  : [];
if (sharePages.length === 0) {
  fail('halaman share crawler', 'public/og/*.html kosong — jalankan `npm run og:pages`');
} else {
  pass('halaman share crawler', `${sharePages.length} halaman HTML statis`);
}

/* ---- Rewrite crawler harus ada & destination-nya nyata ---- */
const vercelPath = path.join(root, 'vercel.json');
if (fs.existsSync(vercelPath)) {
  const cfg = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const crawlerRules = (cfg.rewrites || []).filter((r) => r.has && r.destination?.startsWith('/og/'));
  if (crawlerRules.length === 0) {
    fail('rewrite crawler', 'tidak ada aturan rewrite untuk crawler di vercel.json');
  } else {
    const broken = crawlerRules.filter(
      (r) => !fs.existsSync(path.join(root, 'public', r.destination))
    );
    if (broken.length) {
      fail('rewrite crawler', `${broken.length} tujuan tidak ada: ${broken[0].destination}`);
    } else {
      pass('rewrite crawler', `${crawlerRules.length} aturan, semua tujuan ada`);
    }
  }
  // Catch-all SPA harus tetap paling akhir agar situs tidak 404.
  const last = cfg.rewrites[cfg.rewrites.length - 1];
  if (!last || !last.source.startsWith('/((?!')) {
    fail('catch-all SPA', 'aturan SPA harus berada di urutan terakhir rewrite');
  } else {
    pass('catch-all SPA', last.destination);
  }
}

/* ---- Open Graph: gambar preview WAJIB <300KB & 1200x630 ---- */
const ogFiles = fs.existsSync(path.join(root, 'public/og'))
  ? fs.readdirSync(path.join(root, 'public/og')).filter((f) => f.endsWith('.jpg'))
  : [];
if (ogFiles.length === 0) {
  fail('og image', 'public/og kosong — jalankan `npm run og:images`');
} else {
  const heavy = ogFiles.filter(
    (f) => fs.statSync(path.join(root, 'public/og', f)).size > 300 * 1024
  );
  if (heavy.length) {
    fail('og image', `${heavy.length} file >300KB — WhatsApp akan mengabaikannya`);
  } else {
    pass('og image', `${ogFiles.length} kartu, semua <300KB`);
  }
}

/* index.html harus menunjuk kartu OG, bukan PNG produk 1MB */
if (indexHtml.includes('/og/toko-cilegon-enggih.jpg')) {
  pass('og:image beranda', '/og/toko-cilegon-enggih.jpg');
} else {
  fail('og:image beranda', 'masih memakai gambar produk besar / bukan kartu OG');
}

/* metadata per halaman ter-generate */
const ogMetaPath = path.join(root, 'src/data/og-meta.json');
if (fs.existsSync(ogMetaPath)) {
  const meta = JSON.parse(fs.readFileSync(ogMetaPath, 'utf-8'));
  const n = Object.keys(meta.products || {}).length;
  pass('og-meta.json', `${n} produk + ${Object.keys(meta.pages || {}).length} halaman`);
} else {
  fail('og-meta.json', 'belum digenerate — jalankan `npm run og:data`');
}

/* sitemap.xml harus ikut ter-build (sebelumnya bisa hilang tanpa disadari) */
if (fs.existsSync(path.join(root, 'dist/sitemap.xml'))) {
  const sm = fs.readFileSync(path.join(root, 'dist/sitemap.xml'), 'utf-8');
  const urls = (sm.match(/<loc>/g) || []).length;
  pass('sitemap.xml', `${urls} URL, domain ${matchedDomain || '?'}`);
  if (/cilegonenggih\.com/.test(sm) && matchedDomain !== 'cilegonenggih.com') {
    fail('sitemap domain', 'sitemap masih menunjuk cilegonenggih.com (domain mati)');
  }
} else {
  fail('sitemap.xml', 'tidak ada di dist — jalankan `npm run build`');
}

const distJs = fs.existsSync(path.join(root, 'dist/assets'))
  ? fs
      .readdirSync(path.join(root, 'dist/assets'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(root, 'dist/assets', f), 'utf-8'))
      .join('\n')
  : '';
if (distJs.includes('6282249879873')) pass('WhatsApp resmi', '+62 822-4987-9873 ter-bundle');
else fail('WhatsApp resmi', 'nomor tidak ditemukan di bundle');
if (distJs.includes('fadil-labs.vercel.app')) pass('kredit developer', 'Fadil Labs ter-bundle');
else fail('kredit developer', 'link Fadil Labs tidak ditemukan');
if (distJs.includes('Tambah Varian')) pass('editor produk: varian', 'form varian terbundle');
else fail('editor produk: varian', 'editor varian tidak ada di bundle');
if (distJs.includes('Notifikasi Telegram')) pass('pengaturan Telegram', 'panel notifikasi terbundle');
else fail('pengaturan Telegram', 'panel Telegram tidak ada di bundle');
if (distJs.includes('PRE-ORDER')) pass('label pre-order', 'badge pre-order terbundle');
else fail('label pre-order', 'label pre-order tidak ditemukan');

/* Notifikasi Telegram & Storage gambar (opsional, dicek kalau API hidup) */
const apiBase = target ? target.replace(/\/+$/, '') : 'http://localhost:3001';
try {
  const diag = await fetch(`${apiBase}/api/diagnose`).then((r) => (r.ok ? r.json() : null));
  if (diag && Array.isArray(diag.checks)) {
    const tg = diag.checks.find((c) => c.id === 'telegram');
    const img = diag.checks.find((c) => c.id === 'storage-images');
    if (tg && tg.status === 'ok') pass('notifikasi Telegram', tg.detail);
    else fail('notifikasi Telegram', (tg && tg.detail) || 'belum diatur di dashboard');
    if (img && img.status === 'ok') pass('storage gambar produk', img.detail);
    else fail('storage gambar produk', (img && img.detail) || 'bucket belum disiapkan');
  }
} catch {
  // API tidak hidup → lewati pemeriksaan runtime.
}

/* ---------------- 3. Checklist manual ---------------- */
console.log('\n📋 Checklist manual (tidak bisa diotomasi):');
[
  'Rekening bank asli sudah diisi di /admin → Pengaturan (bukan PLACEHOLDER)',
  'Gambar QRIS merchant resmi dipasang (mode statis) atau NMID benar (mode dinamis)',
  'ADMIN_PASSWORD produksi kuat & hanya diketahui pemilik toko',
  'Data order contoh/demo sudah dibersihkan (tab Pesanan atau SQL Supabase)',
  'Uji transfer nominal kecil ke rekening toko sudah berhasil',
  'Sitemap sudah disubmit ke Google Search Console'
].forEach((item) => console.log(`   ☐ ${item}`));

/* ---------------- 4. Cek deployment live ---------------- */
if (target) {
  const base = target.replace(/\/+$/, '');
  console.log(`\n🌐 Memeriksa deployment: ${base}\n`);

  const check = async (label, url, validate) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        fail(label, `${res.status} ${url}`);
        return;
      }
      if (validate && !(await validate(res))) return;
      pass(label, `${res.status}`);
    } catch (err) {
      fail(label, `${url} → ${err.message}`);
    }
  };

  /* --- deteksi proteksi deployment Vercel (SSO) ---------------------- */
  let protectedDeployment = false;
  try {
    const probe = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(15000),
      redirect: 'manual'
    });
    const location = probe.headers.get('location') || '';
    if (probe.status >= 300 && probe.status < 400 && /vercel\.com/i.test(location)) {
      protectedDeployment = true;
    }
    if (probe.status === 401) protectedDeployment = true;
  } catch (err) {
    fail('deployment dapat diakses publik', err.message);
  }

  if (protectedDeployment) {
    fail(
      'deployment dapat diakses publik',
      'URL ini meminta login Vercel (Deployment Protection aktif) — pembeli tidak bisa membuka toko'
    );
    fail(
      'aksi: matikan proteksi',
      'Vercel → Project → Settings → Deployment Protection → Vercel Authentication: Disabled → lalu Redeploy. Gunakan URL Production (domain utama), bukan URL preview ber-hash.'
    );
    console.log('\n⚠️  Deployment masih dilindungi Vercel Authentication — pemeriksaan API dilewati.\n');
  }

  await check('api health', `${base}/api/health`, async (res) => {
    const body = await res.json().catch(() => ({}));
    if (body.storage === 'supabase') {
      pass('storage supabase', 'data persisten aktif');
      return true;
    }
    fail('storage supabase', `masih "${body.storage}" — env Supabase belum terbaca, data akan hilang saat cold start`);
    if (Array.isArray(body.warnings)) {
      body.warnings.forEach((w) => console.log(`      ↳ ${w}`));
    }
    return false;
  });

  await check('api diagnose (ringkas)', `${base}/api/diagnose`, async (res) => {
    const body = await res.json().catch(() => ({}));
    if (!Array.isArray(body.checks)) {
      fail('api diagnose', 'respons tidak dikenali (versi deploy lama?)');
      return false;
    }
    body.checks.forEach((c) => {
      if (c.status === 'fail') fail(`diagnosa: ${c.label}`, c.fix || c.detail);
      else if (c.status === 'warn') console.log(`   ⚠️  ${c.label} — ${c.detail}`);
    });
    pass('api diagnose', `${body.summary?.ok ?? '?'} siap / ${body.summary?.fail ?? '?'} wajib`);
    return true;
  });

  await check('api storefront', `${base}/api/storefront`, async (res) => {
    const body = await res.json().catch(() => ({}));
    const count = (body.products || []).length;
    if (count > 0) {
      pass('produk tersedia', `${count} produk`);
      return true;
    }
    fail('produk tersedia', 'katalog kosong');
    return false;
  });

  await check('api ping', `${base}/api/ping`);
  await check('halaman utama', `${base}/`);
  await check('SPA rewrite /katalog', `${base}/katalog`);
  await check('halaman /admin', `${base}/admin`);
  await check('robots.txt', `${base}/robots.txt`);
  await check('sitemap.xml', `${base}/sitemap.xml`);

  try {
    const res = await fetch(`${base}/api/admin/orders`, { signal: AbortSignal.timeout(15000) });
    if (res.status === 401) pass('proteksi admin', 'menolak tanpa token (401)');
    else fail('proteksi admin', `status ${res.status} — seharusnya 401`);
  } catch (err) {
    fail('proteksi admin', err.message);
  }
}

/* ---------------- Ringkasan ---------------- */
console.log('\n═══ PREFLIGHT RESULT ═══');
results.forEach((r) =>
  console.log(`${r.ok ? '✅' : '❌'} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`)
);
const failed = results.filter((r) => !r.ok);
console.log(
  `\n${results.length - failed.length}/${results.length} lolos${
    failed.length ? `, ${failed.length} perlu perbaikan` : ' — siap go-live 🚀'
  }`
);
process.exit(failed.length ? 1 : 0);
