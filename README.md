# Info Kelurahan

Portal berita warga modern dan responsif untuk **Kelurahan Karang Asem, Kecamatan Cibeber, Kota Cilegon**. Dibangun dengan React, TypeScript, Vite, Express, Tailwind CSS, dan penyimpanan lokal atau Supabase. Seluruh kode aplikasi berlisensi MIT. Kredit desain/pengembangan: [Fadil Labs](https://fadil-labs.vercel.app/).

## Fitur

- Beranda berita dengan headline, ticker berita terkini, kategori, artikel populer, dan agenda.
- Halaman artikel, pencarian, arsip kategori/tag, berbagi, simpan berita, komentar dengan moderasi.
- Newsletter dan formulir kontak/aduan.
- Dashboard redaksi `/admin`: ringkasan statistik, CRUD artikel, kategori, agenda, moderasi komentar, pesan, pengaturan situs.
- Tampilan responsif untuk ponsel, tablet, dan desktop; tema terang/gelap.
- Sitemap, RSS, Open Graph, metadata SEO, schema.org, robots.txt.
- Backend Express dan API kompatibel Vercel Serverless Functions.
- Storage file JSON tanpa biaya untuk self-host, atau Supabase (free/open-source) untuk penyimpanan terkelola.

## Kebutuhan

Node.js 20–22 dan npm. Tidak memerlukan API berbayar, lisensi berbayar, atau layanan email pihak ketiga. Font Google Fonts hanya dekoratif; aplikasi tetap bisa dibangun tanpa font eksternal.

## Menjalankan lokal

```sh
npm install
npm run dev
```

Vite berjalan pada `http://localhost:5173`, API Express pada `http://localhost:3001`. Gunakan `npm run dev:api` dan `npm run dev:web` bila ingin memisahkan proses.

Dashboard: `http://localhost:5173/admin`

Salin `.env.example` menjadi `.env` untuk mengatur konfigurasi lokal; server membaca berkas itu saat mulai. Password lokal bawaan: `infokelurahan2026`. **Ganti sebelum deploy** dengan mengatur `ADMIN_PASSWORD` di environment.

## Build dan self-host

```sh
npm run build
npm start
```

Express menyajikan API dan SPA dari folder `dist`. Server mengikat `0.0.0.0`, port default `3001` (ubah dengan `PORT`). Untuk menguji API setelah server berjalan, gunakan `npm run smoke`.

Untuk mereset penyimpanan JSON lokal ke seed awal: `npm run seed:reset`.

## Penyimpanan data

### Lokal / self-host

Tanpa kredensial Supabase, aplikasi menggunakan `server/data/db.json` (dibuat saat pertama kali berjalan). Folder ini diabaikan Git. Seed contoh mencakup artikel, kategori, agenda, komentar, dan data awal.

### Supabase (opsional)

Buat proyek Supabase gratis, jalankan [`supabase/schema.sql`](supabase/schema.sql), lalu set:

```env
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_TABLE=site_state
```

Service role key hanya di server/Vercel environment, jangan ditaruh di frontend atau commit ke Git.

## Deploy ke Vercel

1. Import repository ke Vercel.
2. Build command `npm run build`, output `dist` (sudah ada di `vercel.json`).
3. Konfigurasikan `ADMIN_PASSWORD` dan `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` agar perubahan CMS persisten.
4. Pastikan URL situs sesuai domain yang dipakai; perbarui nilai `SITE_URL` saat build untuk sitemap/RSS.

Paket gratis layanan hosting umumnya memiliki batas kuota/kebijakan masing-masing. Kode dan stack aplikasi ini gratis/open-source; tidak ada klaim bahwa kapasitas layanan hosting pihak ketiga tidak terbatas. Self-host pada mesin Anda sendiri untuk menghindari ketergantungan platform.

## Struktur

- `src/` React UI, halaman dan komponen.
- `server/` API Express, auth, seed, database.
- `api/index.js` adapter serverless Vercel.
- `public/images/` foto editorial contoh; `public/covers/` sampul kategori yang dibuat otomatis.
- `scripts/` build aset SEO, reset data, smoke test.
- `supabase/schema.sql` skema database opsional.

## Keamanan produksi

- Ganti password admin bawaan. Gunakan password unik dan kuat.
- Konfigurasikan penyimpanan persisten (Supabase atau self-host) sebelum menerima konten warga.
- Batasi hak akses dashboard dan rutin backup database.
- Jangan memasukkan informasi sensitif warga ke contoh konten publik.

## Lisensi

MIT. Foto editorial dalam `public/images/` dibuat khusus sebagai aset ilustrasi contoh. Ganti atau lengkapi kredit foto sesuai kebutuhan publikasi nyata.
