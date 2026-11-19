/**
 * UJI KONSISTENSI LAPORAN KEUANGAN
 *
 * Tujuan: memastikan semua halaman dashboard menampilkan angka yang SAMA
 * untuk pesanan yang sama. Ini mencegah kejadian seperti audit 20 Nov 2026,
 * di mana "Total Omzet (Lunas)" di Overview dan omzet di Laba Rugi berbeda
 * karena masing-masing menghitung sendiri.
 *
 * Cara pakai:
 *   node scripts/test-report-consistency.mjs
 */
import {
  buildProfitLoss,
  buildSalesReport,
  buildCashReport,
  buildReceivables
} from '../server/finance.js';
import { summarizeSales, countsAsSale, productSalesFromOrders } from '../server/reports.js';

let gagal = 0;
const check = (nama, dapat, harap) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (!ok) gagal += 1;
  console.log(`${ok ? '  OK  ' : '  SALAH'} ${nama}${ok ? '' : ` (dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)})`}`);
};

const item = (o = {}) => ({
  productId: 'p1',
  productName: 'Kaos',
  name: 'Kaos (XL)',
  price: 100000,
  qty: 1,
  costPrice: 60000,
  extraCost: 0,
  ...o
});

const order = (o = {}) => ({
  orderId: 'X',
  createdAt: '2026-11-10T03:00:00.000Z',
  status: 'SELESAI',
  paymentStatus: 'LUNAS',
  items: [item()],
  subtotal: 100000,
  shippingCost: 0,
  voucherDiscount: 0,
  uniqueCode: 0,
  totalAmount: 100000,
  bankAccount: { bank: 'BCA' },
  paymentMethod: 'Transfer BCA',
  courier: 'JNE',
  ...o
});

/* ------------------------------------------------------------------ */
console.log('\n1. Omzet harus identik di semua laporan');
/* ------------------------------------------------------------------ */
{
  const orders = [
    order({ orderId: 'A' }),
    // Harga grosir: subtotal 95.000 sedangkan item 100.000
    order({ orderId: 'B', subtotal: 95000, totalAmount: 95000 })
  ];
  const sum = summarizeSales(orders);
  const pl = buildProfitLoss({ orders, expenses: [], products: [] });
  const sales = buildSalesReport(orders);
  const cash = buildCashReport(orders, []);

  check('summarizeSales.revenue', sum.revenue, 195000);
  check('profit-loss.revenue.total', pl.revenue.total, 195000);
  check('sales.totalRevenue', sales.totalRevenue, 195000);
  check('cash.totalInflow', cash.totalInflow, 195000);
}

/* ------------------------------------------------------------------ */
console.log('\n2. Pesanan DIBATALKAN tidak boleh menambah omzet');
/* ------------------------------------------------------------------ */
{
  const orders = [
    order({ orderId: 'OK' }),
    order({ orderId: 'BATAL', status: 'DIBATALKAN', totalAmount: 500000, subtotal: 500000 })
  ];
  const sum = summarizeSales(orders);
  const pl = buildProfitLoss({ orders, expenses: [], products: [] });

  check('countsAsSale(batal)', countsAsSale(orders[1]), false);
  check('omzet', sum.revenue, 100000);
  check('profit-loss omzet', pl.revenue.total, 100000);
  check('omzet batal dilaporkan terpisah', sum.cancelledRevenue, 500000);
}

/* ------------------------------------------------------------------ */
console.log('\n3. Pesanan belum lunas masuk piutang, bukan omzet');
/* ------------------------------------------------------------------ */
{
  const orders = [
    order({ orderId: 'LUNAS' }),
    order({ orderId: 'BELUM', paymentStatus: 'MENUNGGU_VERIFIKASI', status: 'MENUNGGU_KONFIRMASI' })
  ];
  const sum = summarizeSales(orders);
  const recv = buildReceivables(orders);

  check('omzet', sum.revenue, 100000);
  check('jumlah piutang', recv.length, 1);
  check('belum lunas dilaporkan', sum.unpaidCount, 1);
}

/* ------------------------------------------------------------------ */
console.log('\n4. Unit terjual & penjualan per produk dari pesanan nyata');
/* ------------------------------------------------------------------ */
{
  const orders = [
    order({
      orderId: 'A',
      items: [item({ productId: 'p1', qty: 2, price: 100000 }), item({ productId: 'p2', productName: 'Tote', qty: 1, price: 50000, costPrice: 20000 })],
      subtotal: 250000,
      totalAmount: 250000
    }),
    // Produk sama, pilihan berbeda -> harus DIGABUNG, bukan dua baris
    order({ orderId: 'B', items: [item({ productId: 'p1', name: 'Kaos (XXL)', qty: 3 })], subtotal: 300000, totalAmount: 300000 })
  ];
  const sum = summarizeSales(orders);
  const rows = productSalesFromOrders(orders);

  check('total unit', sum.units, 6);
  check('baris p1 hanya satu', rows.filter((r) => r.productId === 'p1').length, 1);
  check('qty p1 digabung', rows.find((r) => r.productId === 'p1').qty, 5);
}

/* ------------------------------------------------------------------ */
console.log('\n5. Kas masuk ke rekening yang benar');
/* ------------------------------------------------------------------ */
{
  const orders = [
    order({ orderId: 'T', bankAccount: { bank: 'BCA' }, paymentMethod: 'Transfer BCA' }),
    order({ orderId: 'Q', bankAccount: null, paymentMethod: 'QRIS' }),
    order({ orderId: 'Q2', bankAccount: { bank: 'QRIS' }, paymentMethod: 'QRIS BCA' })
  ];
  const cash = buildCashReport(orders, []);
  const acc = Object.fromEntries(cash.accounts.map((a) => [a.account, a.inflow]));

  check('BCA', acc.BCA, 100000);
  check('QRIS (gabungan)', acc.QRIS, 200000);
  check('tidak ada "Lainnya"', acc.Lainnya || 0, 0);
}

/* ------------------------------------------------------------------ */
console.log('\n6. HPP belum diisi harus ditandai, bukan diam-diam dianggap untung');
/* ------------------------------------------------------------------ */
{
  const tanpaHpp = [order({ items: [item({ costPrice: 0 })] })];
  const pl = buildProfitLoss({ orders: tanpaHpp, expenses: [], products: [] });

  check('cogsIncomplete', pl.cogsIncomplete, true);
  check('profitIsReliable', pl.profitIsReliable, false);
  check('ada pesan peringatan', pl.cogsWarning.length > 0, true);
}

/* ------------------------------------------------------------------ */
console.log('\n7. Zona waktu WIB: pesanan 23:30 UTC masuk tanggal berikutnya di WIB');
/* ------------------------------------------------------------------ */
{
  const orders = [order({ createdAt: '2026-11-30T23:30:00.000Z' })];
  const nov = buildSalesReport(orders, { from: '2026-11-01', to: '2026-11-30' });
  const dec = buildSalesReport(orders, { from: '2026-12-01', to: '2026-12-31' });

  check('tidak masuk November', nov.totalRevenue, 0);
  check('masuk Desember (WIB)', dec.totalRevenue, 100000);
}

/* ------------------------------------------------------------------ */
console.log(gagal === 0 ? '\n✅ SEMUA UJI KONSISTENSI LULUS\n' : `\n❌ ${gagal} UJI GAGAL\n`);
process.exit(gagal === 0 ? 0 : 1);
