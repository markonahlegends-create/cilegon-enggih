# Panduan Editor Produk (Dashboard Admin) & Pre-Order

Dokumen ini menjelaskan fitur baru yang dipakai pemilik toko di `/admin`.

---

## 1. Edit / Tambah Produk — 6 bagian lengkap

Buka `/admin` → tab **Produk** → klik **Edit** pada produk, atau **Produk Baru**.

| Bagian | Isi | Catatan |
|---|---|---|
| ① Informasi Dasar | Nama produk, nama pendek, subjudul Inggris, slug URL, kategori, status tampil, deskripsi | Slug otomatis dari nama pendek; kalau sudah dipakai, sistem menambah `-2`, `-3`, dst. |
| ② Harga, Stok & Grosir | Harga jual, harga sebelum diskon, berat (gram), stok total, min. qty grosir, harga grosir | Diskon % dihitung otomatis. Harga coret < harga jual akan ditolak. |
| ③ Varian / Ukuran | Tabel label · harga · harga coret · stok + tombol **Tambah Varian** | Bisa geser urutan (varian pertama = default terpilih), **duplikat** varian, hapus, dan **Isi otomatis ukuran kaos S–XXL**. |
| ④ Gambar Produk | Unggah gambar (multi), jadikan utama, geser urutan, hapus — **maks 9 gambar** | Gambar dikompres otomatis di browser sebelum diunggah. Masih bisa tempel path/URL manual. |
| ⑤ Spesifikasi & Isi Paket | Baris `label: value` untuk tab Spesifikasi; editor isi paket bila "Paket Bundling" dicentang | Kosongkan baris = tidak tampil di toko. |
| ⑥ Label & Status | Best Seller, Flash Deal, Paket Bundling, Size Chart, **Pre-Order 7–15 Hari**, Tampil di Storefront, badge tambahan | Badge diketik lalu tekan Enter. |

### Fitur pendukung
- **Pratinjau kartu produk** di kolom kanan (mengikuti tampilan storefront).
- **Peringatan "perubahan belum disimpan"** saat menutup form.
- **Validasi sebelum simpan**: nama wajib, harga > 0, harga coret ≥ harga jual, stok ≥ 0, berat > 0, label varian tidak boleh duplikat.
- **Pencarian & filter katalog**: pre-order, best seller, bundling, stok menipis (≤20), nonaktif.
- **Duplikat produk** (tombol ikon salin) untuk membuat produk serupa dengan cepat.

### Aturan stok otomatis
- Kalau produk punya varian → **stok total = jumlah stok semua varian**.
- Centang **Manual** di field stok bila ingin mengisi stok sendiri (mis. ada barang rusak).

---

## 2. Pre-order 7–15 hari

Tidak perlu mengubah status order satu per satu. Cukup:

1. Buka editor produk → bagian ⑥ → centang **Pre-Order 7–15 Hari**.
2. Sesuaikan teks **Keterangan Pre-Order** (default: `Pre Order 7–15 hari kerja`).

Yang terjadi otomatis:
- Badge **⏳ PRE-ORDER** + keterangan di **kartu produk** katalog.
- Catatan pre-order di **halaman detail produk**.
- Saat checkout, pesanan otomatis ditandai pre-order.
- Tercetak di **invoice** dan **label pengiriman**.
- Kalau ada produk pre-order di keranjang, seluruh pesanan ditandai pre-order.

Verifikasi pembayaran, status, dan resi tetap dikontrol manual di dashboard (tab Pesanan).

---

## 3. Notifikasi Telegram (gratis)

`/admin` → tab **Pengaturan** → **Notifikasi Telegram**.

1. Telegram → chat `@BotFather` → `/newbot` → salin **token**.
2. Kirim pesan apa pun ke bot Anda, lalu buka
   `https://api.telegram.org/bot<TOKEN>/getUpdates` → salin **chat.id**.
3. Tempel token & chat id di dashboard → **Tes Koneksi** → **Simpan Pengaturan**.

Notifikasi yang tersedia (bisa dinyalakan/dimatikan satu per satu):
- Pesanan baru masuk
- Bukti transfer diunggah pembeli
- Pembayaran diverifikasi **LUNAS**
- Paket dikirim (resi diinput)
- Penawaran B2B baru

Alternatif: isi env `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (nilai di dashboard menang atas env).
Kalau belum diatur, tidak ada error — notifikasi hanya dilewati.

> Token bot hanya dipakai di server. Endpoint publik tidak pernah mengirim token ke browser.

---

## 4. Unggah gambar produk (Supabase Storage)

Di produksi (Vercel), gambar **wajib** disimpan di Supabase Storage karena filesystem serverless tidak permanen.

1. Supabase → **Storage** → **New bucket** → nama `product-images` → aktifkan **Public**.
2. Vercel → Environment Variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (atau `SUPABASE_SECRET_KEY`)
   - opsional `SUPABASE_STORAGE_BUCKET=product-images`
3. Redeploy.

Tanpa Supabase, upload tetap berfungsi di server lokal (disimpan di `public/uploads/`) — berguna untuk uji coba.

Cek status kapan saja di `/admin` → tab **Analitik** → panel **Kesiapan Go-Live**, atau `GET /api/diagnose`.

---

## 5. Halaman detail produk (storefront)

- Galeri gaya marketplace: **thumbnail vertikal** di kiri (desktop) / horizontal (HP), badge jumlah `1/9`, klik gambar untuk **lightbox** (panah kiri/kanan, `Esc` untuk menutup).
- Maksimal **9 gambar** per produk.
- Catatan pre-order tampil di bawah judul produk.

---

## 6. API yang berubah (untuk pengembang)

| Endpoint | Perubahan |
|---|---|
| `POST /api/admin/products` | Validasi lengkap + slug unik + normalisasi varian/specs/badges |
| `PUT /api/admin/products/:id` | Validasi yang sama; field yang tidak dikirim **tidak dihapus** |
| `POST /api/admin/products/:id/duplicate` | **Baru** — duplikat produk |
| `POST /api/admin/upload` | **Baru** — unggah gambar (data URL base64, maks 3 MB) → Supabase Storage / lokal |
| `GET /api/admin/settings` | **Baru** — settings lengkap (termasuk kredensial Telegram) |
| `POST /api/admin/telegram/test` | **Baru** — kirim pesan uji |
| `POST /api/orders` | Menerima `isPreOrder` + `preOrderNote` |
| `GET /api/diagnose` | Tambah cek `telegram` + `storage-images` |

Field produk baru: `isPreOrder`, `preOrderNote`, `stockManual`, `active`.
