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

### Bagian 4c — Pilihan Multi-Dimensi (Model × Ukuran × Warna)

Dipakai bila satu produk punya **beberapa pilihan sekaligus**. Untuk produk yang cuma
punya satu daftar ukuran, cukup pakai **bagian ③ Varian** — jangan isi 4c.

**Tiga hal yang sering ditanyakan:**

| Pertanyaan | Jawaban |
|---|---|
| Apakah menambah dimensi menambah harga? | **Tidak.** Harga hanya berubah bila kolom **Selisih** diisi. Biarkan `0` untuk pilihan yang harganya sama (mis. semua warna). |
| Apakah saya harus mengisi bagian ③ Varian juga? | **Tidak.** Kalau memakai 4c, kosongkan ③ supaya tidak dobel dan membingungkan. |
| Bagaimana membuat foto berbeda per model / per warna? | Klik **Tambah foto** di baris nilai tersebut. Fotonya muncul di halaman produk begitu pembeli memilih nilai itu. **Gratis, tidak memengaruhi harga.** |

**Cara mengisi cepat:**

1. **Tambah dimensi** → beri nama, mis. `Model`.
2. Tambah nilainya (`Reguler`, `Oversize`). Isi **Selisih** hanya bila harganya beda
   (mis. Oversize `+15000`).
3. Ulangi untuk dimensi `Warna` (tampilan **Swatch**) dan `Ukuran`.
4. Klik **Tambah foto** pada nilai yang fotonya berbeda — mis. Oversize, Navy.
5. Periksa panel **Pratinjau harga** di bawah: semua kombinasi dan harga akhirnya terlihat
   sebelum disimpan.

**Urutan prioritas foto** (kalau beberapa dimensi punya foto):

1. Foto khusus kombinasi (paling spesifik)
2. Foto pada dimensi **Swatch** (warna) — supaya ganti warna benar-benar mengganti gambar
3. Foto pada dimensi lain (model, ukuran)
4. Foto utama produk

Jadi: isi foto di **Model** saja → ganti ukuran/warna tidak mengubah gambar. Isi foto di
**Warna** juga → memilih Navy menampilkan foto Navy.

**Stok:** hanya diisi per **ukuran** (bagian ③ atau kombinasi). Warna dianggap selalu
tersedia — tidak perlu mengisi stok per warna.

---

### Bagian 4b — Video Produk

Video **tidak melewati server**: browser meminta tautan unggah ke server, lalu mengunggah
langsung ke Supabase Storage. Ini karena Vercel menolak request di atas 4.5 MB.

Batas yang berlaku:

| Aturan | Nilai |
|---|---|
| Ukuran maksimal | **5 MB** per video |
| Format | **MP4** atau **WebM** |
| Jumlah | maksimal **3** video per produk |
| Bucket | `product-video`, harus **Public** |

**Rekaman iPhone (.mov) ditolak.** Ubah dulu ke MP4 — cara termudah: kirim videonya ke
WhatsApp/Telegram lalu simpan kembali, iPhone otomatis menyimpannya sebagai MP4. Atau kecilkan
resolusi ke 720p dan pendekkan durasi (anjuran 20–30 detik).

---

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

## 5b. Rekening & status kesiapan

Status "placeholder" rekening sekarang ditentukan **di server**, bukan dari browser:

- Nomor rekening masih nomor contoh bawaan (`1234567890`, `1300012345678`,
  `012345678901234`, `901234567890`, `0000000000`) atau kosong → dianggap **belum siap**.
- Nomor asli apa pun (termasuk nomor e-wallet `0819…`) → dianggap **siap**, dan label
  `(PLACEHOLDER)` otomatis dibersihkan dari nama pemilik.

Artinya: cukup ganti nomor rekening di dashboard, lalu Simpan — `/api/diagnose` langsung
melaporkan `banks: ok` tanpa langkah tambahan.

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
