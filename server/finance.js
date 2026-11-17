/**
 * Modul keuangan Cilegon Enggih.
 *
 * Fokus: laporan manajemen untuk pemilik toko (bukan akuntansi double-entry).
 *  - HPP (harga pokok penjualan) per produk & varian
 *  - Vendor / supplier (skema mengikuti Kledo: kode, kontak, termin, catatan)
 *  - Pengeluaran operasional berkategori
 *  - Laporan: laba rugi, margin per produk, penjualan, kas & bank, piutang
 *
 * Prinsip penting:
 *  HPP DIBEKUKAN saat order dibuat (disalin ke item order). Kalau HPP produk
 *  berubah bulan depan, laporan bulan lalu tidak ikut berubah.
 */

export const EXPENSE_CATEGORIES = [
  { id: 'bahan-baku', label: 'Bahan Baku / Produksi' },
  { id: 'packing', label: 'Packing & Kemasan' },
  { id: 'ongkir', label: 'Ongkos Kirim' },
  { id: 'iklan', label: 'Iklan & Promosi' },
  { id: 'operasional', label: 'Operasional (listrik, internet, sewa)' },
  { id: 'gaji', label: 'Gaji & Upah' },
  { id: 'bank', label: 'Biaya Admin Bank / Payment' },
  { id: 'lain-lain', label: 'Lain-lain' }
];

export const EXPENSE_CATEGORY_LABEL = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.id, c.label])
);

/** Vendor default (contoh kosong — diisi pemilik toko). */
export const DEFAULT_VENDORS = [];

/* ------------------------------------------------------------------ */
/* Helper                                                              */
/* ------------------------------------------------------------------ */

export const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** Tanggal lokal (WIB) dalam format YYYY-MM-DD. */
export const dateKey = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
};

export const monthKey = (input) => dateKey(input).slice(0, 7);

const inRange = (iso, from, to) => {
  const key = dateKey(iso);
  if (!key) return false;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
};

/** HPP efektif suatu item order (dibekukan saat checkout). */
const itemCost = (item) =>
  (num(item.costPrice) + num(item.extraCost)) * num(item.qty);

const itemRevenue = (item) => num(item.price) * num(item.qty);

/** Order dianggap pendapatan hanya bila sudah LUNAS. */
const isRevenue = (order) => order.paymentStatus === 'LUNAS';

/* ------------------------------------------------------------------ */
/* Laba rugi                                                           */
/* ------------------------------------------------------------------ */

/**
 * Bangun laporan laba rugi untuk periode tertentu.
 * @param {{orders: any[], expenses: any[], products: any[]}} data
 * @param {{from?: string, to?: string}} range  format YYYY-MM-DD
 */
export const buildProfitLoss = (data, range = {}) => {
  const { orders = [], expenses = [], products = [] } = data;
  const { from = '', to = '' } = range;

  const paidOrders = orders.filter((o) => isRevenue(o) && inRange(o.createdAt, from, to));
  const periodExpenses = expenses.filter((e) => inRange(e.date, from, to));

  // Produk tanpa HPP terdeteksi supaya laporan tidak menyesatkan.
  const missingCost = [];
  let productRevenue = 0;
  let productCost = 0;
  let itemCount = 0;

  paidOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      productRevenue += itemRevenue(item);
      const cost = itemCost(item);
      productCost += cost;
      itemCount += num(item.qty);
      if (!num(item.costPrice) && !num(item.extraCost)) {
        missingCost.push({
          orderId: order.orderId,
          name: item.name,
          qty: item.qty,
          revenue: itemRevenue(item)
        });
      }
    });
  });

  const shippingCharged = paidOrders.reduce((sum, o) => sum + num(o.shippingCost), 0);
  const discounts = paidOrders.reduce((sum, o) => sum + num(o.voucherDiscount), 0);
  const uniqueCodes = paidOrders.reduce((sum, o) => sum + num(o.uniqueCode), 0);

  const totalRevenue = productRevenue + shippingCharged - discounts + uniqueCodes;
  const grossProfit = totalRevenue - productCost;

  const byCategory = {};
  periodExpenses.forEach((e) => {
    const key = e.category || 'lain-lain';
    byCategory[key] = (byCategory[key] || 0) + num(e.amount);
  });
  const totalExpense = periodExpenses.reduce((sum, e) => sum + num(e.amount), 0);
  const netProfit = grossProfit - totalExpense;

  // Rincian pengeluaran per kategori (untuk tabel laporan).
  const expenseLines = Object.entries(byCategory)
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABEL[category] || category,
      amount
    }))
    .sort((a, b) => b.amount - a.amount);

  const pct = (value, base) => (base > 0 ? Math.round((value / base) * 1000) / 10 : 0);

  return {
    period: { from: from || 'awal', to: to || 'akhir' },
    generatedAt: new Date().toISOString(),
    ordersCount: paidOrders.length,
    itemsSold: itemCount,
    revenue: {
      productSales: productRevenue,
      shippingCharged,
      discounts,
      uniqueCodes,
      total: totalRevenue
    },
    cogs: { productCost },
    grossProfit,
    grossMarginPercent: pct(grossProfit, totalRevenue),
    expenses: {
      total: totalExpense,
      lines: expenseLines
    },
    netProfit,
    netMarginPercent: pct(netProfit, totalRevenue),
    missingCostCount: missingCost.length,
    missingCostSamples: missingCost.slice(0, 10),
    productsWithoutCost: products
      .filter((p) => !num(p.costPrice) && !num(p.extraCost))
      .map((p) => ({ id: p.id, name: p.shortName || p.name }))
  };
};

/* ------------------------------------------------------------------ */
/* Margin per produk                                                   */
/* ------------------------------------------------------------------ */

export const buildMarginReport = (products = []) =>
  products
    .map((product) => {
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const rows = (variants.length ? variants : [null]).map((variant) => {
        const price = num(variant?.price ?? product.price);
        // Varian tanpa HPP mewarisi HPP produk.
        const cost = num(variant?.costPrice) || num(product.costPrice);
        const extra = num(variant?.extraCost) || num(product.extraCost);
        const hpp = cost + extra;
        const margin = price - hpp;
        return {
          variantId: variant?.id || null,
          variantLabel: variant?.label || '',
          price,
          cost,
          extra,
          hpp,
          margin,
          marginPercent: price > 0 ? Math.round((margin / price) * 1000) / 10 : 0,
          stock: num(variant?.stock ?? product.stock),
          vendorId: variant?.vendorId ?? product.vendorId ?? null,
          vendorName: variant?.vendorName ?? product.vendorName ?? ''
        };
      });

      const best = rows.reduce((acc, r) => (r.margin > acc.margin ? r : acc), rows[0]);
      return {
        id: product.id,
        name: product.shortName || product.name,
        categoryLabel: product.categoryLabel,
        hasCost: rows.some((r) => r.hpp > 0),
        lowestMargin: rows.reduce((acc, r) => (r.margin < acc.margin ? r : acc), rows[0]),
        bestMargin: best,
        rows
      };
    })
    .sort((a, b) => a.bestMargin.marginPercent - b.bestMargin.marginPercent);

/* ------------------------------------------------------------------ */
/* Penjualan                                                           */
/* ------------------------------------------------------------------ */

export const buildSalesReport = (orders = [], range = {}) => {
  const { from = '', to = '' } = range;
  const paid = orders.filter((o) => isRevenue(o) && inRange(o.createdAt, from, to));

  const byProduct = new Map();
  const byCourier = new Map();
  const byMonth = new Map();

  paid.forEach((order) => {
    byMonth.set(monthKey(order.createdAt), (byMonth.get(monthKey(order.createdAt)) || 0) + num(order.totalAmount));

    const courierKey = order.courierService || order.courier || 'Lainnya';
    const prevCourier = byCourier.get(courierKey) || { courier: courierKey, orders: 0, shipping: 0 };
    prevCourier.orders += 1;
    prevCourier.shipping += num(order.shippingCost);
    byCourier.set(courierKey, prevCourier);

    (order.items || []).forEach((item) => {
      const key = item.productId || item.name;
      const prev = byProduct.get(key) || {
        productId: item.productId || null,
        name: item.name,
        qty: 0,
        revenue: 0,
        cost: 0
      };
      prev.qty += num(item.qty);
      prev.revenue += itemRevenue(item);
      prev.cost += itemCost(item);
      byProduct.set(key, prev);
    });
  });

  const productRows = [...byProduct.values()]
    .map((row) => ({
      ...row,
      margin: row.revenue - row.cost,
      marginPercent: row.revenue > 0 ? Math.round(((row.revenue - row.cost) / row.revenue) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return {
    period: { from: from || 'awal', to: to || 'akhir' },
    ordersCount: paid.length,
    totalRevenue: paid.reduce((sum, o) => sum + num(o.totalAmount), 0),
    byProduct: productRows,
    byCourier: [...byCourier.values()].sort((a, b) => b.shipping - a.shipping),
    byMonth: [...byMonth.entries()]
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month))
  };
};

/* ------------------------------------------------------------------ */
/* Kas & bank                                                          */
/* ------------------------------------------------------------------ */

export const buildCashReport = (orders = [], expenses = [], range = {}) => {
  const { from = '', to = '' } = range;
  const paid = orders.filter((o) => isRevenue(o) && inRange(o.createdAt, from, to));
  const spent = expenses.filter((e) => inRange(e.date, from, to));

  const byAccount = new Map();
  const bump = (name, key, value) => {
    const label = name || 'Tanpa rekening';
    const prev = byAccount.get(label) || { account: label, inflow: 0, outflow: 0 };
    prev[key] += value;
    byAccount.set(label, prev);
  };

  paid.forEach((order) => {
    const bank = order.bankAccount?.bank || (String(order.paymentMethod || '').toLowerCase().includes('qris') ? 'QRIS' : 'Lainnya');
    bump(bank, 'inflow', num(order.totalAmount));
  });

  spent.forEach((expense) => {
    bump(expense.account || 'Kas Toko', 'outflow', num(expense.amount));
  });

  const rows = [...byAccount.values()]
    .map((row) => ({ ...row, net: row.inflow - row.outflow }))
    .sort((a, b) => b.net - a.net);

  return {
    period: { from: from || 'awal', to: to || 'akhir' },
    totalInflow: rows.reduce((sum, r) => sum + r.inflow, 0),
    totalOutflow: rows.reduce((sum, r) => sum + r.outflow, 0),
    net: rows.reduce((sum, r) => sum + r.net, 0),
    accounts: rows
  };
};

/* ------------------------------------------------------------------ */
/* Piutang (order belum lunas) & hutang vendor                         */
/* ------------------------------------------------------------------ */

export const buildReceivables = (orders = []) => {
  const open = orders.filter(
    (o) =>
      o.paymentStatus !== 'LUNAS' &&
      o.paymentStatus !== 'DIBATALKAN' &&
      o.status !== 'DIBATALKAN'
  );
  return open
    .map((o) => ({
      orderId: o.orderId,
      customerName: o.customerName,
      phone: String(o.customerPhone || '').replace(/\D/g, '').slice(0, 6) + '****',
      totalAmount: num(o.totalAmount),
      paymentStatus: o.paymentStatus,
      status: o.status,
      createdAt: o.createdAt,
      umurHari: Math.max(
        0,
        Math.floor((Date.now() - new Date(o.createdAt).getTime()) / (24 * 60 * 60 * 1000))
      )
    }))
    .sort((a, b) => b.umurHari - a.umurHari);
};

export const buildPayables = (vendors = []) =>
  vendors
    .filter((v) => num(v.debt) > 0)
    .map((v) => ({
      vendorId: v.id,
      name: v.name,
      phone: v.phone,
      debt: num(v.debt),
      dueDate: v.dueDate || '',
      notes: v.notes || ''
    }))
    .sort((a, b) => b.debt - a.debt);
