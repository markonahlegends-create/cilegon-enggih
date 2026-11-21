/**
 * Reset database lokal ke data seed awal.
 * Usage: npm run seed:reset
 */
import fs from 'node:fs';
import path from 'node:path';

const file = process.env.DATA_DIR
  ? path.join(process.env.DATA_DIR, 'db.json')
  : path.join(process.cwd(), 'server', 'data', 'db.json');

if (fs.existsSync(file)) {
  fs.rmSync(file);
  console.log(`[Info Kelurahan] Database lokal dihapus: ${file}`);
} else {
  console.log('[Info Kelurahan] Tidak ada database lokal. Seed akan dibuat otomatis saat server dijalankan.');
}
console.log('[Info Kelurahan] Catatan: bila memakai Supabase, hapus baris id=main pada tabel site_state untuk reset.');
