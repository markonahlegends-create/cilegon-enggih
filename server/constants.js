/**
 * Cilegon Enggih — Konstanta toko, seed data & default settings.
 * Semua nilai di bawah bisa diubah secara live dari Super Admin Dashboard (/admin).
 */

export const STORE = {
  name: 'Cilegon Enggih',
  legalName: 'CV Cilegon Enggih Kreatif',
  tagline: 'Khas Kota Baja, Bangga Membawanya.',
  address:
    'Link. Jerang Barat RT. 004/001 Kel. Karang Asem Kec. Cibeber Kota Cilegon - Banten 42425',
  addressShort: 'Kel. Karang Asem, Kec. Cibeber, Kota Cilegon',
  originCity: 'Kota Cilegon',
  originDistrict: 'Kec. Cibeber',
  originPostal: '42425',
  email: 'cilegonenggih@gmail.com',
  whatsapp: '6282249879873',
  whatsappDisplay: '+62 822-4987-9873',
  domain: process.env.STORE_DOMAIN || 'cilegon-enggih.vercel.app',
  instagram: 'https://instagram.com/cilegonenggih',
  mapsUrl: 'https://maps.google.com/?q=Karang+Asem+Cibeber+Kota+Cilegon',
  openHours: 'Senin – Minggu: 08.30 – 20.30 WIB',
  developer: {
    title: 'Web Develop by Fadil Labs',
    url: 'https://fadil-labs.vercel.app/'
  }
};

export const DEFAULT_BANKS = [
  {
    id: 'bca',
    bank: 'BCA',
    accountNumber: '1234567890',
    accountHolder: 'Cilegon Enggih (PLACEHOLDER)',
    color: '#0060AF',
    isPlaceholder: true
  },
  {
    id: 'mandiri',
    bank: 'Mandiri',
    accountNumber: '1300012345678',
    accountHolder: 'Cilegon Enggih (PLACEHOLDER)',
    color: '#003D79',
    isPlaceholder: true
  },
  {
    id: 'bri',
    bank: 'BRI',
    accountNumber: '012345678901234',
    accountHolder: 'Cilegon Enggih (PLACEHOLDER)',
    color: '#00529C',
    isPlaceholder: true
  },
  {
    id: 'seabank',
    bank: 'SeaBank Indonesia',
    accountNumber: '901234567890',
    accountHolder: 'Cilegon Enggih (PLACEHOLDER)',
    color: '#F05A28',
    isPlaceholder: true
  },
  {
    id: 'dana',
    bank: 'DANA (E-Wallet)',
    // SENGAJA TIDAK diganti saat nomor WhatsApp toko berubah.
    // Nomor ini adalah tujuan transfer uang pembeli, bukan nomor kontak.
    // Mengubahnya tanpa memindahkan akun DANA = uang pembeli masuk ke
    // nomor yang salah. Ganti hanya bersama pemilik akun DANA-nya.
    accountNumber: '081927157103',
    accountHolder: 'Cilegon Enggih',
    color: '#118EEA',
    isPlaceholder: true
  }
];

export const DEFAULT_VOUCHERS = [
  {
    code: 'ENGGIHBARU',
    title: 'Diskon Pelanggan Baru Rp 15.000',
    minPurchase: 100000,
    discountAmount: 15000,
    description: 'Potongan langsung Rp 15.000 min. belanja Rp 100.000',
    active: true
  },
  {
    code: 'KOTABAJA',
    title: 'Cashback / Diskon Spesial Rp 25.000',
    minPurchase: 200000,
    discountAmount: 25000,
    description: 'Potongan Rp 25.000 min. belanja Rp 200.000 semua produk',
    active: true
  },
  {
    code: 'ONGKIRCILEGON',
    title: 'Subsidi Ongkir Rp 10.000',
    minPurchase: 50000,
    discountAmount: 10000,
    description: 'Potongan ongkir Rp 10.000 min. belanja Rp 50.000',
    active: true
  }
];

export const DEFAULT_SETTINGS = {
  storeName: STORE.name,
  legalName: STORE.legalName,
  tagline: STORE.tagline,
  address: STORE.address,
  addressShort: STORE.addressShort,
  originDistrict: STORE.originDistrict,
  originCity: STORE.originCity,
  originPostal: STORE.originPostal,
  email: STORE.email,
  whatsapp: STORE.whatsapp,
  whatsappDisplay: STORE.whatsappDisplay,
  openHours: STORE.openHours,
  mapsUrl: STORE.mapsUrl,
  instagram: STORE.instagram,
  developerTitle: STORE.developer.title,
  developerUrl: STORE.developer.url,
  banks: DEFAULT_BANKS,
  qris: {
    enabled: true,
    dynamicEnabled: true,
    mode: 'dynamic',
    merchantName: 'CILEGON ENGGIH',
    nmid: 'ID1020030405060',
    staticImageUrl: '/qris-placeholder.png',
    note: 'Scan QRIS dengan GoPay, OVO, DANA, ShopeePay, BCA Mobile, Livin Mandiri, BRImo, atau aplikasi bank lain.'
  },
  payment: {
    uniqueCodeEnabled: true,
    bankTransferEnabled: true,
    qrisEnabled: true,
    codEnabled: false,
    paymentWindowHours: 24,
    instructions:
      'Transfer sesuai NOMINAL AKHIR (termasuk 3 angka unik di belakang) agar pesanan Anda terverifikasi otomatis tanpa biaya gateway.'
  },
  invoice: {
    prefix: 'CE',
    footerNote:
      'Terima kasih telah berbelanja merchandise resmi Cilegon Enggih. Pesanan Anda disiapkan dan dikirim dari gudang mitra pemasok kami, lengkap dengan nomor resi yang dapat dilacak.',
    signerName: 'Cilegon Enggih Official Store'
  },
  announcement:
    'Subsidi ongkir Rp 10.000 untuk belanja min. Rp 50.000 — gunakan kode ONGKIRCILEGON.',
  /** Notifikasi Telegram ke admin (gratis). Isi botToken & chatId dari Dashboard Admin. */
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
    notifyNewOrder: true,
    notifyPaymentProof: true,
    notifyPaid: true,
    notifyShipped: true,
    notifyB2B: true
  },
  /** Pengaturan umum produk pre-order (dipakai sebagai teks default). */
  preOrder: {
    enabled: true,
    defaultNote: 'Pre Order 7–15 hari kerja',
    badgeText: 'PRE-ORDER'
  },
  vouchers: DEFAULT_VOUCHERS,
  updatedAt: new Date().toISOString()
};

/**
 * Seed pesanan contoh. Sengaja memuat 3 skenario:
 * 1) Selesai (sudah ada resi asli), 2) DIKIRIM (resi sudah diinput), 3) MENUNGGU input resi kurir.
 */
export const SEED_ORDERS = [
  {
    orderId: 'CE-20261115-089',
    invoiceNumber: 'INV/CE/2026/11/0089',
    uniqueCode: 142,
    resi: 'CGK1029384756',
    courier: 'JNE Reguler (CTC/REG)',
    courierService: 'JNE REG',
    resiInputAt: '2026-11-15T10:40:00.000Z',
    customerName: 'Rizky Pratama',
    customerPhone: '081288997711',
    customerEmail: 'rizky.pratama@example.com',
    destination: 'Kota Cilegon (Jombang, Purwakarta, Cibeber, Citangkil, Ramanuju)',
    addressDetail: 'Kawasan Krakatau Steel, Blok C No. 12, Purwakarta',
    fullAddress:
      'Kawasan Krakatau Steel, Blok C No. 12, Purwakarta, Kota Cilegon (Jombang, Purwakarta, Cibeber, Citangkil, Ramanuju)',
    paymentMethod: 'Transfer Bank BCA',
    bankAccount: DEFAULT_BANKS[0],
    paymentStatus: 'LUNAS',
    status: 'SELESAI',
    subtotal: 180000,
    shippingCost: 8000,
    voucherCode: null,
    voucherDiscount: 0,
    uniqueCodeValue: 142,
    totalAmount: 188142,
    notes: 'Titip di security gate 2.',
    paymentProofNote: 'Transfer BCA Rp 188.142 a.n. Rizky Pratama',
    createdAt: '2026-11-15T02:15:00.000Z',
    updatedAt: '2026-11-15T11:18:00.000Z',
    items: [
      { name: 'Kaos Distro Cilegon Enggih (Ukuran L)', qty: 1, price: 115000 },
      { name: 'Gantungan Kunci Karet 3D (Satuan)', qty: 2, price: 20000 },
      { name: 'Stiker Vinyl Die-Cut (Paket 3 Pcs)', qty: 1, price: 25000 }
    ],
    timeline: [
      {
        time: '15 Nov 2026, 09:15 WIB',
        status: 'Pesanan dibuat • Menunggu verifikasi transfer (kode unik 142)',
        location: 'Sistem Cilegon Enggih'
      },
      {
        time: '15 Nov 2026, 09:42 WIB',
        status: 'Pembayaran diverifikasi LUNAS oleh Admin',
        location: 'Dashboard Admin Cilegon Enggih'
      },
      {
        time: '15 Nov 2026, 10:05 WIB',
        status: 'Pesanan disiapkan & dikemas oleh mitra pemasok',
        location: 'Gudang mitra pemasok'
      },
      {
        time: '15 Nov 2026, 10:40 WIB',
        status: 'Resi JNE CGK1029384756 diinput — paket diserahkan ke kurir',
        location: 'Gerai JNE Cilegon'
      },
      {
        time: '15 Nov 2026, 16:18 WIB',
        status: 'Paket diterima oleh Rizky Pratama (Security Gate 2)',
        location: 'Purwakarta, Kota Cilegon'
      }
    ]
  },
  {
    orderId: 'CE-20261116-102',
    invoiceNumber: 'INV/CE/2026/11/0102',
    uniqueCode: 317,
    resi: 'SOC9901827361',
    courier: 'SiCepat BEST / HALU',
    courierService: 'SiCepat BEST',
    resiInputAt: '2026-11-16T03:15:00.000Z',
    customerName: 'Nadia Kusumawardhani',
    customerPhone: '081377665544',
    customerEmail: 'nadia.k@example.com',
    destination: 'DKI Jakarta (Pusat, Selatan, Barat, Timur, Utara)',
    addressDetail: 'Jl. Senopati Raya No. 45, Kebayoran Baru',
    fullAddress:
      'Jl. Senopati Raya No. 45, Kebayoran Baru, DKI Jakarta (Pusat, Selatan, Barat, Timur, Utara)',
    paymentMethod: 'QRIS Toko Cilegon Enggih',
    bankAccount: null,
    paymentStatus: 'LUNAS',
    status: 'DIKIRIM',
    subtotal: 295000,
    shippingCost: 22000,
    voucherCode: 'KOTABAJA',
    voucherDiscount: 25000,
    uniqueCodeValue: 317,
    totalAmount: 292317,
    notes: 'Mohon bubble wrap tambahan untuk kalender.',
    paymentProofNote: 'QRIS berhasil • ref 202611160731',
    createdAt: '2026-11-16T00:30:00.000Z',
    updatedAt: '2026-11-16T06:20:00.000Z',
    items: [
      { name: 'Paket Eksekutif / Korporat (Hardbox Eksklusif)', qty: 1, price: 245000 },
      { name: 'Kalender Dinding A3 (Art Carton 260 gsm)', qty: 1, price: 45000 },
      { name: 'Stiker Vinyl Die-Cut (Satuan)', qty: 1, price: 8000 }
    ],
    timeline: [
      {
        time: '16 Nov 2026, 07:30 WIB',
        status: 'Pesanan dibuat • Menunggu verifikasi QRIS (kode unik 317)',
        location: 'Sistem Cilegon Enggih'
      },
      {
        time: '16 Nov 2026, 07:48 WIB',
        status: 'Pembayaran QRIS diverifikasi LUNAS',
        location: 'Dashboard Admin Cilegon Enggih'
      },
      {
        time: '16 Nov 2026, 08:45 WIB',
        status: 'Paket hardbox selesai dikemas bubble wrap berlapis',
        location: 'Gudang mitra pemasok'
      },
      {
        time: '16 Nov 2026, 10:15 WIB',
        status: 'Resi SiCepat SOC9901827361 diinput — diserahkan ke gerai SiCepat',
        location: 'Gerai SiCepat Ekspres Cilegon'
      },
      {
        time: '16 Nov 2026, 13:20 WIB',
        status: 'Paket dalam perjalanan menuju hub sortir Jakarta Selatan',
        location: 'Tol Tangerang — Merak'
      }
    ]
  },
  {
    orderId: 'CE-20261116-108',
    invoiceNumber: 'INV/CE/2026/11/0108',
    uniqueCode: 508,
    resi: null,
    courier: 'GoSend Instant',
    courierService: 'GoSend Instant',
    resiInputAt: null,
    customerName: 'Hendra Wijaya (PT Chandra Asri)',
    customerPhone: '085711223344',
    customerEmail: 'hendra.w@example.com',
    destination: 'Kota Cilegon Barat & Pelabuhan (Ciwandan, Anyer, Pulomerak, Grogol)',
    addressDetail: 'Plant Site PT Chandra Asri, Ciwandan',
    fullAddress:
      'Plant Site PT Chandra Asri, Ciwandan, Kota Cilegon Barat & Pelabuhan (Ciwandan, Anyer, Pulomerak, Grogol)',
    paymentMethod: 'Transfer Bank Mandiri',
    bankAccount: DEFAULT_BANKS[1],
    paymentStatus: 'MENUNGGU_VERIFIKASI',
    status: 'MENUNGGU_KONFIRMASI',
    subtotal: 169000,
    shippingCost: 20000,
    voucherCode: null,
    voucherDiscount: 0,
    uniqueCodeValue: 508,
    totalAmount: 189508,
    notes: 'Kirim ke kantor purchaser, jam kerja 08.00-16.00.',
    paymentProofNote: '',
    createdAt: '2026-11-16T08:50:00.000Z',
    updatedAt: '2026-11-16T08:50:00.000Z',
    items: [{ name: 'Lampu Tidur 3D Arsitektur Landmark Cilegon', qty: 1, price: 169000 }],
    timeline: [
      {
        time: '16 Nov 2026, 15:50 WIB',
        status: 'Pesanan dibuat • Menunggu verifikasi transfer Mandiri (kode unik 508)',
        location: 'Sistem Cilegon Enggih'
      }
    ]
  }
];

export const SEED_B2B = [
  {
    quoteId: 'QUO-B2B-2041',
    companyName: 'PT Krakatau Sarana Properti',
    picName: 'Dewi Anggraini',
    phone: '081299887766',
    email: 'dewi@example.co.id',
    productInterest: 'Paket Eksekutif / Korporat Hardbox Eksklusif',
    quantity: 120,
    budgetPerUnit: 250000,
    deadline: '2026-12-10',
    needsCustomLogo: true,
    notes: 'Untuk suvenir tamu peresmian gedung baru. Mohon sample 1 pcs.',
    createdAt: '2026-11-14T04:20:00.000Z',
    status: 'Menunggu Konfirmasi Tim Korporat (SLA < 1 Jam Kerja)'
  }
];

export const ORDER_STATUSES = [
  'MENUNGGU_KONFIRMASI',
  'DIPROSES',
  'DIKIRIM',
  'SELESAI',
  'DIBATALKAN'
];

export const PAYMENT_STATUSES = ['MENUNGGU_VERIFIKASI', 'LUNAS', 'DIBATALKAN'];
export const SEED_VOUCHERS = DEFAULT_VOUCHERS;
