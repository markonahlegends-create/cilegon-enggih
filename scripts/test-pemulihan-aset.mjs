/**
 * UJI PEMULIHAN ASET BASI — "halaman tampil tanpa gaya".
 *
 * Komponen ini menyelamatkan peramban yang sudah terlanjur menyimpan dokumen
 * HTML lama yang menunjuk berkas CSS/JS yang sudah tidak ada di server.
 * Gejalanya: HTML mentah tanpa tata letak, hanya di satu profil peramban.
 *
 * Yang diuji di sini adalah logika penentunya, memakai DOM tiruan:
 *   - CSS dianggap TIDAK terpasang bila stylesheet kosong/gagal dimuat
 *   - CSS lintas-origin tidak boleh dianggap bukti kegagalan
 *   - pemulihan hanya sekali per sesi (penjaga anti muat-ulang berulang)
 *
 * Cara pakai: node scripts/test-pemulihan-aset.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const AKAR = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-aset-'));

/* Berkas uji ditulis di dalam repo supaya esbuild & react bisa di-resolve. */
const berkas = path.join(AKAR, '.uji-pemulihan-sementara.tsx');
fs.writeFileSync(
  berkas,
  `
const state: any = { sheets: [] as any[], session: new Map<string, string>(), replaced: '' };

(globalThis as any).window = {
  location: {
    href: 'https://contoh.test/katalog?x=1',
    search: '',
    replace(u: string) { state.replaced = u; }
  },
  setTimeout,
  addEventListener() {}
};
(globalThis as any).document = {
  readyState: 'complete',
  get styleSheets() { return state.sheets; }
};
(globalThis as any).sessionStorage = {
  getItem: (k: string) => state.session.get(k) ?? null,
  setItem: (k: string, v: string) => state.session.set(k, v),
  removeItem: (k: string) => state.session.delete(k)
};

import { cssTerpasang, pulihkanSekali } from './src/lib/asetBasi';

const hasil: any[] = [];
const catat = (nama: string, dapat: any, harap: any) =>
  hasil.push({ nama, ok: JSON.stringify(dapat) === JSON.stringify(harap), dapat, harap });

catat('tanpa stylesheet → tidak terpasang', cssTerpasang(), false);
state.sheets = [{ cssRules: [] }];
catat('stylesheet kosong (gagal dimuat) → tidak terpasang', cssTerpasang(), false);
state.sheets = [{ cssRules: [{ cssText: 'body{margin:0}' }] }];
catat('stylesheet berisi aturan → terpasang', cssTerpasang(), true);
state.sheets = [{ get cssRules() { throw new Error('SecurityError'); } }];
catat('lintas-origin diabaikan → tidak terpasang', cssTerpasang(), false);

state.session.clear();
state.replaced = '';
catat('pemulihan pertama dijalankan', pulihkanSekali(), true);
catat('URL memuat penanda ce_pulih=1', /ce_pulih=1/.test(state.replaced), true);
catat('penanda sesi tersimpan', state.session.get('ce-pulih-aset'), '1');
state.replaced = '';
catat('pemulihan kedua ditolak (anti-loop)', pulihkanSekali(), false);
catat('tidak ada muat ulang tambahan', state.replaced, '');

process.stdout.write(JSON.stringify(hasil));
`,
  'utf8'
);

let daftar = [];
try {
  const keluaran = path.join(dir, 'out.cjs');
  execFileSync(
    path.join(AKAR, 'node_modules/.bin/esbuild'),
    [berkas, '--bundle', '--format=cjs', '--platform=node', `--outfile=${keluaran}`, '--log-level=error'],
    { cwd: AKAR, stdio: 'pipe' }
  );
  daftar = JSON.parse(execFileSync(process.execPath, [keluaran], { encoding: 'utf8', cwd: AKAR }));
} finally {
  fs.rmSync(berkas, { force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}

let gagal = 0;
console.log('\n▶ Pemulihan halaman tanpa gaya');
for (const h of daftar) {
  if (!h.ok) gagal++;
  console.log(
    `${h.ok ? '  OK  ' : '  SALAH'} ${h.nama}${h.ok ? '' : ` (dapat ${JSON.stringify(h.dapat)}, harap ${JSON.stringify(h.harap)})`}`
  );
}

console.log(gagal === 0 ? '\nPEMULIHAN ASET LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
