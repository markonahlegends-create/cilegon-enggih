import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Building2,
  Settings as SettingsIcon,
  LogOut,
  Lock,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  Truck,
  AlertTriangle,
  CheckCircle2,
  X,
  Plus,
  Trash2,
  Save,
  Printer,
  MessageCircle,
  Copy,
  Eye,
  EyeOff,
  QrCode,
  Ticket,
  Banknote,
  RotateCcw,
  Download,
  Users,
  Sparkles,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { formatRupiah, buildWhatsAppUrlFor } from '../data/products';
import { useStore } from '../context/StoreContext';
import { InsightsPanel } from '../components/InsightsPanel';
import { InvoiceDocument } from '../components/InvoiceDocument';
import { ProductEditor } from '../components/ProductEditor';
import { FinancePanel } from '../components/FinancePanel';
import { QrisUploader } from '../components/QrisUploader';
import { SecurityPanel } from '../components/SecurityPanel';
import { HealthCheckPanel } from '../components/HealthCheckPanel';
import {
  adminLogin,
  adminSession,
  adminAnalytics,
  adminOrders,
  adminUpdateOrder,
  adminCreateProduct,
  adminDuplicateProduct,
  adminTestTelegram,
  adminSettingsFull,
  adminVerifyOtp,
  adminSetTwoFactor,
  adminFinanceMeta,
  adminVendors,
  adminCreateVendor,
  adminUpdateVendor,
  adminDeleteVendor,
  adminExpenses,
  adminCreateExpense,
  adminUpdateExpense,
  adminDeleteExpense,
  adminProfitLoss,
  adminMarginReport,
  adminSalesReport,
  adminCashReport,
  adminReceivables,
  adminAuditLog,
  adminUpdateProduct,
  adminDeleteProduct,
  adminResetProducts,
  adminUpdateSettings,
  adminResetSettings,
  adminProducts,
  adminB2B,
  adminUpdateB2B,
  adminExport,
  adminMe,
  adminLogout,
  adminDeleteOrder,
  adminResetOrders,
  ApiError
} from '../lib/api';

type Tab = 'overview' | 'insight' | 'orders' | 'products' | 'b2b' | 'finance' | 'security' | 'settings';

const ORDER_STATUS_OPTIONS = [
  'MENUNGGU_KONFIRMASI',
  'DIPROSES',
  'DIKIRIM',
  'SELESAI',
  'DIBATALKAN'
];

const PAYMENT_STATUS_OPTIONS = ['MENUNGGU_VERIFIKASI', 'LUNAS', 'DIBATALKAN'];

const COURIER_OPTIONS = [
  'GoSend Instant',
  'GrabExpress SameDay',
  'JNE Reguler (CTC/REG)',
  'J&T Express EZ',
  'SiCepat BEST / HALU',
  'Lainnya'
];

const B2B_STATUS_OPTIONS = [
  'Menunggu Konfirmasi Tim Korporat (SLA < 1 Jam Kerja)',
  'Sedang Dihitung (Quotation Disiapkan)',
  'Penawaran Dikirim ke Klien',
  'Negosiasi Harga / Sample',
  'DEAL — Produksi Berjalan',
  'Selesai',
  'Dibatalkan'
];

const statusBadge = (status: string) => {
  switch (status) {
    case 'LUNAS':
    case 'SELESAI':
      return 'bg-forest-100 text-forest-800 border-forest-200';
    case 'DIKIRIM':
      return 'bg-navy-100 text-navy-800 border-navy-200';
    case 'DIPROSES':
      return 'bg-amberbrand-100 text-amberbrand-800 border-amberbrand-200';
    case 'DIBATALKAN':
      return 'bg-red-100 text-red-700 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
};

export const AdminDashboardPage: React.FC = () => {
  const { settings, refreshStorefront, pushToast } = useStore();

  // Sesi ada di cookie HttpOnly — status awal tidak bisa dibaca dari JS,
  // jadi kita mulai "memeriksa" dan tanyakan ke server lewat /api/admin/me.
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [otpChallenge, setOtpChallenge] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(false);

  const [analytics, setAnalytics] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderQuery, setOrderQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [draftSettings, setDraftSettings] = useState<any>(settings);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invoiceOrder, setInvoiceOrder] = useState<any>(null);
  const [invoiceMode, setInvoiceMode] = useState<'invoice' | 'label'>('invoice');
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productQuery, setProductQuery] = useState('');
  const [vendorOptions, setVendorOptions] = useState<any[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const blankProduct = () => ({
    name: '',
    shortName: '',
    englishSubtitle: '',
    slug: '',
    price: 50000,
    originalPrice: 60000,
    stock: 20,
    stockManual: false,
    weightGrams: 300,
    categorySlug: 'aksesoris-dekorasi',
    categoryLabel: 'Aksesoris & Dekorasi',
    image: '/products/gantungan-kunci-3d.jpg',
    galleryImages: ['/products/gantungan-kunci-3d.jpg'],
    description: '',
    specs: [],
    variants: [],
    badges: [],
    bundleItems: [],
    isPreOrder: true,
    preOrderNote: 'Pre Order 7–15 hari kerja',
    minWholesaleQty: 0,
    wholesalePrice: 50000,
    active: true
  });
  const [newProduct, setNewProduct] = useState<any>(blankProduct());

  /* ---------------------------- auth ---------------------------- */
  // Pulihkan sesi dari cookie saat halaman dimuat / di-refresh.
  useEffect(() => {
    let alive = true;
    adminMe()
      .then(() => alive && setAuthed(true))
      .catch(() => alive && setAuthed(false))
      .finally(() => alive && setChecking(false));
    return () => {
      alive = false;
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await adminLogin(password);

      // Dua langkah: password benar, tapi butuh kode 6 digit dari Telegram.
      if (res.otpRequired && res.challengeId) {
        setOtpChallenge(res.challengeId);
        setOtpCode('');
        if (res.warning) pushToast('Perhatian', res.warning, 'info');
        return;
      }

      setAuthed(true);
      setPassword('');
      if (res.warning) pushToast('Perhatian', res.warning, 'info');
      pushToast('Login Berhasil', `Selamat datang, admin (storage: ${res.storage})`, 'success');
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Login gagal.');
    } finally {
      setLoggingIn(false);
    }
  };

  /** Langkah 2: verifikasi kode OTP Telegram. */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpChallenge) return;
    setLoggingIn(true);
    setLoginError('');
    try {
      await adminVerifyOtp(otpChallenge, otpCode);
      setAuthed(true);
      setOtpChallenge('');
      setOtpCode('');
      setPassword('');
      pushToast('Login Berhasil', 'Verifikasi 2 langkah lolos', 'success');
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Kode salah.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setOtpChallenge('');
    setOtpCode('');
    try {
      await adminLogout();
    } catch {
      // Sesi mungkin sudah kedaluwarsa — tetap bersihkan tampilan.
    }
    setAuthed(false);
    pushToast('Logout', 'Sesi admin diakhiri di server', 'info');
  };

  /* ---------------------------- data ---------------------------- */
  const loadAll = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const [an, ord, b2b, prod, full] = await Promise.all([
        adminAnalytics(),
        adminOrders(),
        adminB2B(),
        adminProducts(),
        // Endpoint admin mengembalikan settings LENGKAP (termasuk kredensial Telegram).
        // Jangan pakai /api/admin/export: publicSettings() menghapus botToken/chatId.
        adminSettingsFull().catch(() => null)
      ]);
      setAnalytics(an);
      setOrders(ord.orders || []);
      setInquiries(b2b.inquiries || []);
      setProducts(prod.products || []);
      if (full?.settings) setDraftSettings(full.settings);
      // Dropdown vendor untuk editor produk.
      adminVendors()
        .then((res) => setVendorOptions(res.vendors || []))
        .catch(() => setVendorOptions([]));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuthed(false);
      } else {
        pushToast('Gagal Memuat Data', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [authed, pushToast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /* ---------------------------- actions ---------------------------- */
  const deleteOrder = async (orderId: string) => {
    if (
      !window.confirm(
        `Hapus pesanan ${orderId}?\n\nData pesanan hilang permanen. Stok produk akan dikembalikan otomatis bila pesanan belum dibatalkan.`
      )
    )
      return;
    setBusyId(orderId);
    try {
      const res = await adminDeleteOrder(orderId);
      setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      pushToast('Pesanan Dihapus', res.message, 'success');
      const an = await adminAnalytics().catch(() => null);
      if (an) setAnalytics(an);
      await loadAll();
    } catch (err) {
      pushToast('Gagal Hapus', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resetAllOrders = async () => {
    const first = window.confirm(
      `Hapus SEMUA ${orders.length} pesanan?\n\nStok akan dikembalikan otomatis. Tindakan ini tidak bisa dibatalkan.`
    );
    if (!first) return;
    const second = window.prompt('Ketik HAPUS SEMUA untuk konfirmasi terakhir:');
    if (String(second || '').trim().toUpperCase() !== 'HAPUS SEMUA') {
      pushToast('Dibatalkan', 'Konfirmasi tidak cocok, tidak ada yang dihapus.', 'info');
      return;
    }
    setBusyId('reset-orders');
    try {
      const res = await adminResetOrders();
      setOrders([]);
      pushToast('Data Uji Dibersihkan', res.message, 'success');
      await loadAll();
    } catch (err) {
      pushToast('Gagal', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const updateOrder = async (orderId: string, payload: Record<string, unknown>) => {
    setBusyId(orderId);
    try {
      const res = await adminUpdateOrder(orderId, payload);
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? res.order : o)));
      pushToast('Pesanan Diperbarui', `${orderId} • ${Object.keys(payload).join(', ')}`, 'success');
      const an = await adminAnalytics().catch(() => null);
      if (an) setAnalytics(an);
    } catch (err) {
      pushToast('Gagal Update', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const saveProduct = async (product: any) => {
    const { __isNew, __dirty, ...payload } = product;
    setBusyId(payload.id || 'new');
    try {
      const res = __isNew
        ? await adminCreateProduct(payload)
        : await adminUpdateProduct(payload.id, payload);
      setProducts(res.products || []);
      setEditingProduct(null);
      setShowNewProduct(false);
      setProductQuery('');
      setProductFilter('');
      await refreshStorefront();
      pushToast('Produk Tersimpan', payload.name, 'success');
    } catch (err) {
      pushToast('Gagal Simpan Produk', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const duplicateProduct = async (product: any) => {
    setBusyId(`dup-${product.id}`);
    try {
      const res = await adminDuplicateProduct(product.id);
      setProducts(res.products || []);
      await refreshStorefront();
      pushToast('Produk Diduplikat', `${product.shortName || product.name} → salinan`, 'success');
    } catch (err) {
      pushToast('Gagal Duplikat', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const removeProduct = async (product: any) => {
    if (!window.confirm(`Hapus produk "${product.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusyId(product.id);
    try {
      const res = await adminDeleteProduct(product.id);
      setProducts(res.products || []);
      await refreshStorefront();
      pushToast('Produk Dihapus', product.name, 'info');
    } catch (err) {
      pushToast('Gagal Hapus', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resetCatalog = async () => {
    if (!window.confirm('Kembalikan seluruh katalog ke 12 produk default Cilegon Enggih?')) return;
    setBusyId('reset-products');
    try {
      const res = await adminResetProducts();
      setProducts(res.products || []);
      await refreshStorefront();
      pushToast('Katalog Direset', `${res.restored} produk dipulihkan`, 'success');
    } catch (err) {
      pushToast('Gagal Reset', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const [testingTelegram, setTestingTelegram] = useState(false);

  const testTelegram = async () => {
    setTestingTelegram(true);
    try {
      const res = await adminTestTelegram({ telegram: draftSettings.telegram || {} });
      pushToast('Telegram Terhubung', res.message || 'Pesan uji terkirim.', 'success');
      setDraftSettings((prev: any) => ({
        ...prev,
        telegram: { ...(prev.telegram || {}), enabled: true }
      }));
    } catch (err) {
      pushToast('Tes Telegram Gagal', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setTestingTelegram(false);
    }
  };

  const saveSettings = async () => {
    setBusyId('settings');
    try {
      const res = await adminUpdateSettings(draftSettings);
      // Ambil ulang versi lengkap supaya botToken/chatId tetap ada di state.
      const full = await adminSettingsFull().catch(() => null);
      setDraftSettings(full?.settings || res.settings);
      await refreshStorefront();
      pushToast('Pengaturan Tersimpan', 'Storefront langsung memakai data terbaru', 'success');
    } catch (err) {
      pushToast('Gagal Simpan', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const resetSettings = async () => {
    if (!window.confirm('Kembalikan semua pengaturan toko ke default (rekening placeholder)?')) return;
    setBusyId('reset-settings');
    try {
      const res = await adminResetSettings();
      setDraftSettings(res.settings);
      await refreshStorefront();
      pushToast('Pengaturan Direset', 'Default dipulihkan', 'success');
    } catch (err) {
      pushToast('Gagal Reset', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const updateInquiry = async (quoteId: string, payload: Record<string, unknown>) => {
    setBusyId(quoteId);
    try {
      const res = await adminUpdateB2B(quoteId, payload);
      setInquiries(res.inquiries || []);
      pushToast('Inquiry Diperbarui', quoteId, 'success');
    } catch (err) {
      pushToast('Gagal Update', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const exportJson = async () => {
    try {
      const data = await adminExport();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // iOS Safari mengabaikan click() pada <a> yang belum masuk DOM.
      a.style.display = 'none';
      document.body.appendChild(a);
      a.download = `cilegon-enggih-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      document.body.removeChild(a);
      // Beri jeda: Safari butuh waktu memulai unduhan sebelum URL dicabut.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast('Backup Diunduh', 'File JSON berisi order, produk, B2B & settings', 'success');
    } catch {
      pushToast('Export Gagal', 'Coba lagi', 'error');
    }
  };

  /** Tutup editor dengan pengaman perubahan belum tersimpan. */
  const requestCloseEditor = () => {
    const dirty = Boolean(
      (showNewProduct && newProduct.__dirty) || (editingProduct && editingProduct.__dirty)
    );
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    setShowNewProduct(false);
    setEditingProduct(null);
  };

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => {
      const matchQuery =
        !q ||
        [p.name, p.shortName, p.categoryLabel, p.slug]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q));
      if (!matchQuery) return false;
      switch (productFilter) {
        case 'preorder':
          return Boolean(p.isPreOrder);
        case 'bestseller':
          return Boolean(p.isBestSeller);
        case 'bundle':
          return Boolean(p.isBundle);
        case 'lowstock':
          return Number(p.stock || 0) <= 20;
        case 'inactive':
          return p.active === false;
        default:
          return true;
      }
    });
  }, [products, productQuery, productFilter]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus = !orderFilter || o.status === orderFilter;
      const q = orderQuery.trim().toLowerCase();
      const matchQuery =
        !q ||
        [o.orderId, o.resi, o.customerName, o.customerPhone, o.invoiceNumber]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [orders, orderFilter, orderQuery]);

  /* ---------------------------- screens ---------------------------- */

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="inline-flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw className="w-4 h-4 animate-spin" /> Memeriksa sesi admin...
        </div>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-soft p-7 space-y-5">
          <div className="text-center space-y-1">
            <div className="w-14 h-14 rounded-2xl bg-navy-800 text-amberbrand-400 flex items-center justify-center mx-auto">
              <Lock className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-navy-800">Super Admin Login</h1>
            <p className="text-xs text-slate-500">
              Dashboard internal Cilegon Enggih — hanya untuk pemilik toko.
            </p>
          </div>

          {otpChallenge ? (
            <form onSubmit={handleVerifyOtp} className="space-y-3">
              <div className="text-xs text-slate-600 bg-forest-50 border border-forest-200 rounded-xl p-3 leading-relaxed">
                Password benar. Masukkan <strong>kode 6 digit</strong> yang dikirim ke{' '}
                <strong>Telegram admin</strong>. Kode berlaku 5 menit.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Verifikasi</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-center text-lg font-extrabold tracking-[0.4em] outline-none focus:border-forest-600"
                />
              </div>
              {loginError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
                  {loginError}
                </div>
              )}
              <button
                type="submit"
                disabled={loggingIn || otpCode.length !== 6}
                className="w-full py-3 rounded-xl bg-navy-800 hover:bg-navy-900 disabled:opacity-60 text-white text-sm font-extrabold"
              >
                {loggingIn ? 'Memverifikasi...' : 'Verifikasi & Masuk'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOtpChallenge('');
                  setOtpCode('');
                  setLoginError('');
                }}
                className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-600"
              >
                Kembali ke halaman login
              </button>
            </form>
          ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
              <input
                type="text"
                value="admin"
                readOnly
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Password Admin</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password admin"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-sm outline-none focus:border-forest-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 -m-1 text-slate-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3 rounded-xl bg-navy-800 hover:bg-navy-900 disabled:opacity-60 text-white text-sm font-extrabold"
            >
              {loggingIn ? 'Memproses...' : 'Masuk Dashboard'}
            </button>
          </form>
          )}

          <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 rounded-xl p-3">
            Password admin hanya berasal dari environment variable{' '}
            <code className="bg-white px-1 rounded">ADMIN_PASSWORD</code> di hosting
            (Vercel/Cloudflare/VPS). Tidak ada password bawaan di dalam kode — kalau variabel
            itu belum diset, login dinonaktifkan. Saat menjalankan server di komputer sendiri,
            password acak untuk sesi tersebut tercetak di konsol. Lihat{' '}
            <strong>DEPLOYMENT.md</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-forest-700 text-white rounded-3xl p-5 sm:p-7">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-amberbrand-300 font-extrabold">
              Super Admin Dashboard
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold">Cilegon Enggih Control Center</h1>
            <p className="text-xs text-slate-300 mt-0.5">
              Storage: <strong>{analytics?.storage || 'local-json'}</strong> • Data toko: {settings.addressShort}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadAll}
              disabled={loading}
              aria-label="Muat ulang data"
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={exportJson}
              aria-label="Unduh backup data"
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Backup</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Keluar dari dashboard"
              className="px-2.5 sm:px-3 py-2 rounded-xl bg-red-500/90 hover:bg-red-600 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar bg-white rounded-2xl border border-slate-200 p-1.5">
        {[
          { id: 'overview', label: 'Analitik', icon: LayoutDashboard },
          { id: 'insight', label: 'Insight', icon: TrendingUp },
          { id: 'orders', label: `Pesanan (${orders.length})`, icon: ShoppingBag },
          { id: 'products', label: `Produk (${products.length})`, icon: Package },
          { id: 'b2b', label: `B2B (${inquiries.length})`, icon: Building2 },
          { id: 'finance', label: 'Keuangan', icon: Calculator },
          { id: 'security', label: 'Keamanan', icon: ShieldCheck },
          { id: 'settings', label: 'Pengaturan', icon: SettingsIcon }
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as Tab)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? 'bg-navy-800 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ------------------------------ OVERVIEW ------------------------------ */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <HealthCheckPanel />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Total Omzet (Lunas)',
                value: formatRupiah(analytics?.totalRevenue || 0),
                icon: Wallet,
                hint: `${analytics?.paidOrders || 0} pesanan lunas`
              },
              {
                label: 'Total Pesanan',
                value: analytics?.totalOrders || 0,
                icon: ShoppingBag,
                hint: `${analytics?.awaitingVerification || 0} menunggu verifikasi`
              },
              {
                label: 'Perlu Input Resi',
                value: analytics?.awaitingResi || 0,
                icon: Truck,
                hint: 'Order belum punya AWB'
              },
              {
                label: 'Inquiry B2B Aktif',
                value: analytics?.b2bOpen || 0,
                icon: Building2,
                hint: 'Menunggu tindak lanjut'
              }
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.label}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {card.label}
                    </span>
                    <Icon className="w-4 h-4 text-forest-600" />
                  </div>
                  <div className="text-lg sm:text-xl font-extrabold text-navy-800 mt-1">
                    {card.value}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{card.hint}</div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft">
              <h3 className="text-sm font-extrabold text-navy-800 mb-3 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-forest-600" /> Produk Terlaris
              </h3>
              <div className="space-y-2">
                {(analytics?.topProducts || []).map((p: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{p.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {p.qty} pcs • {formatRupiah(p.revenue)}
                      </div>
                    </div>
                    <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                      <div
                        className="h-full bg-forest-500"
                        style={{
                          width: `${Math.min(100, (p.qty / (analytics?.topProducts?.[0]?.qty || 1)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(!analytics?.topProducts || analytics.topProducts.length === 0) && (
                  <p className="text-xs text-slate-500">Belum ada penjualan tercatat.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft space-y-3">
              <h3 className="text-sm font-extrabold text-navy-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amberbrand-600" /> Stok Menipis (≤ 20)
              </h3>
              {(analytics?.lowStock || []).length === 0 && (
                <p className="text-xs text-slate-500">Semua stok produk dalam kondisi aman.</p>
              )}
              <div className="space-y-1.5">
                {(analytics?.lowStock || []).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 truncate">{p.name}</span>
                    <span className="font-extrabold text-red-600 shrink-0">{p.stock} pcs</span>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[11px] font-bold uppercase text-slate-500 mb-1.5">
                  Distribusi Status Pesanan
                </h4>
                <div className="grid grid-cols-2 gap-1.5">
                  {ORDER_STATUS_OPTIONS.map((s) => (
                    <div
                      key={s}
                      className="flex items-center justify-between text-[11px] bg-slate-50 rounded-lg px-2 py-1"
                    >
                      <span className="text-slate-600">{s.replace(/_/g, ' ')}</span>
                      <strong className="text-navy-800">{analytics?.byStatus?.[s] || 0}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ INSIGHT ------------------------------ */}
      {tab === 'insight' && <InsightsPanel />}

      {/* ------------------------------ ORDERS ------------------------------ */}
      {tab === 'orders' && (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={orderQuery}
                onChange={(e) => setOrderQuery(e.target.value)}
                placeholder="Cari order ID, resi, nama, atau no. HP..."
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs outline-none focus:border-forest-600"
              />
            </div>
            <select
              value={orderFilter}
              onChange={(e) => setOrderFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold"
            >
              <option value="">Semua Status</option>
              {ORDER_STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            {orders.length > 0 && (
              <button
                type="button"
                onClick={resetAllOrders}
                disabled={busyId === 'reset-orders'}
                title="Hapus seluruh pesanan (berguna setelah uji coba sebelum toko dibuka)"
                className="px-3 py-2.5 rounded-xl border border-red-200 bg-white text-red-600 text-[11px] font-extrabold hover:bg-red-50 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {busyId === 'reset-orders' ? 'Menghapus…' : 'Bersihkan Data Uji'}
              </button>
            )}
          </div>

          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Tidak ada pesanan yang cocok dengan filter.
            </div>
          )}

          {filteredOrders.map((order) => (
            <OrderCard
              key={order.orderId}
              order={order}
              busy={busyId === order.orderId}
              onUpdate={updateOrder}
              onDelete={deleteOrder}
              onPrint={(mode) => {
                setInvoiceOrder(order);
                setInvoiceMode(mode);
              }}
            />
          ))}
        </div>
      )}

      {/* ------------------------------ PRODUCTS ------------------------------ */}
      {tab === 'products' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">
              Perubahan di sini langsung tampil di storefront (harga, stok, diskon, badge).
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetCatalog}
                disabled={busyId === 'reset-products'}
                className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset Katalog
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewProduct(blankProduct());
                  setShowNewProduct(true);
                  setEditingProduct(null);
                }}
                className="px-3 py-2 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Produk Baru
              </button>
            </div>
          </div>

          {/* Pencarian & filter katalog */}
          <div className="flex flex-wrap items-center gap-2 bg-white rounded-2xl border border-slate-200 p-2.5">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                placeholder="Cari nama, kategori, atau slug produk…"
                className="input-admin !pl-8 !py-1.5"
              />
            </div>
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="input-admin !text-[11px] !py-1.5 !w-auto"
            >
              <option value="">Semua produk ({products.length})</option>
              <option value="preorder">Pre-Order</option>
              <option value="bestseller">Best Seller</option>
              <option value="bundle">Paket Bundling</option>
              <option value="lowstock">Stok menipis (≤20)</option>
              <option value="inactive">Nonaktif</option>
            </select>
          </div>

          {(showNewProduct || editingProduct) && (
            <ProductEditor
              value={showNewProduct ? { ...newProduct, __isNew: true } : editingProduct}
              onChange={(next) => {
                if (showNewProduct) setNewProduct(next);
                else setEditingProduct(next);
              }}
              onCancel={requestCloseEditor}
              onSave={saveProduct}
              vendors={vendorOptions}
              busy={
                busyId === (editingProduct?.id || 'new') || busyId === `dup-${editingProduct?.id}`
              }
            />
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-bold">Produk</th>
                    <th className="text-right px-2 py-2.5 font-bold">Harga</th>
                    <th className="text-right px-2 py-2.5 font-bold">Stok</th>
                    <th className="text-center px-2 py-2.5 font-bold">Varian</th>
                    <th className="text-right px-2 py-2.5 font-bold">Berat</th>
                    <th className="text-center px-2 py-2.5 font-bold">Label</th>
                    <th className="text-right px-3 py-2.5 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <img
                            src={p.image}
                            alt={p.shortName}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate max-w-[220px]">
                              {p.shortName || p.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {p.categoryLabel} • {p.slug}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right font-semibold text-navy-800 whitespace-nowrap">
                        {formatRupiah(p.price)}
                        {p.discountPercent > 0 && (
                          <div className="text-[10px] text-red-500 font-bold">
                            -{p.discountPercent}%
                          </div>
                        )}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-extrabold ${
                          p.stock <= 20 ? 'text-red-600' : 'text-slate-700'
                        }`}
                      >
                        {p.stock}
                      </td>
                      <td className="px-2 py-2 text-center text-slate-600 font-semibold">
                        {(p.variants || []).length > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                            {(p.variants || []).length}
                          </span>
                        ) : (
                          <span className="text-slate-300">–</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right text-slate-600 whitespace-nowrap">
                        {p.weightGrams || 0} g
                      </td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {p.isPreOrder && (
                            <span className="px-1.5 py-0.5 rounded bg-forest-600 text-white text-[9px] font-bold">
                              PO
                            </span>
                          )}
                          {p.isBestSeller && (
                            <span className="px-1.5 py-0.5 rounded bg-amberbrand-100 text-amberbrand-800 text-[9px] font-bold">
                              Best
                            </span>
                          )}
                          {p.isBundle && (
                            <span className="px-1.5 py-0.5 rounded bg-forest-100 text-forest-800 text-[9px] font-bold">
                              Bundle
                            </span>
                          )}
                          {p.active === false && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[9px] font-bold">
                              Nonaktif
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewProduct(false);
                            setEditingProduct({ ...p });
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => duplicateProduct(p)}
                          disabled={busyId === `dup-${p.id}`}
                          title="Duplikat produk"
                          className="ml-1 p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 disabled:opacity-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProduct(p)}
                          className="ml-1 p-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-center text-slate-400">
                        Tidak ada produk yang cocok dengan pencarian/filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------ B2B ------------------------------ */}
      {tab === 'b2b' && (
        <div className="space-y-3">
          {inquiries.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs text-slate-500">
              Belum ada inquiry B2B masuk.
            </div>
          )}
          {inquiries.map((inq) => (
            <div
              key={inq.quoteId}
              className="bg-white rounded-2xl border border-slate-200 p-4 shadow-soft space-y-2"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-extrabold text-navy-800">{inq.companyName}</div>
                  <div className="text-[11px] text-slate-500">
                    {inq.quoteId} • {inq.picName} • {inq.phone}
                    {inq.email && inq.email !== '-' ? ` • ${inq.email}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <a
                    href={buildWhatsAppUrlFor(
                      inq.phone,
                      `Halo ${inq.picName}, terima kasih atas inquiry ${inq.quoteId} dari ${inq.companyName}. Kami siap membantu kebutuhan merchandise Anda.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-[11px] font-bold inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3 h-3" /> WA PIC
                  </a>
                  <select
                    value={inq.status}
                    onChange={(e) => updateInquiry(inq.quoteId, { status: e.target.value })}
                    className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold"
                  >
                    {[...new Set([inq.status, ...B2B_STATUS_OPTIONS])].filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600">
                <div>
                  <span className="text-slate-400">Produk:</span> {inq.productInterest}
                </div>
                <div>
                  <span className="text-slate-400">Qty:</span> {inq.quantity} pcs
                </div>
                <div>
                  <span className="text-slate-400">Budget:</span>{' '}
                  {formatRupiah(inq.budgetPerUnit || 0)}/pcs
                </div>
                <div>
                  <span className="text-slate-400">Deadline:</span> {inq.deadline}
                </div>
              </div>
              {inq.notes && (
                <div className="text-[11px] text-slate-600 bg-slate-50 rounded-lg p-2">
                  Catatan: {inq.notes}
                </div>
              )}
              <div className="text-[10px] text-slate-400">
                Masuk: {new Date(inq.createdAt).toLocaleString('id-ID')} • Status:{' '}
                <strong>{inq.status}</strong>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------ SETTINGS ------------------------------ */}
      {tab === 'finance' && <FinancePanel pushToast={pushToast} />}

      {tab === 'security' && <SecurityPanel pushToast={pushToast} />}

      {tab === 'settings' && (
        <SettingsPanel
          value={draftSettings}
          onChange={setDraftSettings}
          onSave={saveSettings}
          onReset={resetSettings}
          onTestTelegram={testTelegram}
          testingTelegram={testingTelegram}
          busy={busyId === 'settings' || busyId === 'reset-settings'}
          pushToast={pushToast}
        />
      )}

      {/* Konfirmasi tutup editor dengan perubahan belum disimpan */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 bg-navy-950/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-amberbrand-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-extrabold text-navy-800">Perubahan belum disimpan</h4>
                <p className="text-[11.5px] text-slate-500 mt-1">
                  Kalau ditutup sekarang, semua perubahan pada produk ini akan hilang.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setConfirmClose(false)}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
              >
                Lanjut Edit
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClose(false);
                  setShowNewProduct(false);
                  setEditingProduct(null);
                }}
                className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold"
              >
                Buang Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {invoiceOrder && (
        <InvoiceDocument
          order={invoiceOrder}
          mode={invoiceMode}
          onClose={() => setInvoiceOrder(null)}
        />
      )}
    </div>
  );
};

/* ==================================================================== */
/* Order card                                                           */
/* ==================================================================== */

const OrderCard: React.FC<{
  order: any;
  busy: boolean;
  onUpdate: (orderId: string, payload: Record<string, unknown>) => void;
  onPrint: (mode: 'invoice' | 'label') => void;
  onDelete: (orderId: string) => void;
}> = ({ order, busy, onUpdate, onPrint, onDelete }) => {
  const [resi, setResi] = useState(order.resi || '');
  const [courier, setCourier] = useState(order.courier || COURIER_OPTIONS[0]);
  const [timelineNote, setTimelineNote] = useState('');
  const [showProof, setShowProof] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex flex-wrap items-start justify-between gap-2 bg-surface-warm">
        <div>
          <div className="text-xs font-extrabold text-navy-800">
            {order.orderId} <span className="text-slate-400 font-medium">• {order.invoiceNumber}</span>
          </div>
          <div className="text-[11px] text-slate-600">
            {order.customerName} • {order.customerPhone}
          </div>
          <div className="text-[10px] text-slate-500">
            {new Date(order.createdAt).toLocaleString('id-ID')} • {order.courier}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${statusBadge(
                order.paymentStatus
              )}`}
            >
              {order.paymentStatus}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${statusBadge(
                order.status
              )}`}
            >
              {order.status.replace(/_/g, ' ')}
            </span>
          </div>
          <div className="text-sm font-extrabold text-navy-800">
            {formatRupiah(order.totalAmount)}
          </div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* items + address */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-[10px] uppercase font-extrabold text-slate-400">Rincian Pesanan</div>
          <div className="space-y-1 text-[11px]">
            {order.items?.map((it: any, i: number) => (
              <div key={i} className="flex justify-between gap-2">
                <span className="text-slate-700">
                  {it.qty}x {it.name}
                </span>
                <span className="text-slate-800 font-semibold shrink-0">
                  {formatRupiah(it.price * it.qty)}
                </span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-slate-600 leading-relaxed border-t border-slate-100 pt-1.5">
            <strong className="text-slate-700">Alamat:</strong> {order.fullAddress || order.destination}
          </div>
          {order.notes && (
            <div className="text-[11px] text-amberbrand-800 bg-amberbrand-50 rounded-lg p-1.5">
              Catatan pembeli: {order.notes}
            </div>
          )}
          <div className="text-[11px] text-slate-500">
            Kode unik: <strong>{order.uniqueCodeValue}</strong> • Bayar: {order.paymentMethod}
            {order.bankAccount ? ` (${order.bankAccount.bank} ${order.bankAccount.accountNumber})` : ''}
          </div>

          {(order.paymentProofNote || order.paymentProofImage) && (
            <div className="rounded-lg border border-forest-200 bg-forest-50 p-2 space-y-1">
              <button
                type="button"
                onClick={() => setShowProof((s) => !s)}
                className="text-[10px] font-extrabold text-forest-800 inline-flex items-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" /> Bukti transfer diunggah pembeli{' '}
                {showProof ? '(sembunyikan)' : '(lihat)'}
              </button>
              {showProof && (
                <div className="space-y-1">
                  {order.paymentProofNote && (
                    <p className="text-[11px] text-slate-700">{order.paymentProofNote}</p>
                  )}
                  {order.paymentProofImage && (
                    <img
                      src={order.paymentProofImage}
                      alt="Bukti transfer"
                      className="max-h-44 rounded-lg border border-forest-200"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* actions */}
        <div className="lg:col-span-7 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                Status Pembayaran
              </label>
              <select
                value={order.paymentStatus}
                disabled={busy}
                onChange={(e) => onUpdate(order.orderId, { paymentStatus: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold"
              >
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                Status Pesanan
              </label>
              <select
                value={order.status}
                disabled={busy}
                onChange={(e) => onUpdate(order.orderId, { status: e.target.value })}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-semibold"
              >
                {ORDER_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
            <div className="text-[10px] font-extrabold uppercase text-slate-500 flex items-center gap-1">
              <Truck className="w-3 h-3" /> Input Resi Kurir Asli
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] bg-white"
              >
                {[...new Set([order.courier, ...COURIER_OPTIONS])].filter(Boolean).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={resi}
                onChange={(e) => setResi(e.target.value.toUpperCase())}
                placeholder="Nomor AWB / Resi"
                className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px] font-mono bg-white"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={busy || !resi.trim()}
                onClick={() => onUpdate(order.orderId, { resi, courier, status: 'DIKIRIM' })}
                className="px-2.5 py-1.5 rounded-lg bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-white text-[11px] font-bold"
              >
                Simpan Resi & Tandai Dikirim
              </button>
              {order.resi && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUpdate(order.orderId, { resi: '' })}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-600"
                >
                  Kosongkan Resi
                </button>
              )}
              {order.resi && (
                <span className="text-[10px] text-forest-700 font-bold self-center">
                  Resi aktif: {order.resi}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-1.5">
            <input
              type="text"
              value={timelineNote}
              onChange={(e) => setTimelineNote(e.target.value)}
              placeholder="Tambah catatan timeline (mis. paket dijemput kurir)"
              className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 text-[11px]"
            />
            <button
              type="button"
              disabled={busy || !timelineNote.trim()}
              onClick={() => {
                onUpdate(order.orderId, { timelineNote });
                setTimelineNote('');
              }}
              className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-900 disabled:opacity-50 text-white text-[11px] font-bold"
            >
              Tambah Timeline
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => onPrint('invoice')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
            >
              <Printer className="w-3 h-3" /> Invoice
            </button>
            <button
              type="button"
              onClick={() => onPrint('label')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
            >
              <Package className="w-3 h-3" /> Label Kirim
            </button>
            <a
              href={buildWhatsAppUrlFor(
                order.customerPhone,
                order.resi
                  ? `Halo ${order.customerName}, pesanan ${order.orderId} sudah kami kirim via ${order.courier}.\n\nNomor resi: ${order.resi}\nLacak: ${window.location.origin}/lacak-pesanan?q=${order.resi}\n\nTerima kasih telah berbelanja di Cilegon Enggih!`
                  : `Halo ${order.customerName}, pesanan ${order.orderId} sedang kami proses. Total ${formatRupiah(
                      order.totalAmount
                    )}. Kami kabari lagi setelah resi kurir tersedia.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 rounded-lg bg-[#25D366] text-white text-[11px] font-bold inline-flex items-center gap-1"
            >
              <MessageCircle className="w-3 h-3" /> Kabari Pembeli
            </a>
            {order.resi && order.trackingLinks?.[0] && (
              <a
                href={order.trackingLinks[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600"
              >
                Cek Resi
              </a>
            )}
            <button
              type="button"
              onClick={() => onDelete(order.orderId)}
              disabled={busy}
              title="Hapus pesanan ini (stok dikembalikan otomatis)"
              className="px-2.5 py-1.5 rounded-lg bg-white border border-red-200 text-[11px] font-bold text-red-600 hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Hapus
            </button>
          </div>

          {busy && (
            <div className="text-[10px] text-forest-700 font-bold inline-flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" /> Menyimpan...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ==================================================================== */
/* Product editor                                                       */
/* ==================================================================== */

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-0.5">
      {label}
    </label>
    {children}
  </div>
);

/* ==================================================================== */
/* Settings panel                                                       */
/* ==================================================================== */

const SettingsPanel: React.FC<{
  value: any;
  onChange: (next: any) => void;
  onSave: () => void;
  onReset: () => void;
  onTestTelegram: () => void;
  testingTelegram: boolean;
  busy: boolean;
  pushToast: (title: string, message: string, kind?: 'success' | 'error' | 'info') => void;
}> = ({
  value,
  onChange,
  onSave,
  onReset,
  onTestTelegram,
  testingTelegram,
  busy,
  pushToast
}) => {
  const [copied, setCopied] = useState('');
  const set = (key: string, val: any) => onChange({ ...value, [key]: val });
  const setNested = (group: string, key: string, val: any) =>
    onChange({ ...value, [group]: { ...(value[group] || {}), [key]: val } });

  const updateBank = (idx: number, key: string, val: any) => {
    const banks = [...(value.banks || [])];
    const next = { ...banks[idx], [key]: val };
    // Nomor rekening / atas nama diubah admin => rekening ini bukan placeholder lagi.
    if (key === 'accountNumber' && String(val).trim()) next.isPlaceholder = false;
    if (key === 'accountHolder') {
      next.accountHolder = String(val).replace(/\s*\(placeholder\)\s*/i, '').trim();
      if (next.accountHolder) next.isPlaceholder = false;
    }
    banks[idx] = next;
    set('banks', banks);
  };

  const updateVoucher = (idx: number, key: string, val: any) => {
    const vouchers = [...(value.vouchers || [])];
    vouchers[idx] = { ...vouchers[idx], [key]: val };
    set('vouchers', vouchers);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-2xl border border-slate-200 p-3">
        <p className="text-[11px] text-slate-500">
          Perubahan langsung dipakai storefront & checkout setelah disimpan.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="px-4 py-2 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white text-xs font-extrabold inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {busy ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </div>

      {/* Identitas & kontak */}
      <Section title="Identitas & Kontak Toko" icon={Sparkles}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Nama Toko">
            <input value={value.storeName || ''} onChange={(e) => set('storeName', e.target.value)} className="input-admin" />
          </Field>
          <Field label="Nama Badan Usaha">
            <input value={value.legalName || ''} onChange={(e) => set('legalName', e.target.value)} className="input-admin" />
          </Field>
          <Field label="Email Resmi">
            <input value={value.email || ''} onChange={(e) => set('email', e.target.value)} className="input-admin" />
          </Field>
          <Field label="Nomor WhatsApp (62...)">
            <input value={value.whatsapp || ''} onChange={(e) => set('whatsapp', e.target.value)} className="input-admin" />
          </Field>
          <Field label="WhatsApp Tampilan">
            <input
              value={value.whatsappDisplay || ''}
              onChange={(e) => set('whatsappDisplay', e.target.value)}
              className="input-admin"
            />
          </Field>
          <Field label="Jam Operasional">
            <input value={value.openHours || ''} onChange={(e) => set('openHours', e.target.value)} className="input-admin" />
          </Field>
        </div>
        <Field label="Alamat Lengkap (origin pengiriman)">
          <textarea
            rows={2}
            value={value.address || ''}
            onChange={(e) => set('address', e.target.value)}
            className="input-admin"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <Field label="Kecamatan Origin">
            <input value={value.originDistrict || ''} onChange={(e) => set('originDistrict', e.target.value)} className="input-admin" />
          </Field>
          <Field label="Kota Origin">
            <input value={value.originCity || ''} onChange={(e) => set('originCity', e.target.value)} className="input-admin" />
          </Field>
          <Field label="Kode Pos">
            <input value={value.originPostal || ''} onChange={(e) => set('originPostal', e.target.value)} className="input-admin" />
          </Field>
        </div>
        <Field label="Teks Pengumuman (banner toko)">
          <input
            value={value.announcement || ''}
            onChange={(e) => set('announcement', e.target.value)}
            className="input-admin"
          />
        </Field>
      </Section>

      {/* Rekening bank */}
      <Section title="Rekening Bank Toko" icon={Banknote}>
        <div className="space-y-2">
          {(value.banks || []).map((bank: any, idx: number) => (
            <div key={bank.id || idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-3">
                <Field label="Bank">
                  <input
                    value={bank.bank || ''}
                    onChange={(e) => updateBank(idx, 'bank', e.target.value)}
                    className="input-admin"
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="Nomor Rekening">
                  <input
                    value={bank.accountNumber || ''}
                    onChange={(e) => updateBank(idx, 'accountNumber', e.target.value)}
                    className="input-admin font-mono"
                  />
                </Field>
              </div>
              <div className="sm:col-span-4">
                <Field label="Atas Nama">
                  <input
                    value={bank.accountHolder || ''}
                    onChange={(e) => updateBank(idx, 'accountHolder', e.target.value)}
                    className="input-admin"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2 flex gap-1">
                <input
                  type="color"
                  value={bank.color || '#1B365D'}
                  onChange={(e) => updateBank(idx, 'color', e.target.value)}
                  className="h-9 w-9 rounded-lg border border-slate-200 bg-white"
                  title="Warna kartu bank"
                />
                <button
                  type="button"
                  onClick={() => set('banks', (value.banks || []).filter((_: any, i: number) => i !== idx))}
                  className="p-2 rounded-lg bg-red-50 text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set('banks', [
                ...(value.banks || []),
                {
                  id: `bank-${Date.now()}`,
                  bank: 'Bank Baru',
                  accountNumber: '0000000000',
                  accountHolder: 'Cilegon Enggih',
                  color: '#1B365D',
                  isPlaceholder: false
                }
              ])
            }
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Tambah Rekening
          </button>
        </div>
      </Section>

      {/* QRIS & payment */}
      <Section title="QRIS & Metode Pembayaran" icon={QrCode}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Nama Merchant QRIS">
            <input
              value={value.qris?.merchantName || ''}
              onChange={(e) => setNested('qris', 'merchantName', e.target.value)}
              className="input-admin"
            />
          </Field>
          <Field label="NMID">
            <input
              value={value.qris?.nmid || ''}
              onChange={(e) => setNested('qris', 'nmid', e.target.value)}
              className="input-admin font-mono"
            />
          </Field>
          <Field label="Mode QRIS">
            <select
              value={value.qris?.mode || 'dynamic'}
              onChange={(e) => setNested('qris', 'mode', e.target.value)}
              className="input-admin"
            >
              <option value="dynamic">Dinamis (nominal otomatis)</option>
              <option value="static">Statis (gambar QRIS merchant)</option>
            </select>
          </Field>
        </div>
        <div className="pt-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">
            Gambar QRIS (mode statis)
          </div>
          <QrisUploader
            value={value.qris?.staticImageUrl || ''}
            onChange={(url) => setNested('qris', 'staticImageUrl', url)}
            pushToast={pushToast}
          />
          {(value.qris?.staticImageUrl || '').startsWith('/') && (
            <p className="text-[10px] text-slate-400 mt-1.5">
              Path lokal <code>public/</code> — masih bisa dipakai, tapi unggahan baru tersimpan
              permanen di Storage.
            </p>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={value.payment?.uniqueCodeEnabled !== false}
              onChange={(e) => setNested('payment', 'uniqueCodeEnabled', e.target.checked)}
            />
            Aktifkan 3 digit kode unik transfer
          </label>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={value.qris?.enabled !== false}
              onChange={(e) => setNested('qris', 'enabled', e.target.checked)}
            />
            Aktifkan QRIS Toko
          </label>
          <Field label="Batas Waktu Pembayaran (jam)">
            <input
              type="number"
              value={value.payment?.paymentWindowHours ?? 24}
              onChange={(e) => setNested('payment', 'paymentWindowHours', Number(e.target.value))}
              className="input-admin"
            />
          </Field>
        </div>
        <Field label="Instruksi Pembayaran">
          <textarea
            rows={2}
            value={value.payment?.instructions || ''}
            onChange={(e) => setNested('payment', 'instructions', e.target.value)}
            className="input-admin"
          />
        </Field>
      </Section>

      {/* Vouchers */}
      <Section title="Voucher Promo" icon={Ticket}>
        <div className="space-y-2">
          {(value.vouchers || []).map((v: any, idx: number) => (
            <div key={v.code || idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-3">
                <Field label="Kode">
                  <input
                    value={v.code || ''}
                    onChange={(e) => updateVoucher(idx, 'code', e.target.value.toUpperCase())}
                    className="input-admin font-mono"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Min. Belanja">
                  <input
                    type="number"
                    value={v.minPurchase ?? 0}
                    onChange={(e) => updateVoucher(idx, 'minPurchase', Number(e.target.value))}
                    className="input-admin"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Diskon (Rp)">
                  <input
                    type="number"
                    value={v.discountAmount ?? 0}
                    onChange={(e) => updateVoucher(idx, 'discountAmount', Number(e.target.value))}
                    className="input-admin"
                  />
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field label="Judul">
                  <input
                    value={v.title || ''}
                    onChange={(e) => updateVoucher(idx, 'title', e.target.value)}
                    className="input-admin"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2 flex items-center gap-2 pb-1">
                <label className="flex items-center gap-1 text-[10px] font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={v.active !== false}
                    onChange={(e) => updateVoucher(idx, 'active', e.target.checked)}
                  />
                  Aktif
                </label>
                <button
                  type="button"
                  onClick={() =>
                    set('vouchers', (value.vouchers || []).filter((_: any, i: number) => i !== idx))
                  }
                  className="p-1.5 rounded-lg bg-red-50 text-red-600"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              set('vouchers', [
                ...(value.vouchers || []),
                {
                  code: 'PROMOBARU',
                  title: 'Diskon Spesial',
                  minPurchase: 100000,
                  discountAmount: 10000,
                  description: 'Potongan Rp 10.000',
                  active: true
                }
              ])
            }
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Tambah Voucher
          </button>
        </div>
      </Section>

      {/* Notifikasi Telegram */}
      <Section title="Notifikasi Telegram (Gratis)" icon={MessageCircle}>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Admin menerima pemberitahuan otomatis saat ada pesanan baru, bukti transfer, pembayaran
          LUNAS, paket dikirim, dan penawaran B2B. Gratis, tanpa biaya per pesan.
        </p>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[10.5px] text-slate-600 leading-relaxed space-y-1">
          <div>
            <strong>1.</strong> Buka Telegram → chat <code>@BotFather</code> → kirim{' '}
            <code>/newbot</code> → ikuti langkahnya → salin <strong>token</strong>.
          </div>
          <div>
            <strong>2.</strong> Kirim pesan apa saja ke bot Anda, lalu buka{' '}
            <code>https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</code> untuk melihat{' '}
            <strong>chat id</strong> (angka, biasanya diawali <code>-</code> untuk grup).
          </div>
          <div>
            <strong>3.</strong> Tempel token & chat id di bawah → klik <strong>Tes Koneksi</strong>{' '}
            → Simpan Pengaturan.
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Bot Token">
            <input
              value={value.telegram?.botToken || ''}
              onChange={(e) => setNested('telegram', 'botToken', e.target.value)}
              placeholder="123456789:AAF..."
              className="input-admin font-mono !text-[11px]"
            />
          </Field>
          <Field label="Chat ID Admin">
            <input
              value={value.telegram?.chatId || ''}
              onChange={(e) => setNested('telegram', 'chatId', e.target.value)}
              placeholder="123456789 atau -1001234567890"
              className="input-admin font-mono !text-[11px]"
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onTestTelegram}
            disabled={testingTelegram}
            className="px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-900 disabled:opacity-60 text-white text-[11px] font-extrabold inline-flex items-center gap-1.5"
          >
            {testingTelegram ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <MessageCircle className="w-3.5 h-3.5" />
            )}
            {testingTelegram ? 'Mengirim…' : 'Tes Koneksi'}
          </button>
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={value.telegram?.enabled === true}
              onChange={(e) => setNested('telegram', 'enabled', e.target.checked)}
              className="rounded border-slate-300"
            />
            Aktifkan notifikasi
          </label>
          {value.telegram?.botToken && value.telegram?.chatId && (
            <span className="text-[10.5px] font-bold text-forest-700 bg-forest-50 px-2 py-1 rounded-lg">
              ✓ Terkonfigurasi
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          {[
            ['notifyNewOrder', 'Pesanan baru masuk'],
            ['notifyPaymentProof', 'Bukti transfer diunggah'],
            ['notifyPaid', 'Pembayaran diverifikasi LUNAS'],
            ['notifyShipped', 'Paket dikirim (resi diinput)'],
            ['notifyB2B', 'Penawaran B2B baru']
          ].map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={value.telegram?.[key] !== false}
                onChange={(e) => setNested('telegram', key, e.target.checked)}
                className="rounded border-slate-300"
              />
              {label}
            </label>
          ))}
        </div>
      </Section>

      {/* Invoice + developer */}
      <Section title="Invoice & Kredit Developer" icon={Printer}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Field label="Nama Penanda Tangan Invoice">
            <input
              value={value.invoice?.signerName || ''}
              onChange={(e) => setNested('invoice', 'signerName', e.target.value)}
              className="input-admin"
            />
          </Field>
          <Field label="Judul Kredit Developer">
            <input
              value={value.developerTitle || ''}
              onChange={(e) => set('developerTitle', e.target.value)}
              className="input-admin"
            />
          </Field>
        </div>
        <Field label="URL Kredit Developer">
          <input
            value={value.developerUrl || ''}
            onChange={(e) => set('developerUrl', e.target.value)}
            className="input-admin"
          />
        </Field>
        <Field label="Catatan Kaki Invoice">
          <textarea
            rows={2}
            value={value.invoice?.footerNote || ''}
            onChange={(e) => setNested('invoice', 'footerNote', e.target.value)}
            className="input-admin"
          />
        </Field>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(
              JSON.stringify({ banks: value.banks, qris: value.qris }, null, 2)
            );
            setCopied('payment');
            setTimeout(() => setCopied(''), 1800);
          }}
          className="px-3 py-1.5 rounded-lg bg-slate-100 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1"
        >
          <Copy className="w-3 h-3" /> {copied === 'payment' ? 'Tersalin!' : 'Salin JSON Pembayaran'}
        </button>
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; icon: any; children: React.ReactNode }> = ({
  title,
  icon: Icon,
  children
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5 shadow-soft">
    <h3 className="text-sm font-extrabold text-navy-800 flex items-center gap-1.5">
      <Icon className="w-4 h-4 text-forest-600" /> {title}
    </h3>
    {children}
  </div>
);
