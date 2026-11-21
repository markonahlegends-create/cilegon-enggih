/**
 * Data awal (seed) Info Kelurahan.
 *
 * Semua isi di file ini adalah contoh redaksi yang bisa langsung diganti lewat
 * dashboard /admin. Struktur:
 *   settings   → identitas situs, kontak, kredit
 *   categories → kanal berita
 *   authors    → profil penulis/redaktur
 *   articles   → berita (markdown ringan)
 *   agenda     → agenda kegiatan kelurahan
 *   comments   → komentar warga (dengan moderasi)
 */

const photo = (name) => `/images/${name}.jpg`;
const cover = (slug) => `/covers/${slug}.svg`;

export const SEED_CATEGORIES = [
  { id: 'cat_pemerintahan', slug: 'pemerintahan', name: 'Pemerintahan', accent: '#1d4ed8', description: 'Kebijakan, pelayanan publik, dan kegiatan pemerintah di Kota Cilegon.' },
  { id: 'cat_pembangunan', slug: 'pembangunan', name: 'Pembangunan', accent: '#f0a500', description: 'Infrastruktur, jalan, drainase, dan fasilitas umum di berbagai wilayah Cilegon.' },
  { id: 'cat_kesehatan', slug: 'kesehatan', name: 'Kesehatan', accent: '#059669', description: 'Posyandu, gizi balita, imunisasi, dan kampanye hidup sehat.' },
  { id: 'cat_pendidikan', slug: 'pendidikan', name: 'Pendidikan', accent: '#7c3aed', description: 'Sekolah, perpustakaan, beasiswa, dan literasi warga.' },
  { id: 'cat_ekonomi', slug: 'ekonomi', name: 'Ekonomi & UMKM', accent: '#ea580c', description: 'Usaha warga, pasar, harga pangan, dan pemberdayaan ekonomi.' },
  { id: 'cat_lingkungan', slug: 'lingkungan', name: 'Lingkungan', accent: '#0d9488', description: 'Sampah, sungai, penghijauan, dan kampung iklim.' },
  { id: 'cat_sosial', slug: 'sosial', name: 'Sosial', accent: '#db2777', description: 'Bantuan sosial, gotong royong, dan kegiatan kemasyarakatan.' },
  { id: 'cat_budaya', slug: 'budaya', name: 'Budaya', accent: '#c026d3', description: 'Seni, tradisi, dan kegiatan budaya masyarakat Cilegon.' },
  { id: 'cat_olahraga', slug: 'olahraga', name: 'Olahraga', accent: '#0284c7', description: 'Turnamen antar-RT, senam, dan kegiatan olahraga warga.' },
  { id: 'cat_pengumuman', slug: 'pengumuman', name: 'Pengumuman', accent: '#475569', description: 'Informasi resmi, jadwal layanan, dan pemberitahuan penting.' },
];

export const SEED_AUTHORS = [
  {
    id: 'au_redaksi',
    slug: 'redaksi',
    name: 'Redaksi Info Kelurahan',
    role: 'Redaksi',
    bio: 'Tim redaksi Info Kelurahan yang mengelola pemberitaan harian, verifikasi informasi, dan kanal pengaduan warga.',
    accent: '#e11d2e',
  },
  {
    id: 'au_rina',
    slug: 'rina-marlina',
    name: 'Rina Marlina',
    role: 'Jurnalis',
    bio: 'Meliput pemerintahan, pelayanan publik, dan kegiatan masyarakat di Kota Cilegon.',
    accent: '#1d4ed8',
  },
  {
    id: 'au_dimas',
    slug: 'dimas-prakoso',
    name: 'Dimas Prakoso',
    role: 'Jurnalis & Fotografer',
    bio: 'Meliput pembangunan, lingkungan, dan olahraga warga. Percaya bahwa foto yang jujur bisa bercerita lebih banyak dari seribu kata.',
    accent: '#0d9488',
  },
  {
    id: 'au_sari',
    slug: 'sari-wulandari',
    name: 'Sari Wulandari',
    role: 'Kontributor',
    bio: 'Kontributor warga untuk isu kesehatan, pendidikan, dan UMKM. Aktif di PKK RW 03.',
    accent: '#db2777',
  },
  {
    id: 'au_lurah',
    slug: 'lurah-karang-asem',
    name: 'H. Ahmad Syaifudin',
    role: 'Narasumber',
    bio: 'Narasumber kegiatan pemerintahan dan pelayanan publik di Kota Cilegon.',
    accent: '#0b2545',
  },
];

/** @type {Array<any>} */
const ARTICLES = [
  {
    id: 'ar_bpbd_evakuasi',
    slug: 'bpbd-usulkan-titik-evakuasi-di-43-kelurahan',
    title: 'BPBD Usulkan Titik Evakuasi Bencana di Seluruh 43 Kelurahan Cilegon',
    dek: 'BPBD meminta setiap kelurahan mengidentifikasi lokasi aman agar rencana evakuasi lebih dekat dan mudah dijangkau warga.',
    category: 'pemerintahan', author: 'redaksi',
    cover: 'https://berita.cilegon.go.id/assets/img/berita/226972_0.jpg',
    coverCaption: 'Foto: Berita Cilegon',
    tags: ['BPBD', 'kesiapsiagaan', 'evakuasi', '43 kelurahan'],
    featured: true, breaking: false, views: 0,
    publishedAt: '2026-11-16T00:00:00+07:00', updatedAt: '2026-11-16T00:00:00+07:00',
    sourceName: 'Berita Cilegon', sourceDate: '16 November 2026',
    sourceUrl: 'https://berita.cilegon.go.id/baca/BPBD-Cilegon-Usulkan-Titik-Evakuasi-Bencana-di-43-Kelurahan/20261121/MjI2OTcy',
    content: `BPBD Kota Cilegon mengusulkan agar setiap kelurahan memiliki titik evakuasi bencana. Usulan disampaikan dalam proses peninjauan Rencana Tata Ruang Wilayah (RTRW), dengan tujuan memperluas akses lokasi aman hingga seluruh 43 kelurahan.\n\nBPBD telah menyurati para lurah untuk mengidentifikasi tempat yang layak. Lokasi tidak harus berupa bangunan khusus; sekolah atau fasilitas lain yang dinilai aman dapat diusulkan. Hasil identifikasi akan menjadi masukan bagi peninjauan RTRW.\n\nInformasi ini diringkas dari berita Pemerintah Kota Cilegon. Statusnya adalah usulan/perencanaan, bukan daftar titik evakuasi yang telah ditetapkan.\n\n## Sumber\n[BPBD Cilegon Usulkan Titik Evakuasi Bencana di 43 Kelurahan — Berita Cilegon](https://berita.cilegon.go.id/baca/BPBD-Cilegon-Usulkan-Titik-Evakuasi-Bencana-di-43-Kelurahan/20261121/MjI2OTcy)`,
  },
  {
    id: 'ar_gotong_royong_banjir',
    slug: 'pemkot-ajak-warga-cilegon-gotong-royong-cegah-banjir',
    title: 'Jelang Musim Hujan, Warga Cilegon Diajak Gotong Royong Cegah Banjir',
    dek: 'Pemkot mengimbau RT, RW, lurah, dan camat membersihkan drainase serta memetakan titik rawan genangan di lingkungannya.',
    category: 'lingkungan', author: 'redaksi',
    cover: 'https://berita.cilegon.go.id/assets/img/berita/278908_0.jpg',
    coverCaption: 'Foto: Berita Cilegon',
    tags: ['musim hujan', 'banjir', 'gotong royong', 'drainase'],
    featured: true, breaking: false, views: 0,
    publishedAt: '2026-11-19T00:00:00+07:00', updatedAt: '2026-11-19T00:00:00+07:00',
    sourceName: 'Berita Cilegon', sourceDate: '19 November 2026',
    sourceUrl: 'https://berita.cilegon.go.id/baca/Jelang-Musim-Hujan,-Robinsar-Ajak-Warga-Cilegon-Gotong-Royong-Cegah-Banjir/20261121/Mjc4OTA4',
    content: `Pemerintah Kota Cilegon mengajak warga meningkatkan kewaspadaan menghadapi musim hujan. Imbauan ditujukan kepada masyarakat, RT, RW, lurah, dan camat untuk bergotong royong membersihkan saluran air dan menjaga lingkungan.\n\nPemkot juga meminta warga mengenali titik yang berpotensi tergenang. Keluhan yang ditemukan akan ditindaklanjuti bersama perangkat daerah terkait.\n\nRingkasan ini bersumber dari publikasi Pemkot Cilegon pada 19 November 2026.\n\n## Sumber\n[Jelang Musim Hujan, Robinsar Ajak Warga Cilegon Gotong Royong Cegah Banjir — Berita Cilegon](https://berita.cilegon.go.id/baca/Jelang-Musim-Hujan,-Robinsar-Ajak-Warga-Cilegon-Gotong-Royong-Cegah-Banjir/20261121/Mjc4OTA4)`,
  },
  {
    id: 'ar_cctv_integrasi',
    slug: 'pemkot-polres-integrasikan-cctv-di-cilegon',
    title: 'Pemkot dan Polres Cilegon Integrasikan CCTV untuk Pengawasan Keamanan',
    dek: 'Integrasi kamera pengawas dirancang untuk mendukung pemantauan kota; Pemkot menyebut rencana penambahan titik terutama di Jalan Lingkar Selatan.',
    category: 'pemerintahan', author: 'redaksi',
    cover: 'https://berita.cilegon.go.id/assets/img/berita/119138_0.jpg',
    coverCaption: 'Foto: Berita Cilegon',
    tags: ['keamanan', 'CCTV', 'layanan publik'],
    featured: true, breaking: false, views: 0,
    publishedAt: '2026-11-19T00:00:00+07:00', updatedAt: '2026-11-19T00:00:00+07:00',
    sourceName: 'Berita Cilegon', sourceDate: '19 November 2026',
    sourceUrl: 'https://berita.cilegon.go.id/baca/Awasi-Pergerakan-Kriminal,-Pemkot-dan-Polres-Cilegon-Integrasikan-CCTV-di-Semua-Titik/20261121/MTE5MTM4',
    content: `Pemerintah Kota Cilegon dan Polres Cilegon menyepakati integrasi sistem CCTV untuk membantu pemantauan keamanan. Menurut berita sumber, kamera yang dikelola Pemkot akan dapat diakses melalui sistem pemantauan di Command Center Polres.\n\nPemkot juga menyampaikan rencana menambah kamera di sejumlah lokasi, termasuk titik rawan di Jalan Lingkar Selatan. Kerja sama tersebut turut mencakup Program Polisi Peduli Pengangguran (Poliran) yang akan dikoordinasikan dengan perangkat daerah terkait.\n\nBerita ini diringkas dari publikasi resmi Pemkot Cilegon; rencana dan pelaksanaan dapat berubah mengikuti informasi terbaru pemerintah.\n\n## Sumber\n[Awasi Pergerakan Kriminal, Pemkot dan Polres Cilegon Integrasikan CCTV di Semua Titik — Berita Cilegon](https://berita.cilegon.go.id/baca/Awasi-Pergerakan-Kriminal,-Pemkot-dan-Polres-Cilegon-Integrasikan-CCTV-di-Semua-Titik/20261121/MTE5MTM4)`,
  },
  {
    id: 'ar_kolase_sampah',
    slug: 'program-kolase-reduksi-sampah-di-cilegon',
    title: 'Program Kolase Reduksi 73 Ton Sampah dan Jangkau 104 Sekolah di Cilegon',
    dek: 'Program edukasi lingkungan DLH melibatkan sekolah dan bank sampah; jangkauan program ditargetkan terus bertambah.',
    category: 'lingkungan', author: 'redaksi',
    cover: 'https://berita.cilegon.go.id/assets/img/berita/271857_0.jpg',
    coverCaption: 'Foto: Berita Cilegon',
    tags: ['lingkungan', 'sampah', 'sekolah', 'bank sampah'],
    featured: true, breaking: false, views: 0,
    publishedAt: '2026-11-18T00:00:00+07:00', updatedAt: '2026-11-18T00:00:00+07:00',
    sourceName: 'Berita Cilegon', sourceDate: '18 November 2026',
    sourceUrl: 'https://berita.cilegon.go.id/baca/73-Ton-Sampah-Berhasil-Direduksi,-Program-Kolase-Jangkau-104-Sekolah-di-Cilegon/20261121/MjcxODU3',
    content: `Dinas Lingkungan Hidup Kota Cilegon melaporkan Program Kolaborasi Sekolah (Kolase) telah mengurangi sekitar 73,2 ton sampah hingga Oktober 2026. Program edukasi pemilahan sampah ini melibatkan 104 sekolah dari 220 sekolah sasaran.\n\nBerita sumber menyebut sampah yang terkumpul bernilai transaksi sekitar Rp120 juta dan program bekerja sama dengan bank sampah di sekitar sekolah. DLH menargetkan perluasan jangkauan program pada 2027.\n\nAngka dan rencana dalam ringkasan ini mengacu pada keterangan DLH yang dikutip Berita Cilegon.\n\n## Sumber\n[73 Ton Sampah Berhasil Direduksi, Program Kolase Jangkau 104 Sekolah di Cilegon — Berita Cilegon](https://berita.cilegon.go.id/baca/73-Ton-Sampah-Berhasil-Direduksi,-Program-Kolase-Jangkau-104-Sekolah-di-Cilegon/20261121/MjcxODU3)`,
  },
  {
    id: 'ar_literasi_keliling',
    slug: 'dpk-cilegon-perkuat-literasi-perpustakaan-keliling',
    title: 'Perpustakaan Keliling Didorong Menjangkau Warga di Berbagai Wilayah Cilegon',
    dek: 'Dinas Perpustakaan dan Kearsipan menyebut layanan keliling dan wisata edukasi sebagai upaya mendekatkan akses bacaan kepada warga.',
    category: 'pendidikan', author: 'redaksi',
    cover: 'https://berita.cilegon.go.id/assets/img/berita/290742_0.jpg',
    coverCaption: 'Foto: Berita Cilegon',
    tags: ['literasi', 'perpustakaan keliling', 'pendidikan'],
    featured: false, breaking: false, views: 0,
    publishedAt: '2026-11-19T00:00:00+07:00', updatedAt: '2026-11-19T00:00:00+07:00',
    sourceName: 'Berita Cilegon', sourceDate: '19 November 2026',
    sourceUrl: 'https://berita.cilegon.go.id/baca/DPK-Cilegon-Perkuat-Budaya-Literasi-Lewat-Perpustakaan-Keliling-dan-Wisata-Edukasi/20261121/MjkwNzQy',
    content: `Dinas Perpustakaan dan Kearsipan Kota Cilegon menyampaikan program perpustakaan keliling dan wisata edukasi untuk mendekatkan layanan literasi kepada anak, pelajar, dan masyarakat umum. Perpustakaan keliling juga diarahkan menjangkau wilayah yang relatif jauh dari Perpustakaan Daerah.\n\nDinas tersebut menyebut rencana 2027 mencakup penguatan sarana, penambahan koleksi, wisata edukasi, dan perluasan layanan keliling. Warga dapat mengikuti pengumuman jadwal melalui kanal resmi pemerintah.\n\nRingkasan ini berdasarkan berita Berita Cilegon yang diterbitkan 19 November 2026.\n\n## Sumber\n[DPK Cilegon Perkuat Budaya Literasi Lewat Perpustakaan Keliling dan Wisata Edukasi — Berita Cilegon](https://berita.cilegon.go.id/baca/DPK-Cilegon-Perkuat-Budaya-Literasi-Lewat-Perpustakaan-Keliling-dan-Wisata-Edukasi/20261121/MjkwNzQy)`,
  },
  {
    id: 'ar_mtq_cilegon',
    slug: 'gerogol-juara-umum-mtq-kota-cilegon-2026',
    title: 'Gerogol Raih Juara Umum MTQ XXV Tingkat Kota Cilegon',
    dek: 'Kecamatan Gerogol meraih nilai 188 dalam MTQ 2026; Kecamatan Cibeber berada di posisi kelima dengan nilai 143.',
    category: 'budaya', author: 'redaksi',
    cover: 'https://berita.cilegon.go.id/assets/img/berita/189870_0.jpg',
    coverCaption: 'Foto: Berita Cilegon',
    tags: ['MTQ', 'Gerogol', 'Ciwandan', 'Cibeber'],
    featured: false, breaking: false, views: 0,
    publishedAt: '2026-11-09T00:00:00+07:00', updatedAt: '2026-11-09T00:00:00+07:00',
    sourceName: 'Berita Cilegon', sourceDate: '9 November 2026',
    sourceUrl: 'https://berita.cilegon.go.id/baca/Kecamatan-Gerogol-Raih-Juara-Umum-MTQ-XXV-Tingkat-Kota-Cilegon/20261121/MTg5ODcw',
    content: `Kecamatan Gerogol meraih juara umum Musabaqah Tilawatil Quran (MTQ) XXV tingkat Kota Cilegon tahun 2026 dengan nilai 188. Kecamatan Ciwandan berada di urutan kedua dengan nilai 164, disusul Jombang dengan nilai 162.\n\nMTQ berlangsung selama empat hari di Kecamatan Ciwandan. Berita sumber menyebut Kecamatan Cibeber menempati posisi kelima dengan nilai 143.\n\n## Sumber\n[Kecamatan Gerogol Raih Juara Umum MTQ XXV Tingkat Kota Cilegon — Berita Cilegon](https://berita.cilegon.go.id/baca/Kecamatan-Gerogol-Raih-Juara-Umum-MTQ-XXV-Tingkat-Kota-Cilegon/20261121/MTg5ODcw)`,
  },
];

export function seedDatabase() {
  return {
    meta: { version: 1, createdAt: new Date().toISOString(), secret: null },
    settings: {
      name: 'Info Kelurahan',
      tagline: 'Informasi dan kabar untuk seluruh kelurahan di Kota Cilegon',
      description:
        'Info Kelurahan adalah portal informasi untuk warga di seluruh kelurahan Kota Cilegon. Menyajikan rangkuman kabar pemerintahan, layanan publik, kegiatan masyarakat, pembangunan, pendidikan, kesehatan, lingkungan, dan pengumuman yang bersumber dari kanal resmi serta sumber terverifikasi.',
      village: 'Seluruh kelurahan',
      district: 'Kota Cilegon',
      city: 'Kota Cilegon',
      province: 'Banten',
      address: 'Kota Cilegon, Banten',
      email: 'redaksi@infokelurahan.id',
      phone: '(0254) 1234567',
      whatsapp: '6281927157103',
      officeHours: 'Senin - Jumat, 08.00 - 15.00 WIB',
      credit: { name: 'Fadil Labs', url: 'https://fadil-labs.vercel.app/' },
      socials: {
        instagram: 'https://instagram.com/infokelurahan',
        facebook: 'https://facebook.com/infokelurahan',
        x: 'https://x.com/infokelurahan',
        youtube: 'https://youtube.com/@infokelurahan',
        tiktok: 'https://tiktok.com/@infokelurahan',
      },
      editors: ['Redaksi Info Kelurahan'],
      announcement: 'Kabar kegiatan, layanan, dan informasi dari kelurahan-kelurahan di seluruh Kota Cilegon.',
      seo: {
        title: 'Info Kelurahan — Informasi Seluruh Kelurahan Kota Cilegon',
        description:
          'Portal informasi untuk seluruh kelurahan Kota Cilegon. Ringkasan berita, layanan publik, pembangunan, pendidikan, kesehatan, lingkungan, dan kegiatan masyarakat dengan tautan sumber.',
        keywords:
          'info kelurahan cilegon, berita kelurahan cilegon, kegiatan kelurahan, informasi warga, layanan publik cilegon',
      },
    },
    categories: SEED_CATEGORIES,
    authors: SEED_AUTHORS,
    articles: ARTICLES.map((item) => ({
      status: 'published',
      featured: false,
      breaking: false,
      coverCaption: '',
      views: 0,
      tags: [],
      updatedAt: item.publishedAt,
      ...item,
    })),
    agenda: [],
    comments: [],
    messages: [],
    subscribers: [],
    media: [],
    stats: { totalViews: 0, daily: {} },
  };
}
