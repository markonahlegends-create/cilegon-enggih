# 🛠️ Perbaikan "404 NOT_FOUND" di Vercel — Proyek Belum Benar

Tangkapan layar/error Anda:

```
This page doesn't exist
404: NOT_FOUND
sin1::9frkp-1794832050412-4b0e30a4248f
```

**Artinya: bukan bug aplikasi.** Vercel tidak menemukan file hasil build (`dist/index.html`), sehingga setiap URL — termasuk `/api/health` — dijawab 404. Ini terjadi kalau project Vercel dibuat dengan pengaturan yang salah, atau file aplikasi tidak ada di repo yang dideploy.

---

## 1. Gejala vs penyebab

| Gejala | Penyebab |
| --- | --- |
| `/`, `/api/health`, `/api/ping` **semuanya** 404 | Output build kosong / salah folder / repo yang di-deploy tidak berisi kode |
| Hanya `/api/*` 404, halaman depan normal | Folder `api/` tidak ikut ter-deploy |
| Halaman depan tampil "404 This page doesn't exist" gaya Vercel | `dist/index.html` tidak ada saat build selesai |
| Sebelumnya muncul halaman login Vercel | Itu masalah lain (Deployment Protection) — sekarang sudah mati, jadi 404 ini masalah build |

Cek ceplis: **/api/ping** juga 404 → terbukti tidak ada file hasil build sama sekali.

---

## 2. Penyebab paling mungkin di akun Anda: repo di GitHub kosong

Saat saya memulihkan sesi, repo `markonahlegends-create/cilegon-enggih` **hanya memiliki `README.md`**. Seluruh kode aplikasi ada di branch:

```
arena/42773078-cilegon-enggih
```

Branch `main` **belum** berisi aplikasi. Jika Vercel dibuat dengan branch **main**, maka Vercel:

- tidak menemukan `package.json` → tidak ada `npm run build` yang berarti,
- tidak punya folder `dist`,
- dan **semua URL menjadi 404** persis seperti yang Anda lihat.

### ✅ Solusi A — pilih branch yang benar di Vercel (paling cepat, 2 menit)

1. Vercel → project → **Settings** → **Git**.
2. Pada **Production Branch**, ganti dari `main` menjadi:
   ```
   arena/42773078-cilegon-enggih
   ```
3. Klik **Save**.
4. Tab **Deployments** → tombol **Deploy**/**Redeploy** pada branch tersebut.
5. Tunggu build selesai → buka URL production → storefront harus tampil.

> Kalau Vercel tidak menampilkan branch itu di daftar, klik **Sync** / **Refresh** pada bagian Git, atau pastikan integrasi GitHub punya akses ke repo ini.

### ✅ Solusi B — pindahkan kode ke `main` (disarankan untuk jangka panjang)

Supaya `main` = produksi (praktik standar), jalankan dari repo lokal Anda:

```bash
git clone https://github.com/markonahlegends-create/cilegon-enggih.git
cd cilegon-enggih
git checkout arena/42773078-cilegon-enggih
git checkout -B main origin/arena/42773078-cilegon-enggih
git push -u origin main
```

Setelah itu Vercel dengan branch `main` akan otomatis build benar.

> Kalau Anda memakai akun Arena ini, cukup minta saya: *"pindahkan branch ke main"* — saya bisa lakukan dari sini.

---

## 3. Kalau branch sudah benar tapi masih 404

Ikuti berurutan, hentikan begitu sudah beres.

### 3.1 Pastikan build sukses

Vercel → project → **Deployments** → klik deployment terbaru → tab **Building** → cari baris terakhir:

```
Build Completed in /vercel/output
```

Kalau tertulis **Error**, catat 10 baris terakhir pesan errornya (klik **View Build Logs**). Error paling umum pada project ini: `tsc` gagal karena tipa data — sudah saya pastikan build lokal bersih, jadi kemungkinan besar errornya "**No package.json found**" atau "**No framework detected**".

### 3.2 Periksa Framework Preset & Output Directory

Vercel → **Settings → General**:

| Setting | Nilai WAJIB |
| --- | --- |
| Framework Preset | **Vite** |
| Root Directory | `./` (kosongkan / default) |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Install Command | `npm ci` |
| Node.js Version | **20.x** atau **22.x** |

Kalau salah satu berbeda → perbaiki → **Save** → **Redeploy**.

### 3.3 Periksa Environment Variables

**Settings → Environment Variables** (semua dicentang **Production**):

| Name | Contoh isi |
| --- | --- |
| `SUPABASE_URL` | `https://oceqzytmiavogjivpzcw.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | kunci `sb_secret_...` **baru** (setelah rotasi) |
| `ADMIN_PASSWORD` | password admin pilihan Anda |
| `ADMIN_TOKEN_SECRET` | 64 karakter hex acak |

Tanpa dua yang pertama, aplikasi tetap jalan tapi memakai penyimpanan sementara (order hilang saat serverless dingin) — panel diagnosa akan menandainya merah.

### 3.4 Pastikan folder `api/` ikut terdeteksi

Vercel → project → tab **Functions** (atau **Overview → Functions**). Harus ada entri `api/[...route]`.

Jika kosong → folder `api/` tidak ada di branch yang dideploy → kembali ke Solusi A/B.

### 3.5 Tes tiga URL ini setelah redeploy

| URL | Hasil benar |
| --- | --- |
| `https://<domain>/` | Storefront Cilegon Enggih |
| `https://<domain>/api/ping` | `{"pong":true,...}` |
| `https://<domain>/api/diagnose` | JSON `ready`, `summary`, `checks[]` |

Kalau `/` benar tapi `/api/ping` 404 → masalah routing function; pastikan file `vercel.json` ikut ter-commit (isinya sudah mengatur rewrite `/api/(.*) → /api/[...route]`).

---

## 4. Cara mendapatkan URL yang benar untuk dipakai

Setelah deploy sukses, **jangan** pakai URL preview ber-hash (`...-echhwcv17-...`). Yang benar:

1. Vercel → project → tab **Deployments**.
2. Cari baris berlabel **Production** (bukan Preview) dan status **Ready**.
3. Klik → salin **Domain** (bentuknya `cilegon-enggih.vercel.app` atau domain Anda sendiri).
4. Buka di **incognito** → harus tampil toko.

---

## 5. Ringkasan: 60 detik untuk tahu di mana masalahnya

```
1. Vercel → Deployments → deployment teratas: statusnya "Ready" atau "Error"?
      Error  → buka Build Logs (bagian 3.1)
      Ready  → lanjut 2
2. Buka /api/ping di domain production:
      404          → yang dideploy bukan kode aplikasi → Solusi A/B
      {"pong":true} → kode jalan, masalahnya storage/env → bagian 3.3
3. Buka /api/diagnose:
      "ready": true  → tinggal ganti rekening & QRIS di /admin
      item merah     → ikuti kolom "Cara perbaiki" di panel dashboard
```

---

## 6. Yang perlu Anda kirim bila ingin saya bantu

- ✅ URL production setelah redeploy (contoh: `https://cilegon-enggih.vercel.app`).
- ✅ Kalau masih 404: **screenshot tab Building** (build logs) atau 10 baris terakhir log-nya.
- ✅ Isi tombol **Salin laporan** pada panel "Kesiapan Go-Live" di `/admin`.
- ❌ Jangan kirim: kunci Supabase, password admin, OTP.

---

## 7. Catatan keamanan (penting, terkait sesi sebelumnya)

Repo GitHub sempat berisi folder `data/` berisi **data pesanan contoh** pada branch `main`. Itu **bukan** data pelanggan asli (hanya seed demo: Rizky Pratama, Nadia Kusumawardhani, Hendra Wijaya, dan 1 order uji "Bundler"), tetapi:

- sudah saya hapus dari commit terbaru dan saya tambahkan `data/` ke `.gitignore` agar tidak terulang,
- **jangan** pernah meng-commit folder data produksi; data asli hanya boleh ada di Supabase.

**Web Develop by [Fadil Labs](https://fadil-labs.vercel.app/)**
