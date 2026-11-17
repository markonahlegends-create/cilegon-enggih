-- =====================================================================
-- Analitik Trafik — Cilegon Enggih
-- Jalankan SEKALI di Supabase → SQL Editor → New query → Run.
--
-- Tabel yang dipakai: public.ce_documents
-- (sudah ada, dibuat oleh supabase-schema.sql). Semua koleksi aplikasi
-- ini disimpan di sana sebagai (collection, id, data jsonb), dan event
-- analitik masuk dengan  collection = 'analytics_events'.
-- Jadi TIDAK ada tabel baru — skrip ini hanya menambah indeks.
--
-- Skrip ini aman:
--   • Boleh dijalankan berulang (idempotent).
--   • Kalau tabelnya belum ada, TIDAK error — hanya memberi pesan
--     pengingat supaya Anda jalankan supabase-schema.sql dulu.
--
-- Prinsip privasi (sesuai kesepakatan):
--   • TIDAK menyimpan nama, nomor HP, email, atau alamat pembeli.
--   • TIDAK memakai cookie pelacak lintas situs.
--   • IP di-hash (SHA-256 + salt harian) hanya untuk menghitung
--     pengunjung unik per hari, lalu dihapus otomatis setelah 30 hari.
--   • Data pembeli tetap HANYA di koleksi pesanan seperti semula.
-- =====================================================================

do $$
begin
  if to_regclass('public.ce_documents') is null then
    raise notice 'Tabel public.ce_documents belum ada. Jalankan supabase-schema.sql dulu, lalu ulangi skrip ini.';
    return;
  end if;

  -- Percepat pemuatan event dalam rentang tanggal (paling sering dipakai).
  execute 'create index if not exists ce_documents_analytics_day_idx
             on public.ce_documents ((data->>''day''))
             where collection = ''analytics_events''';

  -- Percepat pengelompokan per jenis event (page_view, product_view, dst).
  execute 'create index if not exists ce_documents_analytics_type_idx
             on public.ce_documents (collection, (data->>''type''))
             where collection = ''analytics_events''';

  raise notice 'Indeks analitik siap. Tidak ada data pembeli yang tersentuh.';
end
$$;

-- ---------------------------------------------------------------------
-- Kebijakan retensi: event lebih lama dari 180 hari dibuang.
-- Pembersihan ini sudah dijalankan otomatis oleh server
-- (pruneOldEvents di server/insights.js). Query manual bila perlu:

-- delete from public.ce_documents
--  where collection = 'analytics_events'
--    and (data->>'day') < to_char(now() - interval '180 days', 'YYYY-MM-DD');

-- Hash IP disimpan di kolom data->>'visitor' (bukan IP mentah) dan hanya
-- berupa hash harian, sehingga tidak bisa dilacak antarhari.

-- ---------------------------------------------------------------------
-- Verifikasi (buka komentar, Run, lalu beri komentar lagi)
-- ---------------------------------------------------------------------
-- select count(*) from public.ce_documents where collection = 'analytics_events';
-- select data->>'day' as hari, count(*) from public.ce_documents
--  where collection = 'analytics_events' group by 1 order by 1 desc limit 7;

-- ---------------------------------------------------------------------
-- Cek nama tabel yang benar (jalankan terpisah, read-only):
--   select table_name from information_schema.tables
--    where table_schema = 'public' order by table_name;
--
-- Kalau nama tabel di project Anda BUKAN ce_documents
-- (dicek dari env SUPABASE_DOCS_TABLE di Vercel), ganti semua tulisan
-- public.ce_documents di atas dengan nama tabel tersebut.
-- ---------------------------------------------------------------------
