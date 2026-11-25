/**
 * UJI RENDER DASHBOARD ADMIN DENGAN BALASAN DIAGNOSTIK CACAT.
 *
 * Ini REPRODUKSI insiden yang dilaporkan: /admin menampilkan "Halaman ini
 * gagal ditampilkan" dan refresh tidak pernah menolong.
 *
 * Penyebabnya: HealthCheckPanel menyimpan JSON apa pun asal `res.ok`, lalu
 * merender `data.summary.ok`. Respons 200 tanpa `summary` membuat render
 * melempar TypeError — dan karena panel itu tidak dibatasi, SELURUH dashboard
 * ikut mati.
 *
 * Uji ini merender dashboard SUNGGUHAN (React + jsdom), bukan sekadar membaca
 * kode, dengan dua bentuk respons:
 *
 *   MODE 0 — /api/diagnose 200 TANPA summary  (kondisi penyebab crash)
 *   MODE 1 — /api/diagnose normal
 *
 * Diuji dengan render karena bug jenis ini tidak terlihat dari membaca kode:
 * versi lama terlihat benar sampai `data.summary.ok` dieksekusi.
 *
 * Cara pakai: node scripts/test-render-dashboard.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const AKAR = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-render-'));
const sumber = path.join(AKAR, 'scripts/uji-dashboard/dash.tsx');
const pelari = path.join(AKAR, 'scripts/uji-dashboard/jalan.cjs');

let keluaran = { 0: '', 1: '', 2: '' };

try {
  for (const mode of [0, 1, 2]) {
    const bundel = path.join(dir, `dash-${mode}.cjs`);
    execFileSync(
      path.join(AKAR, 'node_modules/.bin/esbuild'),
      [
        sumber,
        '--bundle',
        '--format=cjs',
        '--platform=node',
        `--outfile=${bundel}`,
        '--log-level=error',
        '--define:import.meta.env={}',
        '--loader:.jpg=empty',
        '--loader:.png=empty',
        '--loader:.css=empty'
      ],
      { cwd: AKAR, stdio: 'pipe' }
    );

    keluaran[mode] = execFileSync(process.execPath, [pelari, bundel, String(mode)], {
      encoding: 'utf8',
      cwd: AKAR
    });
  }
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}

/*
 * Label di keluaran uji bisa mengandung tanda kurung (mis. "BOUNDARY GLOBAL
 * AKTIF (halaman mati total)"). Versi pertama memakai RegExp dan gagal karena
 * karakternya tidak di-escape dengan benar — uji jadi merah bukan karena kode
 * yang salah. Sekarang pencocokan dilakukan per baris, tanpa regex sama sekali.
 */
const baca = (teks, label) => {
  const polos = (t) => t.replace(/\s*\([^)]*\)/g, '').trim();
  const baris = String(teks)
    .split('\n')
    .map((b) => b.trim())
    .find((b) => polos(b.split(': ')[0]) === polos(label));
  if (!baris) return null;
  const nilai = baris.slice(baris.lastIndexOf(': ') + 2).trim();
  if (nilai === 'true') return true;
  if (nilai === 'false') return false;
  if (/^-?\d+$/.test(nilai)) return Number(nilai);
  return null;
};

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};

console.log('\n▶ MODE 0 — /api/diagnose 200 TANPA summary (kondisi penyebab crash)');
cek(
  'penangkap galat GLOBAL tidak aktif (halaman tidak mati total)',
  baca(keluaran[0], 'BOUNDARY GLOBAL AKTIF'),
  false
);
cek(
  'pesan galat tampil DI DALAM panel',
  baca(keluaran[0], 'PESAN DI DALAM PANEL'),
  true
);
cek('dashboard tetap bisa dipakai', baca(keluaran[0], 'DASHBOARD MASIH HIDUP'), true);

console.log('\n▶ MODE 1 — /api/diagnose normal');
cek('tidak ada pesan galat', baca(keluaran[1], 'PESAN DI DALAM PANEL'), false);
cek('dashboard normal', baca(keluaran[1], 'DASHBOARD MASIH HIDUP'), true);

console.log('\n▶ MODE 2 — data pesanan cacat, tab "Pesanan" dibuka');
cek('tombol tab Pesanan bisa diklik', baca(keluaran[2], 'TOMBOL TAB PESANAN DITEMUKAN'), true);
cek('penangkap galat GLOBAL tidak aktif', baca(keluaran[2], 'BOUNDARY GLOBAL AKTIF'), false);
cek(
  'data cacat DILAPORKAN ke admin (bukan hilang diam-diam)',
  baca(keluaran[2], 'PESAN DATA GAGAL DIMUAT'),
  true
);
cek('dashboard tetap bisa dipakai', baca(keluaran[2], 'DASHBOARD MASIH HIDUP'), true);
cek('tidak ada galat React', baca(keluaran[2], 'GALAT REACT'), 0);

console.log(gagal === 0 ? '\nRENDER DASHBOARD LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
