# Cilegon Enggih — Official Store E-Commerce
test lagi

> **Baru:** editor produk lengkap (varian, gambar, spesifikasi, badge), label pre-order, dan notifikasi Telegram — lihat [EDITOR-PRODUK.md](EDITOR-PRODUK.md).


**Oleh-Oleh Modern Kebanggaan Cilegon | Khas Kota Baja, Bangga Membawanya.**

Website e-commerce resmi untuk brand merchandise **Cilegon Enggih** yang mengangkat ikon **Landmark Simpang Tiga Kota Cilegon**. Dirancang dengan pengalaman belanja modern ala *Official Store* Tokopedia menggunakan palet warna resmi:

- **Biru Baja / Navy (`#1B365D`)**
- **Hijau Tosca / Forest Green (`#2E6F40`)**
- **Kuning Emas / Amber (`#E5A93C`)**

## Kontak & Alamat Resmi

| | |
| --- | --- |
| Alamat | Link. Jerang Barat RT. 004/001 Kel. Karang Asem Kec. Cibeber Kota Cilegon - Banten 42425 |
| Email | cilegonenggih@gmail.com |
| WhatsApp | 0819-2715-7103 (`wa.me/6281927157103`) |
| Web Developer | **Web Develop by Fadil Labs** — <https://fadil-labs.vercel.app/> |

## Fitur Utama

1. **Katalog 9 Produk Resmi + 3 Paket Bundling/Hampers** memakai foto produk asli (`public/products/`).
2. **Storefront Tokopedia-style**: beranda, katalog (5 sub-kategori), detail produk, halaman B2B, tentang kami, cara order & FAQ, lacak pesanan, dan legalitas.
3. **Guest Checkout tanpa akun** — cukup nama, WhatsApp, dan alamat.
4. **Pembayaran langsung ke toko (tanpa biaya gateway)**
   - **Transfer bank** ke rekening toko (BCA / Mandiri / BRI / SeaBank / DANA) — *placeholder, siap diedit di Admin*.
   - **QRIS toko** (dinamis EMVCo atau statis dari gambar merchant).
   - **Kode unik 3 digit** (contoh `Rp 129.559`) agar setiap transfer mudah diverifikasi.
   - Upload bukti transfer + konfirmasi 1-klik ke WhatsApp admin.
5. **Kalkulator ongkir otomatis** dari **Kec. Cibeber, Kota Cilegon**: GoSend Instant, GrabExpress SameDay, JNE, J&T, SiCepat.
6. **Resi kurir asli**: order baru tampil “*Menunggu input resi kurir*”; setelah admin memasukkan AWB, pembeli melihat timeline + deep-link ke situs kurir (CekResi, JNE, J&T, SiCepat).
7. **Invoice & Label Pengiriman yang bisa dicetak** (A4/A6, `window.print()` → simpan PDF) dari checkout, halaman lacak, dan dashboard admin.
8. **Harga grosir B2B & form RFQ** dengan kalkulator diskon kuantitas, opsi cetak logo instansi, dan inbox inquiry di dashboard.
9. **Super Admin Dashboard (`/admin`)**
   - Login password (token HMAC, kedaluwarsa 12 jam).
   - **Analitik**: omzet lunas, potensi omzet, jumlah order, order menunggu verifikasi, order tanpa resi, inquiry B2B, produk terlaris, stok menipis.
   - **Pesanan**: verifikasi pembayaran, ubah status, input resi asli, tambah timeline, lihat bukti transfer, kabari pembeli via WhatsApp, cetak invoice/label.
   - **Produk CRUD**: tambah/edit harga, stok, diskon, badge, kategori, gambar, aktif/nonaktif, reset ke katalog default — perubahan langsung tampil di storefront.
   - **B2B**: kelola status inquiry + chat PIC.
   - **Pengaturan**: identitas toko, alamat, email, WhatsApp, rekening bank, QRIS (dinamis/statis), voucher, catatan invoice, kredit developer.

## Stack Teknologi (100% Free, Unlimited & Open-Source)

- **Frontend**: React 18, TypeScript, Vite 6, Tailwind CSS 3, React Router 7, Lucide Icons, `qrcode` (render QRIS di klien).
- **Backend**: Node.js + Express 4 dengan core API framework-agnostic (`server/core.js`) yang juga berjalan sebagai **Vercel Serverless Function** (`api/[...route].js`) dan **Cloudflare Pages Function** (`functions/api/[[route]].js`).
- **Storage**: **Supabase PostgreSQL** (free tier) via REST, dengan fallback JSON lokal (`server/data/`) atau `/tmp` untuk dev/preview/self-host.

## Cara Menjalankan

```bash
npm install
npm run dev:all      # API :3001 + Vite :5173
# atau production-like
npm run build && npm start
```

Alamat penting:

| Halaman | URL |
| --- | --- |
| Storefront | http://localhost:5173 |
| API health | http://localhost:3001/api/health |
| Super Admin | http://localhost:5173/admin |

> Password admin default: **`enggih2026`** → **wajib diganti** lewat `ADMIN_PASSWORD` sebelum go-live. Token admin memakai `ADMIN_TOKEN_SECRET`.

## Struktur Folder

```
server/
  constants.js        # identitas toko, rekening placeholder, seed order/B2B, default settings
  db.js               # storage adapter: Supabase REST ⇄ JSON lokal (/tmp fallback)
  core.js             # seluruh route API + auth admin + kalkulasi ongkir & QRIS
  app.js              # adapter Express + static SPA
  index.js            # entry server lokal (0.0.0.0:3001)
  seed/catalog.js     # 12 produk seed (hasil generate dari src/data/products.ts)
api/[...route].js     # Vercel Serverless Function (catch-all /api/*)
functions/api/[[route]].js  # Cloudflare Pages Function (proxy ke API_ORIGIN)
src/
  lib/api.ts          # klien API + token admin
  context/StoreContext.tsx  # state global: cart, products, settings, vouchers, cache order
  components/         # Navbar, Footer, CartDrawer, CheckoutModal, InvoiceDocument, ...
  pages/              # Home, Catalog, ProductDetail, TrackOrder, AdminDashboard, ...
supabase-schema.sql   # skema tabel ce_documents + view laporan
DEPLOYMENT.md         # panduan deploy Vercel / Cloudflare Pages / VPS + Supabase
```

## API Ringkas

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/health` | Status server + mode storage |
| GET | `/api/storefront` | Produk, settings publik, voucher aktif |
| POST | `/api/orders` | Buat order (kode unik 3 digit otomatis) |
| POST | `/api/orders/:id/proof` | Upload bukti transfer |
| GET | `/api/orders/track?q=` | Lacak via Order ID / Resi / No. WhatsApp |
| POST | `/api/shipping/calculate` | Ongkir per zona & berat |
| POST | `/api/payment/qris` | Payload QRIS dinamis / gambar statis |
| POST | `/api/b2b` | Kirim inquiry korporat |
| POST | `/api/admin/login` | Login admin → token |
| GET | `/api/admin/analytics` | Ringkasan omzet & stok |
| GET/PATCH | `/api/admin/orders` | Kelola pesanan |
| POST/PUT/DELETE | `/api/admin/products` | CRUD produk |
| PUT | `/api/admin/settings` | Rekening, QRIS, voucher, kontak |
| GET/PATCH | `/api/admin/b2b` | Inbox inquiry B2B |

## Deployment & Go-Live

- **[VERCEL-SETUP.md](./VERCEL-SETUP.md)** — mengatasi `404: NOT_FOUND` di Vercel (branch/framework/output/env salah).
- **[TROUBLESHOOTING-DEPLOY.md](./TROUBLESHOOTING-DEPLOY.md)** — perbaikan masalah deployment (proteksi Vercel, env Supabase, kunci `sb_secret_`, diagnosa).
- **[TUGAS-ANDA.md](./TUGAS-ANDA.md)** — daftar tugas yang **hanya bisa Anda lakukan sendiri** (rekening asli, QRIS, akun Supabase/Vercel, domain, uji transfer, publikasi) dalam 5 blok + checklist satu halaman.
- **[GO-LIVE.md](./GO-LIVE.md)** — playbook operasional langkah demi langkah: persiapan kredensial → Supabase → deploy Vercel → domain & HTTPS → konfigurasi toko dari dashboard → uji transaksi end-to-end → publikasi (SEO, Google Business) → checklist "Definition of Done".
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — referensi teknis deployment (env vars, alternatif Cloudflare Pages & VPS/PM2, backup, troubleshooting).

---

© Cilegon Enggih — **Web Develop by [Fadil Labs](https://fadil-labs.vercel.app/)**
