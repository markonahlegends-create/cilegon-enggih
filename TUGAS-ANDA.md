# ✅ YANG HARUS ANDA EKSEKUSI SENDIRI — Cilegon Enggih Go-Live

Dokumen ini **hanya berisi tugas milik Anda** (pemilik toko / pemilik akun), karena menyangkut akun, uang, dokumen, dan keputusan bisnis yang tidak boleh dan tidak bisa dijalankan oleh agent.

Semua pekerjaan teknis kode (backend, admin dashboard, pembayaran, resi, invoice, deploy config, SEO, preflight) **sudah selesai** di repo.

---

## Ringkasan: 6 blok tugas

| # | Blok | Waktu | Bisa dikerjakan siapa |
| --- | --- | --- | --- |
| 1 | Siapkan bahan bisnis (rekening, QRIS, domain, password) | 30 menit | Anda (wajib) |
| 2 | Buat akun: Supabase → Vercel (klik-klik, tanpa coding) | 40 menit | Anda |
| 3 | Pasang domain & DNS | 15 menit + propagasi | Anda |
| 4 | Isi data toko di dashboard `/admin` | 20 menit | Anda |
| 5 | Uji transaksi dengan uang asli + publikasi | 60 menit | Anda |
| 6 | **Keamanan & keuangan**: isi HPP, catat pengeluaran, tambah vendor, nyalakan 2FA | 25 menit | Anda |

Total realistis: **± 3 jam** (di luar waktu propagasi DNS).

**Legend:** 🔴 = wajib sebelum toko bisa menerima uang · 🟡 = wajib sebelum dipromosikan · 🟢 = disarankan

---

## BLOK 1 — Siapkan bahan (30 menit) 🔴

Kumpulkan dulu semuanya, jangan dicicil saat deploy.

### 1.1 Rekening bank asli 🔴

Siapkan untuk **minimal 2**, idealnya 4–5:

| Bank / E-wallet | Nomor rekening | Atas nama |
| --- | --- | --- |
| BCA | ................ | ................ |
| Mandiri | ................ | ................ |
| BRI | ................ | ................ |
| SeaBank | ................ | ................ |
| DANA | ................ | ................ |

Ketentuan:
- Nama pemilik **harus sama/valid** (hindari rekening pihak ketiga).
- Pastikan rekening **aktif** dan bisa menerima transfer masuk tanpa batas rendah.
- Cek limit harian (beberapa bank e-wallet membatasi penerimaan).

### 1.2 Gambar QRIS resmi 🔴

- Buka aplikasi merchant/bank Anda → menu **QRIS** → **Unduh/Simpan gambar QRIS**.
- Format **PNG/JPG**, minimal **600 × 600 px**, ukuran file < 300 KB.
- Catat **NMID** (16 digit) yang tertera di bawah QR.
- ⚠️ Harus QRIS **atas nama usaha Anda**, bukan QRIS pribadi orang lain (dana masuk langsung ke pemilik QRIS).

### 1.3 Nomor WhatsApp bisnis 🔴

- Pastikan `081927157103` aktif di HP yang akan dipakai admin.
- Disarankan pakai **WhatsApp Business** (gratis): pasang nama usaha, alamat, jam buka, katalog.
- Nomor ini dipakai untuk: tombol chat pembeli, konfirmasi transfer, dan notifikasi resi.

### 1.4 Email resmi 🟡

- `cilegonenggih@gmail.com` — pastikan bisa login (dipakai untuk daftar Supabase/Vercel dan tercantum di invoice).
- Disarankan aktifkan **2FA** di akun Google tersebut.

### 1.5 Domain 🟢 (sangat disarankan)

- Kalau sudah punya `cilegonenggih.com`: pastikan Anda bisa login ke **registrar** (Tempat beli domain: Niagahoster, Rumahweb, Namecheap, Cloudflare, dll) karena nanti harus mengubah DNS.
- Kalau belum punya: beli domain `.com`/`.id` (± Rp 150–250 rb/tahun). Ini satu-satunya biaya wajib; hosting & database gratis.

### 1.6 Password admin produksi 🔴

Buat password kuat, simpan di password manager. Contoh pola aman:

```
CilegonEnggih#2026x
EnggihKotaBaja!2026
```

Jangan pakai `enggih2026` (itu default development, diketahui publik).

### 1.7 Akses GitHub 🔴

- Akun GitHub yang punya akses ke repo `markonahlegends-create/cilegon-enggih`.
- Nanti Anda hanya perlu **klik "Import"** di Vercel dan memberi izin akses repo (tanpa terminal).

---

## BLOK 2 — Buat akun & deploy (40 menit, tanpa coding) 🔴

### 2.1 Supabase (database) — 15 menit

1. Buka <https://supabase.com> → **Start your project** → daftar dengan `cilegonenggih@gmail.com` (atau login GitHub).
2. **New project**:
   - Name: `cilegon-enggih`
   - Database Password: klik **Generate** → **SALIN dan SIMPAN** (butuh untuk backup nanti)
   - Region: **Southeast Asia (Singapore)**
   - Plan: **Free**
3. Tunggu ± 2 menit sampai project siap.
4. Sidebar → **SQL Editor** → **New query** → buka file `supabase-schema.sql` dari repo → **copy semua isinya** → paste → **Run**.
   - Hasil yang benar: `Success. No rows returned`.
5. Sidebar → **Project Settings → API** → salin dua nilai ini ke Notepad sementara:
   - **Project URL** → contoh `https://abcdefghijk.supabase.co`
   - **service_role** secret (klik *Reveal*) → string panjang `eyJhbGciOi...`

> 🔒 `service_role` itu setara password database. Jangan kirim ke siapa pun, jangan screenshot.
> Kalau Anda memang ingin saya bantu verifikasi, cukup kirim **Project URL** saja — jangan kirim service role key.

✅ Selesai kalau: tabel `ce_documents` ada (bisa dicek di **Table Editor**).

### 2.2 Vercel (hosting frontend + API) — 20 menit

1. Buka <https://vercel.com/new> → **Continue with GitHub** → izinkan akses ke repo.
2. Pilih repo **`markonahlegends-create/cilegon-enggih`** → **Import**.
3. Biarkan deteksi otomatis (Vite, `npm run build`, output `dist`).
4. **Sebelum klik Deploy**, buka **Environment Variables** dan tambahkan 4 baris ini (pilih *All Environments*):

| Name | Value |
| --- | --- |
| `ADMIN_PASSWORD` | password dari 1.6 |
| `ADMIN_TOKEN_SECRET` | hasil perintah di bawah |
| `SUPABASE_URL` | Project URL dari 2.1 |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret dari 2.1 |

Untuk `ADMIN_TOKEN_SECRET`, buka <https://www.random.org/strings> (atau minta saya buatkan) dan ambil **64 karakter hex**. Bisa juga lewat terminal kalau Anda nyaman:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Klik **Deploy** → tunggu 1–2 menit → Anda dapat URL `https://cilegon-enggih-xxxx.vercel.app`.
6. **Verifikasi cepat** (buka di browser):
   - `https://cilegon-enggih-xxxx.vercel.app/api/health` → harus berisi `"storage":"supabase"` dan `"supabase":true`.
   - `https://cilegon-enggih-xxxx.vercel.app/admin` → halaman login admin muncul.
   - `https://cilegon-enggih-xxxx.vercel.app/katalog` → katalog tampil.

> ❗ Kalau `storage` masih `local-json`: env Supabase belum terbaca. Perbaiki di **Settings → Environment Variables**, lalu **Deployments → ⋯ → Redeploy**. Jangan lanjut sebelum `supabase` muncul.

### 2.3 Kirim URL ke saya (opsional tapi disarankan) 🟡

Kirim **hanya** URL Vercel Anda (mis. `https://cilegon-enggih-xxxx.vercel.app`) di chat. Saya akan jalankan pemeriksaan otomatis (`npm run preflight -- <url>`) dan melaporkan 27 titik cek: storage Supabase, 12 produk, SPA rewrite, proteksi admin, SEO, dll.

---

## BLOK 3 — Domain & HTTPS (15 menit + propagasi) 🟡

1. Vercel → project → **Settings → Domains → Add** → masukkan `cilegonenggih.com` → **Add**. Ulangi untuk `www.cilegonenggih.com`.
2. Vercel menampilkan instruksi DNS. **Ikuti angka yang ditampilkan Vercel** (bisa berbeda dari contoh). Pola umum:

   **Cara mudah (pindahkan DNS ke Vercel):**
   | Type | Name | Value |
   | --- | --- | --- |
   | NS | `@` | `ns1.vercel-dns.com` |
   | NS | `@` | `ns2.vercel-dns.com` |

   **Cara tetap di registrar:**
   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

3. Buka dashboard **registrar** (tempat beli domain) → menu **DNS Management** → tambahkan record di atas (hapus record `A`/`CNAME` lama yang bentrok dengan `@`/`www`).
4. Tunggu. Biasanya 10–30 menit, maksimal 24 jam. Vercel akan menampilkan ✅ **Valid Configuration** otomatis.
5. Set `cilegonenggih.com` sebagai **Primary Domain** (bukan `www`).
6. Buka `https://cilegonenggih.com` → pastikan ikon gembok HTTPS muncul.

> Kalau setelah 24 jam masih belum valid: cek typo record, pastikan tidak ada **DNSSEC** aktif di registrar yang belum disinkronkan, lalu hubungi support registrar.

---

## BLOK 4 — Isi data toko di dashboard (20 menit) 🔴

Buka `https://domain-anda.com/admin` → username `admin` + `ADMIN_PASSWORD` dari 1.6.

### 4.1 Tab Pengaturan → identitas

- [ ] Nama toko, badan usaha, tagline.
- [ ] Email `cilegonenggih@gmail.com`, WhatsApp `6281927157103`, tampilan `0819-2715-7103`.
- [ ] Jam operasional.
- [ ] Alamat **persis**: `Link. Jerang Barat RT. 004/001 Kel. Karang Asem Kec. Cibeber Kota Cilegon - Banten 42425`
- [ ] Origin: `Kec. Cibeber` / `Kota Cilegon` / `42425`.
- [ ] Teks pengumuman (banner atas).

### 4.2 Rekening bank 🔴 WAJIB

- [ ] Ganti **semua** nomor placeholder (`1234567890` dan kawan-kawan) dengan nomor asli dari 1.1.
- [ ] Ganti "Atas Nama" yang masih bertuliskan `(PLACEHOLDER)`.
- [ ] Hapus rekening yang tidak dipakai (ikon 🗑), sisakan minimal 2.
- [ ] Klik **Simpan Pengaturan**.
- [ ] Verifikasi: buka storefront → checkout → Transfer Bank → nomor rekening baru muncul.

### 4.3 QRIS

Pilih salah satu:

**A. Mode statis (paling mudah & paling umum):**
1. Simpan gambar QRIS Anda sebagai `qris-merchant.png`.
2. Unggah ke repo di folder `public/` (lewat GitHub: **Add file → Upload files** → taruh di `public/`).
3. Dashboard → Pengaturan → **Mode QRIS = Statis**, **URL Gambar = `/qris-merchant.png`** → Simpan.
4. Tunggu Vercel build ulang otomatis (± 1 menit).

**B. Mode dinamis (nominal otomatis di layar pembayaran):**
1. Biarkan **Mode = Dinamis**.
2. Isi **Nama Merchant** dan **NMID** asli dari 1.2.
3. Uji dengan order kecil apakah nominal di QR = total order.

> Kalau ragu: pilih **Statis** dulu (aman, sesuai kebiasaan toko kecil). Mode dinamis butuh payload QRIS yang valid dari merchant.

### 4.4 Pembayaran, voucher, produk

- [ ] Kode unik 3 digit tetap **aktif** (jangan dimatikan — ini kunci verifikasi cepat).
- [ ] Batas waktu pembayaran (default 24 jam).
- [ ] Sesuaikan / hapus voucher `ENGGIHBARU`, `KOTABAJA`, `ONGKIRCILEGON`.
- [ ] Tab **Produk**: periksa harga, stok, diskon, badge. Nonaktifkan stok 0.
- [ ] Bersihkan data contoh:
  - Lewat **tab Pesanan** → 3 order demo (`Rizky Pratama`, `Nadia Kusumawardhani`, `Hendra Wijaya`) → ubah status `DIBATALKAN`.
  - Lewat Supabase SQL Editor (**hapus permanen**):

```sql
delete from public.ce_documents
where collection = 'orders'
  and (data->>'customerName') in ('Rizky Pratama','Nadia Kusumawardhani','Hendra Wijaya (PT Chandra Asri)');

delete from public.ce_documents
where collection = 'b2b' and (data->>'companyName') = 'PT Krakatau Sarana Properti';
```

---

## BLOK 5 — Uji uang nyata + publikasi (60 menit) 🔴

### 5.1 Tes transfer sungguhan (JANGAN dilewati)

Lakukan sendiri, nominal kecil (± Rp 20.000), dari rekening pribadi ke rekening toko:

1. Buka storefront di **mode incognito** (seperti pembeli baru).
2. Pilih 1 produk termurah (mis. Stiker Die-Cut Rp 8.000) → Checkout.
3. Isi nama, **nomor HP Anda**, alamat lengkap → pilih **JNE Reguler**.
4. Pilih **Transfer Bank** → rekening yang baru Anda isi → catat **Total + 3 digit kode unik**.
5. Transfer **tepat** sebesar itu (mis. `Rp 16.532`, jangan dibulatkan).
6. Upload screenshot bukti → **Kirim Bukti** → **Konfirmasi via WhatsApp**.
7. Login `/admin` → tab **Pesanan**:
   - Cocokkan nominal dengan mutasi bank masuk (**harus sama persis**).
   - Ubah **Status Pembayaran → LUNAS**, **Status Pesanan → DIPROSES**.
   - Isi **resi** (pakai nomor resi asli kalau sudah kirim, atau abaikan dulu) → **Simpan Resi & Tandai Dikirim**.
8. Klik **Kabari Pembeli** → cek WhatsApp Anda menerima pesan dengan nomor resi.
9. Buka `/lacak-pesanan` → lacak via nomor resi dan via nomor HP → keduanya harus muncul.
10. Klik **Invoice** & **Label Kirim** → pastikan tercetak rapi (A4, skala 100%).

Kalau langkah 1–10 lolos, sistem siap menerima order sungguhan.

### 5.2 Tes QRIS (5 menit)

Order kecil lagi → pilih **QRIS Toko** → scan dengan aplikasi bank/e-wallet → pastikan nominal yang terpotong **sama** dengan total order → lanjutkan verifikasi seperti di atas.

### 5.3 Publikasi & pendaftaran (30 menit) 🟡

- [ ] **Google Search Console** (<https://search.google.com/search-console>) → tambah properti `https://domain-anda.com` → verifikasi (Vercel mendukung verifikasi DNS) → **Sitemaps** → submit `sitemap.xml`.
- [ ] **Google Business Profile** (<https://business.google.com>) → daftarkan toko: nama **Cilegon Enggih**, alamat Karang Asem Cibeber, WhatsApp, jam buka, foto produk → verifikasi (biasanya via video/foto lokasi). Ini yang membuat toko muncul di Google Maps.
- [ ] **UptimeRobot** (<https://uptimerobot.com>) → monitor `https://domain-anda.com/api/ping` tiap 5 menit, notifikasi ke email.
- [ ] Pasang link toko di bio **Instagram** & WhatsApp Business (katalog, status, pesan sambutan).
- [ ] Simpan **backup pertama**: `/admin` → tombol **Backup** → simpan file JSON ke Google Drive.

### 5.4 Rutinitas setelah live (tugas permanen Anda)

| Kapan | Yang dilakukan |
| --- | --- |
| Setiap ada order | Cek mutasi bank → verifikasi `LUNAS` di `/admin` (target < 30 menit) |
| Setelah drop-off paket | Input **resi asli** → **Simpan Resi & Tandai Dikirim** → klik **Kabari Pembeli** |
| Setelah paket diterima | Ubah status → `SELESAI` |
| Harian | Balas WhatsApp pembeli |
| Mingguan | Tab **Analitik**: omzet, order tanpa resi, stok ≤ 20 → update stok; klik **Backup** |
| Bulanan | Backup database dari Supabase (`pg_dump`) & cek kuota Free (500 MB) |
| Segera | Ganti password admin bila ada HP/perangkat hilang |

---

## Yang TIDAK perlu Anda lakukan (sudah selesai)

- ❌ Menulis/mengubah kode — backend, admin dashboard, checkout, resi, invoice sudah jadi.
- ❌ Menyiapkan server/VPS — pakai Vercel (gratis, tanpa maintenance).
- ❌ Membuat struktur database manual — cukup jalankan 1 file SQL.
- ❌ Mengatur SPA rewrite, header keamanan, SEO, sitemap, robots — sudah ter-commit.
- ❌ Deploy dari terminal — cukup klik di dashboard Vercel.
- ❌ Menyiapkan QRIS dinamis "dari nol" — bisa pakai mode statis.
- ❌ Menghitung harga pesanan manual — server menghitung ulang sendiri.
- ❌ Membuat laporan keuangan dengan Excel — 7 laporan sudah ada di dashboard.

---

## BLOK 6 — Keamanan & Keuangan (baru, 25 menit)

Semua fitur di bawah **sudah jalan** — Anda hanya perlu menyalakan dan mengisi datanya.

### 6.1 Isi HPP tiap produk 🔴 (paling penting)

HPP = modal per pcs. Tanpa HPP, laporan Laba Rugi akan menganggap semua penjualan untung 100%.

1. Dashboard → tab **Produk** → pilih produk → **Ubah**.
2. Buka bagian **"2b. HPP, Margin & Vendor"**.
3. Isi **HPP per pcs** dan (opsional) **biaya tambahan** (packing dll). Untuk produk bervarian, isi HPP di tiap varian — yang kosong otomatis memakai HPP produk.
4. Isi **SKU** (opsional) dan pilih **vendor** (buat dulu di tab Keuangan → Vendor bila belum ada).
5. Sisi kanan langsung menampilkan **laba per pcs** dan **margin %**. Simpan akan **ditolak** bila harga jual lebih rendah dari HPP — itu pengaman, bukan error.

> Produk yang belum punya HPP diberi tanda di tab Keuangan → Ringkasan & HPP. Kejar sampai tanda itu hilang.

### 6.2 Catat pengeluaran rutin 🟡

Tab **Keuangan** → **Pengeluaran** → tombol tambah. Pilih kategori (bahan baku, packing, ongkir, iklan, operasional, gaji, bank, lain-lain), isi tanggal & nominal. Ini yang membuat Laba Rugi realistis.

### 6.3 Tambah vendor 🟡

Tab **Keuangan** → **Vendor**. Isi nama pemasok, kontak, dan termin pembayaran. Vendor otomatis muncul sebagai pilihan saat mengedit produk, dan tagihan yang belum dibayar masuk laporan **Hutang**.

### 6.4 Nyalakan 2FA login admin 🔴 (setelah bot Telegram aktif)

Tab **Keamanan** → kartu **Verifikasi 2 Langkah** → **Aktifkan 2FA**.

- Setelah itu, login butuh password **+ kode 6 digit** yang dikirim ke Telegram Anda.
- Pastikan bot Telegram sudah terhubung dulu (Pengaturan → Notifikasi Telegram → **Tes Koneksi**), kalau tidak tombol aktifnya terkunci.
- Simpan akses Telegram Anda. Kalau bot terhapus, login masih bisa lewat password dengan peringatan — tapi jangan jadikan kebiasaan.

### 6.5 Rutin tiap akhir bulan 🟡

1. Tab **Keuangan** → pilih periode **Bulan ini** → cek **Laba Rugi** & **margin per produk**.
2. Perhatikan produk dengan margin di bawah 15% (ditandai) — naikkan harga atau cari vendor lebih murah.
3. Cek **Piutang** (order belum lunas) dan **Hutang** (tagihan vendor belum dibayar).
4. Buka **Keamanan** → lihat log aktivitas: ada login gagal beruntun atau ekspor data yang tidak Anda lakukan?

### Yang TIDAK perlu Anda lakukan di blok ini

- ❌ Menghitung harga pesanan manual — server sudah menghitung ulang sendiri.
- ❌ Membersihkan log aktivitas — otomatis terhapus setelah 90 hari.
- ❌ Menyiapkan pembukuan double-entry (Neraca/Jurnal/Buku Besar) — laporan di atas sudah cukup untuk keputusan harian.

---

## Bantuan yang bisa saya berikan setelah Anda eksekusi

Kirim ke chat, lalu saya kerjakan:

| Anda kirim | Saya lakukan |
| --- | --- |
| URL Vercel | Jalankan preflight 27 titik cek & laporkan hasilnya |
| Screenshot error / pesan gagal | Diagnosis penyebab + perbaikan kode bila perlu |
| Nama domain final | Ganti canonical/OG/sitemap/`STORE_DOMAIN` di kode + commit |
| Teks voucher/promo baru | Update default settings |
| Permintaan fitur tambahan (ongkir real-time, notifikasi WA otomatis, upload gambar produk) | Implementasi + deploy config |
| HPP produk sudah diisi tapi margin terasa aneh | Cek ulang perhitungan & snapshot HPP di order |

Jangan pernah mengirim: password admin, `service_role` key, password database, atau kode OTP/2FA.

---

## Cetak cepat (checklist satu halaman)

```
[ ] Rekening asli 2–5 buah siap
[ ] Gambar QRIS (< 300 KB) + NMID
[ ] WhatsApp 081927157103 aktif
[ ] Password admin kuat dibuat
[ ] Supabase project dibuat → supabase-schema.sql dijalankan
[ ] Vercel import repo → 4 env vars dipasang → Deploy
[ ] /api/health menunjukkan "storage":"supabase"
[ ] Domain ditambahkan di Vercel + DNS di registrar → HTTPS aktif
[ ] /admin: rekening diganti, QRIS diset, voucher dirapikan
[ ] Data demo dihapus
[ ] Tab Produk → isi HPP + biaya tambahan + vendor tiap produk (Blok 6)
[ ] Tab Keuangan → catat pengeluaran bulan berjalan
[ ] Tab Keamanan → 2FA diaktifkan (setelah bot Telegram tersambung)
[ ] Tes transfer Rp ~20rb + kode unik → verifikasi LUNAS → input resi → lacak → print label
[ ] Tes QRIS
[ ] Google Search Console + sitemap
[ ] Google Business Profile
[ ] UptimeRobot + backup pertama
[ ] npm run preflight -- https://domain-anda.com → semua ✅
```

**Butuh panduan teknis lebih rinci per klik?** Lihat [`GO-LIVE.md`](./GO-LIVE.md) (fase A–G). Dokumen ini adalah versi "tugas Anda saja".

**Web Develop by [Fadil Labs](https://fadil-labs.vercel.app/)**
