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
  'dist/products/kaos-distro.png',
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

/* ---------------- 2. Indikator placeholder di build ---------------- */
const indexHtml = fs.existsSync(path.join(root, 'dist/index.html'))
  ? fs.readFileSync(path.join(root, 'dist/index.html'), 'utf-8')
  : '';
if (indexHtml.includes('cilegonenggih.com')) {
  pass('canonical & OG meta', 'domain produksi terpasang');
} else {
  fail('canonical & OG meta', 'domain belum diset di index.html');
}

const distJs = fs.existsSync(path.join(root, 'dist/assets'))
  ? fs
      .readdirSync(path.join(root, 'dist/assets'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(root, 'dist/assets', f), 'utf-8'))
      .join('\n')
  : '';
if (distJs.includes('6281927157103')) pass('WhatsApp resmi', '0819-2715-7103 ter-bundle');
else fail('WhatsApp resmi', 'nomor tidak ditemukan di bundle');
if (distJs.includes('fadil-labs.vercel.app')) pass('kredit developer', 'Fadil Labs ter-bundle');
else fail('kredit developer', 'link Fadil Labs tidak ditemukan');

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
