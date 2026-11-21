-- Info Kelurahan: penyimpanan dokumen situs.
-- Backend menggunakan service-role key di server saja (tidak pernah di browser).
create table if not exists public.site_state (
  id text primary key,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists site_state_updated_at_idx on public.site_state (updated_at desc);

-- Akses browser anon sengaja tidak diizinkan. API server memakai service role.
alter table public.site_state enable row level security;

-- Tidak menambahkan policy anon/public. Service-role backend mem-bypass RLS.
