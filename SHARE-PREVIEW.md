# 📱 Share Preview (WhatsApp / Facebook / Telegram) — Cara Kerja & Perbaikan

Dokumen ini menjelaskan kenapa link yang dibagikan sebelumnya hanya tampil sebagai
teks + caption, apa yang sudah diperbaiki, dan cara mengujinya.

---

## Penyebab sebelumnya (3 masalah terpisah)

### 1. Gambar OG 1,08 MB — WhatsApp membuangnya

`index.html` memakai `og:image = /products/kaos-distro.png` (1.083.402 byte,
765×1024 px).

- WhatsApp diam-diam **menolak gambar di atas ~300 KB** — bukan menampilkan
  placeholder, tapi preview tanpa gambar sama sekali.
- Facebook/Twitter lebih longgar (8 MB), sehingga bisa jadi di sana muncul
  padahal di WhatsApp tidak.
- Rasio portrait 765×1024 juga salah bentuk: kartu besar butuh **1,91:1** (1200×630).

### 2. Halaman produk tidak punya OG sendiri

Situs ini SPA. `vercel.json` me-rewrite semua path non-`/api` ke `/index.html`,
dan tidak ada kode yang menyetel `og:image` per halaman. Akibatnya:

> Membagikan 12 produk berbeda → previewnya identik semua (judul & gambar beranda).

React **tidak bisa** memperbaikinya: crawler WhatsApp tidak menjalankan JavaScript.

### 3. Tidak ada tag dimensi

`og:image:width` / `og:image:height` tidak ada, sehingga beberapa platform
menampilkan thumbnail kecil atau memotong gambar secara acak.

---

## Yang sudah dikerjakan

### A. Kartu OG 1200×630 yang ringan (`public/og/`)

14 kartu JPEG, semuanya **47–130 KB** (batas aman 300 KB):

| Kartu | Dipakai untuk |
| --- | --- |
| `<slug-produk>.jpg` × 12 | halaman `/produk/<slug>` |
| `toko-cilegon-enggih.jpg` | beranda & katalog |
| `cilegon-enggih-toko.jpg` | halaman umum, produk baru tanpa kartu |

Dibuat oleh `scripts/generate-og-images.mjs` (butuh ImageMagick, dijalankan
manual, hasilnya di-commit agar build Vercel tidak perlu ImageMagick):

```bash
npm run og:images
```

### B. Metadata per halaman (`src/data/og-meta.json`)

`scripts/generate-og-data.mjs` membaca `src/data/products.ts` lalu menulis JSON
berisi judul, deskripsi, harga, dan URL gambar tiap halaman. JSON ini yang
dipakai `scripts/generate-og-pages.mjs` **dan** `index.html` — satu sumber kebenaran.

```bash
npm run og:data      # juga otomatis dijalankan sebelum `npm run build`
```

Contoh hasil untuk halaman produk:

```
title:       Tote Bag Kanvas Premium | Cilegon Enggih
description: ... Rp 65.000 – Rp 95.000.
image:       https://cilegon-enggih.vercel.app/og/tote-bag-kanvas-premium.jpg
url:         https://cilegon-enggih.vercel.app/produk/tote-bag-kanvas-premium
```

### C. Rewrite statis untuk crawler (`vercel.json`)

> **Penting — jangan pakai middleware lagi.** Percobaan pertama memakai
> Vercel Routing Middleware yang memanggil `fetch(origin/index.html)`.
> Panggilan ke origin sendiri dari dalam middleware membuat **seluruh halaman
> publik mati** dengan `500 MIDDLEWARE_INVOCATION_FAILED`. Middleware sudah
> dihapus dan sekarang dicegah oleh `npm run preflight`.

Pendekatan yang dipakai sekarang **tanpa function sama sekali**:

1. `scripts/generate-og-pages.mjs` menulis 18 file HTML kecil
   (`public/og/produk--<slug>.html`, `/og/katalog.html`, dst). Isinya hanya
   `<head>` + meta OG (≈4 KB) dan tidak memuat React.
2. Skrip yang sama menulis aturan `rewrites` di `vercel.json`:

```json
{
  "source": "/produk/tote-bag-kanvas-premium",
  "has": [{ "type": "header", "key": "user-agent",
            "value": { "re": "[Ww]hatsapp|[Ff]acebookexternalhit|..." } }],
  "destination": "/og/produk--tote-bag-kanvas-premium.html"
}
```

3. Pengunjung biasa **tidak pernah** terkena aturan ini — mereka tetap
   mendapat `/index.html` dari CDN, sama seperti sebelumnya.

Karena semuanya file statis: tidak ada invocation, tidak ada biaya function,
dan tidak ada jalur yang bisa membuat situs utama error.

**Dua keputusan penting:**

- **Googlebot & Bingbot sengaja TIDAK diarahkan** ke halaman share. Halaman itu
  bersifat bantuan; bila search engine diarahkan ke sana, halaman produk bisa
  turun dari hasil pencarian. Search engine tetap menerima SPA seperti biasa
  (canonical, sitemap, dan JSON-LD tetap benar).
- **Aturan dibuat eksplisit per halaman**, bukan pola `:slug`. Kalau
  destination tidak ada, crawler akan menerima 404 — bukan preview beranda.

### D. Sinkronisasi judul di browser

`src/lib/documentMeta.ts` menyetel `<title>` + meta description saat navigasi,
sehingga tab browser tidak lagi selalu berjudul beranda. Ini **bukan** untuk
crawler (mereka tidak menjalankan JS) — murni kenyamanan pengguna.

---

## Cara menguji

### 1. Cek HTML yang dilihat crawler

```bash
curl -A "WhatsApp/2.23" -s https://cilegon-enggih.vercel.app/produk/tote-bag-kanvas-premium \
  | grep -E "og:title|og:image|og:url"
```

Harus muncul judul + gambar **produk itu**, bukan beranda.

### 2. Facebook Sharing Debugger (proxy paling dekat untuk WhatsApp)

<https://developers.facebook.com/tools/debug/>

Tempel URL produk → klik **Scrape Again** bila masih menampilkan data lama.

### 3. WhatsApp — cache paling keras

WhatsApp menyimpan preview sampai berhari-hari. Bila kartu lama masih muncul:

1. Kirim ke **chat baru** (bukan chat tempat link lama dikirim).
2. Tambahkan query pembeda: `?v=2` di belakang URL.
3. Tunggu ±24 jam untuk cache lama kedaluwarsa.

### 4. Uji lokal (tanpa deploy)

Aturan `has` di `vercel.json` hanya aktif di Vercel (tidak di `vercel dev`).
Yang bisa diuji lokal adalah isi halaman share-nya:

```bash
npm run build
npm run preview
# lalu buka salah satu:
curl -s localhost:4173/og/produk--tote-bag-kanvas-premium.html | grep og:
curl -sI localhost:4173/og/tote-bag-kanvas-premium.jpg
```

Logika pencocokan crawler diuji oleh `npm run preflight` (cek aturan rewrite,
keberadaan file tujuan, dan memastikan `middleware.ts` tidak muncul lagi).

---

## Jawaban FAQ

**Kenapa `og:image` bukan gambar produk asli?**
Gambar asli 0,7–1,2 MB dan portrait. Kartu OG adalah foto produk yang sama,
di-crop tengah ke 1200×630 lalu dikompres JPEG q82 → 80–130 KB. Secara visual
tetap foto produk, hanya versi ringan untuk preview chat.

**Apakah ini memperlambat website?**
Tidak. Pengunjung biasa dilayani langsung dari cache CDN tanpa function apa pun.
Hanya crawler social media yang menerima file HTML berbeda (≈4 KB).

**Kalau produk baru ditambahkan lewat dashboard?**
Preview langsung berfungsi (judul dari nama produk). Kartu gambar spesifiknya
baru muncul setelah `src/data/products.ts` berisi produk itu lalu
`npm run og:images` dijalankan.

**Apakah `*.vercel.app` bisa tampil preview di WhatsApp?**
Umumnya bisa. Bila setelah semua perbaikan ini gambar tetap tidak muncul di
WhatsApp padahal Facebook Debugger sudah benar, penyebabnya biasanya cache
WhatsApp — bukan tag-nya. Menghubungkan domain sendiri (`cilegonenggih.com`)
juga menghilangkan keraguan soal reputasi domain.

---

## ⚠️ Insiden: `vercel.json` tidak valid → deploy tidak pernah dibuat

Setelah dokumen ini pertama ditulis, terjadi dua kegagalan deploy beruntun yang
**tidak terlihat sebagai error build**. Gejalanya membingungkan:

- Deploy Hook menjawab `{"state":"PENDING"}` tapi **tidak ada deployment muncul**
- Push ke `main` tidak memicu apa pun
- Tidak ada entri berstatus *Error* di daftar Deployments
- Situs tetap menyajikan build lama

Penyebabnya satu baris di `vercel.json`:

```json
"source": "/og/*.jpg"      // ❌ bukan pola yang sah
"source": "/og/(.*)\\.jpg" // ❌ backslash tidak sah
```

Vercel menolak pola itu **saat mem-parse konfigurasi, sebelum build dimulai**.
Karena belum sampai tahap build, tidak ada Build Logs dan tidak ada entri Error.
Gejala terakhir yang akhirnya menunjukkan penyebab sebenarnya:

```
$ vercel --prod
Error: Header at index 3 has invalid `source` pattern "/og/*.jpg".
```

**Aturan pola `source` di Vercel:** literal path (`/katalog`), parameter
(`/produk/:slug`), atau grup regex dalam kurung (`/og/(.*)`). Glob `*` dan
escape backslash tidak diizinkan di `source`.

### Pencegahan yang sekarang terpasang

`scripts/validate-vercel-config.mjs` memeriksa `vercel.json` terhadap aturan
tersebut **sebelum** build:

```bash
npm run validate:vercel     # juga otomatis di `npm run build`
```

Yang diperiksa: JSON valid, `source` diawali `/`, tidak ada backslash, tidak ada
glob di luar grup, kurung seimbang, `has`/`missing` valid (termasuk menolak flag
regex `(?i)` yang tidak didukung), `destination` untuk `/og/*` benar-benar ada,
dan cron lengkap.

`npm run preflight` juga menjalankan validator ini, plus pemeriksaan baru:
**file yang dibutuhkan build harus ter-track Git** — supaya kejadian seperti
`src/data/og-meta.json` yang tidak pernah ter-commit langsung ketahuan.

### Catatan `.gitignore`

`.gitignore` sebelumnya berisi `data/`, dan pola itu **ikut menelan
`src/data/`** — termasuk `og-meta.json`. Sekarang diubah menjadi `/data/`
(hanya folder di root). Jangan dikembalikan ke `data/` tanpa awalan garis miring.
