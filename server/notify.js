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

const TG_API = 'https://api.telegram.org';

export const esc = (input) =>
  String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const rupiah = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;

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
    const res = await fetch(`${TG_API}/bot${cfg.botToken}/sendMessage`, {
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
    return { sent: true };
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
    const res = await fetch(`${TG_API}/bot${botToken}/answerCallbackQuery`, {
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
    const res = await fetch(`${TG_API}/bot${botToken}/editMessageText`, {
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

const orderLines = (order) =>
  (order.items || [])
    .map(
      (item) =>
        `  • ${esc(item.name)}${item.variantLabel ? ` (${esc(item.variantLabel)})` : ''} × ${item.qty} — ${rupiah(
          Number(item.price) * Number(item.qty)
        )}`
    )
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
    `💵 <b>Total: ${rupiah(order.total)}</b>`,
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
    `💵 ${rupiah(order.total)}`,
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
    `💵 ${rupiah(order.total)}`,
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
