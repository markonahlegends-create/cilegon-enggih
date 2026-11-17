-- =====================================================================
-- Analitik Trafik — Cilegon Enggih
-- Jalankan SEKALI di Supabase → SQL Editor.
--
-- Prinsip privasi (sesuai kesepakatan):
--   • TIDAK menyimpan nama, nomor HP, email, atau alamat pembeli.
--   • TIDAK memakai cookie pelacak lintas situs.
--   • IP di-hash (SHA-256 + salt) hanya untuk menghitung pengunjung unik
--     per hari, lalu dihapus otomatis setelah 30 hari.
--   • Data pembeli tetap HANYA di tabel `records` (pesanan) seperti semula.
-- =====================================================================

-- Tabel event. Memakai skema `records` yang sama dengan koleksi lain
-- (id, data jsonb) supaya langsung terbaca oleh server tanpa kode adapter baru.
-- Bila project Anda memakai tabel `records` untuk semua koleksi:
--   collection = 'analytics_events'
-- Tidak perlu membuat tabel baru — cukup indeks di bawah.
--
-- Kalau Anda ingin tabel terpisah, buka komentar blok berikut:

-- create table if not exists public.analytics_events (
--   id text primary key,
--   data jsonb not null,
--   created_at timestamptz not null default now()
-- );

-- ---------------------------------------------------------------------
-- Indeks: percepat agregasi per hari & per jenis event
-- ---------------------------------------------------------------------
create index if not exists records_collection_updated_idx
  on public.records (collection, updated_at desc);

-- Indeks untuk pencarian event analitik berdasarkan waktu (jsonb).
create index if not exists records_analytics_day_idx
  on public.records ((data->>'day'))
  where collection = 'analytics_events';

create index if not exists records_analytics_type_idx
  on public.records (collection, (data->>'type'))
  where collection = 'analytics_events';

-- ---------------------------------------------------------------------
-- Kebijakan retensi: hapus event > 180 hari, dan hash IP > 30 hari
-- ---------------------------------------------------------------------
-- Pembersihan dijalankan oleh cron /api/cron/backup (lihat server/core.js).
-- Query manual bila perlu:
--
--   delete from public.records
--    where collection = 'analytics_events'
--      and (data->>'day') < to_char(now() - interval '180 days', 'YYYY-MM-DD');
--
-- Hash IP disimpan di field `visitor` (bukan IP mentah) dan otomatis
-- dipangkas menjadi hanya tanggal saat proses agregasi harian.

-- ---------------------------------------------------------------------
-- Verifikasi
-- ---------------------------------------------------------------------
-- select count(*) from public.records where collection = 'analytics_events';
-- select data->>'day' as hari, count(*) from public.records
--  where collection = 'analytics_events' group by 1 order by 1 desc limit 7;

-- =====================================================================
-- CATATAN PENTING
-- =====================================================================
-- Tabel `records` sudah ada dan dipakai semua koleksi aplikasi ini.
-- Karena itu TIDAK perlu DDL baru — cukup dua indeks di atas.
-- Kalau indeks sudah ada, perintah `create index if not exists` aman diulang.
-- =====================================================================
