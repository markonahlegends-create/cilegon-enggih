/**
 * UJI KETAHANAN DASHBOARD ADMIN.
 *
 * INSIDEN YANG DIKUNCI DI SINI
 * Dashboard /admin menampilkan layar "Halaman ini gagal ditampilkan" dan
 * refresh tidak pernah menolong. Penyebabnya:
 *
 *   HealthCheckPanel mengambil /api/diagnose, menyimpan JSON apa pun asal
 *   `res.ok`, lalu merender `data.summary.ok`. Kalau `summary` tidak ada,
 *   render melempar TypeError — dan karena panel itu tidak dibatasi, SELURUH
 *   dashboard ikut mati.
 *
 * Uji ini memastikan tiga hal:
 *   1. `bacaDiagnosa` menolak balasan cacat dengan PESAN, bukan pengecualian.
 *   2. Data yang lolos SELALU punya bentuk yang aman dirender.
 *   3. Setiap panel dashboard dibungkus `PanelAman`, sehingga galat di satu
 *      panel tidak mematikan halaman.
 *
 * Cara pakai: node scripts/test-dashboard-tahan-galat.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const AKAR = process.cwd();

let gagal = 0;
const cek = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal++;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, nilai) => cek(nama, Boolean(nilai), true);

/* ===================================================================== */
console.log('\n▶ 1. bacaDiagnosa menolak balasan cacat TANPA melempar');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ce-dash-'));
const berkas = path.join(AKAR, '.uji-diagnosa-sementara.tsx');
fs.writeFileSync(
  berkas,
  `
import { bacaDiagnosa } from './src/components/HealthCheckPanel';

const kasus: { nama: string; masuk: any }[] = [
  { nama: 'objek kosong', masuk: {} },
  { nama: 'null', masuk: null },
  { nama: 'undefined', masuk: undefined },
  { nama: 'string', masuk: "bukan json" },
  { nama: 'array', masuk: [] },
  { nama: 'halaman galat HTML', masuk: { error: "Internal Server Error" } },
  { nama: 'summary bukan objek', masuk: { ready: true, summary: "ok", checks: [] } },
  { nama: 'summary tanpa angka', masuk: { ready: true, summary: { ok: "16" }, checks: [] } },
  { nama: 'checks bukan array', masuk: { ready: true, summary: { ok: 1, warn: 0, fail: 0 }, checks: "x" } },
  { nama: 'checks hilang', masuk: { ready: true, summary: { ok: 1, warn: 0, fail: 0 } } },
  { nama: 'sahih', masuk: { ready: true, summary: { ok: 16, warn: 0, fail: 1 }, checks: [{ id: "a" }], storage: "supabase", generatedAt: "2026-01-01T00:00:00Z", note: "x" } },
  { nama: 'sahih tanpa field opsional', masuk: { ready: false, summary: { ok: 0, warn: 0, fail: 3 }, checks: [] } }
];

const hasil = kasus.map((k) => {
  try {
    const r = bacaDiagnosa(k.masuk);
    return {
      nama: k.nama,
      melempar: false,
      ok: r.ok,
      alasan: r.ok ? "" : r.alasan,
      bentukAman: r.ok
        ? typeof r.data.summary.ok === "number" &&
          typeof r.data.storage === "string" &&
          typeof r.data.generatedAt === "string" &&
          Array.isArray(r.data.checks) &&
          Array.isArray(r.data.notifikasiMidtrans)
        : null
    };
  } catch (e: any) {
    return { nama: k.nama, melempar: true, pesan: e?.message };
  }
});

process.stdout.write(JSON.stringify(hasil));
`,
  'utf8'
);

let hasil = [];
try {
  const keluaran = path.join(dir, 'out.cjs');
  execFileSync(
    path.join(AKAR, 'node_modules/.bin/esbuild'),
    [
      berkas,
      '--bundle',
      '--format=cjs',
      '--platform=node',
      `--outfile=${keluaran}`,
      '--log-level=error',
      '--define:import.meta.env={}',
      '--loader:.jpg=empty',
      '--loader:.png=empty',
      '--loader:.css=empty'
    ],
    { cwd: AKAR, stdio: 'pipe' }
  );
  hasil = JSON.parse(execFileSync(process.execPath, [keluaran], { encoding: 'utf8', cwd: AKAR }));
} finally {
  fs.rmSync(berkas, { force: true });
  fs.rmSync(dir, { recursive: true, force: true });
}

for (const h of hasil) {
  /*
   * Inilah inti insidennya: tidak satu pun masukan boleh melempar. Kalau
   * melempar, seluruh dashboard mati.
   */
  cek(`tidak melempar: ${h.nama}`, h.melempar, false);
  if (h.melempar) continue;

  const cacat = [
    'objek kosong',
    'null',
    'undefined',
    'string',
    'array',
    'halaman galat HTML',
    'summary bukan objek',
    'summary tanpa angka',
    'checks bukan array',
    'checks hilang'
  ].includes(h.nama);

  if (cacat) {
    cek(`ditolak dengan alasan: ${h.nama}`, h.ok, false);
    benar(`alasan bisa dibaca: ${h.nama}`, String(h.alasan || '').length > 20);
  } else {
    cek(`diterima: ${h.nama}`, h.ok, true);
    /* Data yang lolos WAJIB aman dirender — tidak ada undefined. */
    cek(`bentuk aman untuk render: ${h.nama}`, h.bentukAman, true);
  }
}

/* ===================================================================== */
console.log('\n▶ 2. Setiap panel dashboard dibungkus PanelAman');

const admin = fs.readFileSync(path.join(AKAR, 'src/pages/AdminDashboardPage.tsx'), 'utf8');

/*
 * SEMUA tab, bukan hanya yang pernah rusak. Kalau satu tab dibiarkan tanpa
 * pembungkus, galat di tab itu tetap mematikan seluruh dashboard — persis
 * insiden yang sedang dikunci di sini.
 */
const panelWajib = [
  'Kesiapan Go-Live',
  'Insight',
  'Pesanan',
  'Produk',
  'B2B',
  'Keuangan',
  'Dropship',
  'Keamanan',
  'Pengaturan'
];
for (const nama of panelWajib) {
  benar(`panel "${nama}" dibungkus`, admin.includes(`bagian="${nama}"`));
}

/*
 * Penjagaan ke depan: SETIAP tab yang dirender harus dibuka dengan PanelAman.
 * Daftar di atas hanya mengunci tab yang ada hari ini; pemeriksaan ini menangkap
 * tab baru yang ditambahkan tanpa pembungkus.
 */
const tabDirender = [...admin.matchAll(/\{tab === '([a-z0-9-]+)' && \(/g)].map((m) => m[1]);
benar(`ada tab yang diperiksa (${tabDirender.length})`, tabDirender.length >= 9);
for (const t of tabDirender) {
  /*
   * Diambil potongan sampai tab berikutnya, bukan beberapa baris pertama:
   * tab "overview" membungkus HealthCheckPanel di dalam kolom bertumpuk,
   * jadi PanelAman tidak persis di baris pertama. Yang penting isi tab itu
   * punya pembatas.
   */
  const mulai = admin.indexOf(`{tab === '${t}' && (`);
  const setelahnya = admin.indexOf('{tab === ', mulai + 1);
  const potong = admin.slice(mulai, setelahnya > 0 ? setelahnya : mulai + 4000);
  benar(`tab "${t}" memakai PanelAman`, potong.includes('<PanelAman'));
}

/*
 * Tanpa impor, seluruh pembungkusan di atas tidak berpengaruh apa pun —
 * uji ini menangkap kalau impornya hilang.
 */
benar('PanelAman diimpor', /import\s*\{\s*PanelAman\s*\}\s*from/.test(admin));

/* ===================================================================== */
console.log('\n▶ 3. PanelAman punya tampilan ringkas');

const boundary = fs.readFileSync(path.join(AKAR, 'src/components/ErrorBoundary.tsx'), 'utf8');
benar('varian ringkas ada', boundary.includes('ringkas'));
benar(
  'varian ringkas punya tombol coba lagi',
  /Coba Lagi/.test(boundary),
  'tanpa tombol ini panel yang gagal tidak bisa dipulihkan tanpa muat ulang halaman'
);
benar(
  'PanelAman memakai ringkas sebagai bawaan',
  /ringkas\s*=\s*true/.test(boundary)
);

console.log(gagal === 0 ? '\nDASHBOARD TAHAN GALAT LULUS\n' : `\n${gagal} asersi gagal\n`);
process.exit(gagal === 0 ? 0 : 1);
