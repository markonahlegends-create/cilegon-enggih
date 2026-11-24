/**
 * PENGINGAT OTOMATIS TAGIHAN BELUM DIBAYAR.
 *
 * MASALAH YANG DISELESAIKAN
 * Pembeli menutup popup pembayaran, lalu lupa. Tagihan kedaluwarsa, stok
 * dikembalikan, dan penjualan hilang tanpa jejak. Sampai sekarang tidak ada
 * satu pun pengingat: pembeli harus ingat sendiri.
 *
 * MENGAPA BUKAN CRON SETIAP BEBERAPA MENIT
 * Plan Vercel Hobby hanya mengizinkan cron SEKALI SEHARI (dokumentasi Vercel:
 * "Hobby accounts are limited to cron jobs that run once per day"), dan
 * waktunya pun bergeser sampai ±1 jam. Jadi pengingat yang bergantung pada
 * ketepatan jadwal tidak bisa diandalkan di sini.
 *
 * RANCANGANNYA: PEMICU GANDA, PENJAGA TUNGGAL
 *
 *   1. Saat halaman pesanan dibuka   → pengingat dikirim bila sudah waktunya.
 *   2. Saat cron harian berjalan     → menyapu semua pesanan yang terlewat.
 *   3. Saat admin membuka dashboard  → menyapu juga (murah, hanya membaca).
 *
 * Ketiganya memanggil fungsi yang SAMA, dan fungsi itu idempoten lewat
 * penanda di pesanan (`pengingatTerkirimAt`). Jadi pesanan yang sama tidak
 * akan pernah menerima dua pesan, sekalipun ketiga pemicu berjalan
 * berdekatan.
 *
 * ATURAN KIRIM (sengaja sederhana & bisa dijelaskan ke pemilik toko)
 *   - hanya untuk pesanan yang BELUM lunas dan BELUM dibatalkan
 *   - hanya bila pembeli punya nomor WhatsApp
 *   - hanya bila tagihan masih berlaku (belum kedaluwarsa)
 *   - satu pengingat per pesanan (tidak membanjiri pembeli)
 *   - tidak dikirim pada jam malam (22.00–07.00 WIB)
 */

/** Jam tenang: jangan kirim pengingat tengah malam. Ditulis dalam WIB. */
const JAM_MULAI = 7; // 07.00 WIB
const JAM_SELESAI = 22; // 22.00 WIB

/** Jam sekarang dalam WIB (0–23), apa pun zona waktu servernya. */
export const jamWIB = (sekarang = Date.now()) => {
  /*
   * WIB = UTC+7. Dihitung manual, bukan lewat toLocaleString, supaya
   * hasilnya sama di server Vercel (UTC) maupun di laptop pengembang.
   */
  return new Date(sekarang + 7 * 3_600_000).getUTCHours();
};

export const dalamJamTenang = (sekarang = Date.now()) => {
  const jam = jamWIB(sekarang);
  return jam < JAM_MULAI || jam >= JAM_SELESAI;
};

/**
 * Apakah pesanan ini perlu diingatkan sekarang?
 *
 * Mengembalikan `{ kirim: boolean, alasan: string }` — alasannya dipakai di
 * uji dan di audit, jadi kegagalan bisa dijelaskan tanpa menebak.
 */
export const perluPengingat = (order, { sekarang = Date.now(), windowHours = 24 } = {}) => {
  if (!order) return { kirim: false, alasan: 'pesanan-kosong' };

  if (order.paymentStatus === 'LUNAS') return { kirim: false, alasan: 'sudah-lunas' };
  if (order.paymentStatus === 'DIBATALKAN') return { kirim: false, alasan: 'dibatalkan' };
  if (order.status === 'DIBATALKAN') return { kirim: false, alasan: 'dibatalkan' };
  if (order.status === 'DIKIRIM' || order.status === 'SELESAI') {
    return { kirim: false, alasan: 'sudah-diproses' };
  }

  /*
   * Satu pengingat per pesanan. Tanpa penjaga ini, setiap kali pembeli
   * membuka halaman pesanannya ia akan menerima WhatsApp lagi — dan itu
   * cepat berubah menjadi spam.
   */
  if (order.pengingatTerkirimAt) return { kirim: false, alasan: 'sudah-diingatkan' };

  if (!order.customerPhone) return { kirim: false, alasan: 'tanpa-nomor' };

  if (!order.midtransOrderId && !order.snapRedirectUrl) {
    /*
     * Tanpa tagihan, tidak ada yang bisa dibayar dan tidak ada tautan yang
     * bisa dikirim. Pengingat hanya akan membingungkan.
     */
    return { kirim: false, alasan: 'tanpa-tagihan' };
  }

  const dibuat = new Date(order.createdAt || 0).getTime();
  if (!Number.isFinite(dibuat) || dibuat <= 0) {
    return { kirim: false, alasan: 'tanpa-waktu-dibuat' };
  }

  const kedaluwarsa = dibuat + windowHours * 3_600_000;
  if (sekarang >= kedaluwarsa) return { kirim: false, alasan: 'tagihan-kedaluwarsa' };

  /*
   * KAPAN PENGINGAT PERTAMA.
   *
   * Dua ambang, dipilih yang paling akhir tercapai:
   *   - beberapa jam sebelum kedaluwarsa (mis. 3 jam sebelum batas 24 jam)
   *   - beberapa jam setelah pesanan dibuat (mis. 6 jam)
   *
   * Ambang kedua mencegah pengingat terkirim terlalu cepat ketika jendela
   * pembayaran di toko disetel pendek (mis. 2 jam): dengan hanya ambang
   * "sebelum kedaluwarsa", pembeli akan diingatkan satu jam setelah memesan
   * — terasa mendesak dan mengganggu.
   */
  return { kirim: sekarang >= dibuat, alasan: 'siap' };
};

/**
 * TAHAP PENGINGAT.
 *
 * Satu pengingat saja terbukti kurang: dengan jendela pembayaran 24 jam dan
 * aturan "3 jam sebelum kedaluwarsa", pengingat baru jatuh 21 jam setelah
 * pesanan dibuat — besok pagi, saat pembeli mungkin sudah membeli di tempat
 * lain. Sebaliknya, mengingatkan terlalu cepat (1 jam) terasa mendesak.
 *
 * Karena itu dua tahap:
 *
 *   tahap 1 — `reminderAfterHours` setelah pesanan dibuat (bawaan 6 jam).
 *             Nada: mengingatkan dengan sopan, masih banyak waktu.
 *   tahap 2 — `reminderHoursBefore` sebelum tagihan kedaluwarsa (bawaan 3
 *             jam). Nada: kesempatan terakhir, sebutkan sisa waktu.
 *
 * Kalau kedua ambang sudah terlewat sekaligus (mis. cron baru jalan besok
 * pagi), LANGSUNG tahap 2 — jangan kirim dua pesan berdekatan hanya karena
 * sistem terlambat menyapu.
 */
export const tahapPengingat = (order, { sekarang = Date.now(), windowHours = 24, beforeHours = 3, afterHours = 6 } = {}) => {
  const dibuat = new Date(order?.createdAt || 0).getTime();
  if (!Number.isFinite(dibuat) || dibuat <= 0) return 0;

  const kedaluwarsa = dibuat + windowHours * 3_600_000;
  if (sekarang >= kedaluwarsa) return 0; /* sudah mati, tidak diingatkan */

  if (sekarang >= kedaluwarsa - beforeHours * 3_600_000) return 2;
  if (sekarang >= dibuat + afterHours * 3_600_000) return 1;
  return 0;
};

/**
 * Hitung kapan pengingat sebaiknya dikirim, untuk ditampilkan di UI/admin.
 * Dipisah supaya angka yang ditampilkan sama persis dengan yang dipakai
 * penentu keputusan di atas.
 */
export const waktuPengingat = (order, { windowHours = 24, beforeHours = 3, afterHours = 6 } = {}) => {
  const dibuat = new Date(order?.createdAt || 0).getTime();
  if (!Number.isFinite(dibuat) || dibuat <= 0) return null;
  const kedaluwarsa = dibuat + windowHours * 3_600_000;
  const sebelumBatas = kedaluwarsa - beforeHours * 3_600_000;
  const setelahDibuat = dibuat + afterHours * 3_600_000;
  return Math.max(sebelumBatas, setelahDibuat);
};

/**
 * Versi lengkap: pakai kedua ambang sekaligus.
 * `perluPengingat` di atas sengaja tidak memuat ambang jam karena harus bisa
 * dipanggil tanpa pengaturan; fungsi ini yang dipakai alur sungguhan.
 */
export const perluPengingatLengkap = (order, opsi = {}) => {
  const dasar = perluPengingat(order, opsi);
  if (!dasar.kirim) return { ...dasar, tahap: 0 };

  const tahap = tahapPengingat(order, opsi);
  if (tahap === 0) return { kirim: false, alasan: 'belum-waktunya', tahap: 0 };

  /*
   * `pengingatKe` menyimpan tahap TERAKHIR yang sudah dikirim. Kirim hanya
   * bila tahap sasaran lebih tinggi — sehingga maksimal dua pesan per
   * pesanan, dan tidak ada pengulangan saat halaman dibuka berkali-kali.
   */
  const sudah = Number(order.pengingatKe) || 0;
  if (tahap <= sudah) return { kirim: false, alasan: 'sudah-diingatkan', tahap };

  return { kirim: true, alasan: tahap === 2 ? 'kesempatan-terakhir' : 'siap', tahap };
};

/** Sisa waktu dalam bahasa manusia: "5 jam 12 menit". */
export const sisaWaktuTeks = (kedaluwarsaMs, sekarang = Date.now()) => {
  const sisa = Math.max(0, kedaluwarsaMs - sekarang);
  const jam = Math.floor(sisa / 3_600_000);
  const menit = Math.floor((sisa % 3_600_000) / 60_000);
  if (jam <= 0 && menit <= 0) return 'kurang dari 1 menit';
  if (jam <= 0) return `${menit} menit`;
  return `${jam} jam ${menit} menit`;
};
