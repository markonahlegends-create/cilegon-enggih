# Ringkasan Perbaikan — 19 November 2026

Selamat pagi. Semua sudah dikerjakan dan **sudah live di produksi**
(`https://cilegon-enggih.vercel.app`). PR #29 merged, deploy Vercel sukses.

---

## 1. Error 400 saat unggah video — SUDAH DIPERBAIKI

### Penyebabnya BUKAN bucket

Pesan lama menyuruh Anda memastikan bucket `product-video` ada dan Public.
Saya cek langsung ke Supabase: **bucket-nya sudah ada dan sudah Public.**

| Yang dicek | Hasil |
|---|---|
| Bucket `product-video` | ADA |
| Public | ya (`true`) |
| Batas ukuran | 5 MB |
| Format yang diterima | MP4, WebM |

### Penyebab sebenarnya

Kode di server mengirim header `Content-Type: application/json` **tanpa isi**.
Supabase menolak permintaan seperti itu dengan `400` — persis kode yang Anda lihat.
Pesan errornya lalu salah diterjemahkan menjadi "bucket tidak ada".

### Yang saya perbaiki

- Header penyebab 400 dihapus. Pembuatan tautan unggah sekarang berhasil.
- Pesan error memuat **alasan asli dari Supabase**, tidak menebak lagi.
- File **.mov dari iPhone** sekarang ditolak lebih awal, dengan solusi yang jelas:
  *kirim videonya lewat WhatsApp lalu simpan kembali — iPhone otomatis
  menyimpannya sebagai MP4.*
- Pesan gagal dibedakan per penyebab: terlalu besar / tipe tidak didukung /
  tautan kedaluwarsa / bucket.

### Sudah saya uji dengan video sungguhan

| Uji | Hasil |
|---|---|
| Kode lama (sebelum diperbaiki) | **400** — pesan identik dengan yang Anda laporkan |
| Kode baru: minta tautan + unggah MP4 | **200 — video berhasil terunggah** |
| Video 7 MB | Ditolak 413: "Pendekkan durasi atau kecilkan resolusi ke 720p" |
| Tanpa login admin | Ditolak 401 |

**Yang perlu Anda lakukan:** coba unggah video lagi di `/admin` → Edit produk →
bagian **4b Video Produk**. Sekarang seharusnya berhasil.

---

## 2. Pertanyaan Anda: bagian varian 3 dimensi perlu diisi atau tidak?

### Jawaban singkat

| Pertanyaan | Jawaban |
|---|---|
| Apakah 3 dimensi menambah biaya? | **Tidak.** Harga hanya berubah bila kolom **Selisih** diisi. Kosongkan 0 untuk pilihan yang harganya sama (mis. semua warna). |
| Bagian ③ Varian masih perlu diisi? | **Tidak.** Kalau memakai 4c, kosongkan ③ supaya tidak dobel. |
| Bisa bikin foto beda per model/warna? | **Bisa, sekarang sudah ada tombolnya.** Gratis, tidak memengaruhi harga. |

### Yang sebelumnya belum ada

Fitur foto per pilihan sebenarnya **sudah tersimpan** di server dan **sudah dipakai**
halaman produk — tapi **tidak ada tombol unggahnya di admin**. Jadi praktis tidak
bisa Anda pakai. Sekarang sudah ada.

**Cara pakai di `/admin` → Edit produk → bagian 4c:**

1. **Tambah dimensi** → misal `Model`.
2. Tambah nilainya: `Reguler`, `Oversize`.
3. Isi **Selisih** hanya bila harganya beda (mis. Oversize `+15000`).
4. Klik **Tambah foto** di baris nilai itu → unggah fotonya.
5. Ulangi untuk dimensi `Warna` (tampilan **Swatch**) dan `Ukuran`.
6. Periksa panel **Pratinjau harga** di bawah sebelum simpan.

### Satu perbaikan penting soal foto

Kalau Anda mengisi foto di **Model** *dan* **Warna**, dulu memilih Navy tidak
mengubah gambar (foto Model selalu menang). Sekarang **warna didahulukan**,
jadi memilih Navy benar-benar menampilkan foto Navy.

Urutan prioritas foto:

1. Foto khusus kombinasi (paling spesifik)
2. Foto pada dimensi **Swatch** (warna)
3. Foto pada dimensi lain (model, ukuran)
4. Foto utama produk

**Artinya:** kalau Anda hanya mengisi foto di Model, ganti ukuran/warna tidak
mengubah gambar — itu normal. Isi juga foto di Warna kalau ingin gambar ikut
berubah saat pembeli ganti warna.

### Ingat

- **Stok hanya diisi per ukuran.** Warna dianggap selalu tersedia.
- Dimensi tanpa Selisih = **tanpa tambahan biaya**.

---

## 3. Uji ulang yang saya jalankan (tidak ada yang rusak)

Saya pastikan perbaikan ini tidak merusak varian yang sudah live:

| Pilihan | Harga ditagih |
|---|---|
| Reguler · M | 120.000 |
| Oversize · XL | 145.000 |
| Oversize · 2XL | 150.000 |
| Kombinasi yang dimatikan | tetap terkunci |

Pilihan awal saat halaman dibuka juga tetap terisi lengkap, jadi pembeli
langsung bisa menekan "Tambah ke Keranjang".

---

## 4. Panduan yang diperbarui

`EDITOR-PRODUK.md` (di repo) sekarang punya bagian baru:

- **Bagian 4c — Pilihan Multi-Dimensi**: tabel tanya-jawab, langkah pengisian,
  dan urutan prioritas foto.
- **Bagian 4b — Video Produk**: batas 5 MB, format MP4/WebM, cara mengubah
  rekaman iPhone `.mov`.

---

## Kalau masih ada yang gagal

Kirimkan ke saya:

1. **Teks pesan error lengkapnya** (sekarang pesannya sudah menyebut alasan asli).
2. Nama file dan ukurannya.
3. Tangkapan layar bila ada.

Dengan pesan error baru, penyebabnya akan langsung kelihatan — tidak perlu
menebak-nebak soal bucket lagi.
