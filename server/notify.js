/**
 * Notifikasi Telegram untuk admin Cilegon Enggih.
 *
 * Kenapa Telegram: gratis, tanpa biaya per pesan, tanpa risiko nomor diblokir,
 * dan bisa dipakai tanpa verifikasi bisnis (beda dengan WhatsApp Cloud API).
 *
 * Konfigurasi (Dashboard Admin → Pengaturan → Notifikasi Telegram):
 *   - botToken : token dari @BotFather
 *   - chatId   : ID chat/grup admin dari @userinfobot atau getUpdates
 *   - events   : pilih kejadian mana yang dikirim
 *
 * Prinsip penting: notifikasi TIDAK PERNAH menggagalkan alur bisnis.
 * Kalau token kosong / Telegram error, semua fungsi di sini hanya mengembalikan
 * { sent: false, reason } tanpa melempar error ke pemanggil.
 */

/*
 * Dasar URL Bot API. Bisa diarahkan ke server tiruan lewat env hanya untuk
 * keperluan pengujian otomatis (scripts/test-notify-e2e.mjs). Di produksi
 * nilainya selalu https://api.telegram.org.
 */
/** Dasar URL Bot API. Dibaca ulang tiap panggilan agar bisa diuji. */
export const telegramApiBase = () =>
  String(process.env.TELEGRAM_API_BASE || 'https://api.telegram.org').replace(/\/+$/, '');

export const esc = (input) =>
  String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const rupiah = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;

/**
 * Nominal akhir pesanan.
 *
 * KENAPA PERLU HELPER
 * Pesanan yang BARU dibuat (endpoint POST /api/orders) menyimpan `totalAmount`,
 * sedangkan pesanan yang dibaca ulang dari database memakai `total`. Template
 * yang hanya membaca `order.total` menampilkan "Total: Rp 0" untuk pesanan
 * baru — admin melihat angka nol padahal pembeli harus transfer ratusan ribu.
 * Helper ini menerima kedua bentuk, plus menghitung ulang dari komponennya
 * bila keduanya kosong.
 */
export const orderTotal = (order) => {
  if (!order) return 0;
  const direct = Number(order.total ?? order.totalAmount);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const recomputed =
    (Number(order.subtotal) || 0) +
    (Number(order.shippingCost) || 0) +
    (Number(order.uniqueCode) || 0) -
    (Number(order.voucherDiscount) || 0);
  return Math.max(0, recomputed);
};

const DEFAULTS = {
  enabled: false,
  botToken: '',
  chatId: '',
  notifyNewOrder: true,
  notifyPaymentProof: true,
  notifyPaid: true,
  notifyShipped: true,
  notifyB2B: true
};

/** Baca konfigurasi Telegram dari settings, dengan default aman. */
export const telegramConfig = (settings) => {
  const saved = (settings && settings.telegram) || {};
  return {
    ...DEFAULTS,
    ...saved,
    botToken: String(saved.botToken || '').trim(),
    chatId: String(saved.chatId || '').trim(),
    enabled: saved.enabled === true || Boolean(saved.botToken && saved.chatId && saved.enabled !== false)
  };
};

export const isTelegramReady = (settings) => {
  const cfg = telegramConfig(settings);
  return Boolean(cfg.botToken && cfg.chatId && cfg.enabled);
};

/**
 * Kirim pesan HTML ke Telegram. Tidak pernah melempar error.
 * @returns {Promise<{sent: boolean, reason?: string}>}
 */
export const sendTelegramMessage = async (settings, html, options = {}) => {
  const cfg = telegramConfig(settings);
  if (!cfg.botToken || !cfg.chatId) {
    return { sent: false, reason: 'not-configured' };
  }
  if (cfg.enabled === false) {
    return { sent: false, reason: 'disabled' };
  }

  try {
    const res = await fetch(`${telegramApiBase()}/bot${cfg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: cfg.chatId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {})
      })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { sent: false, reason: `telegram-${res.status}: ${text.slice(0, 160)}` };
    }
    const data = await res.json().catch(() => ({}));
    if (data && data.ok === false) {
      // Telegram bisa membalas HTTP 200 dengan ok:false (mis. chat tidak ditemukan).
      return { sent: false, reason: `telegram: ${data.description || 'ditolak'}` };
    }
    return { sent: true, messageId: data?.result?.message_id };
  } catch (err) {
    return { sent: false, reason: `network: ${err.message}` };
  }
};

/**
 * Jawab ketukan tombol inline (memunculkan toast kecil di Telegram).
 * Tanpa ini, Telegram menampilkan indikator loading terus di tombolnya.
 * Tidak pernah melempar error.
 */
export const answerCallbackQuery = async (botToken, callbackQueryId, text = '') => {
  if (!botToken || !callbackQueryId) return { ok: false };
  try {
    const res = await fetch(`${telegramApiBase()}/bot${botToken}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text, show_alert: false })
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

/**
 * Ubah teks pesan yang sudah terkirim — dipakai untuk menandai
 * "✅ LUNAS diverifikasi" pada pesan bukti transfer, sehingga admin bisa
 * melihat sekilas pesanan mana yang sudah ditangani.
 * Tidak pernah melempar error.
 */
export const editTelegramMessage = async (botToken, chatId, messageId, html) => {
  if (!botToken || !chatId || !messageId) return { ok: false };
  try {
    const res = await fetch(`${telegramApiBase()}/bot${botToken}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    return { ok: res.ok };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
};

/** Kirim lalu telan semua error (dipakai di route order). */
export const notifySafe = async (settings, html, options) => {
  try {
    return await sendTelegramMessage(settings, html, options);
  } catch (err) {
    console.error('[telegram] gagal kirim:', err.message);
    return { sent: false, reason: err.message };
  }
};

/* ------------------------------------------------------------------ */
/* Template pesan                                                      */
/* ------------------------------------------------------------------ */

/**
 * Baris item pesanan.
 *
 * KENAPA TIDAK MENEMPELKAN LABEL LAGI
 * `item.name` sudah memuat label pilihan, mis.
 * "Gantungan Kunci Karet 3D (CEGAN-01 · LARGE)". Menambahkan
 * `item.variantLabel` membuatnya tercetak dua kali — persis yang dikeluhkan
 * dari tangkapan layar bot:
 *   "Gantungan Kunci Karet 3D (CEGAN-01 · LARGE) (CEGAN-01 · LARGE) × 1".
 * Label hanya ditempel bila belum ada di dalam nama.
 */
const orderLines = (order) =>
  (order.items || [])
    .map((item) => {
      const nama = String(item.name || '');
      const label = String(item.variantLabel || '').trim();
      const labelSudahAda = label && nama.toLowerCase().includes(label.toLowerCase());
      const namaLengkap = label && !labelSudahAda ? `${nama} (${label})` : nama;
      return `  • ${esc(namaLengkap)} × ${item.qty} — ${rupiah(
        Number(item.price) * Number(item.qty)
      )}`;
    })
    .join('\n');

const preOrderLine = (order) =>
  order.isPreOrder
    ? `\n⏳ <b>PRE-ORDER</b> ${esc(order.preOrderNote || '7–15 hari kerja')}`
    : '';

export const templateNewOrder = (order) =>
  [
    '🛒 <b>PESANAN BARU</b>',
    '',
    `<b>${esc(order.orderId)}</b> • ${esc(order.invoiceNumber || '-')}`,
    `👤 ${esc(order.customerName)}`,
    `📱 ${esc(order.customerPhone)}`,
    `📍 ${esc(order.destination)}`,
    '',
    orderLines(order),
    '',
    `Subtotal: ${rupiah(order.subtotal)}`,
    `Ongkir: ${rupiah(order.shippingCost)}`,
    order.voucherDiscount ? `Voucher: -${rupiah(order.voucherDiscount)}` : '',
    order.uniqueCode ? `Kode unik: ${rupiah(order.uniqueCode)}` : '',
    `💵 <b>Total: ${rupiah(orderTotal(order))}</b>`,
    `💳 ${esc(order.paymentMethod)}`,
    preOrderLine(order),
    '',
    '<i>Buka Dashboard Admin untuk verifikasi pembayaran.</i>'
  ]
    .filter((line) => line !== '')
    .join('\n');

export const templatePaymentProof = (order) =>
  [
    '📸 <b>BUKTI TRANSFER DIUNGGAH</b>',
    '',
    `<b>${esc(order.orderId)}</b>`,
    `👤 ${esc(order.customerName)}`,
    `💵 ${rupiah(orderTotal(order))}`,
    order.paymentProofNote ? `📝 ${esc(order.paymentProofNote)}` : '',
    '',
    '<i>Tekan tombol di bawah untuk memverifikasi tanpa membuka dashboard.</i>'
  ]
    .filter((line) => line !== '')
    .join('\n');

/**
 * Tombol inline "Verifikasi LUNAS" untuk notifikasi bukti transfer.
 *
 * KENAPA: admin sering di luar rumah / hanya memegang ponsel. Tanpa ini,
 * pembeli harus menunggu admin membuka laptop dan dashboard. Dengan satu
 * ketukan di Telegram, pembayaran langsung LUNAS.
 *
 * Panjang `data` callback dibatasi Telegram 64 byte. "paid:" (5) + orderId
 * (maks ~14) masih jauh di bawah batas.
 */
export const paymentProofKeyboard = (order) => ({
  inline_keyboard: [
    [
      { text: '✅ Verifikasi LUNAS', callback_data: `paid:${order.orderId}` },
      { text: '🚫 Tandai Batal', callback_data: `void:${order.orderId}` }
    ],
    [{ text: '📄 Buka Dashboard', url: 'https://cilegon-enggih.vercel.app/admin' }]
  ]
});

export const templatePaid = (order) =>
  [
    '✅ <b>PEMBAYARAN LUNAS</b>',
    '',
    `<b>${esc(order.orderId)}</b>`,
    `👤 ${esc(order.customerName)}`,
    `💵 ${rupiah(orderTotal(order))}`,
    preOrderLine(order),
    '',
    '<i>Pesanan siap diproses / diproduksi.</i>'
  ]
    .filter((line) => line !== '')
    .join('\n');

export const templateShipped = (order) =>
  [
    '🚚 <b>PAKET DIKIRIM</b>',
    '',
    `<b>${esc(order.orderId)}</b>`,
    `👤 ${esc(order.customerName)}`,
    `📦 ${esc(order.courier || '-')}`,
    `🔖 Resi: <code>${esc(order.resi || '-')}</code>`,
    '',
    '<i>Pembeli bisa melacak lewat halaman Lacak Pesanan.</i>'
  ].join('\n');

export const templateB2B = (inquiry) =>
  [
    '🏢 <b>PENAWARAN B2B BARU</b>',
    '',
    `👤 ${esc(inquiry.company || inquiry.name || '-')}`,
    `📱 ${esc(inquiry.phone || '-')}`,
    `✉️ ${esc(inquiry.email || '-')}`,
    `📦 ${esc(inquiry.productInterest || '-')} × ${esc(inquiry.quantity || '-')}`,
    inquiry.notes ? `📝 ${esc(inquiry.notes)}` : '',
    '',
    '<i>Lihat di Dashboard Admin → Korporat / B2B.</i>'
  ]
    .filter((line) => line !== '')
    .join('\n');

export const templateTest = () =>
  [
    '🔔 <b>TES NOTIFIKASI BERHASIL</b>',
    '',
    'Bot Telegram Cilegon Enggih sudah terhubung.',
    'Notifikasi pesanan baru akan dikirim ke chat ini.',
    '',
    `<i>${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</i>`
  ].join('\n');
