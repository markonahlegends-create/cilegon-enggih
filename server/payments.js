/**
 * VERIFIKASI PEMBAYARAN — satu pintu untuk semua jalur.
 *
 * KENAPA MODUL INI ADA
 * Pesanan bisa dinyatakan LUNAS dari dua tempat: dashboard admin dan bot
 * Telegram (tombol sekali-klik). Kalau keduanya menulis logika sendiri-sendiri,
 * cepat atau lambat akan berbeda — misalnya satu jalur menambah timeline,
 * yang lain tidak; atau satu jalur mengirim notifikasi, yang lain lupa.
 *
 * Semua jalur sekarang memanggil `markOrderPaid()` di sini.
 */

import { store } from './db.js';

const wibStamp = (date = new Date()) =>
  new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);

/**
 * Tandai pesanan LUNAS.
 *
 * @param {object} order          pesanan yang tersimpan
 * @param {object} opts
 * @param {'admin'|'telegram'|'sistem'} opts.via  jalur verifikasi (masuk audit)
 * @param {string} [opts.actor]   nama pelaku, mis. "admin" / "admin@telegram"
 * @param {number} [opts.verifiedAmount] jumlah yang benar-benar diterima
 * @param {Function} [opts.persist] pengganti penyimpanan (dipakai uji otomatis)
 * @returns {Promise<{ok:boolean, reason?:string, order?:object, changed?:boolean}>}
 */
export const markOrderPaid = async (order, opts = {}) => {
  if (!order) return { ok: false, reason: 'Pesanan tidak ditemukan.' };

  if (order.paymentStatus === 'LUNAS') {
    // Sudah lunas: jangan dobel timeline & jangan kirim notifikasi lagi.
    return { ok: true, changed: false, order };
  }
  if (order.status === 'DIBATALKAN') {
    return {
      ok: false,
      reason: 'Pesanan sudah dibatalkan, jadi tidak bisa ditandai lunas.'
    };
  }

  const via = opts.via || 'admin';
  const actor = opts.actor || via;
  const labelJalur =
    via === 'telegram'
      ? 'via Telegram'
      : via === 'sistem'
        ? 'otomatis oleh sistem'
        : 'oleh Admin';

  const amountLine =
    opts.verifiedAmount != null
      ? ` (Rp ${Number(opts.verifiedAmount).toLocaleString('id-ID')})`
      : '';

  const next = {
    ...order,
    paymentStatus: 'LUNAS',
    paidAt: order.paidAt || new Date().toISOString(),
    paidVerifiedVia: via,
    updatedAt: new Date().toISOString(),
    timeline: [
      ...(order.timeline || []),
      {
        time: wibStamp(),
        status: `Pembayaran diverifikasi LUNAS ${labelJalur}${amountLine}`,
        location:
          via === 'telegram' ? 'Bot Telegram Admin' : 'Dashboard Admin Cilegon Enggih'
      }
    ]
  };

  /*
   * Pesanan yang tadinya menunggu konfirmasi otomatis masuk antrean proses.
   * Tanpa ini, pesanan yang sudah LUNAS masih tertahan di status
   * "Menunggu Konfirmasi" dan admin harus mengubahnya manual — padahal
   * pembayaran sudah beres.
   */
  if (next.status === 'MENUNGGU_KONFIRMASI') {
    next.status = 'DIPROSES';
    next.timeline.push({
      time: wibStamp(),
      status: 'Pesanan otomatis masuk antrean proses setelah pembayaran lunas',
      location: 'Sistem Cilegon Enggih'
    });
  }

  const persist = typeof opts.persist === 'function' ? opts.persist : (doc) => store.put('orders', doc);
  await persist(next);
  return { ok: true, changed: true, order: next, actor };
};
