import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Building2,
  Calculator,
  Check,
  Printer,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  ExternalLink,
  MessageCircle,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X
} from 'lucide-react';
import { formatRupiah } from '../data/products';
import { vendorLinks } from '../lib/vendorLinks';
import {
  adminCashReport,
  adminCreateExpense,
  adminCreateVendor,
  adminDeleteExpense,
  adminDeleteVendor,
  adminExpenses,
  adminFinanceMeta,
  adminMarginReport,
  adminProfitLoss,
  adminReceivables,
  adminSalesReport,
  adminUpdateExpense,
  adminUpdateVendor,
  ApiError
} from '../lib/api';

type FinanceTab = 'ringkasan' | 'laba-rugi' | 'hpp' | 'pengeluaran' | 'penjualan' | 'vendor' | 'kas';

const FINANCE_TABS: { id: FinanceTab; label: string; icon: any }[] = [
  { id: 'ringkasan', label: 'Ringkasan', icon: TrendingUp },
  { id: 'laba-rugi', label: 'Laba Rugi', icon: Calculator },
  { id: 'hpp', label: 'HPP & Margin', icon: TrendingDown },
  { id: 'pengeluaran', label: 'Pengeluaran', icon: Wallet },
  { id: 'penjualan', label: 'Penjualan', icon: ShoppingBag },
  { id: 'vendor', label: 'Vendor', icon: Building2 },
  { id: 'kas', label: 'Kas & Bank', icon: Banknote }
];

const todayIso = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const StatCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'bad' | 'warn';
}> = ({ label, value, hint, tone = 'default' }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-soft">
    <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
    <div
      className={`text-base sm:text-lg font-extrabold mt-0.5 ${
        tone === 'good'
          ? 'text-forest-700'
          : tone === 'bad'
            ? 'text-red-600'
            : tone === 'warn'
              ? 'text-amber-600'
              : 'text-navy-800'
      }`}
    >
      {value}
    </div>
    {hint && <div className="text-[10px] text-slate-400 mt-0.5">{hint}</div>}
  </div>
);

const AdminField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({
  label,
  children,
  className = ''
}) => (
  <label className={`block space-y-1 ${className}`}>
    <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-500">
      {label}
    </span>
    {children}
  </label>
);

/* ------------------------------------------------------------------ */
/* Panel utama                                                         */
/* ------------------------------------------------------------------ */

export const FinancePanel: React.FC<{ pushToast: (t: string, m: string, k?: any) => void }> = ({
  pushToast
}) => {
  const [tab, setTab] = useState<FinanceTab>('ringkasan');
  const [range, setRange] = useState({ from: monthStart(), to: todayIso() });
  const [loading, setLoading] = useState(false);
  const [profitLoss, setProfitLoss] = useState<any>(null);
  const [margin, setMargin] = useState<any[]>([]);
  const [sales, setSales] = useState<any>(null);
  const [cash, setCash] = useState<any>(null);
  const [receivables, setReceivables] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pl, mg, sl, cs, rc, ex, meta] = await Promise.all([
        adminProfitLoss(range),
        adminMarginReport(),
        adminSalesReport(range),
        adminCashReport(range),
        adminReceivables(),
        adminExpenses(range),
        adminFinanceMeta()
      ]);
      setProfitLoss(pl);
      setMargin(mg.rows || []);
      setSales(sl);
      setCash(cs);
      setReceivables(rc);
      setExpenses(ex.expenses || []);
      setCategories(ex.categories || []);
      setVendors(meta.vendors || []);
      setProducts(meta.products || []);
    } catch (err) {
      pushToast('Gagal memuat keuangan', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setLoading(false);
    }
  }, [range, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  const productsWithoutCost = useMemo(
    () => products.filter((p) => !(Number(p.costPrice) > 0)),
    [products]
  );

  /* ---------- pengeluaran ---------- */
  const [expenseDraft, setExpenseDraft] = useState<any>({
    date: todayIso(),
    category: 'packing',
    description: '',
    amount: 0,
    account: 'Kas Toko'
  });

  const submitExpense = async () => {
    setBusy('expense');
    try {
      await adminCreateExpense(expenseDraft);
      setExpenseDraft({ ...expenseDraft, description: '', amount: 0 });
      await load();
      pushToast('Pengeluaran dicatat', expenseDraft.description || 'Tersimpan', 'success');
    } catch (err) {
      pushToast('Gagal simpan', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeExpense = async (id: string) => {
    if (!window.confirm('Hapus catatan pengeluaran ini?')) return;
    setBusy(id);
    try {
      await adminDeleteExpense(id);
      await load();
      pushToast('Dihapus', 'Catatan pengeluaran dihapus', 'success');
    } catch (err) {
      pushToast('Gagal hapus', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusy('');
    }
  };

  /* ---------- vendor ---------- */
  const [vendorDraft, setVendorDraft] = useState<any>({
    name: '',
    code: '',
    contactName: '',
    phone: '',
    category: 'Produksi',
    paymentTerm: 14,
    debt: 0,
    platform: 'Shopee',
    shopUrl: '',
    rating: 0,
    ratingCount: 0,
    leadTimeDays: 0,
    acceptsDropship: false,
    neutralPackaging: false,
    noInvoice: false,
    supportsCustomLogo: false,
    hasRealPhotos: false,
    responsiveChat: false
  });
  const [editingVendor, setEditingVendor] = useState<any>(null);

  const saveVendor = async () => {
    setBusy('vendor');
    try {
      if (editingVendor?.id) {
        await adminUpdateVendor(editingVendor.id, vendorDraft);
        pushToast('Vendor diperbarui', vendorDraft.name, 'success');
      } else {
        await adminCreateVendor(vendorDraft);
        pushToast('Vendor ditambahkan', vendorDraft.name, 'success');
      }
      setVendorDraft({
        name: '',
        code: '',
        contactName: '',
        phone: '',
        category: 'Produksi',
        paymentTerm: 14,
        debt: 0
      });
      setEditingVendor(null);
      await load();
    } catch (err) {
      pushToast('Gagal simpan vendor', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusy('');
    }
  };

  const removeVendor = async (vendor: any) => {
    if (!window.confirm(`Hapus vendor "${vendor.name}"?`)) return;
    setBusy(vendor.id);
    try {
      await adminDeleteVendor(vendor.id);
      await load();
      pushToast('Vendor dihapus', vendor.name, 'success');
    } catch (err) {
      pushToast('Gagal hapus', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusy('');
    }
  };

  const periodLabel = `${range.from || 'awal'} → ${range.to || 'sekarang'}`;

  return (
    <div className="space-y-3">
      {/* Toolbar periode */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-600">Periode</span>
        <input
          type="date"
          value={range.from}
          onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
          className="input-admin !w-auto !text-[11px] !py-1.5"
        />
        <span className="text-slate-400">–</span>
        <input
          type="date"
          value={range.to}
          onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
          className="input-admin !w-auto !text-[11px] !py-1.5"
        />
        <button
          type="button"
          onClick={() => setRange({ from: monthStart(), to: todayIso() })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
        >
          Bulan ini
        </button>
        <button
          type="button"
          onClick={() => setRange({ from: `${new Date().getFullYear()}-01-01`, to: todayIso() })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
        >
          Tahun ini
        </button>
        <button
          type="button"
          onClick={() => setRange({ from: '', to: '' })}
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
        >
          Semua
        </button>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="ml-auto px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Muat ulang
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-white text-[11px] font-bold inline-flex items-center gap-1.5"
        >
          <Printer className="w-3 h-3" /> Cetak
        </button>
      </div>

      {/* Sub-tab */}
      <div className="flex flex-wrap gap-1.5">
        {FINANCE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold inline-flex items-center gap-1.5 border ${
              tab === t.id
                ? 'bg-navy-800 text-white border-navy-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* ---------- RINGKASAN ---------- */}
      {tab === 'ringkasan' && profitLoss && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatCard
              label="Pendapatan"
              value={formatRupiah(profitLoss.revenue.total)}
              hint={periodLabel}
            />
            <StatCard label="HPP" value={formatRupiah(profitLoss.cogs.productCost)} />
            {/*
              Angka laba TIDAK BISA dipercaya bila HPP belum diisi: biaya
              barang jadi 0, sehingga laba kotor tampil sebesar omzet penuh.
              Admin harus tahu itu, bukan mengira untungnya besar.
            */}
            {profitLoss.cogsWarning && (
              <div className="col-span-2 lg:col-span-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-snug">
                <strong>Laba belum akurat.</strong> {profitLoss.cogsWarning}
                {profitLoss.productsWithoutCost?.length > 0 && (
                  <> Contoh produk yang belum ada HPP: {profitLoss.productsWithoutCost.slice(0, 3).map((x: any) => x.name).join(', ')}{profitLoss.productsWithoutCost.length > 3 ? ', …' : ''}.</>
                )}
              </div>
            )}
            <StatCard
              label="Laba Kotor"
              value={formatRupiah(profitLoss.grossProfit)}
              hint={
                profitLoss.cogsIncomplete
                  ? `${profitLoss.grossMarginPercent}% · HPP belum lengkap`
                  : `${profitLoss.grossMarginPercent}% dari pendapatan`
              }
              tone={
                profitLoss.cogsIncomplete ? 'warn' : profitLoss.grossProfit >= 0 ? 'good' : 'bad'
              }
            />
            <StatCard
              label="Laba Bersih"
              value={formatRupiah(profitLoss.netProfit)}
              hint={`${profitLoss.netMarginPercent}% · biaya ${formatRupiah(profitLoss.expenses.total)}`}
              tone={profitLoss.netProfit >= 0 ? 'good' : 'bad'}
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <StatCard label="Order Lunas" value={String(profitLoss.ordersCount)} />
            <StatCard label="Unit Terjual" value={`${profitLoss.itemsSold} pcs`} />
            <StatCard
              label="Piutang (belum lunas)"
              value={formatRupiah(receivables?.totalReceivable || 0)}
              hint={`${receivables?.receivables?.length || 0} order`}
            />
            <StatCard
              label="Hutang Vendor"
              value={formatRupiah(
                (receivables?.payables || []).reduce((s: number, p: any) => s + p.debt, 0)
              )}
              hint={`${receivables?.payables?.length || 0} vendor`}
            />
          </div>

          {productsWithoutCost.length > 0 && (
            <div className="bg-amberbrand-50 border border-amberbrand-200 rounded-2xl p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amberbrand-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-amberbrand-900 leading-relaxed">
                <strong>{productsWithoutCost.length} produk belum punya HPP.</strong> Laba akan
                terlihat lebih besar dari kenyataan sampai HPP diisi di tab{' '}
                <button
                  type="button"
                  onClick={() => setTab('hpp')}
                  className="font-bold underline"
                >
                  HPP &amp; Margin
                </button>
                .
                <div className="mt-1 text-[10.5px] text-amberbrand-800">
                  {productsWithoutCost.slice(0, 6).map((p) => p.name).join(' • ')}
                  {productsWithoutCost.length > 6 ? ' …' : ''}
                </div>
              </div>
            </div>
          )}

          {/* Tren pendapatan per bulan */}
          {sales?.byMonth?.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <div className="text-[10.5px] font-extrabold uppercase tracking-wide text-slate-500 mb-2">
                Pendapatan per Bulan
              </div>
              <div className="space-y-1.5">
                {sales.byMonth.map((m: any) => {
                  const max = Math.max(...sales.byMonth.map((x: any) => x.revenue), 1);
                  return (
                    <div key={m.month} className="flex items-center gap-2">
                      <span className="text-[10.5px] font-bold text-slate-500 w-16 shrink-0">
                        {m.month}
                      </span>
                      <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-forest-600"
                          style={{ width: `${Math.max(2, (m.revenue / max) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10.5px] font-bold text-navy-800 w-24 text-right shrink-0">
                        {formatRupiah(m.revenue)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---------- LABA RUGI ---------- */}
      {tab === 'laba-rugi' && profitLoss && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-sm font-extrabold text-navy-800">Laporan Laba Rugi</div>
            <div className="text-[10.5px] text-slate-500">Periode {periodLabel}</div>
          </div>
          <div className="overflow-x-auto -mx-px">
            <table className="w-full min-w-[320px] text-[11.5px]">
              <tbody>
              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-1.5 font-extrabold text-slate-700 uppercase text-[10px]">
                  Pendapatan
                </td>
              </tr>
              {[
                ['Penjualan produk', profitLoss.revenue.productSales],
                ['Ongkos kirim dibebankan', profitLoss.revenue.shippingCharged],
                ['Kode unik', profitLoss.revenue.uniqueCodes],
                ['Diskon voucher', -profitLoss.revenue.discounts]
              ].map(([label, value]: any) => (
                <tr key={label} className="border-t border-slate-50">
                  <td className="px-4 py-1.5 text-slate-600">{label}</td>
                  <td className="px-4 py-1.5 text-right font-semibold text-slate-800">
                    {formatRupiah(value)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 bg-white">
                <td className="px-4 py-2 font-extrabold text-navy-800">Total Pendapatan</td>
                <td className="px-4 py-2 text-right font-extrabold text-navy-800">
                  {formatRupiah(profitLoss.revenue.total)}
                </td>
              </tr>

              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-1.5 font-extrabold text-slate-700 uppercase text-[10px]">
                  Harga Pokok Penjualan
                </td>
              </tr>
              <tr className="border-t border-slate-50">
                <td className="px-4 py-1.5 text-slate-600">HPP produk terjual</td>
                <td className="px-4 py-1.5 text-right font-semibold text-slate-800">
                  {formatRupiah(profitLoss.cogs.productCost)}
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td className="px-4 py-2 font-extrabold text-forest-700">LABA KOTOR</td>
                <td className="px-4 py-2 text-right font-extrabold text-forest-700">
                  {formatRupiah(profitLoss.grossProfit)}{' '}
                  <span className="text-[10px] font-bold text-slate-400">
                    ({profitLoss.grossMarginPercent}%)
                  </span>
                </td>
              </tr>

              <tr className="bg-slate-50">
                <td colSpan={2} className="px-4 py-1.5 font-extrabold text-slate-700 uppercase text-[10px]">
                  Biaya Operasional
                </td>
              </tr>
              {profitLoss.expenses.lines.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-slate-400 text-[11px]">
                    Belum ada pengeluaran dicatat pada periode ini.
                  </td>
                </tr>
              )}
              {profitLoss.expenses.lines.map((line: any) => (
                <tr key={line.category} className="border-t border-slate-50">
                  <td className="px-4 py-1.5 text-slate-600">{line.label}</td>
                  <td className="px-4 py-1.5 text-right font-semibold text-slate-800">
                    {formatRupiah(line.amount)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200">
                <td className="px-4 py-2 font-extrabold text-navy-800">Total Biaya</td>
                <td className="px-4 py-2 text-right font-extrabold text-navy-800">
                  {formatRupiah(profitLoss.expenses.total)}
                </td>
              </tr>

              <tr className="border-t-2 border-navy-800 bg-navy-50">
                <td className="px-4 py-3 font-extrabold text-navy-900 text-xs">LABA BERSIH</td>
                <td
                  className={`px-4 py-3 text-right font-extrabold text-xs ${
                    profitLoss.netProfit >= 0 ? 'text-forest-700' : 'text-red-600'
                  }`}
                >
                  {formatRupiah(profitLoss.netProfit)}{' '}
                  <span className="text-[10px] font-bold text-slate-500">
                    ({profitLoss.netMarginPercent}%)
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
            </div>
          <div className="px-4 py-2.5 border-t border-slate-100 text-[10px] text-slate-400 leading-relaxed">
            Catatan: hanya order berstatus <strong>LUNAS</strong> yang dihitung sebagai pendapatan.
            HPP dibekukan saat pesanan dibuat, sehingga perubahan HPP di kemudian hari tidak
            mengubah laporan periode ini.
          </div>
        </div>
      )}

      {/* ---------- HPP & MARGIN ---------- */}
      {tab === 'hpp' && (
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-extrabold text-navy-800">
              HPP &amp; Margin per Produk
              <span className="ml-2 text-[10px] font-semibold text-slate-400">
                (urut dari margin terendah)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Produk / Varian</th>
                    <th className="text-right px-2 py-2 font-bold">Harga</th>
                    <th className="text-right px-2 py-2 font-bold">HPP</th>
                    <th className="text-right px-2 py-2 font-bold">Laba</th>
                    <th className="text-right px-2 py-2 font-bold">Margin</th>
                    <th className="text-right px-2 py-2 font-bold">Stok</th>
                  </tr>
                </thead>
                <tbody>
                  {margin.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="border-t border-slate-100 bg-slate-50/60">
                        <td className="px-3 py-1.5 font-bold text-slate-800">{row.name}</td>
                        <td colSpan={4} className="px-2 py-1.5 text-right text-[10px] text-slate-400">
                          {row.hasCost ? '' : 'HPP belum diisi'}
                        </td>
                        <td className="px-2 py-1.5" />
                      </tr>
                      {row.rows.map((r: any) => (
                        <tr key={`${row.id}-${r.variantId || 'base'}`} className="border-t border-slate-50">
                          <td className="px-3 py-1 pl-6 text-slate-600">
                            {r.variantLabel || '(tanpa varian)'}
                            {r.vendorName && (
                              <span className="ml-1 text-[9.5px] text-slate-400">
                                · {r.vendorName}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right">{formatRupiah(r.price)}</td>
                          <td className="px-2 py-1 text-right text-slate-600">
                            {r.hpp > 0 ? formatRupiah(r.hpp) : '—'}
                          </td>
                          <td
                            className={`px-2 py-1 text-right font-semibold ${
                              r.margin < 0 ? 'text-red-600' : 'text-forest-700'
                            }`}
                          >
                            {r.hpp > 0 ? formatRupiah(r.margin) : '—'}
                          </td>
                          <td
                            className={`px-2 py-1 text-right font-bold ${
                              r.hpp === 0
                                ? 'text-slate-300'
                                : r.marginPercent < 15
                                  ? 'text-red-600'
                                  : r.marginPercent < 30
                                    ? 'text-amberbrand-700'
                                    : 'text-forest-700'
                            }`}
                          >
                            {r.hpp > 0 ? `${r.marginPercent}%` : '—'}
                          </td>
                          <td className="px-2 py-1 text-right text-slate-500">{r.stock}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[10.5px] text-slate-500 px-1">
            Ubah HPP lewat tab <strong>Produk → Edit</strong> (bagian 2b). Varian yang HPP-nya
            kosong otomatis memakai HPP produk.
          </p>
        </div>
      )}

      {/* ---------- PENGELUARAN ---------- */}
      {tab === 'pengeluaran' && (
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="text-xs font-extrabold text-navy-800">Catat Pengeluaran</div>
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
              <AdminField label="Tanggal" className="col-span-2 sm:col-span-1">
                <input
                  type="date"
                  value={expenseDraft.date}
                  onChange={(e) => setExpenseDraft({ ...expenseDraft, date: e.target.value })}
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Kategori" className="col-span-2 sm:col-span-2">
                <select
                  value={expenseDraft.category}
                  onChange={(e) => setExpenseDraft({ ...expenseDraft, category: e.target.value })}
                  className="input-admin !text-[11px] !py-1.5"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </AdminField>
              <AdminField label="Nominal (Rp)" className="col-span-2 sm:col-span-1">
                <input
                  type="number"
                  min={0}
                  value={expenseDraft.amount}
                  onChange={(e) =>
                    setExpenseDraft({ ...expenseDraft, amount: Number(e.target.value) })
                  }
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Keterangan" className="col-span-2 sm:col-span-2">
                <input
                  value={expenseDraft.description}
                  onChange={(e) =>
                    setExpenseDraft({ ...expenseDraft, description: e.target.value })
                  }
                  placeholder="Iklan Instagram, bubble wrap, …"
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AdminField label="Sumber Dana" className="w-40">
                <input
                  value={expenseDraft.account}
                  onChange={(e) => setExpenseDraft({ ...expenseDraft, account: e.target.value })}
                  placeholder="Kas Toko / BCA"
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <button
                type="button"
                onClick={submitExpense}
                disabled={busy === 'expense' || !(expenseDraft.amount > 0)}
                className="mt-4 px-3 py-2 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Simpan Pengeluaran
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <span className="text-xs font-extrabold text-navy-800">Daftar Pengeluaran</span>
              <span className="text-[10.5px] font-bold text-slate-500">
                Total: {formatRupiah(expenses.reduce((s, e) => s + Number(e.amount), 0))}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Tanggal</th>
                    <th className="text-left px-2 py-2 font-bold">Kategori</th>
                    <th className="text-left px-2 py-2 font-bold">Keterangan</th>
                    <th className="text-right px-2 py-2 font-bold">Nominal</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 whitespace-nowrap">{e.date}</td>
                      <td className="px-2 py-1.5">
                        {categories.find((c) => c.id === e.category)?.label || e.category}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">{e.description || '—'}</td>
                      <td className="px-2 py-1.5 text-right font-bold text-navy-800">
                        {formatRupiah(e.amount)}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeExpense(e.id)}
                          disabled={busy === e.id}
                          className="p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        Belum ada pengeluaran pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- PENJUALAN ---------- */}
      {tab === 'penjualan' && sales && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-extrabold text-navy-800">
              Penjualan per Produk
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-bold">Produk</th>
                    <th className="text-right px-2 py-1.5 font-bold">Qty</th>
                    <th className="text-right px-2 py-1.5 font-bold">Omzet</th>
                    <th className="text-right px-2 py-1.5 font-bold">Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.byProduct.map((p: any) => (
                    <tr key={p.name} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-700">{p.name}</td>
                      <td className="px-2 py-1.5 text-right">{p.qty}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">
                        {formatRupiah(p.revenue)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-bold ${
                          p.cost > 0 ? 'text-forest-700' : 'text-slate-300'
                        }`}
                      >
                        {p.cost > 0 ? formatRupiah(p.margin) : '—'}
                      </td>
                    </tr>
                  ))}
                  {sales.byProduct.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                        Belum ada penjualan lunas pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-extrabold text-navy-800">
              Ongkos Kirim per Ekspedisi
            </div>
<div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-1.5 font-bold">Kurir</th>
                  <th className="text-right px-2 py-1.5 font-bold">Order</th>
                  <th className="text-right px-2 py-1.5 font-bold">Total Ongkir</th>
                </tr>
              </thead>
              <tbody>
                {sales.byCourier.map((c: any) => (
                  <tr key={c.courier} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 text-slate-700">{c.courier}</td>
                    <td className="px-2 py-1.5 text-right">{c.orders}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">
                      {formatRupiah(c.shipping)}
                    </td>
                  </tr>
                ))}
                {sales.byCourier.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-slate-400">
                      Belum ada data pengiriman.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden lg:col-span-2">
            <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-extrabold text-navy-800">
              Piutang — Order Belum Lunas
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-1.5 font-bold">Order</th>
                    <th className="text-left px-2 py-1.5 font-bold">Pembeli</th>
                    <th className="text-left px-2 py-1.5 font-bold">Status Bayar</th>
                    <th className="text-right px-2 py-1.5 font-bold">Nilai</th>
                    <th className="text-right px-2 py-1.5 font-bold">Umur</th>
                  </tr>
                </thead>
                <tbody>
                  {(receivables?.receivables || []).map((r: any) => (
                    <tr key={r.orderId} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 font-semibold text-navy-800">{r.orderId}</td>
                      <td className="px-2 py-1.5">
                        {r.customerName} · {r.phone}
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-amberbrand-100 text-amberbrand-800 text-[9.5px] font-bold">
                          {r.paymentStatus}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right font-bold">
                        {formatRupiah(r.totalAmount)}
                      </td>
                      <td
                        className={`px-2 py-1.5 text-right font-bold ${
                          r.umurHari > 3 ? 'text-red-600' : 'text-slate-500'
                        }`}
                      >
                        {r.umurHari} hari
                      </td>
                    </tr>
                  ))}
                  {(receivables?.receivables || []).length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                        Semua pesanan sudah lunas 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- VENDOR ---------- */}
      {tab === 'vendor' && (
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-extrabold text-navy-800">
                {editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Tambah Vendor'}
              </div>
              {editingVendor && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingVendor(null);
                    setVendorDraft({
                      name: '',
                      code: '',
                      contactName: '',
                      phone: '',
                      category: 'Produksi',
                      paymentTerm: 14,
                      debt: 0,
                      platform: 'Shopee',
                      shopUrl: '',
                      rating: 0,
                      ratingCount: 0,
                      leadTimeDays: 0,
                      acceptsDropship: false,
                      neutralPackaging: false,
                      noInvoice: false,
                      supportsCustomLogo: false,
                      hasRealPhotos: false,
                      responsiveChat: false
                    });
                  }}
                  className="text-[10.5px] font-bold text-slate-500 inline-flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Batal edit
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <AdminField label="Nama Vendor" className="col-span-2">
                <input
                  value={vendorDraft.name}
                  onChange={(e) => setVendorDraft({ ...vendorDraft, name: e.target.value })}
                  placeholder="CV Sablon Cilegon"
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Kode">
                <input
                  value={vendorDraft.code}
                  onChange={(e) => setVendorDraft({ ...vendorDraft, code: e.target.value })}
                  placeholder="VND-001"
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Kategori">
                <input
                  value={vendorDraft.category}
                  onChange={(e) => setVendorDraft({ ...vendorDraft, category: e.target.value })}
                  placeholder="Produksi / Bahan / Cetak"
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Nama PIC">
                <input
                  value={vendorDraft.contactName}
                  onChange={(e) => setVendorDraft({ ...vendorDraft, contactName: e.target.value })}
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="WhatsApp / Telp">
                <input
                  value={vendorDraft.phone}
                  onChange={(e) => setVendorDraft({ ...vendorDraft, phone: e.target.value })}
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Termin (hari)">
                <input
                  type="number"
                  min={0}
                  value={vendorDraft.paymentTerm}
                  onChange={(e) =>
                    setVendorDraft({ ...vendorDraft, paymentTerm: Number(e.target.value) })
                  }
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
              <AdminField label="Hutang (Rp)">
                <input
                  type="number"
                  min={0}
                  value={vendorDraft.debt}
                  onChange={(e) => setVendorDraft({ ...vendorDraft, debt: Number(e.target.value) })}
                  className="input-admin !text-[11px] !py-1.5"
                />
              </AdminField>
            </div>
            {/* --- Data dropship --- */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
              <div className="text-[10.5px] font-extrabold text-navy-700 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Data Dropship
                <span className="font-normal text-slate-400">— dipakai halaman Dropship</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <AdminField label="Platform">
                  <select
                    value={vendorDraft.platform || 'Shopee'}
                    onChange={(e) => setVendorDraft({ ...vendorDraft, platform: e.target.value })}
                    className="input-admin !text-[11px] !py-1.5"
                  >
                    <option value="Shopee">Shopee</option>
                    <option value="Tokopedia">Tokopedia</option>
                    <option value="TikTok Shop">TikTok Shop</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </AdminField>
                <AdminField label="Rating Toko (0-5)">
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={0.1}
                    value={vendorDraft.rating ?? 0}
                    onChange={(e) => setVendorDraft({ ...vendorDraft, rating: Number(e.target.value) })}
                    placeholder="4.8"
                    className="input-admin !text-[11px] !py-1.5"
                  />
                </AdminField>
                <AdminField label="Jumlah Ulasan">
                  <input
                    type="number"
                    min={0}
                    value={vendorDraft.ratingCount ?? 0}
                    onChange={(e) =>
                      setVendorDraft({ ...vendorDraft, ratingCount: Number(e.target.value) })
                    }
                    placeholder="420"
                    className="input-admin !text-[11px] !py-1.5"
                  />
                </AdminField>
                <AdminField label="Lama Proses (hari)">
                  <input
                    type="number"
                    min={0}
                    value={vendorDraft.leadTimeDays ?? 0}
                    onChange={(e) =>
                      setVendorDraft({ ...vendorDraft, leadTimeDays: Number(e.target.value) })
                    }
                    placeholder="1"
                    className="input-admin !text-[11px] !py-1.5"
                  />
                </AdminField>
                <AdminField label="Tautan Toko" className="col-span-2 sm:col-span-4">
                  <input
                    value={vendorDraft.shopUrl || ''}
                    onChange={(e) => setVendorDraft({ ...vendorDraft, shopUrl: e.target.value })}
                    placeholder="https://shopee.co.id/nama-toko"
                    className="input-admin !text-[11px] !py-1.5"
                  />
                </AdminField>
              </div>

              <div className="mt-2 space-y-1">
                <div className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wide">
                  Syarat wajib dropship
                </div>
                {(
                  [
                    ['acceptsDropship', 'Menerima dropship (kirim ke alamat pembeli)'],
                    ['neutralPackaging', 'Packing netral — tanpa merek toko vendor'],
                    ['noInvoice', 'Tidak menyertakan invoice / harga kulakan']
                  ] as [string, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean((vendorDraft as any)[key])}
                      onChange={(e) =>
                        setVendorDraft({ ...vendorDraft, [key]: e.target.checked })
                      }
                      className="mt-0.5 w-3 h-3 accent-forest-600"
                    />
                    <span className="text-[10.5px] text-slate-700 leading-snug">{label}</span>
                  </label>
                ))}
                <div className="text-[9.5px] font-extrabold text-slate-500 uppercase tracking-wide pt-1">
                  Nilai tambah
                </div>
                {(
                  [
                    ['supportsCustomLogo', 'Bisa custom logo / branding'],
                    ['hasRealPhotos', 'Ada foto produk asli'],
                    ['responsiveChat', 'Balas chat cepat (< 2 jam)']
                  ] as [string, string][]
                ).map(([key, label]) => (
                  <label key={key} className="flex items-start gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean((vendorDraft as any)[key])}
                      onChange={(e) =>
                        setVendorDraft({ ...vendorDraft, [key]: e.target.checked })
                      }
                      className="mt-0.5 w-3 h-3 accent-forest-600"
                    />
                    <span className="text-[10.5px] text-slate-700 leading-snug">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={saveVendor}
              disabled={busy === 'vendor' || !vendorDraft.name.trim()}
              className="px-3 py-2 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5"
            >
              {editingVendor ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {editingVendor ? 'Simpan Perubahan' : 'Tambah Vendor'}
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-bold">Vendor</th>
                    <th className="text-left px-2 py-2 font-bold">Kontak</th>
                    <th className="text-left px-2 py-2 font-bold">Kategori</th>
                    <th className="text-left px-2 py-2 font-bold">Toko</th>
                    <th className="text-right px-2 py-2 font-bold">Termin</th>
                    <th className="text-right px-2 py-2 font-bold">Hutang</th>
                    <th className="text-right px-3 py-2 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100">
                      <td className="px-3 py-1.5">
                        <div className="font-bold text-slate-800">{v.name}</div>
                        {v.code && <div className="text-[9.5px] text-slate-400">{v.code}</div>}
                      </td>
                      <td className="px-2 py-1.5 text-slate-600">
                        {v.contactName || '—'}
                        {v.phone && <div className="text-[9.5px] text-slate-400">{v.phone}</div>}
                      </td>
                      <td className="px-2 py-1.5">{v.category}</td>
                      <td className="px-2 py-1.5">
                        {/*
                          Tautan toko vendor supaya saat order masuk admin bisa
                          langsung membuka produknya di Shopee/TikTok Shop.
                          vendorLinks() memvalidasi protokol (mencegah
                          javascript:) dan mengubah nomor HP jadi tautan
                          WhatsApp bila tautan toko belum diisi.
                        */}
                        <div className="flex flex-wrap items-center gap-1">
                          {vendorLinks(v).map((link) => (
                            <a
                              key={link.href}
                              href={link.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={
                                link.kind === 'shop'
                                  ? 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-navy-50 hover:bg-navy-100 text-navy-800 text-[10px] font-bold'
                                  : 'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-forest-50 hover:bg-forest-100 text-forest-800 text-[10px] font-bold'
                              }
                            >
                              {link.kind === 'shop' ? (
                                <ExternalLink className="w-2.5 h-2.5" />
                              ) : (
                                <MessageCircle className="w-2.5 h-2.5" />
                              )}
                              {link.label}
                            </a>
                          ))}
                          {vendorLinks(v).length === 0 && (
                            <span className="text-[9.5px] text-slate-400">belum diisi</span>
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right">{v.paymentTerm} hari</td>
                      <td className="px-2 py-1.5 text-right font-bold">
                        {v.debt > 0 ? (
                          <span className="text-red-600">{formatRupiah(v.debt)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVendor(v);
                            setVendorDraft({ ...v });
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10.5px] font-bold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeVendor(v)}
                          className="ml-1 p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {vendors.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        Belum ada vendor. Tambahkan supplier produksi/bahan Anda di atas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- KAS & BANK ---------- */}
      {tab === 'kas' && cash && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <StatCard label="Uang Masuk" value={formatRupiah(cash.totalInflow)} tone="good" />
            <StatCard label="Uang Keluar" value={formatRupiah(cash.totalOutflow)} tone="bad" />
            <StatCard
              label="Selisih"
              value={formatRupiah(cash.net)}
              tone={cash.net >= 0 ? 'good' : 'bad'}
            />
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] text-[11px]">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-bold">Rekening / Metode</th>
                  <th className="text-right px-2 py-2 font-bold">Masuk</th>
                  <th className="text-right px-2 py-2 font-bold">Keluar</th>
                  <th className="text-right px-3 py-2 font-bold">Net</th>
                </tr>
              </thead>
              <tbody>
                {cash.accounts.map((a: any) => (
                  <tr key={a.account} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-semibold text-slate-700">{a.account}</td>
                    <td className="px-2 py-1.5 text-right text-forest-700">
                      {formatRupiah(a.inflow)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-red-600">
                      {a.outflow > 0 ? formatRupiah(a.outflow) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-right font-extrabold text-navy-800">
                      {formatRupiah(a.net)}
                    </td>
                  </tr>
                ))}
                {cash.accounts.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                      Belum ada mutasi pada periode ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
          <p className="text-[10.5px] text-slate-500 px-1">
            “Masuk” = order berstatus LUNAS. “Keluar” = catatan pengeluaran. Ini ringkasan arus kas
            sederhana, bukan rekonsiliasi bank.
          </p>
        </div>
      )}

      {loading && (
        <div className="text-center text-[11px] text-slate-400 py-2">Memuat data keuangan…</div>
      )}
      <div className="hidden print:block">
        <Check className="w-1 h-1" />
      </div>
    </div>
  );
};

export default FinancePanel;
