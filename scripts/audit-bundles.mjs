/**
 * Audit harga paket bundling.
 *
 * ATURAN YANG DIJAGA
 * ------------------
 * "Jangan pernah membuat harga paket yang lebih mahal dari jumlah komponennya."
 *
 * Aturan ini sudah dua kali dilanggar saat menulis katalog (Paket Nataru versi
 * pertama, lalu Paket Tumbler + Tote Rp 189.000 yang melebihi Rp 177.000).
 * Keduanya lolos karena tidak ada yang menghitung ulang secara otomatis.
 * Skrip ini menghitung setiap paket dan GAGAL bila ada pelanggaran.
 *
 * CARA MENGHITUNG
 * ---------------
 * Komponen diambil dari produk tunggal dengan id yang sama seperti di
 * `bundleItems`. Harga pembanding = harga satuan produk (bukan harga grosir,
 * bukan harga coret) karena itu yang benar-benar dibayar pembeli jika membeli
 * terpisah.
 *
 * PAKET DENGAN KEMASAN BERBAYAR
 * -----------------------------
 * Beberapa paket memakai hardbox/pita/kartu yang TIDAK dijual sebagai produk
 * satuan, sehingga nilainya tidak muncul di katalog. Untuk paket seperti itu
 * kemasan boleh dihitung sebagai komponen, TAPI wajib:
 *   1. dideklarasikan di `packagingValue` di bawah, dan
 *   2. dinyatakan terbuka pada pembeli (bundleItems / spesifikasi "Rincian Nilai Paket").
 * Kalau tidak dideklarasikan, kemasan dianggap Rp 0 dan selisihnya dianggap
 * pelanggaran — supaya tidak ada yang menyembunyikan markup dengan alasan kemasan.
 *
 * Jalankan: npm run audit:bundles
 */

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/**
 * Nilai kemasan yang boleh dihitung sebagai komponen, per id paket.
 * Isinya HARUS sama dengan yang ditulis di halaman produk.
 */
const packagingValue = {
  // Hardbox navy gold foil + tissue krem + pita emas + kartu ucapan.
  'bundle-4': 10000,
  // Hardbox magnetik + busa + kartu (Paket Eksekutif & Bukber Korporat).
  'bundle-2': 15000,
  'bundle-8': 15000,
  // Hardbox + tissue + pita + kartu (Paket Bukber Keluarga, Tumbler+Tote).
  'bundle-7': 15000,
  'bundle-5': 12000,
  // Pouch ziplock + label + kartu (Paket Bukber Hemat).
  'bundle-6': 5000
};

/** Komponen tiap paket: id produk satuan, dengan pengulangan bila qty > 1. */
const components = {
  'bundle-1': ['prod-4', 'prod-1', 'prod-6'],
  'bundle-2': ['prod-7', 'prod-9', 'prod-8'],
  'bundle-3': ['prod-2', 'prod-5', 'prod-3', 'prod-6'],
  'bundle-4': ['prod-5', 'prod-6', 'prod-6', 'prod-6'],
  'bundle-5': ['prod-7', 'prod-9'],
  'bundle-6': ['prod-10', 'prod-14', 'prod-6'],
  'bundle-7': ['prod-12', 'prod-5', 'prod-6', 'prod-6', 'prod-6'],
  'bundle-8': ['prod-11', 'prod-5', 'prod-6', 'prod-6', 'prod-6']
};

/**
 * Nilai tambah per VARIAN yang boleh dihitung sebagai komponen, per id paket.
 * Contoh: varian korporat menambahkan cetak Kartu Logo Instansi.
 * Sama seperti kemasan: harus dideklarasikan di sini DAN disebut di halaman produk.
 */
const variantAddon = {
  'bundle-4': { 'nataru-corp': 10000 },
  'bundle-7': { 'bkk-corp': 15000 },
  'bundle-8': { 'bkp-logo': 20000 },
  'bundle-6': { 'bkh-corp': 6000 }
};

const rupiah = (n) => `Rp ${Number(n).toLocaleString('id-ID')}`;

const main = async () => {
  // Bundle products.ts supaya import.meta.env tidak meledak saat dijalankan di Node.
  const outfile = path.join(root, 'node_modules', '.cache', 'audit-products.cjs');
  await build({
    entryPoints: [path.join(root, 'src', 'data', 'products.ts')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    define: { 'import.meta.env': '{}' },
    outfile,
    logLevel: 'error'
  });

  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  delete require.cache[outfile];
  const { PRODUCTS } = require(outfile);

  const byId = new Map(PRODUCTS.map((p) => [p.id, p]));
  const problems = [];
  const unregistered = [];

  const bundles = PRODUCTS.filter((p) => p.isBundle);

  console.log('Audit harga paket bundling\n');

  for (const bundle of bundles) {
    const ids = components[bundle.id];

    if (!ids) {
      unregistered.push(bundle.id);
      continue;
    }

    let productSum = 0;
    const missing = [];
    for (const id of ids) {
      const item = byId.get(id);
      if (!item) {
        missing.push(id);
        continue;
      }
      productSum += item.price;
    }

    if (missing.length) {
      problems.push(`${bundle.id}: komponen tidak ditemukan → ${missing.join(', ')}`);
      continue;
    }

    const packaging = packagingValue[bundle.id] ?? 0;
    const total = productSum + packaging;
    const selisih = bundle.price - total;
    const ok = bundle.price <= total;

    if (!ok) {
      problems.push(
        `${bundle.id} (${bundle.shortName}): harga ${rupiah(bundle.price)} ` +
          `melebihi nilai komponen ${rupiah(total)} — selisih ${rupiah(selisih)}`
      );
    }

    const tanda = ok ? 'OK  ' : 'GAGAL';
    console.log(
      `${tanda} ${bundle.shortName.padEnd(26)} ` +
        `jual ${rupiah(bundle.price).padStart(11)} | ` +
        `produk ${rupiah(productSum).padStart(11)}` +
        `${packaging ? ` + kemasan ${rupiah(packaging)}` : ''} ` +
        `| selisih ${rupiah(selisih).padStart(11)}`
    );

    // Konsistensi varian: harga varian tidak boleh melebihi komponen + nilai tambahnya.
    const addons = variantAddon[bundle.id] || {};
    for (const v of bundle.variants || []) {
      const addon = addons[v.id] ?? 0;
      if (v.price > total + addon) {
        problems.push(
          `${bundle.id} varian "${v.label}": ${rupiah(v.price)} ` +
            `melebihi nilai komponen ${rupiah(total + addon)}` +
            (addon ? ` (termasuk nilai tambah ${rupiah(addon)})` : '')
        );
      } else if (addon > 0) {
        console.log(
          `       └ varian ${v.id}: ${rupiah(v.price)} = komponen ${rupiah(total)} + tambahan ${rupiah(addon)}`
        );
      }
    }

    // Harga grosir harus lebih murah dari harga eceran.
    if (bundle.wholesalePrice >= bundle.price) {
      problems.push(
        `${bundle.id}: harga grosir ${rupiah(bundle.wholesalePrice)} ` +
          `tidak lebih murah dari harga jual ${rupiah(bundle.price)}`
      );
    }

    // Kerapian diskon: persen harus cocok dengan harga coret.
    const hitung = Math.round(((bundle.originalPrice - bundle.price) / bundle.originalPrice) * 100);
    if (hitung !== bundle.discountPercent) {
      problems.push(
        `${bundle.id}: diskon tertulis ${bundle.discountPercent}% ` +
          `padahal hitungan ${hitung}%`
      );
    }
  }

  if (unregistered.length) {
    problems.push(`paket belum didaftarkan di skrip audit → ${unregistered.join(', ')}`);
  }

  console.log('');

  if (problems.length) {
    console.error(`${problems.length} masalah ditemukan:\n`);
    problems.forEach((p) => console.error(`  - ${p}`));
    console.error('\nAudit GAGAL. Perbaiki harga paket sebelum build.');
    process.exit(1);
  }

  console.log(`Semua ${bundles.length} paket lolos audit.`);
};

main().catch((err) => {
  console.error('Audit gagal dijalankan:', err.message);
  process.exit(1);
});
