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
dipakai `middleware.ts` **dan** `index.html` — satu sumber kebenaran.

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

### C. `middleware.ts` — OG berbeda per URL

Vercel Routing Middleware berjalan **sebelum cache** dan **sebelum rewrite**.
Middleware membaca `og-meta.json`, membuang tag sosial lama dari `index.html`,
lalu menyuntikkan blok meta yang sesuai.

Penting untuk diketahui:

- **Hanya crawler** yang dilayani HTML khusus (WhatsApp, Facebook, Twitter,
  Telegram, LinkedIn, Slack, Discord, embedly, Googlebot, dll.).
  Pengunjung biasa tetap mendapat HTML statis dari cache → tidak ada biaya
  function tambahan dan tidak ada risiko FOUC.
- Ingin mengaktifkan untuk **semua** request? Set env `OG_ALL_REQUESTS=1`.
- Aset (`/assets`, `/og`, `/products`), `/api`, dan file ber-ekstensi dilewati.
- Produk baru dari dashboard otomatis dapat judul dari slug-nya (kartu gambar
  memakai kartu toko) — tidak menampilkan preview beranda yang menyesatkan.

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

`middleware.ts` hanya aktif di Vercel. Untuk memeriksa logikanya secara lokal:

```bash
npx esbuild middleware.ts --bundle --format=esm --platform=neutral --outfile=/tmp/mw.mjs
node -e "import('/tmp/mw.mjs').then(async({default:mw})=>{
  const r=await mw(new Request('https://x/produk/tote-bag-kanvas-premium',
    {headers:{'user-agent':'WhatsApp/2'}}));
  console.log((await r.text()).match(/og:image\" content=\"([^\"]+)/)[1]);
})"
```

---

## Jawaban FAQ

**Kenapa `og:image` bukan gambar produk asli?**
Gambar asli 0,7–1,2 MB dan portrait. Kartu OG adalah foto produk yang sama,
di-crop tengah ke 1200×630 lalu dikompres JPEG q82 → 80–130 KB. Secara visual
tetap foto produk, hanya versi ringan untuk preview chat.

**Apakah ini memperlambat website?**
Tidak. Middleware hanya jalan untuk crawler; pengunjung biasa dilayani langsung
dari cache CDN.

**Kalau produk baru ditambahkan lewat dashboard?**
Preview langsung berfungsi (judul dari nama produk). Kartu gambar spesifiknya
baru muncul setelah `src/data/products.ts` berisi produk itu lalu
`npm run og:images` dijalankan.

**Apakah `*.vercel.app` bisa tampil preview di WhatsApp?**
Umumnya bisa. Bila setelah semua perbaikan ini gambar tetap tidak muncul di
WhatsApp padahal Facebook Debugger sudah benar, penyebabnya biasanya cache
WhatsApp — bukan tag-nya. Menghubungkan domain sendiri (`cilegonenggih.com`)
juga menghilangkan keraguan soal reputasi domain.
