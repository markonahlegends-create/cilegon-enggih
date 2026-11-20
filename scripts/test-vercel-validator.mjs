/**
 * UJI VALIDATOR vercel.json — memastikan pola terlarang TIDAK lolos lagi.
 *
 * LATAR BELAKANG (3 insiden deploy produksi)
 *   1. "/og/*.jpg"             → Vercel: invalid route source pattern
 *   2. "/og/(.*)\\.jpg"        → Vercel: invalid route source pattern
 *   3. "/og/((.*)[.]html)"     → Vercel: invalid route source pattern
 *
 * Insiden ke-3 terjadi karena validator versi sebelumnya menganggap pola
 * "kurung seimbang = sah". Deploy produksi ikut gagal walau `npm run build`
 * lulus. Uji ini memastikan validator benar-benar menolak pola-pola itu,
 * sehingga kegagalan tertangkap di lokal — bukan di Vercel.
 *
 * Cara pakai: node scripts/test-vercel-validator.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, 'vercel.json');

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = dapat === harap;
  if (!ok) gagal += 1;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${dapat}, harap ${harap})`}`);
};

/** Jalankan validator terhadap konfigurasi tertentu (tanpa menyentuh repo). */
const nilai = (polaHeader) => {
  const asli = fs.readFileSync(CONFIG, 'utf8');
  const cfg = JSON.parse(asli);
  if (polaHeader) {
    cfg.headers = (cfg.headers || []).filter((h) => !String(h.source).startsWith('/og/'));
    cfg.headers.push({
      source: polaHeader,
      headers: [{ key: 'Cache-Control', value: 'no-store' }]
    });
  }
  const tmp = path.join(os.tmpdir(), `vercel-uji-${process.pid}.json`);
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));

  /*
   * Validator membaca ./vercel.json dari process.cwd(). Supaya repo tidak
   * diubah selama uji, salin ke direktori sementara lalu jalankan di sana.
   */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cek-vercel-'));
  fs.copyFileSync(tmp, path.join(dir, 'vercel.json'));
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'validate-vercel-config.mjs'),
    path.join(dir, 'validate.mjs')
  );
  /*
   * Validator juga memeriksa bahwa `destination` crawler benar-benar ada di
   * public/. Salin folder itu (hanya .html kecil) supaya uji menilai POLA,
   * bukan kelengkapan berkas.
   */
  fs.cpSync(path.join(ROOT, 'public', 'og'), path.join(dir, 'public', 'og'), {
    recursive: true,
    filter: (src) => fs.statSync(src).isDirectory() || src.endsWith('.html')
  });

  let kode = 0;
  let keluaran = '';
  try {
    keluaran = execFileSync(process.execPath, ['validate.mjs'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (err) {
    kode = err.status ?? 1;
    keluaran = `${err.stdout || ''}${err.stderr || ''}`;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  return { kode, keluaran };
};

console.log('— Pola yang HARUS ditolak Vercel —');
const terlarang = [
  ['glob "*" di source', '/og/*.jpg'],
  ['backslash escape', '/og/(.*)\\.jpg'],
  ['character class [.]', '/og/((.*)[.]html)'],
  ['grup pilihan (a|b)', '/og/(.*)(jpg|png)'],
  ['kurung bertumpuk', '/og/((.*).html)']
];
for (const [nama, pola] of terlarang) {
  const { kode } = nilai(pola);
  check(nama, kode === 1, true);
}

console.log('\n— Pola yang HARUS diterima —');
for (const [nama, pola] of [
  ['wildcard "(.*)"', '/og/(.*)'],
  ['literal', '/assets/(.*)']
]) {
  const { kode } = nilai(pola);
  check(nama, kode, 0);
}

console.log('\n— Konfigurasi repo saat ini —');
{
  const { kode } = nilai(null);
  check('vercel.json sah', kode, 0);
}

console.log(gagal === 0 ? '\n✅ SEMUA UJI VALIDATOR LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
