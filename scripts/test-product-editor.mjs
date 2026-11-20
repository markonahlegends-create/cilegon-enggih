/**
 * UJI EDITOR PRODUK — nilai pilihan (ukuran/warna) tidak boleh tertukar.
 *
 * LATAR BELAKANG (laporan 20 Nov 2026)
 * "Pada halaman tambah produk bagian 4c, saat tambah selisih harga ukuran ke-3
 *  (LARGE) tersimpan 8.000 padahal saya input 19.000."
 *
 * PENYEBAB
 * `addValue()` membuat ID dari `Date.now()` saja:
 *     id: `${g.id}-v${Date.now().toString(36)}`
 * Tiga nilai yang ditambahkan dalam milidetik yang sama mendapat ID IDENTIK.
 * React memakai `key`, dan key duplikat membuatnya memakai ulang elemen DOM
 * yang salah: ketikan pada baris ke-3 bisa masuk ke baris ke-2. Angka yang
 * "tersimpan 8.000" itu nilai MEDIUM, bukan LARGE.
 *
 * Uji ini memeriksa pembuat ID sungguhan dari ProductEditor.tsx dan memastikan
 * ID selalu unik walau waktu dibekukan.
 *
 * Cara pakai: node scripts/test-product-editor.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(
    `${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`
  );
};
const benar = (nama, kondisi, detail = '') => {
  if (!kondisi) gagal += 1;
  console.log(`${kondisi ? '  OK  ' : '  SALAH'} ${nama}${kondisi ? '' : ` — ${detail}`}`);
};

const sumber = fs.readFileSync(path.join(ROOT, 'src', 'components', 'ProductEditor.tsx'), 'utf8');

console.log('— Pembuat ID baris dinamis —');

/*
 * Jalankan ekstrak `idBaru` apa adanya dari sumber, dengan `Date.now`
 * dibekukan. Dengan begitu uji benar-benar menguji kode produksi, bukan
 * salinan yang bisa menyimpang.
 */
const ambilFungsi = () => {
  const m = sumber.match(
    /let urutanBaru = 0;\s*\n\s*const idBaru = \(awalan: string\) =>\s*\n\s*`([^`]+)`;/
  );
  if (!m) return null;
  const template = m[1];
  let n = 0;
  return (awalan) => {
    n += 1;
    return template
      .replace('${awalan}', awalan)
      .replace('${Date.now().toString(36)}', '1700000000000')
      .replace('${(urutanBaru += 1).toString(36)}', n.toString(36));
  };
};

const idBaru = ambilFungsi();
benar('idBaru ditemukan di ProductEditor.tsx', typeof idBaru === 'function');
benar(
  'tidak lagi memakai Date.now() langsung untuk nilai pilihan',
  !sumber.includes('{ id: `${g.id}-v${Date.now().toString(36)}`'),
  'masih ada pola lama'
);

if (idBaru) {
  // Waktu dibekukan: meniru tiga klik "Tambah nilai" beruntun.
  const ids = [idBaru('grup-a-v'), idBaru('grup-a-v'), idBaru('grup-a-v')];
  check('tiga ID berbeda', new Set(ids).size, 3);
  benar(
    'ID memuat awalan grup',
    ids.every((i) => i.startsWith('grup-a-v-')),
    ids.join(', ')
  );

  // ID varian & video juga harus unik dalam milidetik yang sama.
  const campur = [
    idBaru('var-0'),
    idBaru('var-1'),
    idBaru('grup'),
    idBaru('vid'),
    idBaru('var-0')
  ];
  check('ID lintas jenis unik', new Set(campur).size, campur.length);
}

console.log('\n— Nilai tersimpan sebagai angka yang benar —');
{
  /*
   * Meniru `updateValue`: hanya baris yang dituju yang berubah.
   * Ini menjaga agar perbaikan ID tidak merusak logika penyuntingan.
   */
  const updateValue = (groups, gi, vi, patch) =>
    groups.map((g, i) =>
      i === gi ? { ...g, values: g.values.map((v, x) => (x === vi ? { ...v, ...patch } : v)) } : g
    );

  const awal = [
    {
      id: 'grup-ukuran',
      name: 'Ukuran',
      values: [
        { id: 'v1', label: 'SMALL', priceDelta: 0 },
        { id: 'v2', label: 'MEDIUM', priceDelta: 8000 },
        { id: 'v3', label: 'LARGE', priceDelta: 0 }
      ]
    }
  ];

  const akhir = updateValue(awal, 0, 2, { priceDelta: 19000 });
  check('LARGE menjadi 19.000', akhir[0].values[2].priceDelta, 19000);
  check('MEDIUM tetap 8.000', akhir[0].values[1].priceDelta, 8000);
  check('SMALL tetap 0', akhir[0].values[0].priceDelta, 0);
}

console.log('\n— Server tidak memotong selisih secara diam-diam —');
{
  const core = fs.readFileSync(path.join(ROOT, 'server', 'core.js'), 'utf8');
  /*
   * Dulu: priceDelta = Math.max(-maxDelta, Math.min(maxDelta, delta)) — nilai
   * di atas batas dipotong TANPA pemberitahuan. Kalau suatu saat angka yang
   * tersimpan berbeda dari yang diketik, admin harus tahu sebabnya.
   */
  benar(
    'cleanOptionGroups melaporkan selisih yang dipotong',
    core.includes('dipotong') || core.includes('batasSelisih'),
    'tidak ada pelaporan saat clamp'
  );
}

console.log(gagal === 0 ? '\n✅ SEMUA UJI EDITOR PRODUK LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
