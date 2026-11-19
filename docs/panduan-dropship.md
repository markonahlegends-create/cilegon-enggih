# Panduan Dropship Cilegon Enggih

> Model bisnis: **tidak menyimpan stok**. Setiap pesanan dari pembeli dipesan ulang ke
> toko Shopee/Tokopedia, lalu dikirim langsung ke alamat pembeli atas nama Cilegon Enggih.
> Dokumen ini menjelaskan cara memilih vendor, menilai kelayakannya, dan angka yang
> wajib Anda hitung sebelum memakai satu vendor.

---

## 1. Kenapa dropship berbahaya kalau tidak disiplin

Dropship membuat Anda tidak bisa memeriksa barang sebelum sampai ke pembeli. Yang
dirasakan pembeli adalah **isi paket** dan **nama pengirimnya** — bukan niat baik Anda.
Lima hal yang paling sering menghancurkan toko dropship:

| Risiko | Yang terjadi | Cara mencegah |
|---|---|---|
| Invoice ikut terkirim | Pembeli melihat harga kulakan & tahu margin Anda | Syarat wajib **noInvoice** |
| Packing bermerek vendor | Pembeli sadar Anda hanya perantara | Syarat wajib **neutralPackaging** |
| Stok vendor habis | Pesanan sudah dibayar, barang tidak ada | Cek stok sebelum konfirmasi; siap refund cepat |
| Retur lintas pihak | Pembeli → Anda → vendor, uang tertahan | Cadangan retur 3% di setiap perhitungan margin |
| Klaim pengiriman instan | Anda janji 1–2 jam, paket datang 3 hari | **Cabut klaim instan** (lihat bagian 5) |

---

## 2. Skema data vendor

Data vendor **tidak dibuat di koleksi baru**. Vendor sudah punya tempat di koleksi
`vendors` (dipakai modul Keuangan untuk HPP). Yang ditambahkan hanyalah kolom khusus
dropship, sehingga satu vendor dipakai untuk dua keperluan sekaligus — tidak ada
data ganda.

```
vendors (satu koleksi, dua kegunaan)
├── identitas          name, code, category, contactName, phone, address, email
├── keuangan           paymentTerm, debt, bankAccount, notes, active
└── dropship  ← BARU
    ├── platform            'Shopee' | 'Tokopedia' | 'TikTok Shop' | 'Lainnya'
    ├── shopUrl             tautan toko
    ├── rating              0–5
    ├── ratingCount         jumlah ulasan
    ├── leadTimeDays        lama proses pesanan (hari)
    ├── acceptsDropship     [WAJIB]
    ├── neutralPackaging    [WAJIB]
    ├── noInvoice           [WAJIB]
    ├── supportsCustomLogo  [nilai tambah]
    ├── hasRealPhotos       [nilai tambah]
    └── responsiveChat      [nilai tambah]
```

Produk terhubung ke vendor lewat dua kolom yang **sudah ada** di setiap produk:

```
products
├── vendorId    → id vendor pemasok (dipilih di tab Produk)
├── costPrice   → harga kulakan per pcs
└── extraCost   → biaya tambahan (packing, stiker, ongkos kirim ke Anda)
```

---

## 3. Cara sistem menilai vendor

Skor mulai dari **100**, lalu dikurangi:

**Syarat wajib — gagal satu saja = tidak layak (skor tidak menolong):**
- Menerima dropship
- Packing netral
- Tidak menyertakan invoice

**Pengurangan skor:**

| Kondisi | Potongan |
|---|---|
| Rating belum diisi | −20 |
| Rating < 4,5 | −35 |
| Rating 4,5–4,7 | −15 |
| Ulasan belum diisi | −10 |
| Ulasan < 50 | −20 |
| Ulasan 50–200 | −8 |
| Lama proses > 4 hari | −25 |
| Lama proses 3–4 hari | −10 |
| Lama proses belum diisi | −8 |
| Tiap nilai tambah yang kosong | −8 / −6 / −6 |

**Ambang kelayakan praktis:** rating ≥ 4,7 · ulasan ≥ 200 · proses ≤ 2 hari.

---

## 4. Rumus margin yang dipakai dashboard

```
HPP     = costPrice + extraCost
Admin   = harga jual × adminFeePercent%
Retur   = harga jual × 3%          ← cadangan wajib, jangan dihapus
Margin  = harga jual − HPP − Admin − Retur
```

Status yang muncul:

| Margin bersih | Status | Artinya |
|---|---|---|
| ≤ 0 | **Rugi** | Naikkan harga atau ganti vendor |
| < 15% | **Tipis** | Satu retur menghapus beberapa transaksi |
| 15–25% | **Cukup** | Aman, tapi jangan tambah diskon besar |
| > 25% | **Sehat** | Boleh ikut flash sale |
| HPP kosong | **Belum diketahui** | Isi HPP dulu — margin tidak bisa ditebak |

**Contoh nyata (Tumbler, harga jual Rp 109.000):**

```
HPP     = 62.000 + 5.000 = 67.000
Retur   = 109.000 × 3%   =  3.270
Margin  = 109.000 − 67.000 − 3.270 = 38.730  (35,5% — Sehat)
```

Kalau HPP naik jadi Rp 90.000 → margin tinggal **Rp 15.730 (14,4% — Tipis)**.
Vendor yang menaikkan harga Rp 23.000 bisa memangkas margin Anda lebih dari separuh.

---

## 5. Klaim pengiriman — SUDAH DIPERBAIKI

Sebelumnya situs menjanjikan **"Kota Cilegon (Instan 1–2 Jam)"**, menyalakan
`allowInstant` di semua zona, dan menawarkan GoSend Instant / GrabExpress SameDay
di kalkulator ongkir serta pilihan kurir admin. Semua itu **mustahil** dipenuhi
dengan dropship: kurir instan harus dijemput dari lokasi barang berada, dan vendor
tidak akan memesankannya ke alamat pembeli Anda.

Yang diubah:

| Sebelum | Sesudah |
|---|---|
| `allowInstant: true` (3 zona) | `allowInstant: false` (semua 10 zona) |
| GoSend Instant + GrabExpress SameDay di kalkulator | dihapus; sisa JNE / J&T / SiCepat |
| Navbar: "GoSend / GrabExpress Instan Area Kota Cilegon" | "Dikirim via JNE, J&T & SiCepat — Seluruh Indonesia" |
| Zona: "Kota Cilegon (Instan 1-2 Jam)" | "Kota Cilegon & Sekitarnya" |
| Estimasi lokal "1 Hari" | "2 – 3 Hari" (termasuk proses siap kirim) |
| Footer: "Instan & Nasional" | "Kirim Seluruh Indonesia" |
| Banner: "Gratis ongkir … min. Rp 300.000" | "Subsidi ongkir Rp 10.000 … min. Rp 50.000" |
| Checkout default: GoSend Instant | JNE Reguler |
| FAQ: janji tiba 1–2 jam | estimasi jujur + penjelasan kenapa instan tidak ada |
| Invoice/email: "dikirim dari Karang Asem" | "dikirim dari gudang mitra pemasok" |

Banner promo juga diperbaiki karena isinya **tidak cocok** dengan voucher
`ONGKIRCILEGON` yang sebenarnya (potongan Rp 10.000, min. Rp 50.000 — bukan
gratis ongkir min. Rp 300.000).

Alamat `Karang Asem` **tetap dipakai** sebagai identitas usaha & alamat penagihan
di invoice — yang dihapus hanya klaim bahwa paket berangkat dari sana.

---

## 6. Prosedur harian

### Sebelum jualan (sekali per vendor)
1. Chat vendor: *"Bisa dropship? Kirim ke alamat pembeli, packing netral, tanpa invoice?"* Simpan jawabannya.
2. Beli **1 unit sampel**. Periksa: ada nama toko lain di box? ada nota harga di dalam?
3. Foto produk sampel sendiri untuk katalog — jangan pakai foto milik vendor.
4. Isi vendor di **Keuangan → Vendor**, centang 3 syarat wajib.
5. Isi **HPP** per produk di tab Produk.
6. Buka tab **Dropship** — pastikan vendor berstatus *Layak*.

### Setiap ada pesanan
1. Pastikan pembayaran **LUNAS** sebelum memesan ke vendor.
2. Pesan dengan alamat pembeli sebagai alamat pengiriman.
3. Tulis di catatan vendor: *"DROPSHIP — packing netral, tanpa invoice/harga di dalam paket."*
4. Simpan nomor pesanan vendor di catatan internal pesanan.
5. Input nomor resi di dashboard.

### Kalau ada masalah
1. Klaim ke vendor **dulu** sebelum mengganti ke pembeli.
2. Vendor menolak? Ganti dulu ke pembeli, lalu hentikan pemakaian vendor itu.
3. Catat insiden di kolom catatan vendor — dasar memutuskan pindah pemasok.

---

## 7. Endpoint

| Metode | Path | Fungsi |
|---|---|---|
| GET | `/api/admin/dropship` | Skor semua vendor + margin per produk + cakupan |
| GET | `/api/admin/dropship/checklist` | Prosedur & daftar larangan |
| POST/PUT/DELETE | `/api/admin/vendors` | CRUD vendor (termasuk kolom dropship) |

Semua butuh sesi admin. Modul penilaian: `server/dropship.js`.
