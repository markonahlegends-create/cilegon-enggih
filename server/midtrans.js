/**
 * MIDTRANS — satu pintu untuk pembayaran otomatis.
 *
 * KENAPA MODUL INI ADA
 * Sebelumnya pembeli transfer manual, lalu admin mencocokkan nominal di mutasi
 * bank dengan kode unik 3 digit. Itu pekerjaan yang tidak ada habisnya dan
 * mudah salah. Dengan Midtrans, status pembayaran datang dari webhook yang
 * sudah ditandatangani secara kriptografis — tidak ada yang perlu dicocokkan
 * dengan mata.
 *
 * TIGA HAL YANG TIDAK BOLEH SALAH, dan dijaga di sini:
 *
 *  1. TANDA TANGAN. Notifikasi tanpa tanda tangan sah = siapa pun bisa
 *     melunaskan pesanan orang lain. Signature KEY = SHA512(order_id +
 *     status_code + gross_amount + ServerKey). Kalau ServerKey belum diisi,
 *     semua permintaan DITOLAK (fail-closed) — sama seperti pola
 *     TELEGRAM_WEBHOOK_SECRET di proyek ini.
 *
 *  2. NOMINAL. Tanda tangan sah hanya membuktikan "pesan ini benar dari
 *     Midtrans", BUKAN "nominalnya benar". Nominal wajib dicocokkan dengan
 *     total pesanan di database. Tanpa ini, transaksi Rp 1.000 yang sah bisa
 *     melunaskan pesanan Rp 300.000.
 *
 *  3. `capture` + `challenge`. Transaksi kartu yang ditandai berisiko oleh
 *     Midtrans TIDAK boleh dianggap lunas. Kalau dianggap lunas, barang bisa
 *     dikirim tanpa uangnya benar-benar masuk.
 *
 * Modul ini sengaja bebas dari framework dan bebas dari pemanggilan jaringan
 * saat diimpor, supaya bisa diuji tanpa server dan tanpa internet.
 */

import crypto from 'node:crypto';

/*
 * MIDTRANS PUNYA DUA HOST, BUKAN SATU.
 *
 *   Snap (membuat tagihan + snap.js di browser) : app.midtrans.com
 *   Core API (cek status, batalkan transaksi)    : api.midtrans.com
 *
 * Sandbox: app.sandbox.midtrans.com / api.sandbox.midtrans.com
 *
 * KENAPA DIPISAH — pernah menjadi bug produksi nyata:
 * seluruh panggilan memakai `app.midtrans.com`, termasuk
 * `GET /v2/{order_id}/status`. Host `app.*` tidak melayani Core API, jadi
 * jawabannya selalu 404. Akibatnya jaring pengaman webhook ("Saya Sudah
 * Bayar — Periksa Status") tidak pernah bisa melunaskan apa pun, dan
 * pembatalan pesanan mengira transaksi "sudah tidak aktif" padahal kode
 * QRIS-nya masih hidup dan bisa dibayar.
 */
const SNAP_SANDBOX_BASE = 'https://app.sandbox.midtrans.com';
const SNAP_PRODUCTION_BASE = 'https://app.midtrans.com';
const API_SANDBOX_BASE = 'https://api.sandbox.midtrans.com';
const API_PRODUCTION_BASE = 'https://api.midtrans.com';

/**
 * Baca konfigurasi dari environment.
 *
 * `MIDTRANS_IS_PRODUCTION` sengaja dibaca eksplisit (bukan sekadar "ada isinya")
 * karena salah menganggap sandbox sebagai produksi berarti pembeli melihat
 * "pembayaran berhasil" padahal uang tidak pernah masuk.
 */
export const midtransConfig = (env = process.env) => {
  const serverKey = String(env.MIDTRANS_SERVER_KEY || '').trim();
  const clientKey = String(env.MIDTRANS_CLIENT_KEY || '').trim();
  const flag = String(env.MIDTRANS_IS_PRODUCTION ?? '').trim().toLowerCase();

  /*
   * MODE DITEBAK DARI KUNCI, BUKAN DIPERCAYA DARI FLAG SAJA.
   *
   * Midtrans memakai awalan berbeda untuk tiap lingkungan:
   *   sandbox    : SB-Mid-server-…  /  SB-Mid-client-…
   *   produksi   : Mid-server-…     /  Mid-client-…
   *
   * Kalau flag dan kunci saling bertentangan, permintaan ke Midtrans akan
   * ditolak (401/404) dengan pesan yang tidak menjelaskan apa-apa. Lebih
   * buruk lagi kalau flag bilang produksi tetapi kunci sandbox — pembeli
   * melihat "berhasil bayar" tanpa uang masuk.
   *
   * Aturan main: KUNCI MENANG. Flag hanya dipakai kalau kunci tidak berpola
   * yang dikenali (mis. kunci lama/format lain).
   */
  const awalanServer = serverKey.match(/^(SB-)?Mid-server-/i);
  const awalanClient = clientKey.match(/^(SB-)?Mid-client-/i);
  const dariServer = awalanServer ? !/^SB-/i.test(serverKey) : null;
  const dariClient = awalanClient ? !/^SB-/i.test(clientKey) : null;

  const modeDariKunci = dariServer ?? dariClient;
  const modeDariFlag = flag === 'true' || flag === '1' || flag === 'ya';
  const isProduction = modeDariKunci != null ? modeDariKunci : modeDariFlag;

  /* Dicatat supaya diagnosa bisa memberi tahu kalau flag dan kunci bertentangan. */
  const konflik = modeDariKunci != null && modeDariKunci !== modeDariFlag;

  /*
   * `snapBase` untuk membuat tagihan & memuat snap.js; `apiBase` untuk Core
   * API (cek status, cancel). `base` dipertahankan sebagai alias snapBase
   * supaya kode lama tidak pecah — tetapi JANGAN dipakai untuk /v2/*.
   */
  const snapBase = isProduction ? SNAP_PRODUCTION_BASE : SNAP_SANDBOX_BASE;
  const apiBase = isProduction ? API_PRODUCTION_BASE : API_SANDBOX_BASE;

  /*
   * SIGNATURE SECRET KEY — kunci KETIGA, terpisah sejak 28 Oktober 2026.
   *
   * Selama bertahun-tahun tanda tangan notifikasi dihitung dengan Server Key,
   * sehingga satu nilai cukup untuk dua pekerjaan: mengotorisasi panggilan API
   * DAN memverifikasi notifikasi. Midtrans memisahkannya:
   *
   *   Server Key           → Authorization: Basic pada panggilan API
   *   Signature Secret Key → SHA512(order_id + status_code + gross_amount + kunci ini)
   *
   * Untuk merchant yang mendaftar sebelum tanggal itu, kedua nilai AWALNYA
   * SAMA — sehingga integrasi yang hanya memakai Server Key lulus semua uji
   * dan terus bekerja... sampai salah satunya dibuat/di-generate ulang.
   * Setelah itu panggilan API tetap sukses, uang tetap masuk, tetapi SETIAP
   * notifikasi ditolak sebagai "tanda tangan tidak sah". Persis yang terjadi
   * di toko ini: cek status 200, notifikasi ditolak 403.
   *
   * KOSONG → pakai Server Key (perilaku lama). Ini penting supaya integrasi
   * yang belum punya Signature Secret Key tidak langsung mati; dan memang
   * benar untuk merchant lama yang kedua nilainya masih sama.
   */
  const signatureKey = String(env.MIDTRANS_SIGNATURE_SECRET_KEY || '').trim() || serverKey;
  /*
   * Kunci lama selama masa transisi setelah "Regenerate".
   *
   * Midtrans menyarankan menerima tanda tangan dari kunci LAMA maupun BARU
   * untuk sementara, karena notifikasi yang sedang di-retry masih ditandatangani
   * kunci lama. Tanpa ini, notifikasi yang datang tepat setelah rotasi akan
   * ditolak — dan pembeli yang sudah membayar tidak pernah dilunaskan.
   */
  const signatureKeyLama = String(env.MIDTRANS_SIGNATURE_SECRET_KEY_LAMA || '').trim();

  return {
    serverKey,
    clientKey,
    /** Kunci untuk MEMVERIFIKASI tanda tangan notifikasi (bukan untuk API). */
    signatureKey,
    /** Kunci sebelumnya, diterima selama masa transisi rotasi. */
    signatureKeyLama,
    /*
     * true kalau Signature Secret Key diisi terpisah dari Server Key. Dipakai
     * diagnosa untuk memberi tahu admin kunci mana yang sebenarnya menandatangani
     * notifikasi tanpa pernah menampilkan nilainya.
     */
    signatureKeyTerpisah: Boolean(signatureKey) && signatureKey !== serverKey,
    isProduction,
    snapBase,
    apiBase,
    /** @deprecated alias snapBase; panggilan /v2/* wajib memakai apiBase. */
    base: snapBase,
    /** true kalau MIDTRANS_IS_PRODUCTION bertentangan dengan kunci. */
    konflik,
    /** Lingkungan yang ditunjukkan oleh kunci itu sendiri (null = tak dikenali). */
    modeDariKunci,
    /** Siap dipakai hanya kalau kedua kunci terisi. */
    ready: Boolean(serverKey && clientKey)
  };
};

/**
 * URL skrip Snap untuk browser.
 * ClientKey aman dikirim ke browser (memang sifatnya publik); ServerKey tidak.
 */
export const snapScriptUrl = (isProduction) =>
  `${isProduction ? SNAP_PRODUCTION_BASE : SNAP_SANDBOX_BASE}/snap/snap.js`;

/**
 * Header otorisasi Midtrans: Basic base64(ServerKey + ":").
 * Password-nya KOSONG — ini yang sering salah dan menyebabkan 401.
 */
export const basicAuthHeader = (serverKey) =>
  `Basic ${Buffer.from(`${serverKey}:`, 'utf8').toString('base64')}`;

/**
 * SIDIK KUNCI — "kunci mana yang dipakai?", tanpa membocorkan kuncinya.
 *
 * KENAPA PERLU
 * Gejala "pembeli sudah bayar tapi pesanan tetap menunggu" punya dua sebab yang
 * MUSTAHIL dibedakan tanpa informasi ini:
 *
 *   a. Midtrans tidak mengirim notifikasi (URL notifikasi belum diisi), atau
 *   b. Midtrans mengirim, tetapi tanda tangannya ditolak karena ServerKey kita
 *      berbeda dari kunci akun tempat transaksi itu dibuat.
 *
 * Pada kasus (b) pesannya MASUK dan langsung dibuang tanpa jejak — persis
 * kebuntuan yang membuat kasus order CE-20261124-701 butuh berjam-jam untuk
 * dipahami. Dengan sidik kunci, admin bisa mencocokkan 8 karakter terakhir
 * ServerKey di dashboard Midtrans → Settings → Access Keys.
 *
 * 8 karakter terakhir TIDAK cukup untuk menebak kunci (ServerKey ±32 karakter
 * acak), jadi aman ditampilkan. Kunci penuh tidak pernah dikirim ke mana pun.
 */
export const sidikKunci = (serverKey) => {
  const kunci = String(serverKey || '').trim();
  if (!kunci) return null;
  return {
    panjang: kunci.length,
    ekor: kunci.slice(-8),
    /** Sandbox atau produksi menurut awalan kunci itu sendiri. */
    mode: /^SB-/i.test(kunci) ? 'sandbox' : /^Mid-server-/i.test(kunci) ? 'produksi' : 'tidak-dikenali'
  };
};

/**
 * Hitung tanda tangan notifikasi.
 *
 * PENTING: `grossAmount` wajib dipakai APA ADANYA seperti yang dikirim
 * Midtrans (mis. "105000.00"), bukan hasil pembulatan kita. Kalau dibulatkan
 * jadi 105000, tanda tangannya tidak akan pernah cocok.
 */
export const buildSignature = ({ orderId, statusCode, grossAmount, serverKey }) =>
  crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`, 'utf8')
    .digest('hex');

/**
 * Verifikasi tanda tangan notifikasi. Fail-closed: tanpa ServerKey → false.
 *
 * Perbandingan memakai timingSafeEqual supaya tidak bisa ditebak lewat
 * perbedaan waktu respons (timing attack).
 */
export const verifySignature = (payload, kunci) => {
  if (!payload || typeof payload !== 'object') return false;

  const { order_id, status_code, gross_amount, signature_key } = payload;
  if (!order_id || !status_code || gross_amount == null || !signature_key) return false;

  /*
   * `kunci` boleh satu string, atau daftar kandidat: [SignatureSecretKey,
   * SignatureSecretKeyLama, ServerKey]. Notifikasi dinyatakan SAH kalau cocok
   * dengan SALAH SATU. Ini yang membuat rotasi kunci tidak memutus pelunasan
   * pesanan yang pembayarannya sudah masuk.
   *
   * Perbandingan tetap constant-time untuk setiap kandidat, dan tidak pernah
   * berhenti di kandidat pertama yang cocok secara posisional.
   */
  const kandidat = (Array.isArray(kunci) ? kunci : [kunci])
    .map((k) => String(k || '').trim())
    .filter(Boolean);
  if (kandidat.length === 0) return false;

  const b = Buffer.from(String(signature_key), 'utf8');
  let cocok = false;
  for (const k of kandidat) {
    const expected = Buffer.from(
      buildSignature({
        orderId: String(order_id),
        statusCode: String(status_code),
        grossAmount: String(gross_amount),
        serverKey: k
      }),
      'utf8'
    );
    if (expected.length === b.length && crypto.timingSafeEqual(expected, b)) cocok = true;
  }
  return cocok;
};

/** "105000.00" → 105000. Dibulatkan karena rupiah tidak punya sen. */
export const grossAmountToRupiah = (grossAmount) => {
  const n = Number(grossAmount);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n);
};

/**
 * Terjemahkan status Midtrans menjadi keputusan untuk pesanan kita.
 *
 * Mengembalikan salah satu dari:
 *   'LUNAS'  → tandai lunas, pindahkan ke antrean proses
 *   'TUNGGU' → belum lunas, tidak ada yang perlu dilakukan
 *   'BATAL'  → batalkan pesanan, kembalikan stok
 *   'TINJAU' → perlu dilihat manusia (kartu berisiko)
 *
 * Status yang tidak dikenal sengaja dianggap 'TUNGGU' (fail safe): lebih baik
 * pesanan terlihat belum lunas daripada dilunaskan karena salah tafsir.
 */
export const mapTransactionStatus = (payload) => {
  /*
   * `payload` sengaja dibaca begini, bukan lewat destructuring parameter.
   * Default parameter `= {}` TIDAK berlaku saat yang masuk benar-benar `null`,
   * sehingga `mapTransactionStatus(null)` akan melempar TypeError — dan di
   * dalam webhook, satu galat seperti itu berubah jadi balasan 500 yang
   * membuat Midtrans terus mengirim ulang notifikasi yang sama.
   */
  const { transaction_status, fraud_status } = payload || {};
  const status = String(transaction_status || '').toLowerCase();
  const fraud = String(fraud_status || '').toLowerCase();

  if (status === 'settlement') return 'LUNAS';

  if (status === 'capture') {
    if (fraud === 'accept') return 'LUNAS';
    // challenge / deny / kosong: JANGAN dilunaskan otomatis.
    return fraud === 'deny' ? 'TUNGGU' : 'TINJAU';
  }

  if (status === 'deny') return 'TUNGGU';
  if (status === 'cancel' || status === 'expire' || status === 'failure') return 'BATAL';
  if (status === 'pending') return 'TUNGGU';

  return 'TUNGGU';
};

/**
 * Midtrans hanya menerima `order_id` alfanumerik, tanda hubung, garis bawah,
 * titik, maksimal 50 karakter — dan MENOLAK order_id yang sudah pernah dipakai.
 *
 * Kalau pembeli membuka tagihan, membiarkannya kedaluwarsa, lalu mencoba bayar
 * lagi, order_id yang sama akan ditolak. Karena itu percobaan kedua dan
 * seterusnya diberi akhiran -R2, -R3, dst.
 */
export const buildMidtransOrderId = (orderId, attempt = 0) => {
  const base = String(orderId || '').replace(/[^A-Za-z0-9._-]/g, '');
  if (!attempt) return base.slice(0, 50);
  const suffix = `-R${attempt + 1}`;
  return `${base.slice(0, 50 - suffix.length)}${suffix}`;
};

/**
 * Susun parameter Snap dari pesanan kita.
 *
 * `gross_amount` SELALU diambil dari pesanan di database, tidak pernah dari
 * browser — kalau nominal datang dari browser, pembeli bisa mengubahnya.
 */
export const buildSnapPayload = (order, { finishUrl } = {}) => {
  const grossAmount = Math.round(Number(order.totalAmount) || 0);
  if (grossAmount <= 0) throw new Error('Total pesanan tidak valid untuk Midtrans.');

  const items = (order.items || []).map((item) => ({
    id: String(item.productId || item.sku || 'item').slice(0, 50),
    price: Math.round(Number(item.price) || 0),
    quantity: Math.max(1, Math.round(Number(item.qty) || 1)),
    name: String(item.name || 'Produk').slice(0, 50)
  }));

  // Midtrans menolak kalau jumlah item_details ≠ gross_amount, misalnya karena
  // ada ongkir atau diskon. Daripada menghitung ulang di sini (rawan selisih
  // satu rupiah), item_details tidak dikirim sama sekali — hanya total.
  // Dengan begitu tidak ada ketidakcocokan yang bisa menggagalkan transaksi.
  const payload = {
    transaction_details: {
      order_id: order.midtransOrderId || buildMidtransOrderId(order.orderId, order.paymentAttempt || 0),
      gross_amount: grossAmount
    },
    customer_details: {
      first_name: String(order.customerName || 'Pembeli').slice(0, 50),
      phone: String(order.customerPhone || '').slice(0, 20),
      ...(order.customerEmail && order.customerEmail !== '-'
        ? { email: String(order.customerEmail).slice(0, 100) }
        : {})
    },
    expiry: { unit: 'hours', duration: Number(order.paymentWindowHours) || 24 }
  };

  if (finishUrl) payload.callbacks = { finish: finishUrl };

  // Simpan untuk keperluan audit; tidak dikirim ke Midtrans.
  payload.__items = items;

  return payload;
};

/**
 * Minta token Snap. Melempar Error dengan pesan yang bisa dibaca admin kalau
 * Midtrans menolak, supaya tidak muncul "gagal" tanpa penjelasan.
 */
export const createSnapToken = async (order, config, { fetchImpl = fetch, finishUrl } = {}) => {
  if (!config?.ready) throw new Error('Midtrans belum dikonfigurasi (MIDTRANS_SERVER_KEY / CLIENT_KEY kosong).');

  const body = buildSnapPayload(order, { finishUrl });
  delete body.__items;

  const res = await fetchImpl(`${config.snapBase}/snap/v1/transactions`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: basicAuthHeader(config.serverKey)
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Midtrans mengirim balasan yang tidak bisa dibaca (HTTP ${res.status}).`);
  }

  if (!res.ok || !data.token) {
    const detail = Array.isArray(data.error_messages)
      ? data.error_messages.join('; ')
      : data.status_message || `HTTP ${res.status}`;
    throw new Error(`Midtrans menolak membuat tagihan: ${detail}`);
  }

  return {
    token: data.token,
    redirectUrl: data.redirect_url,
    midtransOrderId: body.transaction_details.order_id
  };
};

/**
 * Tanyakan status transaksi langsung ke Midtrans.
 *
 * Ini jaring pengaman kalau webhook telat atau gagal masuk. Tanpa ini, pembeli
 * yang sudah membayar bisa melihat pesanannya masih "menunggu pembayaran".
 */
export const fetchTransactionStatus = async (midtransOrderId, config, { fetchImpl = fetch } = {}) => {
  if (!config?.ready) throw new Error('Midtrans belum dikonfigurasi.');

  const res = await fetchImpl(`${config.apiBase}/v2/${encodeURIComponent(midtransOrderId)}/status`, {
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: basicAuthHeader(config.serverKey) }
  });

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* bukan JSON — biarkan kosong, ditangani di bawah */
  }

  /*
   * `alasan` ADA SUPAYA KEGAGALAN BISA DIKATAKAN, BUKAN DITEBAK.
   *
   * Dulu kegagalan hanya menghasilkan `ok:false` tanpa keterangan, sehingga
   * pembeli melihat "memeriksa status..." yang tidak pernah selesai dan admin
   * tidak punya petunjuk apa pun. Kasus nyata: host Core API salah (memakai
   * app.midtrans.com) → selalu 404 → tidak ada satu pun pesan yang
   * menjelaskannya.
   */
  return {
    ok: res.ok,
    status: res.status,
    data,
    alasan: res.ok ? null : jelaskanGagalStatus(res.status, data, text)
  };
};

/**
 * Terjemahkan kegagalan GET /v2/{order_id}/status menjadi kalimat yang bisa
 * ditindaklanjuti admin/pembeli.
 */
export const jelaskanGagalStatus = (httpStatus, data = {}, rawText = '') => {
  const pesanMidtrans = String(data?.status_message || '').trim();
  if (httpStatus === 404) {
    return (
      'Midtrans tidak mengenal tagihan ini (404). Kemungkinan: pembeli belum memilih ' +
      'metode pembayaran, atau transaksi terjadi di akun/lingkungan Midtrans yang berbeda ' +
      'dari kunci yang terpasang.'
    );
  }
  if (httpStatus === 401 || httpStatus === 403) {
    return `Kunci Midtrans ditolak (HTTP ${httpStatus}). Periksa MIDTRANS_SERVER_KEY di Vercel.`;
  }
  if (httpStatus >= 500) {
    return `Midtrans sedang bermasalah (HTTP ${httpStatus}). Coba lagi beberapa saat.`;
  }
  if (pesanMidtrans) return `Midtrans menolak (HTTP ${httpStatus}): ${pesanMidtrans}`;
  const potongan = String(rawText || '').slice(0, 120);
  return potongan
    ? `Midtrans mengirim balasan tak terduga (HTTP ${httpStatus}): ${potongan}`
    : `Midtrans mengirim balasan kosong (HTTP ${httpStatus}).`;
};

/**
 * Batalkan transaksi di sisi Midtrans.
 *
 * KENAPA PERLU
 * Membatalkan pesanan hanya di database kita TIDAK cukup: kode QRIS yang sudah
 * tampil di layar pembeli (atau tautan Snap yang masih terbuka) tetap bisa
 * dipindai dan dibayar. Kalau itu terjadi, uang masuk untuk pesanan yang sudah
 * kita tandai DIBATALKAN — persis kasus yang paling merepotkan admin.
 *
 * Jadi pembatalan lokal SELALU diikuti pembatalan di Midtrans. Kalau Midtrans
 * menolak karena transaksinya memang sudah tidak aktif (expire/cancel), itu
 * bukan kegagalan — hasilnya sudah sesuai keinginan kita.
 */
export const cancelTransaction = async (midtransOrderId, config, { fetchImpl = fetch } = {}) => {
  if (!config?.ready) return { ok: false, status: 0, data: {}, alasan: 'belum-dikonfigurasi' };

  const res = await fetchImpl(`${config.apiBase}/v2/${encodeURIComponent(midtransOrderId)}/cancel`, {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: basicAuthHeader(config.serverKey) }
  });

  const text = await res.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* bukan JSON — ditangani lewat status HTTP */
  }

  /*
   * 412 = "Transaction cannot be cancelled" (sudah settle/expire/cancel).
   * Status itu jelas: tagihan memang tidak aktif lagi, jadi pembatalan lokal
   * aman dilanjutkan.
   *
   * 404 TIDAK BOLEH diperlakukan begitu saja.
   *
   * Dulu 404 dianggap "sudah tidak aktif". Padahal 404 juga muncul kalau
   * transaksinya ADA dan masih bisa dibayar tetapi ditanyakan ke host/akun
   * yang salah — dan itu pernah benar-benar terjadi (host Core API keliru),
   * sehingga pesanan ditutup di toko sementara kode QRIS-nya masih hidup.
   * Sekarang 404 diverifikasi dulu: kalau tidak ada bukti bahwa tagihan sudah
   * mati, pembatalan DITOLAK agar tidak ada uang masuk untuk pesanan yang
   * sudah dibatalkan.
   */
  let sudahTidakAktif = res.status === 412;
  let alasan = res.ok ? 'dibatalkan' : 'ditolak-midtrans';

  if (!res.ok && res.status === 404) {
    const bukti = await verifikasiTidakAktif(midtransOrderId, config, { fetchImpl });
    sudahTidakAktif = bukti;
    alasan = res.ok ? 'dibatalkan' : bukti ? 'sudah-tidak-aktif' : 'tidak-terverifikasi-404';
  }

  return {
    ok: res.ok || sudahTidakAktif,
    status: res.status,
    data,
    alasan
  };
};

/**
 * Pembatalan dibalas 404. Apakah tagihannya benar-benar sudah mati?
 *
 * Hanya percaya 404 kalau GET status (host Core API yang benar) menjawab dan
 * menyatakan status yang memang sudah tidak bisa dibayar lagi. Kalau GET status
 * sendiri 404, artinya transaksi tidak dikenal akun ini — mematikan pesanan
 * lokal tetap TIDAK aman kalau-uang bisa masuk lewat akun lain, jadi jawab
 * false dan biarkan admin memeriksa.
 */
const verifikasiTidakAktif = async (midtransOrderId, config, { fetchImpl = fetch } = {}) => {
  const mati = ['expire', 'cancel', 'deny', 'failure'];
  try {
    const res = await fetchTransactionStatus(midtransOrderId, config, { fetchImpl });
    if (!res.ok) return false;
    return mati.includes(String(res.data?.transaction_status || ''));
  } catch {
    return false;
  }
};
