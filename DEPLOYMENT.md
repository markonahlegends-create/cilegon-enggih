# 🚀 Panduan Deployment — Cilegon Enggih Official Store

> Mencari langkah operasional sampai toko benar-benar **live dan menerima order pertama**? Ikuti
> **[GO-LIVE.md](./GO-LIVE.md)** (playbook lengkap per fase dengan checklist & uji transaksi).
> Dokumen ini adalah referensi teknis konfigurasinya.

Aplikasi ini dirancang **siap deploy ke cloud gratis (Option A)** tanpa mengubah kode:

| Lapisan | Opsi Gratis | Keterangan |
| --- | --- | --- |
| Frontend (React + Vite) | **Vercel** atau **Cloudflare Pages** | Static build di `dist/` |
| Backend API (Express-style) | **Vercel Serverless Function** (`api/[...route].js`) atau VPS + PM2 | Kode yang sama dengan dev |
| Database | **Supabase Cloud (PostgreSQL)** — Free tier | `supabase-schema.sql` |
| Fallback tanpa DB | JSON file (`server/data/`) atau `/tmp` | Otomatis aktif di dev/preview |

> Semua tool yang dipakai **gratis / open-source**: React, Vite, Tailwind, Express, Supabase (free tier), Vercel/Cloudflare free tier.

---

## 0. Ringkasan cepat (paling direkomendasikan)

**Vercel (frontend + API) + Supabase (database).** Satu domain, tanpa CORS, deploy ±5 menit.

```bash
# 1. Buat project Supabase → SQL Editor → jalankan supabase-schema.sql
# 2. Deploy ke Vercel
npm i -g vercel
vercel                                   # deploy preview
vercel --prod                            # deploy production
```

Environment variables di Vercel (Project → Settings → Environment Variables):

| Key | Contoh | Wajib |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `RahasiaKuat123!` | ✅ |
| `ADMIN_TOKEN_SECRET` | string acak ≥ 32 karakter | ✅ |
| `SUPABASE_URL` | `https://abcd1234.supabase.co` | ✅ (produksi) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (service role) | ✅ (produksi) |

Setelah deploy: buka `https://<domain>/admin` → login (`admin` + `ADMIN_PASSWORD`) → **Pengaturan** → ganti rekening placeholder, upload QRIS, atur voucher.

---

## 1. Menjalankan di lokal

```bash
npm install
cp .env.example .env            # opsional, sesuaikan
npm run dev:all                 # API :3001 + Vite :5173
# atau
npm run build && npm start      # production-like di :3001
```

Checklist lokal:

- Storefront: http://localhost:5173
- API health: http://localhost:3001/api/health
- Dashboard admin: http://localhost:5173/admin
- Password admin default: **`enggih2026`** (ubah via `ADMIN_PASSWORD`)

---

## 2. Supabase (database PostgreSQL)

1. Daftar di <https://supabase.com> → **New project** (region Singapore agar dekat Indonesia).
2. Buka **SQL Editor** → **New query** → tempel seluruh isi `supabase-schema.sql` → **Run**.
   Skema membuat tabel `ce_documents(collection, id, data jsonb, updated_at)` + index + RLS aktif.
3. Buka **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role secret` → `SUPABASE_SERVICE_ROLE_KEY`
4. Buat bucket Storage (**Storage → New bucket → Public**):
   - `product-images` — foto produk (wajib bila mengunggah foto dari dashboard)
   - `store-assets` — gambar QRIS & aset toko
   - `payment-proofs` — bukti transfer pembeli (disarankan **Private**; sistem memakai URL publik hanya untuk pratinjau admin, jadi bila di-private bukti tetap tersimpan dan hanya bisa dibuka lewat dashboard)
5. Restart backend. Cek: `GET /api/health` → `"storage": "supabase"`.

> ⚠️ **Jangan** pernah memakai `service_role` key di kode frontend. Key ini hanya berada di environment variable server (Vercel Functions / VPS). RLS aktif tanpa policy publik sehingga anon key tidak bisa membaca data.

Seed data contoh otomatis dibuat pada request pertama (12 produk, 3 contoh order, 1 inquiry B2B). Ingin mulai bersih? Hapus isi tabel:

```sql
delete from public.ce_documents where collection in ('orders','b2b');
```

---

## 3. Opsi A1 — Vercel (frontend + API sekaligus) ✅

```bash
npm i -g vercel
vercel login
vercel            # ikuti wizard: framework Vite, build `npm run build`, output `dist`
vercel --prod
```

`vercel.json` sudah mengatur:

- Rewrite `/api/(.*)` → `api/[...route].js` (semua endpoint API).
- Cache-control `no-store` untuk API, immutable untuk `/products/*`.
- SPA fallback otomatis oleh framework `vite`.

Custom domain: **Project → Settings → Domains** → tambahkan `cilegonenggih.com`, lalu arahkan DNS sesuai instruksi Vercel.

---

## 4. Opsi A2 — Cloudflare Pages (frontend) + API Vercel

Cocok bila ingin bandwidth frontend unlimited dari Cloudflare.

1. Deploy **backend saja** ke Vercel seperti langkah 3 (tanpa custom domain) → catat URL, mis. `https://cilegon-enggih.vercel.app`.
2. Di **Cloudflare Pages** → **Create project** → hubungkan repo GitHub:
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Settings → Functions → Environment variables** tambahkan:
   - `API_ORIGIN = https://cilegon-enggih.vercel.app`
4. File `functions/api/[[route]].js` otomatis menjadi proxy `/api/*` → Vercel, sehingga browser tetap memakai 1 origin (tanpa masalah CORS/cookie).

> Cloudflare Pages Functions tidak menyediakan filesystem persisten. Karena itu proxy dipakai agar logika bisnis hanya ada di satu tempat (Vercel/VPS). Alternatif: isi `VITE_API_BASE_URL=https://cilegon-enggih.vercel.app` saat build dan hapus folder `functions/`.

---

## 5. Opsi A3 — VPS sendiri (Node + PM2 + Nginx)

```bash
git clone <repo> cilegon-enggih && cd cilegon-enggih
npm ci
npm i -g pm2
cp .env.example .env      # isi ADMIN_PASSWORD, ADMIN_TOKEN_SECRET, Supabase
npm run build
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Contoh Nginx (`/etc/nginx/sites-available/cilegon-enggih`):

```nginx
server {
  listen 80;
  server_name cilegonenggih.com www.cilegonenggih.com;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 8m;
  }
}
```

SSL gratis: `sudo certbot --nginx -d cilegonenggih.com -d www.cilegonenggih.com`.

---

## 6. Variabel environment lengkap

Lihat `.env.example`. Ringkasnya:

| Variabel | Fungsi | Default |
| --- | --- | --- |
| `PORT` / `BIND_HOST` | Port & host server lokal | `3001` / `0.0.0.0` |
| `ADMIN_PASSWORD` | Password login `/admin` | `enggih2026` ⚠️ ganti |
| `ADMIN_TOKEN_SECRET` | Secret tanda tangan token admin | turunan password |
| `SUPABASE_URL` | URL project Supabase | – |
| `SUPABASE_SERVICE_ROLE_KEY` | Key server Supabase | – |
| `CE_DATA_DIR` | Folder JSON fallback | `server/data` |
| `API_ORIGIN` | (Cloudflare) URL backend | – |
| `VITE_API_BASE_URL` | (opsional) API beda domain | same-origin |

### Keamanan & keuangan (perilaku bawaan, tanpa env tambahan)

| Perilaku | Detail | Bisa diubah? |
| --- | --- | --- |
| Harga dihitung di server | Harga dari browser diabaikan; selisih dicatat sebagai `priceAudit` | tidak (by design) |
| Rate limit login | 5 percobaan / 15 menit per IP → `429` | di `server/core.js` |
| Rate limit lacak pesanan | 20 percobaan / 10 menit per IP | di `server/core.js` |
| Rate limit ekspor | 3 ekspor / jam per IP | di `server/core.js` |
| Lacak pesanan 2 faktor | Nomor pesanan + 4 digit terakhir WhatsApp | tidak |
| 2FA admin (OTP Telegram) | 6 digit, berlaku 10 menit, maks. 5 coba | dashboard → tab Keamanan |
| Upload gambar | JPG/PNG/WEBP saja, divalidasi dari **isi file** (magic bytes); SVG & file menyamar ditolak; nama file dibuat server | di `server/storage.js` |
| Batas ukuran upload | 3 MB (foto produk/QRIS), 2 MB (bukti transfer) | `server/storage.js` |
| Rate limit upload | 30 unggahan / jam per IP | di `server/core.js` |
| Audit perubahan pembayaran | Ganti gambar QRIS, NMID, atau **nomor rekening** → tercatat + notifikasi Telegram | otomatis |
| Audit log | 90 hari, tanpa kredensial | `pruneAudit(store, 90)` |
| Bukti transfer | URL Supabase Storage (bukan base64 di order) | butuh Supabase aktif |

> **Penting:** 2FA hanya bisa dinyalakan setelah `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` (atau isian di Pengaturan) tersambung. Kalau pengiriman kode gagal, login **tidak** terkunci total — sistem lanjut dengan peringatan agar Anda tidak kehilangan akses; perbaiki bot lalu login ulang.

---

## 7. Alur bisnis setelah go-live

1. **Pembeli** checkout tanpa akun → order dibuat dengan status `MENUNGGU_VERIFIKASI` + **kode unik 3 digit** (mis. `Rp 129.559`).
2. Pembeli transfer ke rekening toko / scan QRIS, lalu unggah bukti (opsional) atau klik **Konfirmasi via WhatsApp**.
3. **Admin** (`/admin` → Pesanan) memverifikasi pembayaran → `LUNAS`.
4. Admin packing, serahkan ke kurir, lalu **input resi asli** → klik **Simpan Resi & Tandai Dikirim** (status otomatis `DIKIRIM`).
5. Admin klik **Kabari Pembeli** → WhatsApp berisi nomor resi + link lacak.
6. Pembeli melacak di `/lacak-pesanan` (bisa pakai Order ID, Resi, atau nomor WhatsApp) → tombol **Cek Resi** membuka situs kurir resmi.
7. **Admin** memantau tab **Keuangan**: Laba Rugi, margin per produk (HPP diisi di editor produk, otomatis di-snapshot ke tiap order saat checkout), pengeluaran, vendor, kas, piutang & hutang. Laporan ini **manajemen**, bukan double-entry.
8. Cetak **Invoice** atau **Label Pengiriman** dari checkout, halaman lacak, atau dashboard admin (`window.print()` → simpan PDF).

---

## 8. Checklist sebelum promosi

- [ ] `ADMIN_PASSWORD` & `ADMIN_TOKEN_SECRET` sudah diganti.
- [ ] Rekening bank placeholder (BCA/Mandiri/BRI/SeaBank/DANA) diganti nomor asli di `/admin → Pengaturan`.
- [ ] QRIS resmi: unggah gambar ke `public/`, isi `qris.staticImageUrl`, atau set mode statis + NMID asli.
- [ ] Alamat & nomor WhatsApp benar (`Karang Asem, Cibeber, Kota Cilegon 42425`, `0819-2715-7103`).
- [ ] Voucher promo disesuaikan.
- [ ] Uji 1 order end-to-end (buat → verifikasi → input resi → lacak → cetak label).
- [ ] Backup JSON berkala via tombol **Backup** di dashboard (atau `pg_dump` Supabase).

---

## 9. Pemecahan masalah

| Gejala | Penyebab & solusi |
| --- | --- |
| `/api/health` → `storage: local-json` di produksi | `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` belum diset. Data hanya hidup di memori/`/tmp` dan hilang saat cold start. |
| Order hilang setelah beberapa jam di Vercel | Sama seperti di atas — serverless tidak punya disk persisten. Sambungkan Supabase. |
| Login admin selalu gagal | `ADMIN_PASSWORD` berbeda antara build/instance, atau token tersimpan untuk password lama → logout/clear localStorage. |
| Dashboard kosong / 401 | Token kedaluwarsa (12 jam). Login ulang. |
| `/api/*` 503 di Cloudflare | `API_ORIGIN` belum diset (lihat bagian 4). |
| QRIS tidak muncul | Mode dinamis butuh payload EMVCo valid; untuk QRIS merchant nyata gunakan mode **statis** + gambar QRIS resmi. |
| Cetak invoice terpotong | Gunakan dialog print dengan "Scale: Default/100%", ukuran A4. |

---

## 10. Backup & migrasi

- **JSON:** `/admin` → tombol **Backup** (mengunduh seluruh order, produk, B2B, settings).
- **Postgres (Supabase):**
  ```bash
  pg_dump "postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres" \
    --data-only --table=public.ce_documents > backup.sql
  ```
- **Restore:** jalankan `supabase-schema.sql` lalu `psql < backup.sql`.

---

Dibuat & dirawat oleh **Fadil Labs** — <https://fadil-labs.vercel.app/>
