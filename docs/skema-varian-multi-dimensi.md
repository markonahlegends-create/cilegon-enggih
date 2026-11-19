# Skema Varian Multi-Dimensi (Model × Ukuran × Warna)

Status: **USULAN — menunggu review pemilik toko**. Belum ada kode yang diubah.

---

## 1. Masalah dengan skema sekarang

Saat ini `ProductVariant` adalah **daftar datar** (flat list). Satu varian = satu baris
dengan satu harga. Ini cukup untuk produk yang hanya punya **satu** dimensi pilihan
(mis. kaos: cuma ukuran), tapi patah begitu ada tiga dimensi seperti yang Anda minta.

Contoh nyata di katalog sekarang — gantungan kunci (`prod-1`):

```ts
variants: [
  { id: 'kc-single', label: 'Satuan (1 Pcs)',              price: 20000 },
  { id: 'kc-pack3',  label: 'Paket Hemat 3 Pcs (Rp 17rb/pcs)', price: 51000 },
  { id: 'kc-pack5',  label: 'Paket Oleh-Oleh 5 Pcs (Rp 15rb/pcs)', price: 75000 }
]
```

Kalau produk ini punya Model (2) × Ukuran (5) × Warna (3), cara lama memaksa admin
menulis **2 × 5 × 3 = 30 baris** dengan nama gabungan seperti
`"Oversize / XL / Navy"`. Akibatnya:

| Masalah | Dampak nyata |
|---|---|
| Nama varian jadi kalimat panjang | Tombol di HP berdesakan, susah dibaca |
| Admin salah ketik / lupa satu kombinasi | Pembeli tidak bisa memilih kombinasi itu |
| Ubah harga semua warna Navy | Harus edit 10 baris satu per satu |
| Tidak ada hubungan antar-pilihan | Tidak bisa tampilkan "Warna: Navy" terpisah dari "Ukuran: XL" |
| Stok tidak bisa dilacak per kombinasi | Stok ada di baris gabungan, laporannya tidak jelas |

Yang perlu diubah: dari **daftar datar** menjadi **kelompok pilihan (option groups) +
kombinasi (combos)**. Ini model yang dipakai Shopee/Tokopedia karena terbukti
menangani 3 dimensi tanpa meledak.

---

## 2. Skema usulan

### 2.1 Tipe data

```ts
/** Satu nilai pilihan, mis. "XL" atau "Navy". */
export interface ProductOptionValue {
  id: string;        // 'xl' — dipakai di URL, keranjang, dan pesanan
  label: string;     // 'XL' — yang dilihat pembeli
  /**
   * Selisih harga terhadap basePrice. Boleh negatif (mis. model tanpa resleting
   * lebih murah). 0 = tidak mengubah harga.
   *
   * KENAPA SELISIH, BUKAN HARGA MATI: dengan 3 dimensi ada 30 kombinasi. Kalau
   * tiap kombinasi menyimpan harga mati, mengubah harga dasar produk berarti
   * mengedit 30 angka. Dengan selisih, cukup 1 angka.
   */
  priceDelta?: number;
  /** Kode warna untuk swatch (mis. '#1B365D'). Kosong = tombol teks biasa. */
  colorHex?: string;
  /** Foto khusus nilai ini (mis. foto warna Navy). */
  image?: string;
  /** false = disembunyikan (stok habis total / dihentikan). Default true. */
  available?: boolean;
  /** Urutan tampil. Kosong = urut sesuai array. */
  sortOrder?: number;
}

/** Satu dimensi pilihan, mis. "Ukuran". */
export interface ProductOptionGroup {
  id: string;                 // 'ukuran'
  name: string;               // 'Ukuran'
  /** 'button' = tombol teks, 'swatch' = kotak warna, 'select' = dropdown. */
  display?: 'button' | 'swatch' | 'select';
  /** true = pembeli WAJIB memilih (default). false = boleh kosong. */
  required?: boolean;
  values: ProductOptionValue[];
}

/**
 * Kombinasi spesifik yang harganya/stoknya BERBEDA dari hasil penjumlahan
 * selisih. Hanya diisi bila memang perlu — tidak wajib lengkap.
 */
export interface ProductCombination {
  /** ID nilai per grup, urut sesuai optionGroups. ['oversize','xl','navy'] */
  optionValueIds: string[];
  /** Harga akhir. Kosong = basePrice + jumlah priceDelta. */
  price?: number;
  originalPrice?: number;
  /** Stok kombinasi ini. Kosong = pakai stok produk. */
  stock?: number;
  /** SKU internal (opsional, untuk gudang). */
  sku?: string;
  image?: string;
  available?: boolean;
}
```

Dan di dalam `Product`:

```ts
export interface Product {
  price: number;            // harga dasar (dipakai bila produk tanpa pilihan)
  variants?: ProductVariant[];      // LAMA — dipertahankan agar data lama tetap jalan
  optionGroups?: ProductOptionGroup[];   // BARU
  combinations?: ProductCombination[];   // BARU — hanya yang menyimpang
}
```

---

## 3. Aturan harga (paling penting)

### 3.1 Rumus

```
harga = combo.price  ??  (product.price + Σ priceDelta nilai yang dipilih)
```

Kombinasi menang kalau ada; kalau tidak, dihitung dari selisih. Artinya admin
**boleh** hanya mengisi 2–3 kombinasi yang istimewa dan sisanya otomatis benar.

### 3.2 Contoh nyata — Kaos Distro (`prod-3`, harga dasar Rp 115.000)

```ts
optionGroups: [
  {
    id: 'model', name: 'Model', display: 'button',
    values: [
      { id: 'reguler', label: 'Reguler Fit', priceDelta: 0 },
      { id: 'oversize', label: 'Oversize',   priceDelta: 15000 }
    ]
  },
  {
    id: 'ukuran', name: 'Ukuran', display: 'button',
    values: [
      { id: 's',   label: 'S',   priceDelta: 0 },
      { id: 'm',   label: 'M',   priceDelta: 0 },
      { id: 'l',   label: 'L',   priceDelta: 0 },
      { id: 'xl',  label: 'XL',  priceDelta: 10000 },
      { id: 'xxl', label: 'XXL', priceDelta: 20000 }
    ]
  },
  {
    id: 'warna', name: 'Warna', display: 'swatch',
    values: [
      { id: 'putih', label: 'Putih', priceDelta: 0,       colorHex: '#F6F1E6' },
      { id: 'hitam', label: 'Hitam', priceDelta: 0,       colorHex: '#1F2937' },
      { id: 'navy',  label: 'Navy',  priceDelta: 0,       colorHex: '#1B365D' }
    ]
  }
]
```

Hasil otomatis (tanpa menulis 30 baris):

| Pilihan | Hitungan | Harga |
|---|---|---|
| Reguler Fit / M / Putih | 115.000 + 0 + 0 + 0 | **Rp 115.000** |
| Reguler Fit / XL / Navy | 115.000 + 0 + 10.000 + 0 | **Rp 125.000** |
| Oversize / XXL / Hitam | 115.000 + 15.000 + 20.000 + 0 | **Rp 150.000** |

### 3.3 Contoh dengan kombinasi istimewa — Tote Bag (`prod-9`, dasar Rp 68.000)

```ts
optionGroups: [
  { id: 'model', name: 'Model', values: [
      { id: 'resleting', label: 'Resleting Utama',   priceDelta: 0 },
      { id: 'kancing',   label: 'Kancing Magnetik',  priceDelta: -4000 }
  ]}
]

combinations: [
  {
    // Kancing + warna Cream ternyata stoknya kosong di gudang mitra
    optionValueIds: ['kancing', 'cream'],
    stock: 0,
    available: false
  },
  {
    // Pembelian 30 pcs kancing dapat harga vendor khusus — di bawah harga rumus
    optionValueIds: ['kancing', 'cream'],
    price: 60000,
    stock: 12
  }
]
```

Kancing + Cream = **Rp 60.000** (kombinasi menang), Kancing + Navy =
68.000 − 4.000 = **Rp 64.000** (rumus), Resleting + apa pun = **Rp 68.000**.

### 3.4 Aturan yang ditegakkan server

| Aturan | Alasan |
|---|---|
| `price` akhir tidak boleh < 0 | Menghindari harga negatif dari selisih besar |
| `priceDelta` maksimal ±50% harga dasar | Salah ketik `150000` vs `15000` langsung terlihat |
| `originalPrice` ≥ `price` | Coret harga tidak boleh lebih murah dari harga jual |
| Semua grup `required` wajib punya 1 nilai terpilih | Pesanan tidak boleh ambigu |
| Harga yang dipakai = hitung ulang di server | Harga kiriman browser tidak pernah dipercaya (sudah berlaku) |
| Maks 3 grup, maks 20 nilai per grup | Membatasi 60 kombinasi; di atas itu UX hancur |

---

## 4. Dampak ke halaman-halaman

| Bagian | Perubahan |
|---|---|
| **PDP** | 3 baris chip terpisah (Model / Ukuran / Warna). Harga & stok ikut kombinasi terpilih. Opsi yang stoknya habis dinonaktifkan dengan label "habis". Galeri ikut `image` nilai terpilih (Navy → foto Navy). |
| **Keranjang** | Kunci item = `produk::model,ukuran,warna` supaya 3 kombinasi berbeda tidak tergabung jadi satu baris. |
| **Pesanan / invoice / WhatsApp** | Baris pesanan menyimpan `options: [{ group: 'Model', value: 'Oversize' }, …]`, bukan satu string panjang. |
| **Admin editor** | Bagian baru "Pilihan & Kombinasi": tambah grup → tambah nilai → isi selisih harga. Tabel kombinasi hanya menampilkan baris yang **perlu diubah** (bisa difilter "hanya yang berbeda"). Penanda otomatis bila ada kombinasi tanpa harga. |
| **Data lama** | Produk dengan `variants[]` tetap jalan. Server mengonversinya saat dibaca menjadi 1 grup bernama "Pilihan" berisi nilai-nilai lama. Tidak ada data hilang, tidak perlu migrasi manual. |

---

## 5. Perbandingan dengan cara lama

| Aspek | Sekarang (flat) | Usulan (grup + kombinasi) |
|---|---|---|
| Menambah warna baru | edit 10 baris | tambah 1 nilai |
| Naikkan harga semua XL | edit 6 baris | edit 1 angka |
| Stok per kombinasi | tidak bisa akurat | bisa |
| Swatch warna | tidak mungkin | bisa |
| Tampilan HP 3 dimensi | 30 tombol panjang | 3 baris rapi |
| Risiko salah ketik | tinggi | rendah (banyak yang otomatis) |
| Kerumitan admin | rendah untuk 1 dimensi | sedikit lebih tinggi, tapi ada mode ringkas |

Kelemahan yang jujur: skema ini **lebih rumit** untuk produk yang cuma punya 1 pilihan
(mis. payung: hanya warna). Karena itu `variants[]` lama **tidak dihapus** —
produk 1 dimensi tetap pakai cara lama. Skema baru hanya dipakai produk yang memang
butuh 3 dimensi.

---

## 6. Urutan pengerjaan (kalau disetujui)

1. **Tipe + normalisasi server** — `optionGroups` / `combinations` diteruskan `cleanProduct`, plus konversi data lama.
2. **PDP** — 3 baris chip, harga/stok/kombinasi, disable opsi habis, galeri per nilai.
3. **Keranjang & pesanan** — kunci item + baris pesanan `options[]`.
4. **Admin editor** — panel "Pilihan & Kombinasi".
5. **Isi data** — mulai dari Kaos (Model × Ukuran × Warna) setelah Anda tentukan angkanya.

---

## 7. Yang perlu keputusan Anda

1. **Selisih harga atau harga mati?** Usulan saya: selisih (cukup isi `0` untuk yang tidak menambah biaya). Kalau Anda lebih nyaman melihat harga akhir per kombinasi, saya bisa tampilkan kolom harga akhir di admin, tapi perhitungannya tetap dari selisih.
2. **Produk mana yang dipakai sebagai contoh pertama?** Kaos Distro (Model × Ukuran × Warna) paling masuk akal.
3. **Warna memengaruhi harga?** Di kebanyakan distro tidak (hanya ukuran & model). Kalau Navy sama harganya dengan Putih, cukup `priceDelta: 0` — tidak perlu diisi.
4. **Stok dilacak per kombinasi atau per produk?** Kalau per kombinasi, admin perlu mengisi 30 sel stok. Bisa juga: stok per **ukuran** saja (lebih realistis untuk distro).
