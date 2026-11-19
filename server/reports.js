/**
 * SATU SUMBER KEBENARAN untuk laporan penjualan.
 *
 * LATAR BELAKANG (audit 20 Nov 2026)
 * Dashboard punya beberapa tempat yang menghitung angka penjualan sendiri-sendiri
 * (`/api/admin/analytics`, laporan laba-rugi, penjualan, kas, dan `soldCount`
 * pada produk). Akibatnya angka yang dilihat admin bisa berbeda-beda untuk
 * pesanan yang sama. Modul ini menyatukan definisinya supaya:
 *
 *   - omzet di Overview  ==  omzet di halaman Keuangan
 *   - unit terjual       ==  jumlah qty pada pesanan yang dihitung
 *   - produk "terjual"   ==  qty pesanan nyata, bukan angka isian tangan
 */

import { num, dateKey } from './finance.js';

/**
 * Apakah pesanan ini dihitung sebagai penjualan (omzet)?
 *
 * Syaratnya DUA-duanya, bukan salah satu:
 *   1. Pembayaran LUNAS  — uang benar-benar masuk.
 *   2. Pesanan tidak DIBATALKAN — kalau batal, uangnya milik pembeli lagi
 *      (refund), jadi tidak boleh menambah omzet.
 *
 * KENAPA INI PENTING
 * Sebelumnya laporan hanya melihat `paymentStatus === 'LUNAS'`. Pesanan yang
 * sudah dibatalkan/di-refund tetapi status pembayarannya masih LUNAS tetap
 * dihitung sebagai omzet dan kas masuk — angkanya jadi terlalu besar tanpa
 * ada yang menyadari.
 */
export const countsAsSale = (order) =>
  Boolean(order) &&
  order.paymentStatus === 'LUNAS' &&
  order.status !== 'DIBATALKAN';

/** Rentang tanggal (YYYY-MM-DD, WIB) — dipakai semua laporan. */
export const inPeriod = (iso, from = '', to = '') => {
  const key = dateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
};

/** Pesanan yang dihitung dalam periode tertentu. */
export const salesOrders = (orders = [], { from = '', to = '' } = {}) =>
  orders.filter((o) => countsAsSale(o) && inPeriod(o.createdAt, from, to));

/** Total uang yang ditagih/diterima untuk satu pesanan. */
export const orderTotal = (order) => num(order?.totalAmount);

/** Jumlah unit (pcs) pada sekumpulan pesanan. */
export const totalUnits = (orders = []) =>
  orders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, it) => s + num(it.qty), 0),
    0
);

/**
 * Rekap per produk dari pesanan nyata.
 *
 * Dulu penjualan per produk dikelompokkan memakai `item.name` — padahal nama
 * itu memuat label pilihan ("Kaos (Oversize · XL · Navy)"), sehingga satu
 * produk yang sama terpecah menjadi banyak baris. Sekarang dikelompokkan
 * dengan `productId`, dan nama pilihan disimpan terpisah.
 *
 * @returns {Array<{productId:string|null, name:string, qty:number, revenue:number, cost:number, margin:number}>}
 */
export const productSalesFromOrders = (orders = []) => {
  const map = new Map();

  orders.forEach((order) => {
    (order.items || []).forEach((item) => {
      const key = item.productId || item.name || 'lainnya';
      const prev =
        map.get(key) ||
        {
          productId: item.productId || null,
          name: item.productName || item.name || 'Produk',
          qty: 0,
          revenue: 0,
          cost: 0
        };
      prev.qty += num(item.qty);
      prev.revenue += num(item.price) * num(item.qty);
      prev.cost += (num(item.costPrice) + num(item.extraCost)) * num(item.qty);
      map.set(key, prev);
    });
  });

  return [...map.values()]
    .map((row) => ({
      ...row,
      margin: row.revenue - row.cost,
      marginPercent:
        row.revenue > 0 ? Math.round(((row.revenue - row.cost) / row.revenue) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);
};

/**
 * Angka ringkasan yang dipakai kartu-kartu di dashboard.
 * Semua halaman memakai ini agar tidak ada lagi angka yang berbeda.
 */
export const summarizeSales = (orders = [], range = {}) => {
  const sales = salesOrders(orders, range);
  const cancelled = orders.filter((o) => o.status === 'DIBATALKAN');
  const unpaid = orders.filter(
    (o) => o.status !== 'DIBATALKAN' && o.paymentStatus !== 'LUNAS'
  );

  return {
    ordersCount: sales.length,
    revenue: sales.reduce((sum, o) => sum + orderTotal(o), 0),
    units: totalUnits(sales),
    cancelledCount: cancelled.length,
    cancelledRevenue: cancelled.reduce((sum, o) => sum + orderTotal(o), 0),
    unpaidCount: unpaid.length,
    unpaidRevenue: unpaid.reduce((sum, o) => sum + orderTotal(o), 0),
    productRows: productSalesFromOrders(sales)
  };
};
