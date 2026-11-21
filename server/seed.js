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
  { id: 'cat_pemerintahan', slug: 'pemerintahan', name: 'Pemerintahan', accent: '#1d4ed8', description: 'Kebijakan, pelayanan publik, dan kegiatan pemerintah kelurahan.' },
  { id: 'cat_pembangunan', slug: 'pembangunan', name: 'Pembangunan', accent: '#f0a500', description: 'Infrastruktur, jalan, drainase, dan fasilitas umum lingkungan.' },
  { id: 'cat_kesehatan', slug: 'kesehatan', name: 'Kesehatan', accent: '#059669', description: 'Posyandu, gizi balita, imunisasi, dan kampanye hidup sehat.' },
  { id: 'cat_pendidikan', slug: 'pendidikan', name: 'Pendidikan', accent: '#7c3aed', description: 'Sekolah, perpustakaan, beasiswa, dan literasi warga.' },
  { id: 'cat_ekonomi', slug: 'ekonomi', name: 'Ekonomi & UMKM', accent: '#ea580c', description: 'Usaha warga, pasar, harga pangan, dan pemberdayaan ekonomi.' },
  { id: 'cat_lingkungan', slug: 'lingkungan', name: 'Lingkungan', accent: '#0d9488', description: 'Sampah, sungai, penghijauan, dan kampung iklim.' },
  { id: 'cat_sosial', slug: 'sosial', name: 'Sosial', accent: '#db2777', description: 'Bantuan sosial, gotong royong, dan kegiatan kemasyarakatan.' },
  { id: 'cat_budaya', slug: 'budaya', name: 'Budaya', accent: '#c026d3', description: 'Seni, tradisi, dan cerita warga Kelurahan Karang Asem.' },
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
    bio: 'Menulis isu pemerintahan, pelayanan publik, dan kehidupan warga Karang Asem sejak 2021.',
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
    role: 'Lurah Karang Asem',
    bio: 'Lurah Karang Asem, Kecamatan Cibeber, Kota Cilegon. Menjabat sejak 2022.',
    accent: '#0b2545',
  },
];

/** @type {Array<any>} */
const ARTICLES = [
  {
    id: 'ar_musrenbang',
    slug: 'musrenbang-karang-asem-2026-tetapkan-12-prioritas',
    title: 'Musrenbang Kelurahan Karang Asem 2026 Tetapkan 12 Prioritas Pembangunan',
    dek: 'Drainase, penerangan jalan, dan rehabilitasi posyandu menjadi tiga usulan dengan suara terbanyak dalam musyawarah perencanaan pembangunan tahun depan.',
    category: 'pemerintahan',
    author: 'rina-marlina',
    cover: photo('musrenbang'),
    coverCaption: 'Warga dan perangkat kelurahan membahas usulan prioritas dalam Musrenbang Kelurahan Karang Asem, Kamis (20/11).',
    tags: ['musrenbang', 'pembangunan', 'APBD', 'Cibeber'],
    featured: true,
    breaking: false,
    views: 4820,
    publishedAt: '2026-11-20T08:30:00+07:00',
    updatedAt: '2026-11-20T09:05:00+07:00',
    content: `Musyawarah Perencanaan Pembangunan (Musrenbang) Kelurahan Karang Asem, Kecamatan Cibeber, Kota Cilegon, menetapkan 12 usulan prioritas untuk tahun anggaran 2026. Penetapan itu dilakukan setelah perwakilan 12 RW menyampaikan aspirasi masing-masing di aula kelurahan, Kamis (20/11).

Dari 38 usulan yang masuk, tiga program mendapat suara terbanyak: normalisasi saluran drainase di kawasan padat penduduk, penambahan penerangan jalan lingkungan, serta rehabilitasi Posyandu Melati RW 03.

"Usulan warga kami urutkan berdasarkan tingkat urgensi dan dampak. Drainase dan lampu jalan memang paling sering dikeluhkan, terutama saat hujan malam," kata Lurah Karang Asem, H. Ahmad Syaifudin, saat membuka forum.

## Warga diberi ruang bicara

Forum berlangsung hampir empat jam. Setiap ketua RW mendapat jatah waktu untuk memaparkan kondisi wilayahnya, lengkap dengan foto dan peta sederhana. Sejumlah warga juga menyinggung soal genangan di Gang Jerang serta akses air bersih di RW 07.

Perwakilan Bappeda Kota Cilegon yang hadir menyatakan usulan kelurahan akan dibahas kembali di tingkat kecamatan. "Yang lolos di kelurahan belum otomatis masuk APBD, tetapi menjadi dasar kuat. Kami minta perangkat kelurahan melengkapi dokumen pendukung," ujarnya.

## Transparansi jadi catatan

Koordinator Forum Warga Karang Asem, Endang Supriatna, mengapresiasi keterbukaan panitia. Namun ia meminta hasil musyawarah ditempel di papan pengumuman dan dibagikan lewat grup WhatsApp RW.

"Jangan sampai warga sudah usul, lalu tidak tahu kelanjutannya. Minimal kami dikabari mana yang disetujui dan mana yang ditunda," kata Endang.

Menanggapi hal itu, pihak kelurahan berjanji mengunggah matriks usulan ke situs Info Kelurahan dalam pekan ini. Warga juga bisa menyampaikan tanggapan melalui kanal pengaduan yang tersedia di halaman kontak.

## Dua belas usulan prioritas

Berikut ringkasan usulan yang disepakati untuk dibawa ke Musrenbang Kecamatan Cibeber:

- Normalisasi drainase RW 02, RW 04, dan RW 06
- Penambahan 60 titik penerangan jalan lingkungan
- Rehabilitasi Posyandu Melati RW 03
- Pembangunan gedung serbaguna RW 05 (tahap perencanaan)
- Perbaikan jalan lingkungan Gang Jerang Barat
- Pengadaan motor sampah untuk bank sampah kelurahan
- Renovasi perpustakaan kelurahan
- Alat bantu kesehatan untuk posyandu lansia
- Pemeliharaan taman dan ruang terbuka hijau
- Pelatihan digital untuk UMKM
- Sumur resapan di enam titik rawan genangan
- Peningkatan sistem peringatan dini banjir

Musrenbang tingkat kecamatan dijadwalkan berlangsung pekan depan. Warga yang ingin menyampaikan masukan tambahan dapat menghubungi sekretariat kelurahan pada jam kerja.`,
  },
  {
    id: 'ar_drainase',
    slug: 'normalisasi-drainase-rw-04-rampung',
    title: 'Normalisasi Drainase RW 04 Rampung, Warga Lega Sambut Musim Hujan',
    dek: 'Pengerjaan sepanjang 620 meter selesai lebih cepat dari jadwal. Kelurahan mengajak warga menjaga saluran agar tidak kembali tersumbat sampah.',
    category: 'pembangunan',
    author: 'dimas-prakoso',
    cover: photo('drainase'),
    coverCaption: 'Petugas membersihkan endapan lumpur di saluran drainase Gang Jerang Barat, RW 04.',
    tags: ['drainase', 'banjir', 'infrastruktur'],
    featured: true,
    views: 3115,
    publishedAt: '2026-11-19T15:10:00+07:00',
    content: `Pekerjaan normalisasi saluran drainase di RW 04 Kelurahan Karang Asem resmi rampung, Selasa (18/11). Saluran sepanjang 620 meter yang sebelumnya dipenuhi endapan lumpur kini mengalir lancar.

Pantauan Info Kelurahan, petugas masih melakukan pembersihan akhir di beberapa titik. Truk pengangkut lumpur keluar-masuk gang sempit sejak pagi.

"Pengerjaan awal kami targetkan tiga pekan, ternyata selesai dalam 16 hari. Alhamdulillah tidak mengganggu aktivitas warga terlalu lama," kata Koordinator Lapangan, Bayu Setiawan.

## Keluhan bertahun-tahun

Warga RW 04 menyebut genangan setinggi mata kaki kerap muncul setiap hujan deras. Saat musim hujan 2025 lalu, air bahkan masuk ke beberapa rumah di Gang Jerang Barat.

"Sekarang airnya cepat surut. Dulu kalau hujan sejam, kami sudah siap-siap angkat barang," ujar Ibu Nurhayati, warga RT 002.

Kepala Seksi Pembangunan Kelurahan Karang Asem menambahkan, perbaikan ini merupakan bagian dari program padat karya yang melibatkan 18 tenaga kerja lokal.

## Jangan buang sampah ke saluran

Meski drainase sudah normal, pemerintah kelurahan mengingatkan warga agar tidak membuang sampah ke saluran air. Petugas menemukan banyak kantong plastik dan sisa makanan saat pengerjaan.

"Kalau salurannya bersih tapi sampahnya tetap dibuang ke situ, ya percuma. Kami akan aktifkan kembali sanksi sosial lewat kerja bakti bagi pelanggar," tegas Lurah Karang Asem.

Warga diimbau melaporkan saluran yang tersumbat melalui layanan pengaduan kelurahan atau grup WhatsApp RW masing-masing.`,
  },
  {
    id: 'ar_posyandu',
    slug: 'posyandu-melati-layani-180-balita',
    title: 'Posyandu Melati Layani 180 Balita dalam Sehari, Cek Gizi hingga Imunisasi',
    dek: 'Kader posyandu mencatat 14 balita dengan gizi kurang dan langsung merujuk mereka ke puskesmas untuk pendampingan.',
    category: 'kesehatan',
    author: 'sari-wulandari',
    cover: photo('posyandu'),
    coverCaption: 'Kader Posyandu Melati menimbang balita dalam layanan bulanan di RW 03, Sabtu (15/11).',
    tags: ['posyandu', 'stunting', 'gizi', 'imunisasi'],
    featured: true,
    views: 2740,
    publishedAt: '2026-11-18T09:00:00+07:00',
    content: `Posyandu Melati RW 03 Kelurahan Karang Asem melayani 180 balita dalam kegiatan bulanan, Sabtu (15/11). Layanan meliputi penimbangan berat badan, pengukuran tinggi badan, pemberian vitamin A, imunisasi dasar, serta konsultasi gizi.

Dari hasil penimbangan, 14 balita tercatat memiliki berat badan di bawah garis normal. Sebanyak sembilan di antaranya sudah mendapat pendampingan gizi dari puskesmas, sedangkan lima lainnya dijadwalkan kunjungan rumah.

"Kami tidak hanya menimbang. Kalau ada temuan, langsung kami catat dan koordinasikan dengan bidan desa," kata Ketua Posyandu Melati, Ibu Hasnah.

## Ibu hamil juga dilayani

Selain balita, posyandu melayani 26 ibu hamil dan 40 lansia. Pemeriksaan tekanan darah, kadar hemoglobin, serta konsultasi pola makan menjadi layanan yang paling diminati.

Salah satu warga, Ibu Fitri, mengaku rutin datang sejak anak pertamanya lahir. "Di sini gratis, kader-kadernya sabar. Anak saya jadi tidak takut ditimbang," ujarnya.

## Dukungan pangan lokal

Kader posyandu juga membagikan paket makanan tambahan berisi telur, susu, dan bubur kacang hijau. Bahan pangan itu berasal dari donasi warga dan dukungan CSR salah satu perusahaan di Cilegon.

Kepala Puskesmas Cibeber mengapresiasi konsistensi Posyandu Melati. Menurutnya, deteksi dini di tingkat posyandu adalah kunci menurunkan angka stunting.

Layanan posyandu berikutnya digelar 13 Desember 2026. Orang tua diimbau membawa Buku KIA agar riwayat tumbuh kembang anak tercatat rapi.`,
  },
  {
    id: 'ar_perpustakaan',
    slug: 'perpustakaan-kelurahan-kelas-belajar-gratis',
    title: 'Perpustakaan Kelurahan Buka Kelas Belajar Gratis Setiap Sabtu',
    dek: 'Relawan mahasiswa dan guru pensiunan mengajar membaca, matematika dasar, hingga literasi digital untuk anak usia sekolah.',
    category: 'pendidikan',
    author: 'sari-wulandari',
    cover: photo('perpustakaan'),
    coverCaption: 'Anak-anak mengikuti kelas belajar di perpustakaan kelurahan, Sabtu (16/11).',
    tags: ['perpustakaan', 'literasi', 'pendidikan', 'relawan'],
    views: 1980,
    publishedAt: '2026-11-17T10:15:00+07:00',
    content: `Perpustakaan Kelurahan Karang Asem kini membuka kelas belajar gratis setiap Sabtu pagi. Program ini menyasar anak usia 7-12 tahun dengan materi membaca, menulis, matematika dasar, dan literasi digital.

Kelas berlangsung pukul 08.30-10.30 WIB dan diampu oleh enam relawan, terdiri dari mahasiswa, guru pensiunan, serta pegiat literasi warga.

"Banyak anak sebenarnya pintar, hanya butuh pendampingan tambahan. Kami coba hadir dengan suasana yang tidak seperti sekolah formal," kata koordinator program, Rani Oktaviani.

## Dari donasi buku ke kelas rutin

Ide kelas berawal dari program donasi buku pada awal 2026. Ribuan buku terkumpul, tetapi kunjungan anak ke perpustakaan masih rendah. Perangkat kelurahan lalu menggandeng Karang Taruna untuk menghidupkan kembali ruang baca.

Kini perpustakaan buka Senin-Jumat pukul 08.00-15.00 WIB dan Sabtu pukul 08.00-12.00 WIB. Koleksinya mencapai 2.400 judul, termasuk buku cerita anak, ensiklopedia, dan buku keterampilan.

## Butuh tambahan relawan

Pengelola membuka kesempatan bagi warga yang ingin menjadi relawan pengajar, khususnya untuk mata pelajaran bahasa Inggris dan komputer.

"Satu kelas idealnya maksimal 15 anak. Sekarang kadang sampai 25, jadi kami butuh tambahan tenaga," ujar Rani.

Anak-anak yang ingin ikut cukup mendaftar di meja perpustakaan atau melalui WhatsApp kelurahan. Tidak ada biaya pendaftaran maupun iuran bulanan.`,
  },
  {
    id: 'ar_umkm',
    slug: 'umkm-karang-asem-naik-kelas-lewat-foto-produk',
    title: 'UMKM Karang Asem Naik Kelas lewat Pelatihan Foto Produk dan Jualan Online',
    dek: 'Dua puluh pelaku usaha mengikuti pelatihan memotret produk dengan ponsel dan mengelola toko daring. Omzet peserta dilaporkan naik rata-rata 30 persen.',
    category: 'ekonomi',
    author: 'rina-marlina',
    cover: photo('umkm'),
    coverCaption: 'Seorang pelaku UMKM menata produk olahan pangan sebelum sesi pemotretan.',
    tags: ['UMKM', 'digital', 'ekonomi warga', 'pelatihan'],
    featured: true,
    views: 3520,
    publishedAt: '2026-11-16T13:40:00+07:00',
    content: `Sebanyak 20 pelaku usaha mikro Kelurahan Karang Asem mengikuti pelatihan foto produk dan pemasaran digital di aula kelurahan, Sabtu (15/11). Pelatihan digelar bersama komunitas UMKM Cilegon dan didukung salah satu marketplace nasional.

Materi mencakup teknik dasar pencahayaan alami, penataan produk, penulisan deskripsi, hingga cara mengelola pesanan lewat aplikasi pesan.

"Kami ingin warga tidak hanya jadi penonton di ekonomi digital. Modal awalnya sederhana: ponsel dan kemauan belajar," kata Ketua Komunitas UMKM Cibeber, Hendra Gunawan.

## Omzet naik, kemasan dirapikan

Salah satu peserta, Ibu Wati, memproduksi sambal bawang rumahan. Setelah fotonya diperbaiki dan kemasan diberi label, pesanan dari luar kota mulai masuk.

"Dulu jualannya hanya ke tetangga. Sekarang sehari bisa kirim 15-20 bungkus ke Serang dan Tangerang," ujarnya.

Peserta lain, Rizal, menjual keripik pisang. Ia mengaku baru sadar foto produk memengaruhi keputusan pembeli. "Ternyata pencahayaan pagi lebih bagus, tidak perlu beli lampu mahal," kata Rizal.

## Pendampingan lanjutan

Kelurahan berencana membentuk koperasi bersama untuk mempermudah pengadaan bahan baku dan pengiriman. Pelatihan lanjutan soal pembukuan sederhana dijadwalkan Desember.

Pelaku UMKM yang ingin ikut dapat mendaftar melalui Ketua RW atau langsung ke kantor kelurahan. Kuota tiap angkatan dibatasi 25 orang agar pendampingan lebih intensif.`,
  },
  {
    id: 'ar_banksampah',
    slug: 'bank-sampah-asem-bersih-catat-omzet-18-juta',
    title: 'Bank Sampah Asem Bersih Catat Omzet Rp18 Juta dalam Tiga Bulan',
    dek: 'Warga menukar sampah anorganik menjadi tabungan. Sebagian hasil penjualan dipakai untuk kegiatan sosial di tingkat RW.',
    category: 'lingkungan',
    author: 'dimas-prakoso',
    cover: photo('kompos'),
    coverCaption: 'Pengurus bank sampah memilah material anorganik sebelum ditimbang.',
    tags: ['bank sampah', 'lingkungan', 'ekonomi sirkular'],
    views: 2260,
    publishedAt: '2026-11-15T08:00:00+07:00',
    content: `Bank Sampah Asem Bersih mencatat omzet Rp18,4 juta dalam periode Agustus-Oktober 2026. Angka itu berasal dari penjualan plastik PET, kardus, kaleng, dan kertas yang dikumpulkan 210 nasabah dari enam RW.

Sistemnya sederhana: warga memilah sampah dari rumah, menyetorkan ke pos bank sampah setiap Minggu pagi, lalu nilainya dicatat sebagai tabungan.

"Rata-rata satu keluarga bisa menabung Rp40 ribu sampai Rp90 ribu per bulan. Kalau rajin memilah, bisa lebih," kata bendahara bank sampah, Nur Aisyah.

## Berkah dari pemilahan

Selain nilai ekonomi, volume sampah yang dikirim ke TPA berkurang. Pengurus mencatat 3,8 ton material berhasil dialihkan dalam tiga bulan terakhir.

Hasil penjualan dipakai untuk membeli perlengkapan posyandu, mengganti lampu gang, dan memberi santunan bagi warga lanjut usia.

"Kami ingin bank sampah bukan cuma soal uang, tapi juga memperkuat kebersamaan warga," ujar Ketua RW 06, Suryana.

## Tantangan harga dan gudang

Pengurus mengakui harga jual sampah fluktuatif. Pada September, harga plastik sempat turun sehingga pendapatan ikut terkoreksi.

Keterbatasan gudang juga menjadi kendala. Saat ini penampungan menempati sisi balai RW yang kerap dipakai kegiatan lain.

Kelurahan menyatakan akan mengusulkan bantuan kontainer dan pelatihan manajemen bagi pengurus bank sampah pada 2027. Warga yang ingin menjadi nasabah dapat mendaftar di pos terdekat setiap akhir pekan.`,
  },
  {
    id: 'ar_layananWa',
    slug: 'layanan-administrasi-kelurahan-via-whatsapp',
    title: 'Urus Surat Keterangan Kini Bisa Lewat WhatsApp, Respons Maksimal Satu Hari',
    dek: 'Warga tak perlu lagi bolak-balik ke kantor kelurahan. Cukup kirim foto dokumen, petugas akan mengabari status permohonan.',
    category: 'pemerintahan',
    author: 'rina-marlina',
    cover: cover('pemerintahan'),
    coverCaption: 'Ilustrasi layanan administrasi digital Kelurahan Karang Asem.',
    tags: ['pelayanan publik', 'digitalisasi', 'administrasi'],
    views: 4102,
    publishedAt: '2026-11-14T11:20:00+07:00',
    content: `Kelurahan Karang Asem meluncurkan layanan administrasi melalui WhatsApp. Warga kini dapat mengajukan surat keterangan domisili, surat keterangan usaha, pengantar SKCK, dan surat keterangan tidak mampu tanpa harus datang lebih dulu ke kantor.

Caranya, warga mengirim pesan ke nomor layanan resmi, melampirkan foto KTP, Kartu Keluarga, dan dokumen pendukung lain, lalu menunggu verifikasi petugas.

"Target kami semua permohonan direspons maksimal satu hari kerja. Kalau dokumen lengkap, surat bisa diambil hari berikutnya," kata Sekretaris Kelurahan, Dedi Kurniawan.

## Tetap ada layanan tatap muka

Meski digital, layanan langsung di kantor kelurahan tetap dibuka seperti biasa. Petugas menyiapkan loket khusus bagi warga lanjut usia atau yang belum terbiasa menggunakan ponsel.

"Digital itu alat bantu, bukan pengganti pelayanan. Warga yang datang tetap kami layani," tegas Dedi.

Selama uji coba dua pekan, tercatat 86 permohonan masuk melalui WhatsApp. Sebanyak 61 di antaranya selesai dalam satu hari.

## Waspada penipuan

Kelurahan mengingatkan bahwa seluruh layanan administrasi tidak dipungut biaya. Warga diminta waspada terhadap pihak yang mengaku sebagai petugas dan meminta pembayaran.

Nomor layanan resmi hanya satu dan tertera di halaman Kontak pada situs ini. Aduan terkait pelayanan dapat disampaikan melalui kanal pengaduan yang tersedia.`,
  },
  {
    id: 'ar_rabies',
    slug: 'vaksinasi-rabies-gratis-200-hewan',
    title: 'Vaksinasi Rabies Gratis untuk 200 Hewan Peliharaan Warga',
    dek: 'Layanan digelar di balai kelurahan selama dua hari. Pemilik diminta membawa kartu identitas dan memastikan hewan dalam kondisi sehat.',
    category: 'kesehatan',
    author: 'redaksi',
    cover: photo('posyandu'),
    coverCaption: 'Ilustrasi pelayanan kesehatan hewan peliharaan warga.',
    tags: ['rabies', 'hewan', 'kesehatan masyarakat'],
    views: 1520,
    publishedAt: '2026-11-13T09:45:00+07:00',
    content: `Kelurahan Karang Asem bersama Dinas Pertanian Kota Cilegon menggelar vaksinasi rabies gratis bagi hewan peliharaan warga, Senin-Selasa (17-18/11). Sebanyak 200 dosis disiapkan untuk anjing, kucing, dan kera peliharaan.

Layanan berlangsung pukul 08.00-14.00 WIB di halaman balai kelurahan. Pemilik wajib membawa KTP dan memastikan hewan dalam kondisi sehat, tidak sedang bunting, serta berusia minimal tiga bulan.

"Rabies bisa dicegah, tapi tidak bisa diobati. Vaksinasi rutin adalah cara paling murah dan efektif," kata dokter hewan dari Dinas Pertanian, drh. Lestari.

## Antusiasme warga

Pada hari pertama, 132 hewan divaksin. Sebagian besar kucing rumahan. Petugas juga memberikan obat cacing gratis dan edukasi cara merawat hewan di lingkungan padat penduduk.

Warga RW 02, Ilham, datang membawa dua kucingnya. "Biasanya harus ke klinik dan bayar. Ini gratis dan dekat rumah, jadi saya ajak tetangga juga," ujarnya.

## Aturan memelihara hewan

Kelurahan mengingatkan pemilik hewan agar tidak melepas peliharaan berkeliaran tanpa pengawasan. Hewan yang sering keluar rumah berisiko terpapar rabies dari hewan liar.

Bagi warga yang menemukan hewan dengan gejala agresif atau hypersalivasi, segera laporkan ke kelurahan atau puskesmas terdekat. Jangan menyentuh hewan tanpa pelindung.`,
  },
  {
    id: 'ar_voli',
    slug: 'turnamen-voli-antar-rt-piala-lurah-dimulai',
    title: 'Turnamen Voli Antar-RT Piala Lurah Resmi Dimulai, 24 Tim Berlaga',
    dek: 'Kompetisi berlangsung tiga pekan di lapangan RW 05. Selain trofi bergilir, panitia menyiapkan hadiah pembinaan untuk juara.',
    category: 'olahraga',
    author: 'dimas-prakoso',
    cover: photo('voli'),
    coverCaption: 'Pemain bertanding pada laga pembuka turnamen voli antar-RT di lapangan RW 05.',
    tags: ['voli', 'turnamen', 'olahraga warga'],
    featured: true,
    views: 2640,
    publishedAt: '2026-11-12T16:00:00+07:00',
    content: `Turnamen voli antar-RT Piala Lurah Karang Asem 2026 resmi dibuka, Rabu (12/11) sore. Sebanyak 24 tim dari 12 RW akan bertanding selama tiga pekan di lapangan RW 05.

Laga pembuka mempertemukan RT 003 RW 02 melawan RT 001 RW 05. Pertandingan berlangsung sengit dan disaksikan ratusan warga yang memadati sisi lapangan.

"Turnamen ini jadi ajang silaturahmi. Menang kalah nomor dua, yang penting warga bisa berkumpul sehat," kata Lurah Karang Asem usai seremonial pembukaan.

## Dibina jadi atlet

Panitia menyebut turnamen tahun ini berbeda karena menggandeng klub voli Cilegon untuk memantau bibit muda. Pemain terbaik berpeluang mengikuti pembinaan di tingkat kota.

"Kami lihat ada beberapa pemain muda dengan postur dan insting bagus. Sayang kalau tidak dibina," ujar pelatih klub voli Cilegon, Arif Hidayat.

## Jadwal dan hadiah

Pertandingan digelar setiap Selasa, Kamis, dan Sabtu mulai pukul 15.30 WIB. Babak final dijadwalkan 30 November 2026.

Juara pertama mendapat trofi bergilir Piala Lurah dan dana pembinaan Rp5 juta. Runner-up Rp3 juta, sedangkan juara tiga Rp1,5 juta.

Warga yang ingin menonton tidak dikenakan tiket. Panitia hanya mengimbau penonton menjaga kebersihan dan tidak memarkir kendaraan di badan jalan.`,
  },
  {
    id: 'ar_festival',
    slug: 'festival-karang-asem-berseni-pentas-tradisional',
    title: 'Festival Karang Asem Berseni, Pentas Tradisional Banten Meriah',
    dek: 'Puluhan seniman warga tampil dalam festival seni budaya di halaman balai kelurahan. Anak-anak juga unjuk gigi membawakan tari tradisional.',
    category: 'budaya',
    author: 'sari-wulandari',
    cover: photo('karnaval'),
    coverCaption: 'Peserta karnaval budaya melintasi jalan lingkungan Kelurahan Karang Asem.',
    tags: ['budaya', 'seni', 'tradisi Banten', 'festival'],
    views: 1870,
    publishedAt: '2026-11-10T07:30:00+07:00',
    content: `Halaman balai Kelurahan Karang Asem berubah menjadi panggung seni, Minggu (9/11). Festival Karang Asem Berseni menampilkan beragam kesenian tradisional Banten, dari pencak silat hingga tari topeng.

Sedikitnya 120 peserta terlibat, mulai dari anak usia sekolah dasar hingga seniman senior. Penonton duduk lesehan di atas tikar yang disiapkan panitia.

"Kami ingin ruang seni ini kembali hidup. Dulu hampir setiap RT punya grup pencak silat, sekarang tinggal beberapa," kata ketua panitia, Abah Sanusi.

## Regenerasi seniman

Sesi yang paling ditunggu adalah penampilan 30 anak dari sanggar seni kelurahan. Mereka membawakan tari topeng dan atraksi silat dasar yang sudah dilatih selama tiga bulan.

"Saya bangga lihat cucu saya tampil. Ini warisan yang harus dijaga," ujar Mbah Karsih, warga RW 01.

Selain pertunjukan, festival menggelar bazar makanan khas dan pameran foto sejarah kelurahan.

Kelurahan berencana menjadikan festival ini agenda tahunan dan mendukung pembentukan sanggar seni tingkat RW. Warga yang berminat bergabung dapat menghubungi pengurus Karang Taruna.`,
  },
  {
    id: 'ar_bansos',
    slug: 'data-bansos-diperbarui-340-kpm-terima-bantuan',
    title: 'Data Bansos Diperbarui, 340 KPM Terima Bantuan Pangan Bulan Ini',
    dek: 'Pemutakhiran data dilakukan door to door untuk memastikan bantuan tepat sasaran. Warga yang keberatan bisa mengajukan sanggahan.',
    category: 'sosial',
    author: 'rina-marlina',
    cover: cover('sosial'),
    coverCaption: 'Ilustrasi penyaluran bantuan pangan bagi keluarga penerima manfaat.',
    tags: ['bansos', 'data', 'sosial'],
    views: 3320,
    publishedAt: '2026-11-09T10:00:00+07:00',
    content: `Sebanyak 340 keluarga penerima manfaat (KPM) di Kelurahan Karang Asem menerima bantuan pangan bulan November. Penyaluran dilakukan di balai kelurahan dan dibagi per RW agar tidak menumpuk.

Bantuan berupa beras, minyak goreng, telur, dan protein hewani. Setiap KPM menerima paket senilai Rp200 ribu.

"Kami pastikan penerima sesuai data terbaru. Sebelum penyaluran, petugas melakukan verifikasi ulang ke rumah-rumah," kata Kasi Kesejahteraan Sosial Kelurahan Karang Asem.

## Door to door

Pemutakhiran data melibatkan 12 ketua RW dan 48 ketua RT. Petugas mengecek kondisi rumah, jumlah tanggungan, serta status pekerjaan kepala keluarga.

Dari 412 nama dalam data lama, 72 dinyatakan tidak lagi memenuhi kriteria karena pindah domisili atau kondisi ekonomi membaik.

"Ada juga warga yang belum terdata. Kami kumpulkan lewat usulan RT untuk diverifikasi, bukan langsung dimasukkan," ujar petugas pendamping.

## Sanggahan dibuka

Warga yang merasa berhak namun belum tercantum dipersilakan mengajukan sanggahan dengan membawa KTP, KK, dan surat keterangan penghasilan.

Pengaduan dapat disampaikan langsung ke kantor kelurahan atau melalui kanal pengaduan di situs ini. Tenggat pengajuan akhir bulan.`,
  },
  {
    id: 'ar_pasarmurah',
    slug: 'pasar-murah-kelurahan-1200-paket-sembako',
    title: 'Pasar Murah Kelurahan Sediakan 1.200 Paket Sembako Harga Terjangkau',
    dek: 'Beras, gula, dan minyak dijual di bawah harga pasar. Warga antre sejak pagi, panitia membatasi pembelian dua paket per keluarga.',
    category: 'ekonomi',
    author: 'redaksi',
    cover: photo('umkm'),
    coverCaption: 'Warga memilih kebutuhan pokok pada pasar murah di halaman kelurahan.',
    tags: ['pasar murah', 'sembako', 'harga pangan'],
    views: 2480,
    publishedAt: '2026-11-08T08:30:00+07:00',
    content: `Pasar murah di halaman Kelurahan Karang Asem menyediakan 1.200 paket sembako, Sabtu (8/11). Kegiatan ini digelar untuk membantu warga menghadapi kenaikan harga beberapa komoditas pangan.

Paket berisi 5 kilogram beras, 1 liter minyak goreng, 1 kilogram gula pasir, dan 1 kilogram telur, dijual Rp75 ribu atau sekitar 25 persen lebih murah dari harga pasar.

"Antusiasme warga tinggi. Kami buka pukul 07.00, tapi sejak 06.00 sudah ada yang datang," kata panitia, Yanto.

## Batasi pembelian

Agar merata, setiap keluarga hanya boleh membeli maksimal dua paket dengan menunjukkan KTP dan KK. Panitia juga menyediakan jalur khusus lansia dan penyandang disabilitas.

Sebagian warga mengaku terbantu. "Biasanya belanja untuk seminggu bisa Rp120 ribu. Ini jauh lebih ringan," ujar Ibu Aminah, warga RW 07.

## Dukungan Bulog dan UMKM

Bahan pangan dipasok dari Bulog dan distributor lokal. Kelurahan juga melibatkan UMKM warga untuk menyediakan sayur dan lauk siap masak.

Pasar murah berikutnya direncanakan digelar awal Desember, menjelang libur akhir tahun. Jadwal pasti akan diumumkan melalui situs ini dan papan pengumuman RW.`,
  },
  {
    id: 'ar_asemdigital',
    slug: 'karang-taruna-luncurkan-asem-digital',
    title: 'Karang Taruna Luncurkan Asem Digital, Kelas Teknologi Gratis untuk Remaja',
    dek: 'Program ini mengajarkan desain grafis, dasar pemrograman, dan keamanan digital. Peserta dibagi dalam dua angkatan setiap bulan.',
    category: 'pendidikan',
    author: 'sari-wulandari',
    cover: photo('perpustakaan'),
    coverCaption: 'Remaja mengikuti sesi kelas teknologi di sekretariat Karang Taruna.',
    tags: ['karang taruna', 'teknologi', 'remaja', 'literasi digital'],
    views: 1690,
    publishedAt: '2026-11-07T14:20:00+07:00',
    content: `Karang Taruna Kelurahan Karang Asem meluncurkan program Asem Digital, kelas teknologi gratis bagi remaja usia 13-21 tahun. Kelas perdana digelar Sabtu (7/11) di sekretariat Karang Taruna.

Materi awal mencakup dasar desain grafis menggunakan aplikasi gratis, pengenalan pemrograman web, dan keamanan digital. Peserta diminta membawa laptop atau ponsel masing-masing.

"Banyak remaja di sini sebenarnya kreatif, hanya belum punya akses pelatihan. Kami ingin mereka tidak hanya jadi pengguna, tapi juga pembuat," kata ketua Karang Taruna, Fajar Ramadhan.

## Dua angkatan tiap bulan

Setiap angkatan dibatasi 20 peserta agar pendampingan efektif. Kelas berlangsung empat pertemuan, setiap Sabtu pukul 13.00-16.00 WIB.

Pengajar berasal dari relawan profesional dan mahasiswa yang tinggal di sekitar kelurahan. Sebagian di antaranya alumnus program serupa di tingkat kota.

"Saya mau bisa bikin portofolio sendiri. Siapa tahu bisa jadi kerjaan sampingan," ujar Aldi (17), peserta kelas perdana.

## Dukungan perangkat

Kelurahan menyediakan enam laptop bekas layak pakai untuk peserta yang tidak memiliki perangkat. Pendaftaran dibuka melalui tautan yang dibagikan di grup RW.

Program ini juga akan menghadirkan sesi khusus tentang pencegahan penipuan online dan jejak digital yang aman bagi remaja.`,
  },
  {
    id: 'ar_sungai',
    slug: '300-relawan-bersihkan-sungai-cibeber',
    title: '300 Relawan Turun Bersihkan Sungai Cibeber, Angkut 2,4 Ton Sampah',
    dek: 'Aksi gotong royong melibatkan pelajar, komunitas, dan warga enam kelurahan. Sampah plastik mendominasi temuan.',
    category: 'lingkungan',
    author: 'dimas-prakoso',
    cover: photo('sungai'),
    coverCaption: 'Relawan mengangkut sampah plastik dari aliran Sungai Cibeber.',
    tags: ['sungai', 'sampah plastik', 'gotong royong'],
    views: 2110,
    publishedAt: '2026-11-06T09:10:00+07:00',
    content: `Sekitar 300 relawan membersihkan aliran Sungai Cibeber, Minggu (5/11). Aksi yang melibatkan pelajar, komunitas lingkungan, dan warga dari enam kelurahan itu mengangkut 2,4 ton sampah.

Sampah didominasi plastik kemasan, botol, dan styrofoam. Relawan juga membersihkan eceng gondok yang menutup sebagian permukaan sungai.

"Kalau hanya mengandalkan petugas, tidak akan selesai. Butuh kesadaran warga untuk tidak membuang sampah ke sungai," kata koordinator aksi, Rizky Maulana.

## Fokus hulu

Pembersihan tidak hanya di hilir, tetapi juga di titik-titik hulu di kawasan RW 02 dan RW 08. Relawan memisahkan sampah organik dan anorganik untuk kemudian diserahkan ke bank sampah.

Pelajar dari tiga sekolah menengah ikut serta. Mereka sekaligus mendapat edukasi tentang dampak sampah plastik terhadap ekosistem sungai.

"Ternyata sampah di depan rumah saya juga bisa sampai ke sungai. Besok saya akan mulai memilah," ujar Nabila, siswa kelas XI.

## Perlu solusi jangka panjang

Pemerintah kelurahan berencana menambah tempat sampah terpilah di titik rawan dan mengaktifkan patroli lingkungan.

Aksi bersih sungai akan dijadikan agenda rutin setiap bulan. Warga yang ingin terlibat dapat mendaftar melalui Karang Taruna atau bank sampah setempat.`,
  },
  {
    id: 'ar_kompos',
    slug: 'kader-pkk-latih-warga-olah-sampah-organik-jadi-kompos',
    title: 'Kader PKK Latih Warga Olah Sampah Organik Jadi Kompos Bernilai Jual',
    dek: 'Sampah dapur disulap menjadi pupuk dalam 30 hari. Hasilnya dipakai untuk tanaman warga dan dijual ke pasar lokal.',
    category: 'lingkungan',
    author: 'sari-wulandari',
    cover: photo('kompos'),
    coverCaption: 'Kader PKK mengaduk bahan kompos di kebun percontohan RW 03.',
    tags: ['kompos', 'PKK', 'sampah organik', 'urban farming'],
    views: 1440,
    publishedAt: '2026-11-04T13:00:00+07:00',
    content: `Kader PKK Kelurahan Karang Asem menggelar pelatihan pengolahan sampah organik menjadi kompos, Selasa (4/11). Pelatihan diikuti 35 ibu rumah tangga dari enam RW.

Peserta belajar mencampur sisa dapur dengan bahan kering, mengatur kelembapan, dan memanen kompos setelah 30 hari. Alatnya sederhana: ember bekas, drum plastik, dan sekop.

"Sampah dapur itu 40 persen dari total sampah rumah tangga. Kalau dipilah dari awal, beban TPA jauh berkurang," kata narasumber dari Dinas Lingkungan Hidup, Rini Astuti.

## Kebun percontohan

Kelurahan menyiapkan kebun percontohan di belakang balai RW 03. Kompos hasil olahan dipakai untuk menanam cabai, tomat, dan sayuran daun.

Sebagian kompos dikemas dalam kantong 5 kilogram dan dijual Rp25 ribu. Hasil penjualan masuk kas bank sampah.

"Ternyata gampang dan tidak bau kalau caranya benar. Saya sudah mulai di rumah," ujar peserta, Ibu Rohmah.

## Pendampingan berkelanjutan

Kader PKK akan mendampingi peserta setiap dua pekan sekali untuk memastikan proses berjalan. Warga yang ingin memulai dapat meminta panduan di sekretariat PKK.`,
  },
  {
    id: 'ar_lampu',
    slug: 'empat-puluh-titik-lampu-led-rw-02',
    title: '40 Titik Lampu LED Dipasang di RW 02, Gang Gelap Kini Terang',
    dek: 'Pemasangan menggunakan dana aspirasi warga. Sebagian lampu dilengkapi sensor gerak untuk menghemat listrik.',
    category: 'pembangunan',
    author: 'dimas-prakoso',
    cover: cover('pembangunan'),
    coverCaption: 'Ilustrasi penerangan jalan lingkungan berbasis LED.',
    tags: ['penerangan jalan', 'LED', 'infrastruktur'],
    views: 1210,
    publishedAt: '2026-11-03T19:30:00+07:00',
    content: `Sebanyak 40 titik lampu LED dipasang di lingkungan RW 02 Kelurahan Karang Asem. Pemasangan selesai akhir pekan lalu dan langsung diuji coba pada malam hari.

Warga sebelumnya mengeluhkan gang yang gelap, terutama di jalur penghubung RT 004 dan RT 006. Beberapa insiden pencurian kecil sempat terjadi.

"Dulu kalau pulang kerja malam harus bawa senter. Sekarang sudah terang," kata Siti, warga RT 004.

## Sensor gerak hemat energi

Sekitar separuh lampu dilengkapi sensor gerak dan pengatur waktu. Lampu menyala penuh saat ada orang lewat, lalu meredup setelah beberapa menit.

Menurut perangkat kelurahan, teknologi itu menghemat konsumsi listrik hingga 40 persen dibanding lampu konvensional.

Pemasangan menggunakan dana aspirasi warga yang disalurkan melalui musrenbang. Total anggaran mencapai Rp68 juta, termasuk tiang dan kabel.

## Pemeliharaan bersama

Warga diminta melaporkan lampu yang mati atau rusak melalui ketua RT. Pemeliharaan akan dilakukan bergilir oleh petugas kelurahan setiap bulan.

Ke depan, RW 02 berencana menambah lampu di jalur olahraga dan area parkir balai warga.`,
  },
  {
    id: 'ar_stunting',
    slug: 'cegah-stunting-gerakan-satu-balita-satu-telur',
    title: 'Cegah Stunting, Kelurahan Canangkan Gerakan Satu Balita Satu Telur',
    dek: 'Setiap balita berisiko mendapat satu butir telur per hari dari donasi warga dan pelaku usaha. Program berjalan enam bulan pertama.',
    category: 'kesehatan',
    author: 'sari-wulandari',
    cover: photo('posyandu'),
    coverCaption: 'Kader posyandu membagikan paket protein hewani bagi balita.',
    tags: ['stunting', 'gizi', 'balita', 'posyandu'],
    views: 3020,
    publishedAt: '2026-11-02T09:20:00+07:00',
    content: `Kelurahan Karang Asem mencanangkan Gerakan Satu Balita Satu Telur (Sabtu Telur) untuk menekan angka stunting. Program menyasar 62 balita yang teridentifikasi berisiko kekurangan gizi.

Setiap balita menerima satu butir telur per hari selama enam bulan. Telur didistribusikan melalui posyandu setiap pekan, dengan pemantauan berat badan dan tinggi badan tiap bulan.

"Protein hewani adalah salah satu kunci pencegahan stunting. Telur murah, mudah diolah, dan disukai anak-anak," kata bidan desa, Nurul Hidayah.

## Gotong royong warga

Kebutuhan telur sekitar 1.860 butir per bulan. Sebagian berasal dari donasi warga, sebagian dari dukungan pelaku usaha di Cilegon.

"Saya ikut menyumbang karena ini soal masa depan anak-anak. Kalau bukan kita, siapa lagi," ujar pengusaha lokal, Haji Marwan.

Program juga melibatkan kader PKK untuk memantau pola makan anak di rumah dan memberikan edukasi kepada orang tua.

## Evaluasi berkala

Dinas Kesehatan akan mengevaluasi hasil program setiap tiga bulan. Jika efektif, skema serupa akan diperluas ke kelurahan lain di Kecamatan Cibeber.

Orang tua yang anaknya belum terdaftar dapat menghubungi kader posyandu terdekat atau balai kelurahan.`,
  },
  {
    id: 'ar_kkm',
    slug: 'mahasiswa-kkm-bantu-pendataan-warga',
    title: 'Mahasiswa KKM Bantu Pendataan Warga Kurang Mampu di Enam RW',
    dek: 'Selama 40 hari, mahasiswa mendampingi petugas kelurahan melakukan verifikasi data dan memetakan kebutuhan warga.',
    category: 'sosial',
    author: 'redaksi',
    cover: cover('sosial'),
    coverCaption: 'Ilustrasi pendataan warga oleh petugas kelurahan dan relawan.',
    tags: ['KKM', 'mahasiswa', 'pendataan', 'sosial'],
    views: 980,
    publishedAt: '2026-10-31T11:00:00+07:00',
    content: `Sebanyak 18 mahasiswa peserta Kuliah Kerja Nyata (KKM) membantu Kelurahan Karang Asem melakukan pendataan warga kurang mampu. Kegiatan berlangsung 40 hari di enam RW, mulai pertengahan Oktober.

Mahasiswa mendampingi petugas melakukan kunjungan rumah, mengisi formulir digital, dan memetakan kebutuhan seperti bantuan pendidikan, kesehatan, dan perbaikan rumah.

"Data yang rapi memudahkan kami menyalurkan bantuan tepat sasaran. Selama ini sering ada duplikasi atau nama yang sudah pindah," kata Kasi Sosial Kelurahan.

## Temuan awal

Dari 260 rumah yang dikunjungi, 34 keluarga membutuhkan bantuan perbaikan sanitasi, 21 keluarga memiliki anak putus sekolah, dan 12 lansia hidup sendiri.

Temuan itu akan dibahas bersama puskesmas, dinas sosial, dan lembaga zakat untuk menentukan intervensi.

"Kami tidak sekadar mengambil data. Ada juga sesi belajar untuk anak-anak di tiap RW," ujar koordinator mahasiswa, Rendi.

## Rekomendasi

Mahasiswa merekomendasikan pembuatan peta sosial digital yang diperbarui setiap semester. Kelurahan menyambut baik usulan itu dan berencana mengintegrasikannya dengan layanan administrasi.`,
  },
  {
    id: 'ar_libur',
    slug: 'jadwal-pelayanan-kelurahan-libur-akhir-tahun',
    title: 'Pengumuman: Jadwal Pelayanan Kelurahan Selama Libur Akhir Tahun',
    dek: 'Pelayanan administrasi tutup pada 24-26 Desember dan 31 Desember-1 Januari. Layanan darurat tetap siaga 24 jam.',
    category: 'pengumuman',
    author: 'redaksi',
    cover: cover('pengumuman'),
    coverCaption: 'Papan pengumuman jadwal layanan Kelurahan Karang Asem.',
    tags: ['pengumuman', 'layanan', 'libur'],
    views: 5140,
    publishedAt: '2026-10-30T07:00:00+07:00',
    content: `Sehubungan dengan libur akhir tahun, pelayanan administrasi Kelurahan Karang Asem diatur sebagai berikut:

- **23 Desember 2026** — pelayanan normal, pukul 08.00-15.00 WIB
- **24-26 Desember 2026** — tutup
- **27-30 Desember 2026** — pelayanan normal
- **31 Desember 2026-1 Januari 2027** — tutup
- **2 Januari 2027** — pelayanan kembali normal

Warga yang membutuhkan surat keterangan mendesak dimohon mengajukan sebelum 23 Desember 2026.

## Layanan darurat

Meski pelayanan administrasi tutup, posko darurat tetap siaga 24 jam untuk melayani laporan kebencanaan, gangguan keamanan, dan kebutuhan medis mendesak.

Nomor posko dapat dilihat pada halaman Kontak. Untuk keadaan darurat yang mengancam nyawa, segera hubungi 112 atau 119.

## Imbauan

Warga diimbau memeriksa instalasi listrik dan saluran air sebelum meninggalkan rumah, serta tidak membuang sampah ke saluran drainase selama musim hujan.

Kami mengucapkan selamat berlibur dan tetap menjaga keamanan lingkungan.`,
  },
  {
    id: 'ar_batik',
    slug: 'kisah-bu-sri-perajin-batik-banten',
    title: 'Kisah Bu Sri, Perajin Batik Banten yang Bertahan di Tengah Sepi Pesanan',
    dek: 'Dari garasi rumah, ia memproduksi kain batik motif khas Banten. Pandemi hampir menutup usahanya, kini pesanan mulai kembali.',
    category: 'budaya',
    author: 'rina-marlina',
    cover: cover('budaya'),
    coverCaption: 'Ilustrasi perajin batik Banten.',
    tags: ['batik Banten', 'UMKM', 'cerita warga'],
    views: 1720,
    publishedAt: '2026-10-29T10:40:00+07:00',
    content: `Di sebuah garasi rumah di RW 04, Sri Wahyuni (54) menggoreskan canting berisi lilin panas ke atas kain. Motif yang ia buat bukan motif umum, melainkan corak khas Banten dengan warna tanah dan biru tua.

Ia mulai menekuni batik pada 2009. Keterampilan itu dipelajarinya dari sang ibu yang merupakan perajin batik di Serang.

"Awalnya cuma bikin untuk keluarga. Lama-lama ada tetangga yang pesan, lalu tetangga itu bawa ke luar kota," kisahnya.

## Bertahan saat pandemi

Pandemi COVID-19 hampir mematikan usahanya. Pesanan turun drastis, sementara harga bahan baku naik. Bu Sri sempat beralih menjual makanan ringan untuk menyambung hidup.

"Alhamdulillah sekarang pesanan mulai kembali. Banyak yang pesan untuk seragam kantor dan kenang-kenangan," kata dia.

## Regenerasi

Bu Sri kini mengajari empat ibu muda di lingkungannya. Ia berharap batik Banten makin dikenal dan tidak berhenti di generasinya.

"Kalau anak muda mau belajar, saya ajari gratis. Yang penting jangan sampai motif ini hilang."

Produknya dipasarkan secara luring dan melalui media sosial. Warga yang ingin melihat langsung dapat menghubungi kelurahan untuk dipertemukan dengan Bu Sri.`,
  },
  {
    id: 'ar_jumatbersih',
    slug: 'jumat-bersih-jadi-agenda-rutin-warga',
    title: 'Jumat Bersih Jadi Agenda Rutin, Warga Gotong Royong di 12 Titik',
    dek: 'Program kerja bakti mingguan menyasar saluran air dan fasilitas umum. Partisipasi warga dinilai makin tinggi.',
    category: 'sosial',
    author: 'redaksi',
    cover: photo('sungai'),
    coverCaption: 'Warga bergotong royong membersihkan saluran air pada Jumat Bersih.',
    tags: ['gotong royong', 'jumat bersih', 'kebersihan'],
    views: 860,
    publishedAt: '2026-10-27T08:15:00+07:00',
    content: `Program Jumat Bersih di Kelurahan Karang Asem kini menjadi agenda rutin mingguan. Setiap Jumat pagi, warga bersama perangkat kelurahan membersihkan saluran air, jalan lingkungan, dan fasilitas umum di 12 titik.

Kegiatan dimulai pukul 07.00 WIB dan berlangsung sekitar dua jam. Petugas menyediakan alat kebersihan, sedangkan warga membawa peralatan sendiri.

"Gotong royong itu identitas kita. Kalau lingkungan bersih, warga juga lebih sehat," kata Lurah Karang Asem.

## Fokus pada pencegahan

Selain membersihkan, kegiatan ini menjadi ajang sosialisasi pencegahan demam berdarah. Kader kesehatan memeriksa jentik nyamuk di penampungan air warga.

Pada kegiatan terakhir, petugas menemukan 11 titik penampungan air yang positif jentik. Warga langsung diberi edukasi dan bubuk abate.

## Partisipasi meningkat

Kelurahan mencatat kenaikan partisipasi dari 180 orang pada bulan pertama menjadi sekitar 320 orang. Sejumlah RW bahkan menambah jadwal kerja bakti mandiri.

Warga yang ingin mengusulkan lokasi kerja bakti dapat menyampaikan melalui ketua RT atau kanal pengaduan di situs ini.`,
  },
  {
    id: 'ar_dbd',
    slug: 'waspada-dbd-fogging-delapan-rw',
    title: 'Waspada DBD, Fogging Dilakukan di Delapan RW Mulai Pekan Ini',
    dek: 'Kasus demam berdarah meningkat setelah hujan intensitas tinggi. Warga diminta memberantas sarang nyamuk di rumah masing-masing.',
    category: 'kesehatan',
    author: 'sari-wulandari',
    cover: photo('posyandu'),
    coverCaption: 'Petugas kesehatan menyiapkan pengasapan (fogging) di kawasan permukiman.',
    tags: ['DBD', 'fogging', 'kesehatan', 'waspada'],
    breaking: true,
    featured: true,
    views: 6210,
    publishedAt: '2026-11-21T06:30:00+07:00',
    updatedAt: '2026-11-21T07:15:00+07:00',
    content: `Kelurahan Karang Asem bersama Puskesmas Cibeber akan melakukan fogging (pengasapan) di delapan RW mulai pekan ini. Langkah itu diambil setelah kasus demam berdarah dengue (DBD) meningkat dalam tiga pekan terakhir.

Berdasarkan data puskesmas, tercatat 27 kasus DBD di wilayah Kelurahan Karang Asem sepanjang November. Sebanyak 19 kasus di antaranya dialami anak usia sekolah.

"Kenaikan ini berkaitan dengan musim hujan. Banyak genangan air di barang bekas dan talang rumah yang jadi sarang nyamuk," kata Kepala Puskesmas Cibeber.

## Jadwal fogging

Fogging dijadwalkan berlangsung pagi hari, mulai pukul 06.00 WIB, dengan urutan:

- Selasa, 24 November: RW 01 dan RW 02
- Rabu, 25 November: RW 03 dan RW 04
- Kamis, 26 November: RW 05 dan RW 06
- Jumat, 27 November: RW 07 dan RW 08

Warga diminta membuka pintu dan jendela saat pengasapan, menutup makanan, serta menjauhkan hewan peliharaan sementara.

## Fogging bukan solusi utama

Puskesmas menegaskan fogging hanya membunuh nyamuk dewasa, bukan jentik. Pemberantasan sarang nyamuk (PSN) dengan 3M Plus tetap menjadi cara paling efektif.

Warga diimbau menguras penampungan air seminggu sekali, menutup rapat tempat penampungan, dan mendaur ulang barang bekas yang dapat menampung air.

"Kalau hanya fogging tanpa PSN, dua minggu kemudian nyamuk kembali. Ini harus dilakukan bersama," tegasnya.

## Gejala yang perlu diwaspadai

Warga diminta segera memeriksakan diri jika mengalami demam tinggi mendadak, nyeri kepala, nyeri otot, mual, dan muncul bintik merah di kulit. Jangan menunda hingga kondisi memburuk.

Layanan konsultasi dapat dilakukan di puskesmas terdekat atau posyandu. Untuk keadaan darurat, hubungi layanan gawat darurat 119.`,
  },
  // Draf redaksi — tampil di dashboard admin, tidak tampil di publik.
  {
    id: 'ar_draft_gedung',
    slug: 'rencana-gedung-serbaguna-rw-05',
    title: 'Rencana Gedung Serbaguna RW 05 Masuk Tahap Perencanaan',
    dek: 'Draf berita menunggu konfirmasi anggaran dan luas lahan dari dinas terkait.',
    category: 'pembangunan',
    author: 'dimas-prakoso',
    cover: cover('pembangunan'),
    tags: ['gedung serbaguna', 'perencanaan'],
    status: 'draft',
    views: 0,
    publishedAt: '2026-11-21T05:00:00+07:00',
    content: `Kelurahan Karang Asem mematangkan rencana pembangunan gedung serbaguna di RW 05. Lokasi yang diusulkan berada di atas lahan aset kelurahan seluas 400 meter persegi.

Draf ini masih menunggu konfirmasi besaran anggaran dari dinas terkait. Naskah belum dipublikasikan dan menunggu wawancara lanjutan.`,
  },
  {
    id: 'ar_draft_wawancara',
    slug: 'wawancara-lurah-arah-baru-karang-asem',
    title: 'Wawancara Lurah: Arah Baru Pelayanan Karang Asem',
    dek: 'Draf wawancara khusus soal digitalisasi layanan dan prioritas 2027.',
    category: 'pemerintahan',
    author: 'rina-marlina',
    cover: cover('pemerintahan'),
    tags: ['wawancara', 'lurah'],
    status: 'draft',
    views: 0,
    publishedAt: '2026-11-20T16:00:00+07:00',
    content: `Naskah wawancara dengan Lurah Karang Asem membahas rencana digitalisasi layanan, penataan PKL, dan prioritas pembangunan 2027.

Draf belum selesai: menunggu verifikasi kutipan dan foto sesi wawancara.`,
  },
];

export const SEED_AGENDA = [
  {
    id: 'ag_musrenbang',
    title: 'Musrenbang Tingkat Kecamatan Cibeber',
    date: '2026-11-26',
    time: '08.00 - 13.00 WIB',
    place: 'Aula Kecamatan Cibeber',
    description: 'Pembahasan usulan prioritas kelurahan bersama perangkat kecamatan dan Bappeda Kota Cilegon.',
  },
  {
    id: 'ag_voli',
    title: 'Final Turnamen Voli Piala Lurah',
    date: '2026-11-30',
    time: '15.30 WIB',
    place: 'Lapangan RW 05',
    description: 'Laga puncak turnamen voli antar-RT, dilanjutkan penyerahan trofi dan hadiah pembinaan.',
  },
  {
    id: 'ag_posyandu',
    title: 'Posyandu Serentak & Pemberian Vitamin A',
    date: '2026-12-13',
    time: '07.30 - 11.00 WIB',
    place: 'Balai RW 01-12',
    description: 'Penimbangan balita, imunisasi, pemeriksaan ibu hamil, dan pembagian vitamin A.',
  },
  {
    id: 'ag_pasarmurah',
    title: 'Pasar Murah Akhir Tahun',
    date: '2026-12-20',
    time: '07.00 - 12.00 WIB',
    place: 'Halaman Kantor Kelurahan',
    description: 'Sembako harga terjangkau, bazar UMKM warga, dan layanan administrasi cepat.',
  },
  {
    id: 'ag_jumat',
    title: 'Jumat Bersih Serentak',
    date: '2026-11-27',
    time: '07.00 - 09.00 WIB',
    place: '12 titik di seluruh RW',
    description: 'Kerja bakti membersihkan saluran air dan fasilitas umum, dilanjutkan pemeriksaan jentik.',
  },
];

export const SEED_COMMENTS = [
  {
    id: 'cm_1',
    articleSlug: 'musrenbang-karang-asem-2026-tetapkan-12-prioritas',
    name: 'Endang S.',
    email: 'endang@example.com',
    body: 'Terima kasih sudah transparan. Tolong matriks usulannya benar-benar diunggah ya, jangan cuma janji.',
    status: 'approved',
    createdAt: '2026-11-20T10:12:00+07:00',
  },
  {
    id: 'cm_2',
    articleSlug: 'musrenbang-karang-asem-2026-tetapkan-12-prioritas',
    name: 'Warga RW 06',
    email: 'rw06@example.com',
    body: 'Drainase RW 06 semoga jadi prioritas juga, setiap hujan selalu meluap ke jalan.',
    status: 'approved',
    createdAt: '2026-11-20T12:40:00+07:00',
  },
  {
    id: 'cm_3',
    articleSlug: 'waspada-dbd-fogging-delapan-rw',
    name: 'Ibu Rini',
    email: 'rini@example.com',
    body: 'Jadwal RW 03 kapan tepatnya? Di pengumuman tertulis Rabu, tapi jamnya belum ada.',
    status: 'approved',
    createdAt: '2026-11-21T07:02:00+07:00',
  },
  {
    id: 'cm_4',
    articleSlug: 'waspada-dbd-fogging-delapan-rw',
    name: 'Anonim',
    email: 'anon@example.com',
    body: 'Cek juga selokan belakang pasar, banyak genangan.',
    status: 'pending',
    createdAt: '2026-11-21T07:30:00+07:00',
  },
  {
    id: 'cm_5',
    articleSlug: 'posyandu-melati-layani-180-balita',
    name: 'Bapak Joko',
    email: 'joko@example.com',
    body: 'Posyandu berikutnya tanggal berapa? Anak saya baru pindah ke RW 03.',
    status: 'pending',
    createdAt: '2026-11-18T19:15:00+07:00',
  },
];

export const SEED_MESSAGES = [
  {
    id: 'msg_1',
    name: 'Hendra Gunawan',
    email: 'hendra@example.com',
    subject: 'Tawaran pelatihan UMKM',
    body: 'Selamat pagi, kami komunitas UMKM Cibeber ingin menawarkan pelatihan pembukuan gratis untuk warga Karang Asem. Mohon info kontak yang bisa dihubungi.',
    read: false,
    createdAt: '2026-11-19T09:20:00+07:00',
  },
  {
    id: 'msg_2',
    name: 'Warga RT 004',
    email: 'warga004@example.com',
    subject: 'Lampu jalan mati',
    body: 'Lampu di depan musholla RT 004 sudah mati sejak sepekan. Mohon dibantu dicek. Terima kasih.',
    read: false,
    createdAt: '2026-11-20T20:05:00+07:00',
  },
];

export function seedDatabase() {
  return {
    meta: { version: 1, createdAt: new Date().toISOString(), secret: null },
    settings: {
      name: 'Info Kelurahan',
      tagline: 'Berita, informasi, dan suara warga Kelurahan Karang Asem',
      description:
        'Info Kelurahan adalah portal berita dan informasi resmi warga Kelurahan Karang Asem, Kecamatan Cibeber, Kota Cilegon. Menyajikan kabar pemerintahan, pembangunan, kesehatan, pendidikan, ekonomi warga, hingga agenda lingkungan.',
      village: 'Kelurahan Karang Asem',
      district: 'Kecamatan Cibeber',
      city: 'Kota Cilegon',
      province: 'Banten',
      address: 'Jl. Jerang Barat No. 12, RT 004/001, Kel. Karang Asem, Kec. Cibeber, Kota Cilegon, Banten 42425',
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
      editors: ['Redaksi Info Kelurahan', 'Rina Marlina', 'Dimas Prakoso'],
      announcement: 'Selamat datang di Info Kelurahan — kanal informasi resmi warga Karang Asem, Cibeber, Cilegon.',
      seo: {
        title: 'Info Kelurahan — Berita & Informasi Warga Karang Asem, Cilegon',
        description:
          'Portal berita kelurahan: pemerintahan, pembangunan, kesehatan, pendidikan, UMKM, dan agenda warga Kelurahan Karang Asem, Kecamatan Cibeber, Kota Cilegon.',
        keywords:
          'info kelurahan, berita cilegon, kelurahan karang asem, kecamatan cibeber, berita kelurahan, pemerintahan kelurahan',
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
    agenda: SEED_AGENDA,
    comments: SEED_COMMENTS,
    messages: SEED_MESSAGES,
    subscribers: [
      { id: 'sub_1', email: 'warga.karangasem@example.com', createdAt: '2026-10-20T08:00:00+07:00' },
      { id: 'sub_2', email: 'umkm.cibeber@example.com', createdAt: '2026-11-01T09:30:00+07:00' },
    ],
    media: [],
    stats: { totalViews: 0, daily: {} },
  };
}
