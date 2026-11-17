# 🔒 Perbaikan Pra-Go-Live — Ringkasan Teknis

Dokumen ini mencatat perubahan yang dikerjakan setelah audit menyeluruh
"100% siap go-live". Semua perubahan ada di branch
`arena/85f78643-cilegon-enggih`.

---

## 1. Stok sekarang benar-benar berkurang

**Masalah:** stok produk tidak pernah berkurang walau pesanan dibuat. Dua pembeli
bisa transfer untuk barang yang sama.

**Sekarang:**

- Stok **dipotong saat pesanan dibuat** (reservasi) — bukan saat LUNAS — agar
  pembeli yang sudah terlanjur transfer tidak kehilangan barang.
- Stok **dikembalikan otomatis** ketika pesanan diubah ke `DIBATALKAN`,
  dan dipotong ulang bila pesanan diaktifkan kembali.
- Produk **pre-order** dikecualikan (memang diproduksi sesuai pesanan).
- `product.stock` disinkronkan dari jumlah stok varian bila produk tidak
  memakai stok manual.
- Modul baru: `server/stock.js` (`availableStock`, `checkStock`,
  `applyStockMovement`).

## 2. Batas jumlah & validasi input

| Aturan | Nilai |
| --- | --- |
| Maksimal pcs per item | **500** |
| Maksimal jenis produk per pesanan | **30** |
| Ongkir maksimal diterima | **Rp 500.000** |
| Diskon/voucher | tidak boleh melebihi subtotal |
| Nama penerima | minimal 3 karakter, maksimal 80 |
| Nomor WhatsApp | `08…` / `+62…` / `62…`, 9–15 digit |
| Alamat | minimal 8 karakter, maksimal 240 |
| Email (opsional) | format email valid |
| Produk tidak dikenal | **ditolak** (dulu diterima dengan harga kiriman pembeli) |

Percobaan lama yang berhasil menembus sistem:

```
qty 99.999 × Rp 15.000 → order Rp 1.499.985.685   → sekarang ditolak (batas 500)
HP "abc"                                          → sekarang ditolak
nama 5.000 karakter                               → sekarang dipotong
produk fiktif harga Rp 0                          → sekarang ditolak
```

## 3. Rate limit

| Endpoint | Batas |
| --- | --- |
| `POST /api/orders` | 10 pesanan / 10 menit / IP |
| `POST /api/b2b` | 5 pengajuan / 30 menit / IP |
| `GET /api/orders/track` | 20 percobaan / 10 menit / IP (sudah ada) |

Melebihi batas → HTTP **429** dengan pesan waktu tunggu.

> Catatan: penghitung disimpan di memori instance. Di Vercel (serverless) setiap
> instance punya hitungan sendiri, jadi ini pagar anti-spam dasar — bukan
> pengganti WAF. Lihat bagian 7 untuk pengerasan lanjutan.

## 4. Hapus pesanan & bersihkan data uji

- `DELETE /api/admin/orders/:orderId` — hapus satu pesanan, stok dikembalikan
  otomatis, tercatat di audit log (`order.dihapus`).
- `POST /api/admin/orders/reset` — hapus semua pesanan; wajib kirim
  `{"confirm":"HAPUS SEMUA"}`. Data B2B ikut dikosongkan.
- UI: tombol **Hapus** di setiap kartu pesanan dan tombol
  **Bersihkan Data Uji** di tab Pesanan (konfirmasi dua langkah).

**Bug lama ikut diperbaiki:** data contoh disemai ulang setiap kali koleksi
kosong, sehingga pesanan yang sengaja dihapus **muncul kembali**. Sekarang
penyemaian hanya terjadi sekali (`server/db.js`, penanda `seed-initialized`).

## 5. Keamanan header & SEO

- `Content-Security-Policy` + `Strict-Transport-Security` ditambahkan di
  `vercel.json`. `script-src` tetap mengizinkan `'unsafe-inline'` karena
  JSON-LD (structured data) ditulis inline di `index.html`.
- `GET /api/ping` — healthcheck ringan untuk uptime monitor & preflight
  (sebelumnya 404).
- **Halaman 404 sungguhan** — dulu semua URL tak dikenal diarahkan ke beranda,
  membuat Google mengindeks halaman duplikat.
- **Sitemap dinamis** — `scripts/sitemap.mjs` membuat `sitemap.xml` +
  `robots.txt` setiap build dari data produk; `lastmod` selalu tanggal build,
  produk baru otomatis masuk. `public/sitemap.xml` statis dihapus.

## 6. Domain canonical

Canonical, `og:url`, `og:image`, JSON-LD, footer, invoice, dan teks legal kini
menunjuk **`https://cilegon-enggih.vercel.app`** karena `cilegonenggih.com`
belum diarahkan ke Vercel.

Saat domain asli siap, **tanpa ubah kode**:

1. Vercel → Settings → Environment Variables
2. `VITE_STORE_DOMAIN` = `cilegonenggih.com`
3. `STORE_DOMAIN` = `cilegonenggih.com`
4. Redeploy

## 7. Yang belum dikerjakan (opsional / lanjutan)

- **Optimasi gambar**: `public/products/` masih 9 MB PNG (belum WebP).
  Ini penyebab lambat di jaringan 3G.
- **Rate limit terdistribusi**: pindah ke Upstash Redis/Vercel KV bila trafik naik.
- **Retensi data pembeli**: kebijakan hapus otomatis setelah N bulan.
- **Monitoring uptime** eksternal memakai `/api/ping`.

## 8. Verifikasi

```bash
npm ci
npm run build          # tsc -b + vite build + generate sitemap
npm run preflight -- http://127.0.0.1:3001
```

Hasil uji lokal terakhir: 17/17 uji regresi lolos
(storefront, order, lacak pesanan, admin, validasi, rate limit, hapus, reset,
stok potong/kembali, dan ketahanan setelah restart server).
