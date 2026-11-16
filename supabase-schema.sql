-- =====================================================================
--  Cilegon Enggih — Supabase (PostgreSQL) schema
--  Jalankan di Supabase Dashboard → SQL Editor → New query → Run.
--  Aman dijalankan berulang (idempotent).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Tabel dokumen generik.
-- Backend menyimpan orders / products / settings / b2b / vouchers sebagai
-- JSONB di sini, sehingga skema tetap sederhana namun query tetap cepat
-- (index per collection + GIN untuk pencarian di dalam dokumen).
-- ---------------------------------------------------------------------
create table if not exists public.ce_documents (
  collection  text        not null,
  id          text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (collection, id)
);

create index if not exists ce_documents_collection_idx
  on public.ce_documents (collection);

create index if not exists ce_documents_collection_updated_idx
  on public.ce_documents (collection, updated_at desc);

create index if not exists ce_documents_data_gin_idx
  on public.ce_documents using gin (data);

-- Auto-update updated_at
create or replace function public.ce_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ce_documents_touch on public.ce_documents;
create trigger ce_documents_touch
  before update on public.ce_documents
  for each row execute function public.ce_touch_updated_at();

-- ---------------------------------------------------------------------
-- Keamanan (RLS)
-- Semua akses data dilakukan dari backend (service_role) atau Express lokal.
-- JANGAN pernah mengekspos service_role key ke browser.
-- RLS diaktifkan tanpa policy publik → anon key tidak bisa membaca apa pun.
-- ---------------------------------------------------------------------
alter table public.ce_documents enable row level security;

-- ---------------------------------------------------------------------
-- (Opsional) View bantu untuk laporan penjualan harian.
-- ---------------------------------------------------------------------
create or replace view public.ce_orders_report as
select
  d.id                                              as order_id,
  d.data->>'customerName'                           as customer_name,
  d.data->>'customerPhone'                          as customer_phone,
  d.data->>'paymentStatus'                          as payment_status,
  d.data->>'status'                                 as order_status,
  d.data->>'courier'                                as courier,
  d.data->>'resi'                                   as resi,
  (d.data->>'totalAmount')::numeric                 as total_amount,
  (d.data->>'createdAt')::timestamptz               as created_at
from public.ce_documents d
where d.collection = 'orders';

-- ---------------------------------------------------------------------
-- (Opsional) Simulasi seed awal dari dashboard admin:
-- setelah deploy, login ke /admin → tombol "Seed Data Demo".
-- ---------------------------------------------------------------------

-- Cek isi data:
-- select collection, count(*) from public.ce_documents group by collection;
