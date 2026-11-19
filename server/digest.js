/**
 * Digest harian penjualan & trafik ke Telegram.
 *
 * Tujuan: pemilik toko tidak perlu membuka dashboard tiap pagi. Satu pesan
 * berisi angka penting semalam sudah cukup untuk memutuskan hari itu.
 *
 * Prinsip (sama dengan notify.js):
 *   - Tidak pernah menggagalkan apa pun. Kalau Telegram belum diatur atau
 *     error, fungsi hanya mengembalikan { sent: false, reason }.
 *   - Tanpa data pribadi: hanya agregat (jumlah pengunjung, pesanan, omzet,
 *     kata kunci yang paling dicari). Tidak ada nama pembeli, nomor HP, email.
 *   - Dihasilkan dari fungsi yang sama dengan dashboard (buildInsights), jadi
 *     angka di Telegram tidak pernah berbeda dengan angka di layar admin.
 */

import { buildInsights, pruneOldEvents, storeDay, EVENT_TYPES } from './insights.js';
import { sendTelegramMessage, isTelegramReady } from './notify.js';

const esc = (input) =>
  String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const rupiah = (value) => `Rp ${(Number(value) || 0).toLocaleString('id-ID')}`;
const angka = (value) => (Number(value) || 0).toLocaleString('id-ID');

/** Nama hari & bulan dalam Bahasa Indonesia tanpa bergantung locale Node. */
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const tanggalPanjang = (day) => {
  const [y, m, d] = String(day).split('-').map(Number);
  if (!y || !m || !d) return String(day);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${HARI[dt.getUTCDay()]}, ${d} ${BULAN[m - 1]} ${y}`;
};

/**
 * Susun teks digest. Dipisah dari pengiriman supaya bisa diuji tanpa jaringan.
 *
 * @param {{events: Array, orders: Array, products: Array, days?: number}} input
 * @returns {string} HTML siap kirim ke Telegram
 */
export const buildDigest = ({ events = [], orders = [], products = [], days = 1 }) => {
  const report = buildInsights({ events, orders, products, days });

  const hariIni = storeDay();
  const kemarinDate = new Date();
  kemarinDate.setUTCDate(kemarinDate.getUTCDate() - 1);
  const kemarin = storeDay(kemarinDate);

  const barisHarian = (day) =>
    report.traffic.daily.find((d) => d.day === day) || {
      day, views: 0, visitors: 0, orders: 0, revenue: 0, conversion: 0
    };

  const hariKemarin = barisHarian(kemarin);
  const hariIniRow = barisHarian(hariIni);

  /* ---------- Pesanan semalam ---------- */
  const ordKemarin = orders.filter(
    (o) => storeDay(new Date(o.createdAt || Date.now())) === kemarin
  );
  const lunas = ordKemarin.filter((o) => o.paymentStatus === 'LUNAS');
  const menunggu = ordKemarin.filter(
    (o) => o.paymentStatus !== 'LUNAS' && o.status !== 'BATAL'
  );
  const omzetLunas = lunas.reduce((s, o) => s + Number(o.totalAmount || 0), 0);

  /* ---------- Kata kunci pencarian ---------- */
  const evKemarin = events.filter((e) => e.day === kemarin);
  const kataKunci = new Map();
  evKemarin
    .filter((e) => e.type === 'search' && e.keyword)
    .forEach((e) => {
      const k = String(e.keyword).toLowerCase().trim().slice(0, 40);
      if (k) kataKunci.set(k, (kataKunci.get(k) || 0) + 1);
    });
  const topCari = [...kataKunci.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  /* ---------- Produk paling dilihat & paling laku ---------- */
  const topDilihat = [...report.products]
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 3);
  const topLaku = [...report.products]
    .filter((p) => p.sold > 0)
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 3);

  /* ---------- Bagikan (fitur baru) ---------- */
  const jumlahShare = evKemarin.filter((e) => e.type === 'share').length;

  /* ---------- Stok menipis ---------- */
  const stokTipis = [...(report.stockForecast || [])]
    .filter((s) => s.daysLeft !== null && s.daysLeft <= 7 && s.daysLeft >= 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 3);

  /* ---------- Susun pesan ---------- */
  const tren = hariKemarin.visitors - (barisHarian(storeDay(new Date(
    Date.UTC(kemarinDate.getUTCFullYear(), kemarinDate.getUTCMonth(), kemarinDate.getUTCDate() - 1)
  ))).visitors || 0);
  const trenTeks =
    tren > 0 ? `📈 naik ${tren} dari hari sebelumnya`
      : tren < 0 ? `📉 turun ${Math.abs(tren)} dari hari sebelumnya`
        : '➖ sama dengan hari sebelumnya';

  const L = [];
  L.push('<b>📊 RINGKASAN HARIAN CILEGON ENGGIH</b>');
  L.push(`<i>${esc(tanggalPanjang(kemarin))}</i>`);
  L.push('');

  L.push('<b>💰 PENJUALAN</b>');
  L.push(`• Pesanan masuk: <b>${angka(ordKemarin.length)}</b>`);
  L.push(`• Sudah lunas: ${angka(lunas.length)} · Omzet <b>${rupiah(omzetLunas)}</b>`);
  if (menunggu.length) {
    L.push(`• ⏳ Menunggu pembayaran: <b>${angka(menunggu.length)}</b>`);
  }
  L.push('');

  L.push('<b>👥 TRAFIK</b>');
  L.push(`• Pengunjung unik: <b>${angka(hariKemarin.visitors)}</b> ${trenTeks}`);
  L.push(`• Halaman dilihat: ${angka(hariKemarin.views)}`);
  L.push(`• Konversi: ${hariKemarin.conversion}%`);
  L.push('');

  if (topLaku.length) {
    L.push('<b>🔥 PALING LAKU</b>');
    topLaku.forEach((p, i) => {
      L.push(`${i + 1}. ${esc(p.name || p.id)} — ${angka(p.sold)} terjual`);
    });
    L.push('');
  }

  if (topDilihat.length) {
    L.push('<b>👀 PALING DILIHAT</b>');
    topDilihat.forEach((p, i) => {
      L.push(`${i + 1}. ${esc(p.name || p.id)} — ${angka(p.views)} dilihat`);
    });
    L.push('');
  }

  if (topCari.length) {
    L.push('<b>🔎 PALING DICARI PEMBELI</b>');
    topCari.forEach(([k, n], i) => {
      L.push(`${i + 1}. “${esc(k)}” (${n}×)`);
    });
    L.push('  <i>Kalau banyak yang mencari tapi belum ada di katalog, itu ide produk.</i>');
    L.push('');
  } else {
    L.push('<b>🔎 PALING DICARI PEMBELI</b>');
    L.push('<i>Belum ada pencarian tercatat kemarin.</i>');
    L.push('');
  }

  if (jumlahShare > 0) {
    L.push(`🔗 Produk dibagikan pembeli: <b>${angka(jumlahShare)}</b> kali`);
    L.push('');
  }

  if (stokTipis.length) {
    L.push('<b>⚠️ STOK MENIPIS</b>');
    stokTipis.forEach((s) => {
      L.push(`• ${esc(s.name || s.id)} — sisa ${s.daysLeft} hari`);
    });
    L.push('');
  }

  L.push('—');
  L.push(`Hari ini sejauh ini: ${angka(hariIniRow.visitors)} pengunjung, ${angka(hariIniRow.orders)} pesanan.`);
  if (!report.dataStatus.ready && report.dataStatus.note) {
    L.push(`<i>${esc(report.dataStatus.note)}</i>`);
  }
  L.push('<i>Angka tanpa data pribadi. Detail lengkap di /admin → Analitik.</i>');

  return L.join('\n');
};

/**
 * Susun lalu kirim digest. Tidak pernah melempar error.
 *
 * @returns {Promise<{sent: boolean, reason?: string, text?: string}>}
 */
export const sendDailyDigest = async ({ store, settings, readOrders, readProducts }) => {
  if (!isTelegramReady(settings)) {
    return { sent: false, reason: 'Telegram belum diatur (bot token / chat id kosong).' };
  }

  try {
    const [events, orders, products] = await Promise.all([
      store.list('analytics_events'),
      readOrders(),
      readProducts()
    ]);

    const text = buildDigest({
      events: pruneOldEvents(events || [], 180).filter((e) => EVENT_TYPES.has(e.type)),
      orders: orders || [],
      products: products || [],
      days: 7
    });

    const result = await sendTelegramMessage(settings, text);
    return { ...result, text };
  } catch (err) {
    return { sent: false, reason: err?.message || 'Gagal menyusun digest.' };
  }
};
