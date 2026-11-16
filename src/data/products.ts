export type CategorySlug =
  | 'semua'
  | 'apparel-tas'
  | 'drinkware'
  | 'aksesoris-dekorasi'
  | 'perlengkapan-cetak'
  | 'paket-bundling';

export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  originalPrice?: number;
  stock: number;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductReview {
  id: string;
  user: string;
  role: string;
  rating: number;
  date: string;
  variant?: string;
  comment: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  englishSubtitle: string;
  categorySlug: Exclude<CategorySlug, 'semua'>;
  categoryLabel: string;
  image: string;
  galleryImages?: string[];
  price: number;
  priceRangeText: string;
  originalPrice: number;
  discountPercent: number;
  rating: number;
  reviewCount: number;
  soldCount: number;
  weightGrams: number;
  stock: number;
  isBestSeller?: boolean;
  isFlashDeal?: boolean;
  isBundle?: boolean;
  bundleItems?: string[];
  /** Pre-order: produk dibuat setelah pesanan masuk (7–15 hari kerja). */
  isPreOrder?: boolean;
  preOrderNote?: string;
  /** Stok dikelola manual walau ada varian. */
  stockManual?: boolean;
  badges: string[];
  description: string;
  specs: ProductSpec[];
  variants?: ProductVariant[];
  hasSizeChart?: boolean;
  minWholesaleQty: number;
  wholesalePrice: number;
  reviews: ProductReview[];
}

export const CATEGORIES: {
  slug: CategorySlug;
  label: string;
  shortLabel: string;
  description: string;
  itemsSummary: string;
}[] = [
  {
    slug: 'semua',
    label: 'Semua Koleksi',
    shortLabel: 'Semua',
    description: 'Seluruh rangkaian merchandise resmi Cilegon Enggih & Paket Hampers',
    itemsSummary: '12 Produk Pilihan'
  },
  {
    slug: 'apparel-tas',
    label: 'Apparel & Tas',
    shortLabel: 'Apparel & Tas',
    description: 'Kaos Distro Cotton Combed & Tote Bag Kanvas Premium khas Cilegon',
    itemsSummary: 'Kaos Distro, Goodie Bag/Tote Bag'
  },
  {
    slug: 'drinkware',
    label: 'Drinkware',
    shortLabel: 'Drinkware',
    description: 'Tumbler Stainless Steel Sporty 304 & Mug Keramik SNI eksklusif',
    itemsSummary: 'Tumbler Sporty, Mug Keramik'
  },
  {
    slug: 'aksesoris-dekorasi',
    label: 'Aksesoris & Dekorasi',
    shortLabel: 'Aksesoris & 3D',
    description: 'Gantungan Kunci Karet 3D, Stiker Die-Cut & Lampu Tidur 3D Arsitektur',
    itemsSummary: 'Gantungan Kunci 3D, Stiker, Lampu 3D'
  },
  {
    slug: 'perlengkapan-cetak',
    label: 'Perlengkapan & Cetak',
    shortLabel: 'Payung & Cetak',
    description: 'Payung Desain Geometris Anti-UV & Kalender Dinding Eksklusif A3',
    itemsSummary: 'Payung Geometris, Kalender A3'
  },
  {
    slug: 'paket-bundling',
    label: 'Paket Bundling / Hampers',
    shortLabel: 'Paket Bundling',
    description: 'Paket hemat oleh-oleh wisatawan & hampers hardbox eksekutif korporat',
    itemsSummary: 'Paket Hemat & Eksekutif Korporat'
  }
];

export const KAOS_SIZE_CHART = [
  { size: 'S', chest: '48 cm', length: '68 cm', shoulder: '42 cm', weightRec: '45 – 55 kg' },
  { size: 'M', chest: '50 cm', length: '70 cm', shoulder: '44 cm', weightRec: '55 – 65 kg' },
  { size: 'L', chest: '52 cm', length: '72 cm', shoulder: '46 cm', weightRec: '65 – 75 kg' },
  { size: 'XL', chest: '55 cm', length: '75 cm', shoulder: '49 cm', weightRec: '75 – 85 kg' },
  { size: 'XXL', chest: '58 cm', length: '77 cm', shoulder: '52 cm', weightRec: '85 – 100 kg' }
];

export const PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    slug: 'gantungan-kunci-karet-3d',
    name: 'Gantungan Kunci Karet 3D Landmark Cilegon',
    shortName: 'Gantungan Kunci Karet 3D',
    englishSubtitle: '3D Rubber Keychain',
    categorySlug: 'aksesoris-dekorasi',
    categoryLabel: 'Aksesoris & Dekorasi',
    image: '/products/gantungan-kunci-3d.png',
    price: 20000,
    priceRangeText: 'Rp 15.000 – Rp 25.000',
    originalPrice: 25000,
    discountPercent: 20,
    rating: 4.9,
    reviewCount: 318,
    soldCount: 1420,
    weightGrams: 55,
    stock: 280,
    isBestSeller: true,
    isFlashDeal: true,
    badges: ['Terlaris #1', 'Oleh-Oleh Favorit'],
    description:
      'Bawa selalu kebanggaan Kota Baja di setiap langkah Anda! Gantungan kunci 3D eksklusif edisi "CILEGON ENGGIH" hadir dengan detail ikonik Landmark Cilegon yang dibuat timbul (emboss) dan presisi. Menggunakan material karet PVC lentur yang awet, tahan air, serta dilengkapi ring logam kokoh. Sangat pas untuk gantungan kunci motor, mobil, tas, maupun oleh-oleh khas Cilegon yang praktis.',
    specs: [
      {
        label: 'Material',
        value: 'Karet PVC elastis berkualitas tinggi (soft PVC) dengan efek timbul (emboss) 3D detail'
      },
      {
        label: 'Ukuran',
        value: '± 7,5 cm x 4,5 cm (ketebalan ± 4 mm)'
      },
      {
        label: 'Gantungan',
        value: 'Ring dan rantai besi anti karat (stainless steel) warna silver'
      },
      {
        label: 'Finishing',
        value: 'Warna solid doff dengan detail garis arsitektur menara dan tulisan timbul "CILEGON ENGGIH"'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 15.000 – Rp 25.000 / pcs'
      }
    ],
    variants: [
      { id: 'kc-single', label: 'Satuan (1 Pcs)', price: 20000, originalPrice: 25000, stock: 200 },
      { id: 'kc-pack3', label: 'Paket Hemat 3 Pcs (Rp 17rb/pcs)', price: 51000, originalPrice: 75000, stock: 50 },
      { id: 'kc-pack5', label: 'Paket Oleh-Oleh 5 Pcs (Rp 15rb/pcs)', price: 75000, originalPrice: 125000, stock: 30 }
    ],
    minWholesaleQty: 50,
    wholesalePrice: 15000,
    reviews: [
      {
        id: 'r1',
        user: 'Dimas Setiawan',
        role: 'Karyawan BUMN Krakatau',
        rating: 5,
        date: '2 hari lalu',
        variant: 'Paket Oleh-Oleh 5 Pcs',
        comment: 'Detail emboss 3D menara simpang tiganya rapi banget! Karetnya tebal lentur nggak kaku, cocok dibagiin ke teman kantor luar kota.'
      },
      {
        id: 'r2',
        user: 'Siti Nurhaliza',
        role: 'Pembeli Terverifikasi - Serang',
        rating: 5,
        date: '5 hari lalu',
        variant: 'Satuan (1 Pcs)',
        comment: 'Warna birunya cakep, ring besinya juga tebel anti karat. Dipasang di kunci motor aman nggak bikin lecet bodi.'
      }
    ]
  },
  {
    id: 'prod-2',
    slug: 'lampu-tidur-3d-arsitektur',
    name: 'Lampu Tidur 3D Arsitektur Landmark Cilegon',
    shortName: 'Lampu Tidur 3D Arsitektur',
    englishSubtitle: '3D Architectural Night Lamp',
    categorySlug: 'aksesoris-dekorasi',
    categoryLabel: 'Aksesoris & Dekorasi',
    image: '/products/lampu-tidur-3d.png',
    price: 169000,
    priceRangeText: 'Rp 145.000 – Rp 195.000',
    originalPrice: 195000,
    discountPercent: 13,
    rating: 5.0,
    reviewCount: 124,
    soldCount: 410,
    weightGrams: 650,
    stock: 48,
    isBestSeller: true,
    isFlashDeal: true,
    badges: ['Premium Gift', '3D Craft Eksklusif'],
    description:
      'Hadirkan nuansa hangat dan elegan di kamar tidur atau meja kerja Anda dengan Lampu Tidur 3D "CILEGON ENGGIH". Mengadaptasi bentuk arsitektur ikonik Landmark Cilegon dalam detail 3D yang memukau, dipadukan dengan dudukan kayu alami beraksen cahaya warm white yang menenangkan mata. Cocok dijadikan dekorasi ruangan estetik, lampu meja, maupun kado/suvenir premium bagi kerabat dan tamu spesial.',
    specs: [
      {
        label: 'Material Bodi',
        value: 'Resin/PLA cetak 3D presisi tinggi warna translucent white (putih tembus cahaya)'
      },
      {
        label: 'Material Dudukan (Base)',
        value: 'Kayu solid natural dengan ukiran teks menyala "CILEGON ENGGIH"'
      },
      {
        label: 'Dimensi',
        value: 'Tinggi ± 22 cm, diameter base ± 11 cm'
      },
      {
        label: 'Pencahayaan',
        value: 'LED Warm White (kuning hangat) hemat daya, dilengkapi kabel USB dan tombol sakelar on/off'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 145.000 – Rp 195.000 / pcs'
      }
    ],
    variants: [
      { id: 'lamp-std', label: 'Standard Gift Box + Kabel USB', price: 169000, originalPrice: 195000, stock: 32 },
      { id: 'lamp-vip', label: 'VIP Hardbox + Kartu Ucapan Custom', price: 189000, originalPrice: 215000, stock: 16 }
    ],
    minWholesaleQty: 20,
    wholesalePrice: 145000,
    reviews: [
      {
        id: 'r3',
        user: 'Ir. Bambang Suryono',
        role: 'General Manager Industri Kimia Cilegon',
        rating: 5,
        date: '3 hari lalu',
        variant: 'VIP Hardbox + Kartu Ucapan Custom',
        comment: 'Kami pesan 15 unit untuk cendera mata tamu ekspatriat Jepang & Korea. Mereka sangat kagum dengan presisi struktur tangga dalam menara 3D-nya!'
      },
      {
        id: 'r4',
        user: 'Ayu Lestari',
        role: 'Pembeli Terverifikasi - Cibeber',
        rating: 5,
        date: '1 minggu lalu',
        variant: 'Standard Gift Box + Kabel USB',
        comment: 'Cahaya warm white-nya beneran nyaman di mata pas malam hari. Tulisan Cilegon Enggih di kayu bawahnya ikutan nyala elegan.'
      }
    ]
  },
  {
    id: 'prod-3',
    slug: 'kalender-dinding-eksklusif-a3',
    name: 'Kalender Dinding Eksklusif Ukuran A3 (Edisi 2027)',
    shortName: 'Kalender Dinding A3',
    englishSubtitle: 'Exclusive A3 Wall Calendar',
    categorySlug: 'perlengkapan-cetak',
    categoryLabel: 'Perlengkapan & Cetak',
    image: '/products/kalender-dinding-a3.png',
    price: 42000,
    priceRangeText: 'Rp 35.000 – Rp 50.000',
    originalPrice: 50000,
    discountPercent: 16,
    rating: 4.9,
    reviewCount: 96,
    soldCount: 530,
    weightGrams: 320,
    stock: 190,
    badges: ['Edisi 2027 Terbaru', 'Art Carton 260gsm'],
    description:
      'Atur jadwal harian Anda dengan penuh inspirasi bersama Kalender Dinding A3 edisi "CILEGON ENGGIH". Dicetak di atas kertas Art Carton tebal dengan ilustrasi eksklusif ikon kebanggaan Cilegon yang tajam dan cerah. Dilengkapi jilid spiral kokoh serta ruang catatan khusus untuk membantu mencatat agenda penting sepanjang bulan. Pilihan tepat untuk dekorasi dinding rumah, kantor, maupun merchandise acara.',
    specs: [
      {
        label: 'Ukuran',
        value: 'A3 (29,7 cm x 42 cm)'
      },
      {
        label: 'Material Kertas',
        value: 'Art Carton 230 gsm / 260 gsm (tebal, kokoh, dan permukaan halus)'
      },
      {
        label: 'Jilid',
        value: 'Spiral kawat (wire-o) putih/hitam lengkap dengan gantungan dinding (hanger)'
      },
      {
        label: 'Isi & Desain',
        value: 'Ilustrasi vektor Landmark Cilegon full-color, dilengkapi kolom catatan (notes) di bagian bawah'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 35.000 – Rp 50.000 / pcs'
      }
    ],
    variants: [
      { id: 'cal-230', label: 'Art Carton 230 gsm (Spiral Putih)', price: 39000, originalPrice: 45000, stock: 100 },
      { id: 'cal-260', label: 'Art Carton 260 gsm Tebal (Spiral Hitam)', price: 45000, originalPrice: 50000, stock: 90 }
    ],
    minWholesaleQty: 50,
    wholesalePrice: 35000,
    reviews: [
      {
        id: 'r5',
        user: 'Fajar Ramadhan',
        role: 'Staf Pemkot Cilegon',
        rating: 5,
        date: '4 hari lalu',
        variant: 'Art Carton 260 gsm Tebal',
        comment: 'Ilustrasi menaranya berasa poster art print! Kertasnya tebal banget dan ada kolom catatan agenda di bawah tanggalan.'
      }
    ]
  },
  {
    id: 'prod-4',
    slug: 'kaos-distro-cilegon-enggih',
    name: 'Kaos / T-Shirt Distro Edisi Cilegon Enggih',
    shortName: 'Kaos Distro Cilegon Enggih',
    englishSubtitle: 'Premium Cotton Combed T-Shirt',
    categorySlug: 'apparel-tas',
    categoryLabel: 'Apparel & Tas',
    image: '/products/kaos-distro.png',
    price: 115000,
    priceRangeText: 'Rp 95.000 – Rp 135.000',
    originalPrice: 135000,
    discountPercent: 15,
    rating: 4.9,
    reviewCount: 275,
    soldCount: 980,
    weightGrams: 260,
    stock: 165,
    isBestSeller: true,
    isFlashDeal: true,
    hasSizeChart: true,
    badges: ['Best Seller Apparel', 'Cotton Combed 24s'],
    description:
      'Tampil kasual dan bangga dengan identitas lokal lewat Kaos "CILEGON ENGGIH". Mengusung desain ilustrasi modern Landmark Cilegon di atas bahan Cotton Combed yang sejuk dan nyaman dipakai seharian. Hasil sablon tajam, lentur, dan tidak mudah pecah meski dicuci berulang kali. Cocok untuk outfit harian, hangout, hingga buah tangan wajib saat berkunjung ke Kota Cilegon.',
    specs: [
      {
        label: 'Material Kain',
        value: '100% Cotton Combed 24s / 30s (adem, lembut, menyerap keringat, tidak menerawang)'
      },
      {
        label: 'Warna Kaos',
        value: 'Hitam pekat (Jet Black)'
      },
      {
        label: 'Jenis Sablon',
        value: 'Sablon DTF (Direct Transfer Film) / Plastisol kualitas tinggi dengan detail ilustrasi Landmark Cilegon dan tipografi "CILEGON ENGGIH"'
      },
      {
        label: 'Ukuran Tersedia',
        value: 'S, M, L, XL, XXL (potongan regular fit unisex)'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 95.000 – Rp 135.000 / pcs'
      }
    ],
    variants: [
      { id: 'ts-s', label: 'Ukuran S (48 x 68 cm)', price: 110000, originalPrice: 130000, stock: 25 },
      { id: 'ts-m', label: 'Ukuran M (50 x 70 cm)', price: 115000, originalPrice: 135000, stock: 40 },
      { id: 'ts-l', label: 'Ukuran L (52 x 72 cm)', price: 115000, originalPrice: 135000, stock: 50 },
      { id: 'ts-xl', label: 'Ukuran XL (55 x 75 cm)', price: 120000, originalPrice: 135000, stock: 35 },
      { id: 'ts-xxl', label: 'Ukuran XXL (58 x 77 cm)', price: 125000, originalPrice: 145000, stock: 15 }
    ],
    minWholesaleQty: 24,
    wholesalePrice: 95000,
    reviews: [
      {
        id: 'r6',
        user: 'Reza Mahendra',
        role: 'Pembeli Terverifikasi - Jakarta Barat',
        rating: 5,
        date: '1 hari lalu',
        variant: 'Ukuran L (52 x 72 cm)',
        comment: 'Kain Jet Black-nya adem banget dipakai cuaca Cilegon yang panas. Sablon plastisol emas & silvernya kelihatan distro kelas atas!'
      },
      {
        id: 'r7',
        user: 'Dinda Permata',
        role: 'Pembeli Terverifikasi - Cilegon',
        rating: 5,
        date: '6 hari lalu',
        variant: 'Ukuran M (50 x 70 cm)',
        comment: 'Size chart akurat, jahitan rantai rapi sampai bagian kerah dalam ada label Cilegon Enggih-nya.'
      }
    ]
  },
  {
    id: 'prod-5',
    slug: 'mug-keramik-souvenir',
    name: 'Mug Keramik Souvenir Landmark Cilegon',
    shortName: 'Mug Keramik Souvenir',
    englishSubtitle: 'Ceramic Coffee Mug 11 oz',
    categorySlug: 'drinkware',
    categoryLabel: 'Drinkware',
    image: '/products/mug-keramik.png',
    price: 38000,
    priceRangeText: 'Rp 30.000 – Rp 45.000',
    originalPrice: 45000,
    discountPercent: 16,
    rating: 4.8,
    reviewCount: 162,
    soldCount: 740,
    weightGrams: 480,
    stock: 210,
    badges: [' Keramik SNI', 'Free Box Pelindung'],
    description:
      'Temani momen ngopi atau ngeteh pagi Anda dengan Mug Keramik "CILEGON ENGGIH". Dihiasi ilustrasi artistik Landmark Cilegon dengan warna cerah yang menyatu sempurna pada lapisan keramik glossy. Gagang ergonomis yang nyaman digenggam serta material keramik tebal yang menjaga suhu minuman lebih lama. Sangat cocok sebagai suvenir perusahaan, hadiah, atau koleksi pribadi.',
    specs: [
      {
        label: 'Material',
        value: 'Keramik porselen standar SNI, food grade, tahan panas dan aman untuk microwave'
      },
      {
        label: 'Kapasitas',
        value: '11 oz (± 325 ml)'
      },
      {
        label: 'Warna',
        value: 'Putih glossy dengan cetak sublimation coating penuh warna'
      },
      {
        label: 'Kemasan',
        value: 'Dilengkapi box satuan putih/kraft pelindung + bubble wrap tebal'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 30.000 – Rp 45.000 / pcs'
      }
    ],
    variants: [
      { id: 'mug-whitebox', label: 'Mug + Box Putih Standar', price: 38000, originalPrice: 45000, stock: 140 },
      { id: 'mug-kraft', label: 'Mug + Gift Box Kraft Pita', price: 43000, originalPrice: 50000, stock: 70 }
    ],
    minWholesaleQty: 36,
    wholesalePrice: 30000,
    reviews: [
      {
        id: 'r8',
        user: 'Rina Wulandari',
        role: 'HRD Perusahaan Kawasan KIEC',
        rating: 5,
        date: '5 hari lalu',
        variant: 'Mug + Gift Box Kraft Pita',
        comment: 'Packing sangat aman berlapis-lapis, tidak ada satupun yang retak. Hasil cetak warnanya tajam persis foto.'
      }
    ]
  },
  {
    id: 'prod-6',
    slug: 'stiker-vinyl-die-cut',
    name: 'Stiker Vinyl Die-Cut Landmark Cilegon',
    shortName: 'Stiker Vinyl Die-Cut',
    englishSubtitle: 'Weatherproof Die-Cut Sticker',
    categorySlug: 'aksesoris-dekorasi',
    categoryLabel: 'Aksesoris & Dekorasi',
    image: '/products/stiker-die-cut.png',
    price: 8000,
    priceRangeText: 'Rp 5.000 – Rp 10.000 / Paket Rp 20.000',
    originalPrice: 10000,
    discountPercent: 20,
    rating: 4.9,
    reviewCount: 412,
    soldCount: 2350,
    weightGrams: 25,
    stock: 500,
    badges: ['Tahan Cuaca', 'Paket 3 Pcs Rp 20rb'],
    description:
      'Ekspresikan kecintaan Anda pada Kota Cilegon di mana saja dengan Stiker Die-Cut "CILEGON ENGGIH". Dicetak menggunakan bahan vinyl tahan cuaca dan dilapisi laminasi anti gores sehingga warna tetap awet meski ditempel di luar ruangan. Cocok ditempel pada laptop, casing HP, helm, tumbler, koper, hingga kaca kendaraan.',
    specs: [
      {
        label: 'Material',
        value: 'Vinyl susu / transparan kualitas premium (tahan air, tahan panas matahari, dan tidak meninggalkan bekas lem)'
      },
      {
        label: 'Laminasi',
        value: 'Laminasi Doff / Glossy anti gores'
      },
      {
        label: 'Ukuran',
        value: '± 8 cm x 10 cm (potong mengikuti pola/kontur desain die-cut)'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 5.000 – Rp 10.000 / pcs (atau Rp 20.000 paket isi 3 pcs)'
      }
    ],
    variants: [
      { id: 'stk-doff-1', label: 'Satuan Laminasi Doff (1 Pcs)', price: 8000, originalPrice: 10000, stock: 200 },
      { id: 'stk-glossy-1', label: 'Satuan Laminasi Glossy (1 Pcs)', price: 8000, originalPrice: 10000, stock: 150 },
      { id: 'stk-pack-3', label: 'Paket Hemat Isi 3 Pcs (Campur)', price: 20000, originalPrice: 30000, stock: 150 }
    ],
    minWholesaleQty: 100,
    wholesalePrice: 5000,
    reviews: [
      {
        id: 'r9',
        user: 'Bagas Prakoso',
        role: 'Mahasiswa FT Untirta Cilegon',
        rating: 5,
        date: '2 hari lalu',
        variant: 'Paket Hemat Isi 3 Pcs (Campur)',
        comment: 'Ditempel di MacBook sama helm harian kehujanan tetap awet nggak luntur sama sekali. Potongan die-cut halus!'
      }
    ]
  },
  {
    id: 'prod-7',
    slug: 'tumbler-stainless-steel-sporty',
    name: 'Tumbler Stainless Steel Sporty 304 Cilegon Enggih',
    shortName: 'Tumbler Stainless Sporty',
    englishSubtitle: 'Sporty Stainless Steel 304 Tumbler',
    categorySlug: 'drinkware',
    categoryLabel: 'Drinkware',
    image: '/products/tumbler-sporty.png',
    price: 109000,
    priceRangeText: 'Rp 85.000 – Rp 125.000',
    originalPrice: 125000,
    discountPercent: 13,
    rating: 4.9,
    reviewCount: 209,
    soldCount: 865,
    weightGrams: 390,
    stock: 115,
    isBestSeller: true,
    isFlashDeal: true,
    badges: ['UV Print Timbul 360°', 'Stainless 304 BPA-Free'],
    description:
      'Tetap terhidrasi dengan gaya elegan menggunakan Tumbler "CILEGON ENGGIH". Didesain dengan bodi metalik ergonomis yang mantap digenggam serta tutup pengunci anti bocor, sangat praktis dibawa bekerja, berolahraga, maupun bepergian. Cetakan UV Print bertekstur menampilkan ikon Landmark Cilegon secara tajam dan mewah, menjadikannya pilihan suvenir eksklusif yang fungsional.',
    specs: [
      {
        label: 'Material',
        value: 'Stainless Steel 304 (bagian dalam) & finishing matte metallic (bagian luar), BPA Free'
      },
      {
        label: 'Kapasitas',
        value: '± 500 ml – 600 ml'
      },
      {
        label: 'Fitur',
        value: 'Tutup model flip-lock anti tumpah dengan pegangan (carry loop) dan lekukan bodi ergonomis'
      },
      {
        label: 'Cetak Desain',
        value: 'UV Print 360 derajat timbul bertekstur untuk ilustrasi Landmark Cilegon dan tulisan "CILEGON ENGGIH"'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 85.000 – Rp 125.000 / pcs'
      }
    ],
    variants: [
      { id: 'tmb-500', label: 'Gunmetal Matte 550 ml (Reguler)', price: 109000, originalPrice: 125000, stock: 85 },
      { id: 'tmb-custom', label: 'Gunmetal Matte + Grafir Nama Laser', price: 124000, originalPrice: 140000, stock: 30 }
    ],
    minWholesaleQty: 25,
    wholesalePrice: 85000,
    reviews: [
      {
        id: 'r10',
        user: 'Andika Pratama',
        role: 'Engineer Plant Ciwandan',
        rating: 5,
        date: '1 hari lalu',
        variant: 'Gunmetal Matte + Grafir Nama Laser',
        comment: 'Dibawa ke lapangan pabrik seharian es batu masih awet dingin sampai sore. Cetakan UV-nya timbul bertekstur mewah banget!'
      }
    ]
  },
  {
    id: 'prod-8',
    slug: 'payung-desain-geometris',
    name: 'Payung Lipat / Standar Desain Geometris Cilegon Enggih',
    shortName: 'Payung Desain Geometris',
    englishSubtitle: 'Geometric Navy-Tosca Umbrella',
    categorySlug: 'perlengkapan-cetak',
    categoryLabel: 'Perlengkapan & Cetak',
    image: '/products/payung-geometris.png',
    price: 95000,
    priceRangeText: 'Rp 75.000 – Rp 110.000',
    originalPrice: 110000,
    discountPercent: 14,
    rating: 4.9,
    reviewCount: 138,
    soldCount: 490,
    weightGrams: 520,
    stock: 92,
    badges: ['Anti-UV Pongee', 'Gagang Kayu J-Handle'],
    description:
      'Siap menghadapi cuaca hujan maupun terik matahari dengan Payung Eksklusif "CILEGON ENGGIH". Memadukan kain pongee tebal yang cepat kering dengan gagang kayu klasik yang nyaman digenggam. Tampilan panel payung tampil beda lewat perpaduan pola geometris modern dan ilustrasi ikonik Landmark Cilegon. Fungsional, tangguh, dan sangat berkelas untuk suvenir instansi maupun pemakaian harian.',
    specs: [
      {
        label: 'Material Kain',
        value: 'Pongee / Polyester tebal anti UV dengan lapisan tahan air (water-repellent)'
      },
      {
        label: 'Rangka & Gagang',
        value: 'Rangka besi/fiber kokoh tahan angin dengan gagang kayu melengkung klasik (J-handle)'
      },
      {
        label: 'Diameter Terbuka',
        value: '± 100 cm – 105 cm (8 panel)'
      },
      {
        label: 'Desain',
        value: 'Kombinasi motif geometris modern warna navy-tosca dan ilustrasi Landmark Cilegon bertuliskan "CILEGON ENGGIH"'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 75.000 – Rp 110.000 / pcs'
      }
    ],
    variants: [
      { id: 'umb-jhandle', label: 'Model Standar Gagang Kayu J-Handle', price: 95000, originalPrice: 110000, stock: 55 },
      { id: 'umb-fold', label: 'Model Lipat Praktis Anti-Angin', price: 89000, originalPrice: 105000, stock: 37 }
    ],
    minWholesaleQty: 30,
    wholesalePrice: 75000,
    reviews: [
      {
        id: 'r11',
        user: 'Hj. Ratna Dewi',
        role: 'Instansi Perbankan Cilegon',
        rating: 5,
        date: '3 hari lalu',
        variant: 'Model Standar Gagang Kayu J-Handle',
        comment: 'Perpaduan warna navy dan hijau tosca-nya elegan sekali, gagang kayunya bikin kelihatan mahal seperti payung hotel bintang 5.'
      }
    ]
  },
  {
    id: 'prod-9',
    slug: 'tote-bag-kanvas-premium',
    name: 'Goodie Bag / Tote Bag Kanvas Premium Cilegon Enggih',
    shortName: 'Tote Bag Kanvas Premium',
    englishSubtitle: 'Premium Canvas Tote Bag with Side Pocket',
    categorySlug: 'apparel-tas',
    categoryLabel: 'Apparel & Tas',
    image: '/products/tote-bag-kanvas.png',
    price: 68000,
    priceRangeText: 'Rp 55.000 – Rp 80.000',
    originalPrice: 80000,
    discountPercent: 15,
    rating: 4.9,
    reviewCount: 184,
    soldCount: 675,
    weightGrams: 310,
    stock: 140,
    isBestSeller: true,
    badges: ['Kanvas Marsoto Tebal', 'Ada Saku Samping'],
    description:
      'Bawa seluruh kebutuhan harian Anda dengan praktis dan penuh gaya menggunakan Tote Bag Kanvas "CILEGON ENGGIH". Terbuat dari bahan kanvas tebal berjahitan rapi, dilengkapi kompartemen utama yang luas serta saku samping praktis untuk menyimpan botol minum atau buku catatan. Desain ilustrasi Landmark Cilegon yang modern menjadikannya tas serbaguna yang estetik untuk kuliah, kerja, belanja, maupun goodie bag acara resmi.',
    specs: [
      {
        label: 'Material',
        value: 'Kain Kanvas Marsoto / Kanvas Drill tebal dan berserat halus'
      },
      {
        label: 'Ukuran',
        value: '± 35 cm x 40 cm x 10 cm (dilengkapi ruang bawah/gusset dan saku samping fungsional)'
      },
      {
        label: 'Warna & Tali',
        value: 'Kombinasi warna krem natural (broken white) dengan aksen bawah dan tali bahu warna hijau tua (forest green) dan navy'
      },
      {
        label: 'Sablon',
        value: 'Sablon DTF / Screen Printing high-definition ilustrasi Landmark Cilegon dan teks "CILEGON ENGGIH"'
      },
      {
        label: 'Rekomendasi Harga Retail',
        value: 'Rp 55.000 – Rp 80.000 / pcs'
      }
    ],
    variants: [
      { id: 'tb-zipper', label: 'Resleting Utama + Saku Samping', price: 68000, originalPrice: 80000, stock: 95 },
      { id: 'tb-magnet', label: 'Kancing Magnetik + Saku Samping', price: 64000, originalPrice: 75000, stock: 45 }
    ],
    minWholesaleQty: 30,
    wholesalePrice: 55000,
    reviews: [
      {
        id: 'r12',
        user: 'Nabila Putri',
        role: 'Pembeli Terverifikasi - Bandung',
        rating: 5,
        date: '2 hari lalu',
        variant: 'Resleting Utama + Saku Samping',
        comment: 'Jatuh cinta sama kombinasi warna krem & forest green-nya! Muat laptop 14 inch plus tumbler masuk di saku sampingnya.'
      }
    ]
  },
  // PAKET BUNDLING / HAMPERS (Requirement Section 3 & 4)
  {
    id: 'bundle-1',
    slug: 'paket-hemat-wisatawan',
    name: 'Paket Hemat Wisatawan Cilegon Enggih (3-in-1)',
    shortName: 'Paket Hemat Wisatawan',
    englishSubtitle: 'Traveler Value Souvenir Bundle',
    categorySlug: 'paket-bundling',
    categoryLabel: 'Paket Bundling / Hampers',
    image: '/products/kaos-distro.png',
    galleryImages: [
      '/products/kaos-distro.png',
      '/products/gantungan-kunci-3d.png',
      '/products/stiker-die-cut.png'
    ],
    price: 129000,
    priceRangeText: 'Hemat Rp 14.000 dari harga satuan',
    originalPrice: 143000,
    discountPercent: 10,
    rating: 5.0,
    reviewCount: 87,
    soldCount: 315,
    weightGrams: 350,
    stock: 80,
    isBundle: true,
    hasSizeChart: true,
    bundleItems: [
      '1x Kaos / T-Shirt Distro Cotton Combed (Bebas Pilih Ukuran S–XXL)',
      '1x Gantungan Kunci Karet 3D Landmark Cilegon',
      '1x Stiker Vinyl Die-Cut Tahan Cuaca',
      'Bonus Pouch Ziplock Oleh-Oleh Khas Cilegon Enggih'
    ],
    badges: ['Bundling Hemat', 'Favorit Wisatawan'],
    description:
      'Solusi praktis dan hemat bagi wisatawan maupun perantau yang ingin membawa pulang buah tangan khas Kota Baja! Paket Hemat Wisatawan menggabungkan tiga produk terfavorit Cilegon Enggih sekaligus: Kaos Distro Cotton Combed yang sejuk, Gantungan Kunci Karet 3D timbul, dan Stiker Vinyl Die-Cut tahan air dalam kemasan siap hadiah.',
    specs: [
      { label: 'Isi Paket', value: '1 Kaos Distro + 1 Gantungan Kunci Karet 3D + 1 Stiker Vinyl Die-Cut' },
      { label: 'Kemasan', value: 'Ziplock Matte Frosted Eksklusif + Kartu Cerita Landmark Cilegon' },
      { label: 'Pilihan Ukuran Kaos', value: 'S, M, L, XL, XXL (Unisex Regular Fit)' }
    ],
    variants: [
      { id: 'bw-m', label: 'Paket Kaos Ukuran M', price: 129000, originalPrice: 143000, stock: 25 },
      { id: 'bw-l', label: 'Paket Kaos Ukuran L', price: 129000, originalPrice: 143000, stock: 30 },
      { id: 'bw-xl', label: 'Paket Kaos Ukuran XL', price: 132000, originalPrice: 148000, stock: 25 }
    ],
    minWholesaleQty: 20,
    wholesalePrice: 112000,
    reviews: [
      {
        id: 'r13',
        user: 'Hendrik Kusuma',
        role: 'Wisatawan Bisnis - Surabaya',
        rating: 5,
        date: '3 hari lalu',
        variant: 'Paket Kaos Ukuran L',
        comment: 'Mampir dinas ke Cilegon bingung cari oleh-oleh selain makanan, ketemu paket ini langsung beres praktis banget!'
      }
    ]
  },
  {
    id: 'bundle-2',
    slug: 'paket-eksekutif-korporat',
    name: 'Paket Eksekutif / Korporat Hardbox Eksklusif',
    shortName: 'Paket Eksekutif / Korporat',
    englishSubtitle: 'Executive Corporate Hampers Hardbox',
    categorySlug: 'paket-bundling',
    categoryLabel: 'Paket Bundling / Hampers',
    image: '/products/tumbler-sporty.png',
    galleryImages: [
      '/products/tumbler-sporty.png',
      '/products/tote-bag-kanvas.png',
      '/products/payung-geometris.png'
    ],
    price: 245000,
    priceRangeText: 'Sudah termasuk Hardbox Magnetik Eksklusif',
    originalPrice: 285000,
    discountPercent: 14,
    rating: 5.0,
    reviewCount: 64,
    soldCount: 220,
    weightGrams: 1350,
    stock: 60,
    isBundle: true,
    isBestSeller: true,
    bundleItems: [
      '1x Tumbler Stainless Steel Sporty 304 UV Print 360°',
      '1x Goodie Bag / Tote Bag Kanvas Premium Saku Samping',
      '1x Payung Lipat / Standar Desain Geometris Navy-Tosca',
      '1x Hardbox Magnetik Navy Gold Foil + Greeting Card Instansi'
    ],
    badges: ['Hardbox Eksklusif', 'Pilihan B2B & VIP'],
    description:
      'Rangkaian suvenir kelas eksekutif untuk tamu kehormatan, relasi bisnis industri, pembicara seminar, maupun gathering perusahaan di Kota Cilegon. Dikemas rapi di dalam Hardbox Magnetik berlapis busa presisi berisi Tumbler Stainless Steel Sporty, Tote Bag Kanvas Premium, dan Payung Desain Geometris.',
    specs: [
      { label: 'Isi Paket', value: '1 Tumbler Stainless 304 + 1 Tote Bag Kanvas + 1 Payung Geometris' },
      { label: 'Kemasan Utama', value: 'Hardbox Eksklusif Biru Baja (#1B365D) dengan pita & kartu ucapan' },
      { label: 'Opsi Kustomisasi', value: 'Bisa tambah logo perusahaan/instansi untuk pemesanan ≥ 20 paket' }
    ],
    variants: [
      { id: 'bek-reg', label: 'Hardbox Eksekutif Ready Stock', price: 245000, originalPrice: 285000, stock: 40 },
      { id: 'bek-logo', label: 'Hardbox + Custom Kartu & Pita Instansi', price: 259000, originalPrice: 299000, stock: 20 }
    ],
    minWholesaleQty: 15,
    wholesalePrice: 215000,
    reviews: [
      {
        id: 'r14',
        user: 'Yudha Pratama, S.T.',
        role: 'Procurement Kawasan Industri Cilegon',
        rating: 5,
        date: '4 hari lalu',
        variant: 'Hardbox + Custom Kartu & Pita Instansi',
        comment: 'Sangat representatif untuk VIP gift acara peresmian pabrik kami. Hardbox-nya kokoh dan kelihatan sangat berkelas.'
      }
    ]
  },
  {
    id: 'bundle-3',
    slug: 'paket-meja-kerja-inspiratif',
    name: 'Paket Meja Kerja & Dekorasi Cilegon Enggih (4-in-1)',
    shortName: 'Paket Meja Kerja 4-in-1',
    englishSubtitle: 'Desk & Home Decor Gift Set',
    categorySlug: 'paket-bundling',
    categoryLabel: 'Paket Bundling / Hampers',
    image: '/products/lampu-tidur-3d.png',
    galleryImages: [
      '/products/lampu-tidur-3d.png',
      '/products/mug-keramik.png',
      '/products/kalender-dinding-a3.png',
      '/products/stiker-die-cut.png'
    ],
    price: 229000,
    priceRangeText: 'Hemat Rp 28.000 (4 Produk Lengkap)',
    originalPrice: 257000,
    discountPercent: 11,
    rating: 4.9,
    reviewCount: 41,
    soldCount: 145,
    weightGrams: 1450,
    stock: 45,
    isBundle: true,
    bundleItems: [
      '1x Lampu Tidur 3D Arsitektur Landmark Cilegon (LED Warm White)',
      '1x Mug Keramik Souvenir 11 oz SNI',
      '1x Kalender Dinding Eksklusif Ukuran A3 (Edisi 2027)',
      '1x Stiker Vinyl Die-Cut Landmark Cilegon'
    ],
    badges: ['Kado Spesial', '4-in-1 Lengkap'],
    description:
      'Hadirkan atmosfer hangat dan produktif di ruang kerja atau kamar tidur dengan Paket Meja Kerja 4-in-1 Cilegon Enggih. Kombinasi sempurna antara Lampu Tidur 3D Arsitektur berbahan kayu natural, Mug Keramik hangat, Kalender Dinding A3 2027, dan Stiker Die-Cut.',
    specs: [
      { label: 'Isi Paket', value: 'Lampu Tidur 3D + Mug Keramik + Kalender Dinding A3 + Stiker Die-Cut' },
      { label: 'Kemasan', value: 'Gift Box Corrugated Kraft Tebal + Kartu Ucapan Personal' },
      { label: 'Garansi Pengiriman', value: '100% Garansi Ganti Baru jika pecah saat pengiriman' }
    ],
    variants: [
      { id: 'bmk-std', label: 'Paket Lengkap 4-in-1 + Gift Card', price: 229000, originalPrice: 257000, stock: 45 }
    ],
    minWholesaleQty: 15,
    wholesalePrice: 199000,
    reviews: [
      {
        id: 'r15',
        user: 'Clarissa Maharani',
        role: 'Pembeli Terverifikasi - Tangerang Selatan',
        rating: 5,
        date: '1 minggu lalu',
        variant: 'Paket Lengkap 4-in-1 + Gift Card',
        comment: 'Beli buat kado ulang tahun ayah yang dulu lama dinas di Cilegon. Beliau terharu banget lihat lampu menaranya!'
      }
    ]
  }
];

export const VOUCHER_CODES = [
  {
    code: 'ENGGIHBARU',
    title: 'Diskon Pelanggan Baru Rp 15.000',
    minPurchase: 100000,
    discountAmount: 15000,
    description: 'Potongan langsung Rp 15.000 min. belanja Rp 100.000'
  },
  {
    code: 'KOTABAJA',
    title: 'Cashback / Diskon Spesial Rp 25.000',
    minPurchase: 200000,
    discountAmount: 25000,
    description: 'Potongan Rp 25.000 min. belanja Rp 200.000 semua produk'
  },
  {
    code: 'ONGKIRCILEGON',
    title: 'Subsidi Ongkir Rp 10.000',
    minPurchase: 50000,
    discountAmount: 10000,
    description: 'Potongan ongkir Rp 10.000 min. belanja Rp 50.000'
  }
];

export const formatRupiah = (amount: number): string => {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
};

/* ------------------------------------------------------------------ */
/* Identitas toko resmi (surat menyurat, pengiriman & kredit developer) */
/* ------------------------------------------------------------------ */

export const STORE_INFO = {
  name: 'Cilegon Enggih',
  legalName: 'CV Cilegon Enggih Kreatif',
  tagline: 'Khas Kota Baja, Bangga Membawanya.',
  address:
    'Link. Jerang Barat RT. 004/001 Kel. Karang Asem Kec. Cibeber Kota Cilegon - Banten 42425',
  addressShort: 'Kel. Karang Asem, Kec. Cibeber, Kota Cilegon',
  originDistrict: 'Kec. Cibeber',
  originCity: 'Kota Cilegon',
  originPostal: '42425',
  openHours: 'Senin – Minggu: 08.30 – 20.30 WIB',
  mapsUrl: 'https://maps.google.com/?q=Karang+Asem+Cibeber+Kota+Cilegon'
} as const;

export const DEVELOPER_CREDIT = {
  title: 'Web Develop by Fadil Labs',
  url: 'https://fadil-labs.vercel.app/'
} as const;

export const WHATSAPP_NUMBER = '6281927157103';
export const WHATSAPP_DISPLAY = '0819-2715-7103';
export const STORE_EMAIL = 'cilegonenggih@gmail.com';
export const STORE_DOMAIN = 'cilegonenggih.com';

export const buildWhatsAppUrl = (message: string): string => {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
};

/** Normalisasi nomor HP Indonesia → format internasional tanpa tanda baca. */
export const toWhatsAppNumber = (phone: string): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return WHATSAPP_NUMBER;
  if (digits.startsWith('62')) return digits;
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  if (digits.startsWith('8')) return `62${digits}`;
  return digits;
};

export const buildWhatsAppUrlFor = (phone: string, message: string): string => {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`;
};
