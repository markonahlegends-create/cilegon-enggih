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

const SANDBOX_BASE = 'https://app.sandbox.midtrans.com';
const PRODUCTION_BASE = 'https://app.midtrans.com';

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
  const isProduction = flag === 'true' || flag === '1' || flag === 'ya';

  return {
    serverKey,
    clientKey,
    isProduction,
    base: isProduction ? PRODUCTION_BASE : SANDBOX_BASE,
    /** Siap dipakai hanya kalau kedua kunci terisi. */
    ready: Boolean(serverKey && clientKey)
  };
};

/**
 * URL skrip Snap untuk browser.
 * ClientKey aman dikirim ke browser (memang sifatnya publik); ServerKey tidak.
 */
export const snapScriptUrl = (isProduction) =>
  `${isProduction ? PRODUCTION_BASE : SANDBOX_BASE}/snap/snap.js`;

/**
 * Header otorisasi Midtrans: Basic base64(ServerKey + ":").
 * Password-nya KOSONG — ini yang sering salah dan menyebabkan 401.
 */
export const basicAuthHeader = (serverKey) =>
  `Basic ${Buffer.from(`${serverKey}:`, 'utf8').toString('base64')}`;

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
export const verifySignature = (payload, serverKey) => {
  if (!serverKey) return false;
  if (!payload || typeof payload !== 'object') return false;

  const { order_id, status_code, gross_amount, signature_key } = payload;
  if (!order_id || !status_code || gross_amount == null || !signature_key) return false;

  const expected = buildSignature({
    orderId: String(order_id),
    statusCode: String(status_code),
    grossAmount: String(gross_amount),
    serverKey
  });

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature_key), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
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

  const res = await fetchImpl(`${config.base}/snap/v1/transactions`, {
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

  const res = await fetchImpl(`${config.base}/v2/${encodeURIComponent(midtransOrderId)}/status`, {
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
  return { ok: res.ok, status: res.status, data };
};
