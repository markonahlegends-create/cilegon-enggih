# 🚦 GO-LIVE PLAYBOOK — Cilegon Enggih Official Store

> Ingin versi ringkas berisi **tugas Anda saja**? Lihat **[TUGAS-ANDA.md](./TUGAS-ANDA.md)**.
> Deployment sudah jalan tapi muncul halaman login Vercel / env Supabase belum terbaca? Lihat
> **[TROUBLESHOOTING-DEPLOY.md](./TROUBLESHOOTING-DEPLOY.md)**.

### Diagnosa mandiri setelah deploy

| Cara | URL / aksi |
| --- | --- |
| Panel visual | `/admin` → tab **Analitik** → panel **Kesiapan Go-Live** |
| JSON | `/api/diagnose` |
| Terminal | `npm run preflight -- https://domain-anda.com` |

Panel & endpoint ini **hanya menampilkan status**, tidak pernah menampilkan nilai kunci/password.

Panduan operasional **langkah demi langkah** untuk membawa project ini dari repo → domain publik → transaksi pertama, mengikuti rekomendasi arsitektur yang sudah dipilih (**Option A**).

**Rekomendasi utama (paling murah & paling cepat):**

```
Pembeli ──► https://cilegonenggih.com   (Vercel — frontend React + API /api/*)
                    │
                    ├── Supabase PostgreSQL (data order, produk, settings, B2B)
                    └── WhatsApp / bank transfer / QRIS (pembayaran langsung ke toko)
```

- Biaya: **Rp 0** (Vercel Hobby + Supabase Free + domain saja kalau sudah punya).
- 1 repo, 1 deployment, tanpa CORS, tanpa server yang harus dirawat.
- Cloudflare Pages & VPS tersedia sebagai alternatif (lihat langkah 9).

**Estimasi waktu:**

| Fase | Aktivitas | Durasi |
| --- | --- | --- |
| A | Persiapan akun & kredensial | 20 menit |
| B | Supabase (database) | 15 menit |
| C | Deploy Vercel | 15 menit |
| D | Domain & HTTPS | 10–60 menit (propagasi DNS) |
| E | Konfigurasi toko (rekening, QRIS, voucher) | 20 menit |
| F | Uji transaksi end-to-end | 20 menit |
| G | Go-live & publikasi (SEO, IG, Google) | 30 menit |

---

## FASE 0 — Checklist "jangan skip"

Sebelum menyentuh cloud, pastikan hal-hal ini sudah disiapkan pemilik toko (bukan developer):

- [ ] **Nomor rekening asli** 3–5 bank (BCA/Mandiri/BRI/SeaBank/DANA) — a.n. pemilik, bukan placeholder.
- [ ] **Gambar QRIS resmi** dari bank/aplikasi merchant (PNG/JPG, minimal 600×600 px) + **NMID**.
- [ ] **Nomor WhatsApp bisnis** aktif & sudah terpasang di HP admin: `081927157103`.
- [ ] **Email resmi**: `cilegonenggih@gmail.com`.
- [ ] **Alamat lengkap & kode pos**: `Link. Jerang Barat RT. 004/001 Kel. Karang Asem Kec. Cibeber Kota Cilegon - Banten 42425`.
- [ ] **Domain** (opsional tapi sangat disarankan): mis. `cilegonenggih.com`.
- [ ] **Password admin kuat** (contoh: `CilegonEnggih#2026x`) — disimpan di password manager.
- [ ] Akun **GitHub** (repo ini), **Vercel**, **Supabase** (semua gratis, daftar dengan email toko).

> ⚠️ Jangan pernah menaruh password admin / service role key di WhatsApp, chat, atau file yang di-commit. Semua kredensial hanya masuk ke **Environment Variables** di dashboard hosting.

---

## FASE A — Persiapan repo & build lokal (20 menit)

### A1. Pastikan build bersih

```bash
git clone https://github.com/markonahlegends-create/cilegon-enggih.git
cd cilegon-enggih
git checkout arena/42773078-cilegon-enggih   # branch yang berisi versi produksi ini
npm ci
npm run build          # harus selesai tanpa error
```

Output yang benar: `dist/` berisi `index.html`, `assets/`, `products/`, `qris-placeholder.png`, `robots.txt`, `sitemap.xml`, `site.webmanifest`.

### A2. Siapkan file `.env` lokal

```bash
cp .env.example .env
```

Isi minimal untuk uji lokal:

```env
PORT=3001
ADMIN_PASSWORD=CilegonEnggih#2026x
ADMIN_TOKEN_SECRET=<hasil generate di bawah>
```

Generate secret acak (jalankan sekali, simpan hasilnya):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# contoh keluaran:
# 515dfb5393d88ee3e52cd5abfd15cb556340363f274c40c23549de373deb3d3b
```

### A3. Uji lokal sebelum ke cloud

```bash
npm run dev:all
```

| Cek | URL | Ekspektasi |
| --- | --- | --- |
| Storefront | <http://localhost:5173> | 12 produk tampil, banner promo, footer alamat baru |
| API sehat | <http://localhost:3001/api/health> | `{"status":"ok","storage":"local-json",...}` |
| Dashboard | <http://localhost:5173/admin> | Halaman login admin |
| Lacak | <http://localhost:5173/lacak-pesanan?q=CE-20261116-102> | Timeline + resi `SOC9901827361` |
| Invoice | Klik "Invoice / Label" di dashboard | Dokumen A4 muncul + bisa print |

### A4. Jalankan preflight otomatis

Repo menyertakan skrip pemeriksa kesiapan (tanpa dependency):

```bash
npm run preflight                       # cek artefak build lokal
npm run preflight -- https://domain.com # cek deployment live (FASE C ke atas)
```

Yang diperiksa:

- file wajib (`dist/index.html`, `robots.txt`, `sitemap.xml`, `supabase-schema.sql`, `vercel.json`, dll.),
- meta canonical/OG, nomor WhatsApp resmi, dan kredit Fadil Labs benar-benar masuk bundle,
- (mode live) status `/api/health`, apakah `storage = supabase`, jumlah produk, SPA rewrite `/katalog`, `/admin`, `robots.txt`, `sitemap.xml`, dan proteksi endpoint admin (`401` tanpa token).

Contoh keluaran saat deployment belum memakai Supabase:

```
❌ storage supabase — masih "local-json" — env Supabase belum terbaca, data akan hilang saat cold start
26/27 lolos, 1 perlu perbaikan
```

✅ **Gate A**: build bersih, preflight lokal lolos, login admin berhasil, 1 order uji bisa dibuat.

---

## FASE B — Supabase: database produksi (15 menit)

> Tanpa Supabase, data di Vercel akan **hilang** saat serverless cold start (disk tidak persisten). Ini wajib untuk produksi.

### B1. Buat project

1. Buka <https://supabase.com/dashboard> → **New project**.
2. Isi:
   - **Name**: `cilegon-enggih`
   - **Database Password**: generate & simpan (mis. di password manager)
   - **Region**: **Southeast Asia (Singapore)** — paling dekat ke Indonesia
   - **Plan**: Free
3. Tunggu ±2 menit sampai project siap.

### B2. Jalankan skema

1. Sidebar → **SQL Editor** → **New query**.
2. Copy seluruh isi file `supabase-schema.sql` dari repo → paste → **Run**.
3. Ekspektasi: `Success. No rows returned`. Ini membuat tabel `ce_documents`, index, trigger `updated_at`, RLS aktif, dan view `ce_orders_report`.

Verifikasi cepat (jalankan di SQL Editor):

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name = 'ce_documents';
```

### B3. Ambil kredensial

Sidebar → **Project Settings** → **API**:

| Yang dicari | Dipakai untuk |
| --- | --- |
| **Project URL** (`https://xxxx.supabase.co`) | `SUPABASE_URL` |
| **service_role** secret (di bagian `Project API keys`) | `SUPABASE_SERVICE_ROLE_KEY` |

> 🔒 `service_role` **melewati RLS**. Hanya boleh ada di environment variable server (Vercel/VPS). Jangan pernah dimasukkan ke `VITE_*` atau kode frontend.

### B4. (Opsional) Matikan pendaftaran publik

Karena tidak ada login pembeli, tidak ada yang perlu didaftarkan. Sidebar → **Authentication → Providers → Email** → matikan "Enable Sign-ups" agar tidak ada akun liar.

✅ **Gate B**: project Supabase aktif, tabel `ce_documents` ada, URL + service role key tersimpan aman.

---

## FASE C — Deploy ke Vercel (15 menit)

### C1. Import project

1. Buka <https://vercel.com/new> → login dengan GitHub.
2. Pilih repo `markonahlegends-create/cilegon-enggih` → **Import**.
3. Konfigurasi (biasanya sudah terdeteksi otomatis dari `vercel.json`):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm ci`
   - **Root Directory**: `./`
4. **JANGAN** klik Deploy dulu — isi environment variables pada langkah C2.

### C2. Environment variables (wajib)

Buka **Environment Variables** → tambahkan satu per satu untuk **Production, Preview, dan Development**:

| Key | Contoh nilai | Wajib |
| --- | --- | --- |
| `ADMIN_PASSWORD` | `CilegonEnggih#2026x` | ✅ |
| `ADMIN_TOKEN_SECRET` | `515dfb53...deb3d3b` (64 hex) | ✅ |
| `SUPABASE_URL` | `https://abcdefghijkl.supabase.co` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6...` | ✅ |
| `SUPABASE_DOCS_TABLE` | `ce_documents` | opsional |
| `CE_DATA_DIR` | *(kosongkan)* | opsional |

Catatan:
- `PORT`, `BIND_HOST` **tidak perlu** di Vercel (ditangani platform).
- `VITE_API_BASE_URL` **kosongkan** — frontend & API satu domain.
- Setelah mengubah env, wajib **Redeploy** (Deployments → ⋯ → Redeploy).

### C3. Deploy

Klik **Deploy** → tunggu ±1–2 menit. Hasil: `https://cilegon-enggih-xxxx.vercel.app`.

### C4. Verifikasi deployment

```bash
BASE=https://cilegon-enggih-xxxx.vercel.app

curl -s $BASE/api/health
# harapan: "storage":"supabase","supabase":true

curl -s $BASE/api/storefront | head -c 200
# harapan: products: [ ... 12 item ... ]

curl -s -o /dev/null -w "%{http_code}\n" $BASE/admin       # 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/katalog     # 200 (SPA rewrite bekerja)
curl -s -o /dev/null -w "%{http_code}\n" $BASE/sitemap.xml # 200
```

**Jika `storage` masih `local-json`** → env Supabase belum terbaca: cek ejaan key, pastikan dipasang untuk environment *Production*, lalu Redeploy.

### C5. Uji API langsung (opsional, membuktikan auth)

```bash
TOKEN=$(curl -s -X POST $BASE/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"password":"CilegonEnggih#2026x"}' | sed -E 's/.*"token":"([^"]+)".*/\1/')

curl -s $BASE/api/admin/analytics -H "Authorization: Bearer $TOKEN" | head -c 300
```

✅ **Gate C**: `health.storage = supabase`, storefront memuat 12 produk, `/admin` bisa login.

---

## FASE D — Domain & HTTPS (10–60 menit)

### D1. Tambahkan domain di Vercel

1. Project → **Settings** → **Domains** → **Add**.
2. Masukkan `cilegonenggih.com` → Add. Ulangi untuk `www.cilegonenggih.com`.
3. Vercel menampilkan instruksi DNS. Pilih salah satu pola:

**Pola A — Nameserver Vercel (paling mudah, DNS penuh di Vercel):**

| Type | Name | Value |
| --- | --- | --- |
| NS | `@` | `ns1.vercel-dns.com` |
| NS | `@` | `ns2.vercel-dns.com` |

**Pola B — Tetap di registrar (cukup 2 record):**

| Type | Name | Value |
| --- | --- | --- |
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

> Nilai di atas bisa berbeda — **selalu ikuti angka yang ditampilkan dashboard Vercel** untuk project Anda.

### D2. Arahkan redirect & HTTPS

- Set `cilegonenggih.com` sebagai **Primary Domain**.
- Pastikan `www` di-redirect ke domain utama (Vercel menyediakan opsi ini otomatis).
- HTTPS aktif otomatis (Let's Encrypt) setelah DNS terverifikasi — biasanya < 10 menit, maksimal 24 jam.

### D3. Sesuaikan identitas domain di kode

Setelah domain final, perbarui bila perlu:

| File | Yang diubah |
| --- | --- |
| `index.html` | `canonical`, `og:url`, `og:image`, `twitter:image` → `https://cilegonenggih.com/...` |
| `public/robots.txt` | baris `Sitemap:` |
| `public/sitemap.xml` | seluruh `<loc>` |
| `src/data/products.ts` | `STORE_DOMAIN = 'cilegonenggih.com'` |

Contoh perintah ganti cepat (jalankan setelah domain final):

```bash
grep -rl "cilegonenggih.com" index.html public/sitemap.xml public/robots.txt src/data/products.ts \
  | xargs sed -i 's#https://cilegonenggih.com#https://DOMAIN-FINAL-ANDA.com#g'
npm run build && git commit -am "chore: set production domain" && git push
```

✅ **Gate D**: `https://domain-anda.com` menampilkan storefront dengan gembok HTTPS, `www` redirect ke domain utama.

---

## FASE E — Konfigurasi toko dari Dashboard (20 menit)

Login di `https://domain-anda.com/admin` → **admin** + `ADMIN_PASSWORD`.

### E1. Tab **Pengaturan** → Identitas & Kontak

- [ ] Nama toko, badan usaha (`CV Cilegon Enggih Kreatif`), tagline.
- [ ] Email `cilegonenggih@gmail.com`, WhatsApp `6281927157103`, tampilan `0819-2715-7103`.
- [ ] Jam operasional `Senin – Minggu: 08.30 – 20.30 WIB`.
- [ ] Alamat lengkap (harus sama persis dengan yang dipakai kurir):
      `Link. Jerang Barat RT. 004/001 Kel. Karang Asem Kec. Cibeber Kota Cilegon - Banten 42425`
- [ ] `Kecamatan Origin = Kec. Cibeber`, `Kota = Kota Cilegon`, `Kode Pos = 42425`.
- [ ] Teks pengumuman (banner atas) — mis. promo gratis ongkir Cilegon.

### E2. Rekening Bank (WAJIB diganti)

Semua rekening saat ini **placeholder**. Untuk tiap baris:

| Field | Isi dengan |
| --- | --- |
| Bank | `BCA` / `Mandiri` / `BRI` / `SeaBank Indonesia` / `DANA` |
| Nomor Rekening | nomor asli |
| Atas Nama | nama pemilik rekening (harus sama dengan rekening bank) |
| Warna | warna kartu saat checkout (identitas bank) |

- Hapus rekening yang tidak dipakai (ikon 🗑) — minimal sisakan **2** (satu bank + satu e-wallet).
- Klik **Simpan Pengaturan**.
- Verifikasi di storefront: buka checkout → pilih Transfer Bank → nomor rekening terbaru muncul.
- **Uji transfer Rp 10.000** dari satu bank ke rekening yang tercantum, pastikan nama penerima benar, lalu kembalikan dananya.

### E3. QRIS

Pilih salah satu:

**Mode statis (paling umum untuk toko kecil):**
1. Simpan gambar QRIS resmi ke `public/qris-merchant.png` (kompres < 300 KB).
2. Dashboard → Pengaturan → **Mode QRIS = Statis** → **URL Gambar** = `/qris-merchant.png`.
3. Simpan & redeploy (`git push` memicu build otomatis) atau upload lewat commit.

**Mode dinamis (nominal otomatis di layar):**
1. Biarkan `Mode = Dinamis`.
2. Isi **Nama Merchant** dan **NMID** asli dari merchant QRIS.
3. Uji: buat order → halaman pembayaran menampilkan QR dengan nominal = total order.

> Penting: QRIS harus milik **merchant sendiri** (bukan QRIS pribadi orang lain), karena dana langsung masuk ke rekening merchant tanpa biaya gateway.

### E4. Pembayaran & Voucher

- [ ] **3 digit kode unik** aktif (default) — pastikan tetap aktif agar verifikasi mudah.
- [ ] Batas waktu pembayaran `24` jam (bisa diubah).
- [ ] Instruksi pembayaran disesuaikan.
- [ ] Voucher: sesuaikan `ENGGIHBARU`, `KOTABAJA`, `ONGKIRCILEGON` (kode, min. belanja, nominal, aktif/tidak). Hapus voucher yang tidak dipakai.

### E5. Tab **Produk**

- [ ] Cek 12 produk: harga, stok, diskon, badge Best Seller/Bundle.
- [ ] Tambah produk baru bila ada (isi gambar di `public/products/` dulu, lalu path `/products/namafile.png`).
- [ ] Pastikan stok realistis (order dengan stok 0 sebaiknya dinonaktifkan).
- [ ] Klik **Reset Katalog** hanya kalau ingin kembali ke 12 produk default (menghapus produk tambahan).

### E6. Bersihkan data contoh

Data awal berisi 3 order demo + 1 inquiry B2B (untuk memperlihatkan tampilan). Sebelum promosi:

- Order demo/uji: buka tab **Pesanan** → ubah statusnya menjadi `DIBATALKAN`, atau hapus langsung dari Supabase:

```sql
-- Hapus SEMUA order contoh & uji (hati-hati, tidak bisa dibatalkan)
delete from public.ce_documents
where collection = 'orders'
  and (data->>'customerName') in ('Rizky Pratama','Nadia Kusumawardhani','Hendra Wijaya (PT Chandra Asri)');

delete from public.ce_documents
where collection = 'b2b' and (data->>'companyName') = 'PT Krakatau Sarana Properti';
```

✅ **Gate E**: rekening asli, QRIS benar, voucher rapi, katalog bersih dari data demo.

---

## FASE F — Uji transaksi end-to-end (20 menit, WAJIB)

Lakukan **dengan uang sungguhan dalam nominal kecil**, bukan simulasi.

### Skenario 1 — Transfer Bank (happy path)

1. Buka storefront (mode incognito, seperti pembeli baru).
2. Pilih 1 produk → **Keranjang** → **Checkout**.
3. Isi nama, **WhatsApp Anda**, alamat lengkap → pilih kurir **JNE Reguler**.
4. Pilih **Transfer Bank** → rekening BCA → catat **total + kode unik** (mis. `Rp 123.456`).
5. Klik **Lanjut ke Pembayaran** → transfer **tepat** sebesar nominal tersebut (termasuk 3 digit).
6. Upload screenshot bukti → **Kirim Bukti** → **Konfirmasi via WhatsApp** (pesan otomatis terisi).
7. Login admin → tab **Pesanan** → order muncul `MENUNGGU_VERIFIKASI`:
   - cek nominal vs mutasi bank (**harus sama persis**),
   - lihat bukti transfer,
   - ubah **Status Pembayaran → LUNAS**, **Status Pesanan → DIPROSES**.
8. Klik **Kabari Pembeli** → WhatsApp terkirim ke pembeli.
9. Setelah paket benar-benar diserahkan ke JNE dan resi keluar:
   - isi **Nomor AWB/Resi** + pilih kurir,
   - klik **Simpan Resi & Tandai Dikirim** (status otomatis `DIKIRIM`).
10. Buka halaman **Lacak Pesanan** → masukkan nomor resi → timeline tampil + tombol **Cek Resi** mengarah ke situs kurir.
11. Klik **Invoice** dan **Label Kirim** → cetak/simpan PDF → tempel label di paket.
12. Setelah paket diterima pembeli → ubah status **SELESAI**.

### Skenario 2 — QRIS

Ulangi langkah 1–3, pilih **QRIS Toko** → scan dengan aplikasi bank/e-wallet → pastikan nominal di layar **sama** dengan yang terpotong → lanjutkan seperti skenario 1.

### Skenario 3 — Lacak via nomor WhatsApp

Buka `/lacak-pesanan` → masukkan nomor HP pembeli → order muncul (bukti fitur pencarian fleksibel).

### Skenario 4 — B2B

Buka `/custom-korporat` → isi form → submit → login admin → tab **B2B** → ubah status + klik **WA PIC**.

### Tabel hasil uji (isi saat eksekusi)

| # | Skenario | Hasil | Catatan |
| --- | --- | --- | --- |
| 1 | Checkout transfer + kode unik | ☐ | |
| 2 | Bukti transfer tersimpan & terlihat admin | ☐ | |
| 3 | Verifikasi LUNAS | ☐ | |
| 4 | Input resi → status DIKIRIM | ☐ | |
| 5 | Lacak via resi & via nomor HP | ☐ | |
| 6 | Invoice & label tercetak rapi (A4/A6) | ☐ | |
| 7 | QRIS nominal benar | ☐ | |
| 8 | Notifikasi WA ke pembeli | ☐ | |
| 9 | Inquiry B2B masuk & bisa diubah status | ☐ | |
| 10 | Data bertahan setelah 1 jam (uji Supabase) | ☐ | buka order lama besok pagi |

✅ **Gate F**: 10/10 lolos. Jika ada yang gagal, perbaiki dulu — jangan lanjut promosi.

---

## FASE G — Go-live & publikasi (30 menit)

### G1. Kunci akses & keamanan

- [ ] `ADMIN_PASSWORD` kuat dan hanya diketahui pemilik.
- [ ] `ADMIN_TOKEN_SECRET` acak 64 hex, tidak dipakai ulang di project lain.
- [ ] Jangan bagikan URL `/admin` di bio media sosial.
- [ ] Login admin hanya dari perangkat pribadi; selalu **Logout** setelah selesai di perangkat umum.
- [ ] Pastikan `supabase-schema.sql` sudah dijalankan sehingga RLS aktif (anon key tidak bisa membaca tabel).

### G2. SEO & mesin pencari

1. **Google Search Console** → <https://search.google.com/search-console>:
   - Tambahkan properti `https://domain-anda.com`.
   - Verifikasi (Vercel mendukung verifikasi DNS TXT atau file HTML).
   - **Sitemaps** → submit `https://domain-anda.com/sitemap.xml`.
   - **URL Inspection** → masukkan `/` dan `/katalog` → **Request Indexing**.
2. **Bing Webmaster Tools** (opsional) → submit sitemap yang sama.
3. **Google Business Profile** (sangat membantu toko lokal): daftarkan bisnis dengan alamat `Karang Asem, Cibeber, Kota Cilegon`, nomor WhatsApp, jam operasional, dan foto produk → verifikasi.

### G3. Bagikan ke kanal resmi

- WhatsApp Business: pasang katalog/link di bio, status, dan pesan sambutan otomatis.
- Instagram `@cilegonenggih`: link di bio, sorotan "Cara Order", "Katalog", "Resi".
- Marketplace (opsional): cantumkan link toko resmi sebagai kanal transaksi langsung (tanpa potongan).

### G4. Pantauan rutin

| Rutin | Aktivitas |
| --- | --- |
| **Harian (pagi & sore)** | Cek tab **Pesanan** → verifikasi transfer baru (SLA < 30 menit), input resi untuk paket yang sudah dikirim. |
| **Harian** | Balas WhatsApp pembeli; klik **Kabari Pembeli** setelah resi masuk. |
| **Mingguan** | Cek tab **Analitik**: omzet, order tanpa resi, stok menipis (≤20). Update stok. |
| **Mingguan** | Klik **Backup** → simpan file JSON ke Google Drive. |
| **Bulanan** | `pg_dump` Supabase (lihat bawah) + cek kuota Supabase (Free: 500 MB DB). |

Backup database (jalankan di komputer lokal, butuh `psql`):

```bash
pg_dump "postgresql://postgres:<DB_PASSWORD>@db.<PROJECT_REF>.supabase.co:5432/postgres" \
  --data-only --table=public.ce_documents > backup-$(date +%F).sql
```

Restore: jalankan `supabase-schema.sql` di project baru, lalu `psql < backup.sql`.

### G5. Uptime & error monitoring (gratis)

- **UptimeRobot** (<https://uptimerobot.com>) → monitor HTTP `https://domain-anda.com/api/ping` setiap 5 menit, notifikasi email/WhatsApp.
- **Vercel → Deployments → Functions → Logs** untuk melihat error API real-time.
- **Supabase → Reports** untuk memantau query lambat & penyimpanan.

✅ **Gate G**: domain live + HTTPS, sitemap terkirim, Google Business terdaftar, backup pertama tersimpan.

---

## 9. Alternatif deployment (bila tidak memakai Vercel penuh)

### Opsi B — Cloudflare Pages (frontend) + Vercel (API)

Keunggulan: bandwidth frontend unlimited & CDN global Cloudflare.

1. Deploy API ke Vercel (FASE C) → catat URL, mis. `https://cilegon-enggih-api.vercel.app`.
2. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → pilih repo.
   - Framework preset: **Vite**
   - Build command: `npm run build`
   - Build output: `dist`
3. **Settings → Variables and Secrets** → tambahkan:
   - `API_ORIGIN = https://cilegon-enggih-api.vercel.app`
4. Deploy. File `functions/api/[[route]].js` otomatis mem-proxy `/api/*` ke Vercel → browser tetap 1 origin.
5. Pasang domain di Cloudflare Pages (DNS dikelola Cloudflare → paling mulus).

> Jika ingin Cloudflare memanggil API langsung tanpa proxy: set `VITE_API_BASE_URL=https://...vercel.app` saat build dan hapus folder `functions/`. Namun API harus mengizinkan origin tersebut (sudah diatur di adapter Express & Vercel).

### Opsi C — VPS sendiri (Node + PM2 + Nginx)

Untuk yang ingin kontrol penuh / tanpa batas platform.

```bash
# di VPS Ubuntu 22.04
sudo apt update && sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
sudo npm i -g pm2

git clone https://github.com/markonahlegends-create/cilegon-enggih.git /var/www/cilegon-enggih
cd /var/www/cilegon-enggih
npm ci && cp .env.example .env && nano .env    # isi ADMIN_PASSWORD, ADMIN_TOKEN_SECRET, Supabase
npm run build
pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```

Nginx reverse proxy (`/etc/nginx/sites-available/cilegon-enggih`):

```nginx
server {
  listen 80;
  server_name cilegonenggih.com www.cilegonenggih.com;
  client_max_body_size 8m;

  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/cilegon-enggih /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cilegonenggih.com -d www.cilegonenggih.com
```

---

## 10. Troubleshooting go-live (berdasarkan gejala)

| Gejala | Penyebab paling mungkin | Solusi |
| --- | --- | --- |
| `/api/health` → `"storage":"local-json"` di produksi | Env Supabase tidak terbaca | Cek `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` untuk environment **Production**, lalu **Redeploy** |
| Order hilang setelah beberapa jam | Tanpa Supabase, serverless tidak punya disk | Sambungkan Supabase (FASE B) |
| Halaman `/katalog` 404 saat refresh | SPA rewrite belum aktif | Pastikan `vercel.json` versi terbaru ter-commit; di Cloudflare tambahkan `_redirects`: `/* /index.html 200` |
| Login admin selalu gagal | Password beda antara env & yang diketik; token lama tersimpan | Cek `ADMIN_PASSWORD`, logout/clear localStorage, login ulang |
| Dashboard “Gagal memuat data” / 401 | Token kedaluwarsa (12 jam) | Login ulang |
| Checkout error “Tidak dapat menghubungi server” | API tidak terjangkau (proxy/rewrite salah) | Tes `/api/health` di domain yang sama; periksa `vercel.json` & `API_ORIGIN` |
| Nominal transfer tidak cocok saat verifikasi | Pembeli transfer tanpa 3 digit kode unik | Instruksi di layar pembayaran menegaskan nominal akhir; verifikasi manual dari mutasi |
| QRIS tidak muncul | Mode dinamis tanpa payload valid, atau gambar statis belum ada | Gunakan mode **Statis** + gambar QRIS resmi di `public/` |
| Invoice terpotong saat print | Skala printer | Dialog print → **Scale: Default/100%**, kertas **A4**, margin default |
| Nomor resi tidak bisa dilacak di situs kurir | Resi baru diinput / salah ketik | Pastikan AWB benar; gunakan tombol **Cek Resi** (multi-kurir) |
| Gambar produk tidak tampil di produksi | Path salah / file belum di-commit | Simpan di `public/products/`, path `/products/namafile.png`, pastikan ikut ter-commit |
| Build Vercel gagal `tsc` | Tipe data error setelah edit | Jalankan `npm run build` lokal, perbaiki, baru push |

---

## 11. Ringkasan perintah penting

```bash
# lokal
npm ci && npm run dev:all          # develop (API :3001, UI :5173)
npm run build                      # cek build sebelum push
npm start                          # produksi lokal (build + server :3001)

# quality gate sebelum push
npm run build && echo "BUILD OK"

# deploy
git push                           # Vercel/Cloudflare auto-deploy dari branch produksi
vercel --prod                      # alternatif deploy manual via CLI

# uji cepat setelah deploy
BASE=https://domain-anda.com
curl -s $BASE/api/health | head -c 200
curl -s -o /dev/null -w "%{http_code}\n" $BASE/admin

# preflight otomatis (lokal & live)
npm run preflight
npm run preflight -- $BASE
```

---

## 12. Definition of Done (centang sebelum promosi)

- [ ] `https://domain-anda.com` live, HTTPS aktif, `www` redirect.
- [ ] `/api/health` → `"storage":"supabase"`, `"supabase":true`.
- [ ] Login `/admin` berhasil dengan password produksi (bukan default).
- [ ] Rekening bank & QRIS **asli**, teruji dengan transfer nominal kecil.
- [ ] 12 produk tampil benar, harga & stok sesuai, foto tampil.
- [ ] Skenario uji FASE F lolos 10/10.
- [ ] Invoice & label pengiriman tercetak rapi.
- [ ] `sitemap.xml` terkirim ke Google Search Console, Google Business Profile terdaftar.
- [ ] Backup JSON pertama tersimpan, UptimeRobot memantau `/api/ping`.
- [ ] Tim toko tahu alur harian (verifikasi transfer → input resi → kabari pembeli).
- [ ] `npm run preflight -- https://domain-anda.com` → **semua ✅** (termasuk `storage supabase`).

---

## 13. Setelah live: pengembangan lanjutan (opsional)

Ide peningkatan berikutnya, semua tetap gratis/open-source:

1. **Notifikasi WhatsApp otomatis** (bukan 1-klik manual) lewat Cloudflare Worker + WhatsApp Cloud API free tier, atau gateway open-source seperti `wa-automate` di VPS kecil.
2. **Ongkir real-time** via API RajaOngkir/Komerce free tier (saat ini tarif berbasis zona).

   > Catatan: tarif zona saat ini adalah **estimasi** untuk perhitungan awal. Nominal final tetap dikonfirmasi admin sebelum pengiriman; jangan menjanjikan angka eksak sebelum integrasi kurir aktif.

3. **Upload gambar produk dari dashboard** (saat ini path file di `public/products/`) via Supabase Storage.
4. **Halaman ulasan pelanggan** dengan foto, tersimpan di Supabase.
5. **Laporan penjualan bulanan** memakai view `ce_orders_report` + export CSV.
6. **PWA offline** (service worker) agar halaman lacak tetap terbuka saat sinyal lemah.

---

Dokumen terkait:

- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — referensi teknis deployment & env vars.
- [`README.md`](./README.md) — gambaran fitur, struktur folder, ringkasan API.
- [`supabase-schema.sql`](./supabase-schema.sql) — skema database (jalankan sekali di Supabase).
- [`.env.example`](./.env.example) — daftar lengkap environment variables.

**Web Develop by [Fadil Labs](https://fadil-labs.vercel.app/)**
