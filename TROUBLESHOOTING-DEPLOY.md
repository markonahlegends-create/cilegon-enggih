# 🔧 Perbaikan Deploy Anda — 2 Masalah, 4 Langkah

Hasil pemeriksaan atas URL yang Anda kirim:

| Yang diperiksa | Hasil | Arti |
| --- | --- | --- |
| `https://cilegon-enggih-echhwcv17-markonahlegends-2875s-projects.vercel.app` | ❌ **halaman login Vercel** | Deployment masih dilindungi **Vercel Authentication** → pembeli tidak bisa membuka toko |
| URL tersebut | ⚠️ URL **preview ber-hash** | Bukan URL Production; berubah setiap deploy |
| Supabase `oceqzytmiavogjivpzcw.supabase.co` | ✅ **project hidup** | Server Supabase merespons normal |
| Kunci `sb_secret_...` | ✅ **tipe benar** (Secret key) | Aman dipakai **hanya** di server (env var), tidak boleh di browser |

Sisi aplikasi sudah saya sesuaikan: backend kini mendukung **format kunci baru `sb_secret_...`** (sebelumnya hanya JWT legacy), plus endpoint diagnosa & panel "Kesiapan Go-Live" di dashboard.

Ikuti 4 langkah berikut berurutan.

---

## LANGKAH 1 — Matikan proteksi deployment (WAJIB) 🔴

**Gejala:** membuka URL toko malah muncul halaman *"Log in to Vercel"* / *"Protected Deployment"*.

**Sebab:** di project Vercel, opsi **Deployment Protection → Vercel Authentication** aktif (default untuk sebagian akun/tim). Ini membuat semua URL deployment minta login Vercel.

**Cara mematikan:**

1. Buka <https://vercel.com/dashboard> → pilih project **cilegon-enggih**.
2. Menu **Settings** → cari bagian **Deployment Protection**
   (di UI baru: **Settings → Deployment Protection**, atau **Settings → Security → Deployment Protection**).
3. Pada **Vercel Authentication**, pilih **Disabled** (atau *Standard Protection* → matikan untuk Production).
4. Jika ada opsi terpisah **Password Protection** / **Protection Bypass for Automation** — biarkan kosong/tidak dipakai.
5. Klik **Save**.
6. **Redeploy**: tab **Deployments** → deployment teratas → tombol **⋯** → **Redeploy** → konfirmasi.
   (Tanpa redeploy, sebagian konfigurasi belum berlaku.)

**Cara cepat memverifikasi:** buka URL toko di **jendela incognito** (bukan tab biasa) → harus langsung tampil storefront Cilegon Enggih, bukan halaman login Vercel.

> Alternatif bila Anda ingin proteksi tetap aktif untuk URL preview: biarkan proteksi menyala, tetapi **pakai domain production** (Langkah 2). Pembeli hanya mengakses domain, bukan URL preview.

---

## LANGKAH 2 — Pakai URL Production, bukan URL preview 🟡

URL `cilegon-enggih-echhwcv17-...vercel.app` adalah **URL preview khusus satu deployment** (ada hash `echhwcv17`) dan akan berubah setiap kali deploy baru. Jangan dipakai untuk promosi.

**Ambil URL production yang stabil:**

1. Vercel → project → tab **Deployments**.
2. Cari deployment dengan label **Production** (bukan *Preview*).
3. Klik → salin domain production. Bentuknya salah satu dari:
   - `cilegon-enggih.vercel.app` (paling umum, tanpa hash), atau
   - domain Anda sendiri setelah Langkah 3: `cilegonenggih.com`.

**Cek cepat di browser:**

| URL | Hasil yang benar |
| --- | --- |
| `https://cilegon-enggih.vercel.app/` | storefront tampil |
| `https://cilegon-enggih.vercel.app/api/health` | JSON dengan `"storage": "supabase"` |
| `https://cilegon-enggih.vercel.app/admin` | form login admin |

---

## LANGKAH 3 — Pasang environment variable Supabase 🔴

Saat ini Vercel **belum menerima** kredensial Supabase, sehingga backend memakai penyimpanan sementara (`local-json`) dan **semua order akan hilang** saat serverless dingin. Ini wajib diperbaiki.

1. Vercel → project → **Settings** → **Environment Variables**.
2. Tambahkan (klik **Add Another** untuk tiap baris):

| Name | Value | Environment |
| --- | --- | --- |
| `SUPABASE_URL` | `https://oceqzytmiavogjivpzcw.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | kunci `sb_secret_...` Anda | Production, Preview, Development |
| `ADMIN_PASSWORD` | password admin kuat pilihan Anda | Production (dan Preview bila perlu) |
| `ADMIN_TOKEN_SECRET` | 64 karakter hex acak | Production (dan Preview bila perlu) |

> Nama variabel **harus** `SUPABASE_SERVICE_ROLE_KEY` — walau isinya kunci format baru `sb_secret_...`, backend sudah mendukung keduanya. (Alternatif: `SUPABASE_SECRET_KEY`.)

Buat `ADMIN_TOKEN_SECRET` acak (jalankan di terminal mana pun yang ada Node):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Atau minta saya buatkan di chat.

3. Klik **Save** untuk setiap baris.
4. **Wajib Redeploy** agar env terbaca: **Deployments** → deployment Production → **⋯** → **Redeploy**.
   > Environment variable yang ditambahkan setelah build TIDAK otomatis masuk ke deployment lama.

### 3b. Pastikan tabel database sudah dibuat 🔴

Buka <https://supabase.com/dashboard> → project **oceqzytmiavogjivpzcw** → **SQL Editor** → **New query** → tempel **seluruh isi** file [`supabase-schema.sql`](./supabase-schema.sql) → **Run**.

Hasil benar: `Success. No rows returned`. (Skema aman dijalankan berulang.)

Verifikasi tabel ada: **Table Editor** → harus terlihat `ce_documents`.

---

## LANGKAH 4 — Verifikasi (3 cara, pilih yang paling nyaman)

### Cara A — Panel di dashboard (paling mudah, tanpa terminal)

1. Buka `https://<domain-production>/admin` → login (`admin` + `ADMIN_PASSWORD`).
2. Tab **Analitik** → panel **"Kesiapan Go-Live"** di paling atas.
3. Panel menampilkan daftar cek berwarna:
   - ✅ hijau = siap
   - ⚠️ kuning = perlu perhatian (tidak memblokir)
   - ❌ merah = wajib diperbaiki + **"Cara perbaiki"** langsung di tiap item.
4. Tombol **Salin laporan** → tempel ke chat bila ingin saya bantu analisis (aman: tidak memuat kunci/password).

### Cara B — Buka URL diagnosa

`https://<domain-production>/api/diagnose` → JSON. Perhatikan:

```json
{
  "ready": true,
  "summary": { "ok": 8, "warn": 0, "fail": 0 },
  "storage": "supabase"
}
```

### Cara C — Terminal

```bash
npm run preflight -- https://<domain-production>
```

Ekspektasi saat semua beres: `semua ✅` termasuk `storage supabase` dan `diagnosa: ...` tanpa item merah.

### Hasil "sebelum vs sesudah" yang harus Anda lihat

| Cek | Sebelum (kondisi Anda sekarang) | Sesudah perbaikan |
| --- | --- | --- |
| Halaman toko | login Vercel | storefront tampil |
| `/api/health` → `storage` | `local-json` | **`supabase`** |
| `/api/diagnose` → `ready` | `false` | **`true`** |
| Rekening di checkout | `1234567890` + `(PLACEHOLDER)` | nomor asli Anda |

---

## 🔐 PENTING — Rotasi kunci Supabase yang sudah terkirim di chat

Kunci `sb_secret_...` yang Anda tempel di chat adalah **kunci rahasia penuh** (setara password database: bisa membaca & menulis semua data). Anggap kunci itu sudah bocor.

**Lakukan sekali sekarang:**

1. Supabase → project → **Project Settings → API Keys** (atau **Settings → API**).
2. Cari kunci **`sb_secret_...`** yang Anda pakai → **Revoke / Delete**.
3. Klik **Create new secret key** → beri nama `cilegon-enggih-vercel`.
4. Salin kunci **baru** → tempel ke Vercel sebagai `SUPABASE_SERVICE_ROLE_KEY` (menimpa yang lama).
5. **Redeploy** project Vercel.
6. Cek ulang `/api/health` → tetap harus `"storage": "supabase"`.

> Kunci lama yang sudah di-revoke tidak bisa dipakai lagi, jadi aman walaupun sempat terlihat.
> Aturan praktis: kunci rahasia **hanya** masuk ke kolom Value di dashboard hosting, **tidak pernah** ke chat, screenshot, dokumen, atau kode.

---

## Bila masih bermasalah

| Gejala setelah 4 langkah | Kemungkinan penyebab | Solusi |
| --- | --- | --- |
| Masih muncul halaman login Vercel | Proteksi belum tersimpan / belum redeploy | Ulangi Langkah 1, pastikan klik **Save**, lalu Redeploy |
| `storage` tetap `local-json` | Nama env salah ketik, atau hanya dipasang untuk "Preview" | Pastikan nama persis `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`, centang **Production**, lalu Redeploy |
| `/api/diagnose` → `Supabase tidak dapat dihubungi / tabel belum dibuat` | `supabase-schema.sql` belum dijalankan | Langkah 3b |
| `/api/diagnose` → kunci *publishable/anon* | Kunci yang dipasang salah tipe | Ganti dengan **Secret key** (`sb_secret_...`) atau `service_role` JWT |
| Login admin gagal | `ADMIN_PASSWORD` berbeda antara env & yang diketik, atau token lama tersimpan | Cek env, logout/clear localStorage, login ulang |
| Data order hilang setelah beberapa jam | Masih `local-json` (env belum terbaca) | Ulangi Langkah 3 + redeploy |
| `/api/*` mengembalikan 404 | Deployment memakai build lama tanpa fungsi API | Pastikan deploy sukses & framework terdeteksi **Vite**; lihat **Functions** di dashboard Vercel |
| Panel "Kesiapan Go-Live" tidak muncul | Build lama (panel baru ditambahkan) | Redeploy setelah pull commit terbaru |

---

## Setelah keempat langkah lolos

Lanjut ke bagian operasional:

1. **Ganti rekening placeholder** → `/admin → Pengaturan` (wajib; akan tetap merah di panel sampai diganti).
2. **QRIS**: unggah gambar resmi ke `public/qris-merchant.png` → set mode statis, atau isi NMID asli untuk mode dinamis.
3. **Uji transfer nominal kecil** (± Rp 20.000 termasuk 3 digit kode unik) → verifikasi `LUNAS` → input resi → lacak → cetak label.
4. **Domain & publikasi**: lihat [`TUGAS-ANDA.md`](./TUGAS-ANDA.md) Blok 3 & 5.

---

## Kirim apa bila ingin saya bantu verifikasi

- ✅ Boleh: URL production (`https://cilegon-enggih.vercel.app` atau domain Anda) dan **isi panel "Salin laporan"** dari dashboard.
- ❌ Jangan: kunci Supabase, password admin, password database, OTP.

**Web Develop by [Fadil Labs](https://fadil-labs.vercel.app/)**
