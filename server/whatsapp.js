/**
 * PENGIRIM WHATSAPP KE PEMBELI.
 *
 * KENAPA MODUL TERPISAH
 * Sampai sekarang toko ini hanya punya satu kanal keluar: Telegram ke ADMIN.
 * Akibatnya kode OTP "akun pembeli" harus diteruskan manual oleh admin —
 * pembeli menunggu, admin harus bangun jam 2 pagi, dan kode 6 digit sempat
 * berpindah tangan lewat chat. Modul ini menutup celah itu: pesan dikirim
 * langsung ke nomor WhatsApp pembeli.
 *
 * GATEWAY
 * Memakai API Fonnte yang bentuknya sederhana (form-encoded + header
 * Authorization), dan—karena itu yang paling luas dipakai toko kecil di
 * Indonesia—tanpa biaya per pesan template seperti WhatsApp Cloud API.
 *
 * JEBAKAN YANG SUDAH DIPERHITUNGKAN
 *
 *  1. **Fonnte membalas HTTP 200 walaupun gagal.** Badan responsnya memuat
 *     `{"status": false, "reason": "..."}`. Kalau kita hanya memeriksa
 *     `res.ok`, kegagalan akan terlihat seperti sukses dan pembeli menunggu
 *     kode yang tidak pernah datang. Karena itu badan respons SELALU dibaca.
 *
 *  2. **Nomor Indonesia harus berformat 62…**, bukan 08… dan tanpa "+".
 *
 *  3. **Token tidak boleh bocor.** Fungsi ini mengembalikan {sent, reason}
 *     saja; token tidak pernah masuk ke pesan galat, log, atau audit.
 *
 *  4. **Tidak pernah melempar error.** Pemanggilnya adalah alur checkout/OTP;
 *     kegagalan WhatsApp tidak boleh menggagalkan pesanan.
 */

/**
 * Normalisasi nomor ke format yang diterima gateway: 62xxxxxxxxxx.
 *
 * Menerima: 08xxx, +628xxx, 628xxx, 8xxx, dengan spasi/strip/titik.
 * Mengembalikan '' kalau tidak masuk akal — pemanggil yang memutuskan.
 */
export const nomorUntukWhatsApp = (nomor) => {
  let d = String(nomor || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = `62${d.slice(1)}`;
  else if (d.startsWith('8')) d = `62${d}`;
  else if (d.startsWith('620')) d = `62${d.slice(3)}`;
  /* Nomor Indonesia yang sah: 62 diikuti 9–14 digit. */
  if (!/^62\d{8,14}$/.test(d)) return '';
  return d;
};

/** Konfigurasi dari pengaturan toko, dengan env sebagai cadangan. */
export const whatsappConfig = (settings) => {
  const saved = (settings && settings.whatsappApi) || {};
  const token = String(saved.token || process.env.FONNTE_TOKEN || '').trim();
  const endpoint = String(saved.endpoint || 'https://api.fonnte.com/send').trim();
  return {
    token,
    endpoint,
    /*
     * `enabled` dianggap true kalau token terisi dan tidak dimatikan secara
     * eksplisit. Membalik logika ini akan membuat toko yang sudah mengisi
     * token tetap tidak mengirim apa pun — kegagalan yang sulit dilacak.
     */
    enabled: Boolean(token) && saved.enabled !== false,
    /** Kirim juga salinan ke admin? Berguna saat pertama kali memasang. */
    notifyAdminCopy: saved.notifyAdminCopy === true
  };
};

export const isWhatsAppReady = (settings) => whatsappConfig(settings).enabled;

/**
 * Kirim satu pesan WhatsApp.
 *
 * @returns {Promise<{sent: boolean, reason?: string, httpStatus?: number}>}
 */
export const sendWhatsApp = async (
  settings,
  nomor,
  pesan,
  { fetchImpl = fetch } = {}
) => {
  const cfg = whatsappConfig(settings);

  if (!cfg.enabled) {
    return { sent: false, reason: 'belum-dikonfigurasi' };
  }

  const target = nomorUntukWhatsApp(nomor);
  if (!target) {
    return { sent: false, reason: 'nomor-tidak-valid' };
  }

  const teks = String(pesan || '').trim();
  if (!teks) return { sent: false, reason: 'pesan-kosong' };

  try {
    const res = await fetchImpl(cfg.endpoint, {
      method: 'POST',
      headers: {
        Authorization: cfg.token,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        target,
        message: teks,
        countryCode: '62'
      }).toString()
    });

    const teksBalasan = await res.text();
    let data = {};
    try {
      data = JSON.parse(teksBalasan);
    } catch {
      /* bukan JSON — hanya status HTTP yang bisa dipakai */
    }

    /*
     * INI PEMERIKSAAN YANG SEBENARNYA.
     *
     * HTTP 200 tidak berarti terkirim. Fonnte membalas
     * {"status": false, "reason": "token tidak valid"} dengan kode 200.
     * Mempercayai res.ok saja akan membuat pembeli menunggu kode yang tidak
     * pernah dikirim — dan tidak ada satu pun log yang menunjukkan sebabnya.
     */
    const berhasil =
      res.ok &&
      (data.status === true || data.status === 'true' || data.status === undefined);

    if (!berhasil) {
      const alasan =
        data.reason ||
        data.message ||
        (data.status === false ? 'gateway-menolak' : `http-${res.status}`);
      /*
       * Sebab dicatat TANPA token. `reason` dari Fonnte aman: isinya alasan
       * seperti "token tidak valid" atau "device disconnected".
       */
      console.warn(`[whatsapp] gagal kirim ke ${target}: ${alasan}`);
      return { sent: false, reason: String(alasan).slice(0, 200), httpStatus: res.status };
    }

    return { sent: true, httpStatus: res.status };
  } catch (err) {
    console.error('[whatsapp] galat jaringan:', err.message);
    return { sent: false, reason: err.message };
  }
};

/** Pembungkus aman — dipakai alur yang tidak boleh gagal karena WhatsApp. */
export const kirimWhatsAppAman = async (settings, nomor, pesan, opsi) => {
  try {
    return await sendWhatsApp(settings, nomor, pesan, opsi);
  } catch (err) {
    console.error('[whatsapp] gagal (aman):', err.message);
    return { sent: false, reason: err.message };
  }
};

/* ------------------------------------------------------------------ */
/* Template pesan                                                      */
/* ------------------------------------------------------------------ */

/**
 * Kode verifikasi akun pembeli.
 *
 * Sengaja menyebut nama toko dan tujuan kode ini: kalau pembeli tidak merasa
 * memintanya, ia tahu harus mengabaikan — bukan panik karena mengira akunnya
 * dibobol.
 */
export const templateOtpPembeli = ({ kode, menit, namaToko }) =>
  [
    `*${namaToko || 'Cilegon Enggih'}*`,
    '',
    `Kode verifikasi Anda: *${kode}*`,
    '',
    `Berlaku ${menit} menit. Jangan berikan kode ini kepada siapa pun,`,
    'termasuk yang mengaku petugas toko.',
    '',
    'Kalau Anda tidak sedang membuka menu "Pesanan Saya", abaikan pesan ini.'
  ].join('\n');

/**
 * Pengingat tagihan yang belum dibayar.
 *
 * Isinya harus cukup untuk MEMBAYAR tanpa membuka situs lebih dulu: nomor
 * pesanan, nominal, sisa waktu, dan tautan. Tautan pembayaran ini yang
 * menjawab masalah "kode/QRIS-nya di mana" — pembeli tidak perlu mencari.
 */
export const templatePengingatPembayaran = ({
  namaToko,
  namaPembeli,
  orderId,
  totalText,
  sisaText,
  tautanBayar,
  tautanLacak,
  tahap = 1
}) =>
  [
    `*${namaToko || 'Cilegon Enggih'}*`,
    '',
    /*
     * Nada mengikuti tahap. Tahap 1 masih santai; tahap 2 adalah kesempatan
     * terakhir dan harus terasa begitu — tanpa mengancam atau mengarang.
     */
    tahap >= 2
      ? `Halo${namaPembeli ? ` ${namaPembeli}` : ''}, waktu pembayaran pesanan Anda hampir habis.`
      : `Halo${namaPembeli ? ` ${namaPembeli}` : ''}, pesanan Anda masih menunggu pembayaran.`,
    '',
    `Nomor pesanan: *${orderId}*`,
    `Total: *${totalText}*`,
    `Sisa waktu: *${sisaText}*`,
    '',
    tautanBayar ? `Bayar sekarang:\n${tautanBayar}` : '',
    tautanLacak ? `\nLihat pesanan:\n${tautanLacak}` : '',
    '',
    'Kalau Anda sudah membayar, abaikan pesan ini — status akan diperbarui otomatis.'
  ]
    .filter((baris) => baris !== '')
    .join('\n');

/** Pemberitahuan tagihan hampir kedaluwarsa / sudah kedaluwarsa. */
export const templateTagihanKedaluwarsa = ({ namaToko, orderId }) =>
  [
    `*${namaToko || 'Cilegon Enggih'}*`,
    '',
    `Batas waktu pembayaran pesanan *${orderId}* sudah lewat.`,
    '',
    'Stok pesanan Anda sudah dikembalikan ke toko. Kalau masih ingin',
    'membeli, silakan buat pesanan baru lewat situs kami.'
  ].join('\n');
