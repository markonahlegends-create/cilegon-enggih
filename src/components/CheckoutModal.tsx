import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackCheckoutStart } from '../lib/tracker';
import {
  X,
  CreditCard,
  CheckCircle2,
  Ticket,
  ShieldCheck,
  Copy,
  PackageCheck,
  ArrowRight,
  Printer,
  MessageCircle,
  Clock,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import { useStore, cacheOrderLocally } from '../context/StoreContext';
import { formatRupiah } from '../data/products';
import { resolveSelection } from '../lib/variantPricing';
import { useBackClose } from '../hooks/useBackClose';
import { ShippingCalculator } from './ShippingCalculator';
import { InvoiceDocument } from './InvoiceDocument';
import { createOrder, ApiError } from '../lib/api';
import { useMidtransSnap, type SnapOutcome } from '../lib/midtransSnap';

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });

// Bukti transfer: target ≤600 KB agar tidak membebani payload serverless.
const compressImage = (file: File, maxSize = 900, quality = 0.62): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas tidak tersedia'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar tidak valid'));
    };
    img.src = url;
  });

export const CheckoutModal: React.FC = () => {

  const {
    cart,
    isCheckoutOpen,
    setIsCheckoutOpen,
    cartSubtotal,
    cartWeightGrams,
    clearCart,
    pushToast,
    vouchers,
    settings
  } = useStore();
  const navigate = useNavigate();

  const [step, setStep] = useState<'form' | 'payment' | 'done'>('form');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [notes, setNotes] = useState('');

  /*
   * Default kurir = reguler, BUKAN instan. Produk dikirim dari gudang pemasok
   * (dropship), jadi GoSend/GrabExpress Instant tidak tersedia. Harga default
   * mengikuti tarif JNE zona Cilegon untuk 1 kg; nilai sebenarnya diambil dari
   * ShippingCalculator begitu pembeli memilih.
   */
  const [selectedCourier, setSelectedCourier] = useState({
    id: 'jne-reg',
    courier: 'JNE Reguler (CTC/REG)',
    cost: 8000,
    zoneLabel: 'Kota Cilegon',
    zoneId: 'cilegon-pusat'
  });

  // Analitik: catat niat checkout (funnel: keranjang → checkout → pesanan).
  useEffect(() => {
    if (!isCheckoutOpen || cart.length === 0) return;
    trackCheckoutStart({
      value: Number(cartSubtotal) || 0,
      qty: cart.reduce((sum, item) => sum + item.qty, 0),
      zone: selectedCourier.zoneId || null
    });
    // sengaja hanya saat modal dibuka, bukan setiap render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckoutOpen]);

  /*
   * Pembayaran sekarang lewat Midtrans saja (Snap). Pilihan "transfer bank"
   * dan "QRIS toko" dihapus karena keduanya menuntut admin mencocokkan mutasi
   * bank secara manual — persis beban yang ingin dihilangkan.
   *
   * `midtransSiap` datang dari server: kalau kunci Midtrans belum diisi,
   * server melaporkannya lewat /api/storefront dan checkout otomatis kembali
   * ke jalur lama, sehingga toko tidak pernah mati total.
   */
  const midtransSiap = Boolean((settings as any).paymentGateway?.enabled);
  const snap = useMidtransSnap();
  const [snapOutcome, setSnapOutcome] = useState<SnapOutcome | null>(null);
  const [memeriksaStatus, setMemeriksaStatus] = useState(false);
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number } | null>(
    null
  );


  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  /**
   * Kunci gulir halaman di belakang modal.
   * Di HP, tanpa ini latar belakang ikut bergulir saat pembeli menggeser
   * form checkout — sangat mengganggu dan sering membuat salah tekan.
   */
  /*
   * Tombol kembali HP menutup popup checkout.
   * Sebelumnya di sini hanya ada listener `Escape` — dan HP tidak punya
   * tombol Escape, sehingga "kembali" meninggalkan halaman sementara popup
   * tetap terbuka. `useBackClose` mendorong entri riwayat penanda dan
   * menutup modal saat entri itu dikonsumsi.
   */
  useBackClose(isCheckoutOpen, () => setIsCheckoutOpen(false));

  useEffect(() => {
    if (!isCheckoutOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Escape untuk pengguna desktop; tombol kembali HP ditangani useBackClose.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCheckoutOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isCheckoutOpen, setIsCheckoutOpen]);

  useEffect(() => {
    if (isCheckoutOpen) {
      setStep('form');
      setCreatedOrder(null);
      setShowInvoice(false);
      setSnapOutcome(null);
      setErrorMsg('');
    }
  }, [isCheckoutOpen]);


  const voucherDiscount = appliedVoucher?.discount || 0;
  const totalBeforeCode = Math.max(0, cartSubtotal + selectedCourier.cost - voucherDiscount);

  // Kode unik 3 digit — ditampilkan sebagai estimasi; server menentukan nilai final.
  const previewUniqueCode = useMemo(() => Number(String(Date.now()).slice(-3)), [isCheckoutOpen]);
  /*
   * Dengan Midtrans, kode unik tidak dipakai: nominal yang dibayar harus sama
   * persis dengan total pesanan, karena server mencocokkan `gross_amount`
   * Midtrans dengan `totalAmount` di database. Menambahkan kode unik di sini
   * akan membuat tagihan berbeda dari total yang tersimpan.
   */
  const estimatedTotal =
    midtransSiap || settings.payment.uniqueCodeEnabled === false
      ? totalBeforeCode
      : totalBeforeCode + previewUniqueCode;

  if (!isCheckoutOpen) return null;

  const handleApplyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    const found = vouchers.find((v) => v.code === code);
    if (!found) {
      pushToast(
        'Kode Voucher Tidak Valid',
        `Kode aktif saat ini: ${vouchers.map((v) => v.code).join(', ') || 'belum ada'}`,
        'warning'
      );
      return;
    }
    if (cartSubtotal < found.minPurchase) {
      pushToast(
        'Belum Mencapai Minimum Belanja',
        `Min. belanja ${formatRupiah(found.minPurchase)} untuk kode ${found.code}`,
        'warning'
      );
      return;
    }
    setAppliedVoucher({ code: found.code, discount: found.discountAmount });
    pushToast(
      `Voucher ${found.code} Berhasil Dipakai!`,
      `Hemat ${formatRupiah(found.discountAmount)}`,
      'success'
    );
  };

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!customerName.trim() || !customerPhone.trim() || !addressDetail.trim()) {
      pushToast(
        'Lengkapi Data Pengiriman',
        'Nama, No. WhatsApp, dan Alamat lengkap wajib diisi',
        'warning'
      );
      return;
    }
    if (!/^(\+?62|0)8\d{7,12}$/.test(customerPhone.replace(/[\s-]/g, ''))) {
      pushToast('Nomor WhatsApp Tidak Valid', 'Gunakan format 08xxxxxxxxxx', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const orderItems = cart.map((item) => {
        /*
         * Produk multi-dimensi tidak punya `variant`, harganya dihitung dari
         * pilihan. resolveSelection() sama persis dengan yang dipakai server,
         * jadi harga di checkout = harga yang ditagih.
         */
        const unitPrice = item.options
          ? resolveSelection(item.product, item.options).price
          : item.variant?.price ?? item.product.price;
        const effectivePrice =
          item.product.minWholesaleQty > 0 && item.qty >= item.product.minWholesaleQty
            ? Math.min(unitPrice, item.product.wholesalePrice || unitPrice)
            : unitPrice;
        return {
          // ID dikirim supaya server bisa memverifikasi & menghitung harga sendiri.
          productId: item.product.id,
          productSlug: item.product.slug,
          variantId: item.variant?.id,
          variantLabel: item.variant?.label,
          // Server menghitung ulang dari sini; tidak pernah percaya `price`.
          options: item.options,
          optionsLabel: item.optionsLabel,
          name: `${item.product.shortName}${
            item.optionsLabel
              ? ` (${item.optionsLabel})`
              : item.variant
                ? ` (${item.variant.label})`
                : ''
          }`,
          qty: item.qty,
          price: effectivePrice
        };
      });

      const preOrderItems = cart.filter((item) => item.product.isPreOrder);
      const hasPreOrder = preOrderItems.length > 0;
      const preOrderNote =
        preOrderItems[0]?.product.preOrderNote || 'Pre Order 7–15 hari kerja';

      const result = await createOrder({
        customerName,
        customerPhone,
        customerEmail,
        destination: selectedCourier.zoneLabel,
        addressDetail,
        courier: selectedCourier.courier,
        courierService: selectedCourier.courier,
        shippingCost: selectedCourier.cost,
        paymentMethod: midtransSiap ? 'Midtrans (QRIS / Virtual Account / E-Wallet)' : 'Transfer Bank',
        bankId: undefined,
        voucherCode: appliedVoucher?.code,
        voucherDiscount,
        items: orderItems,
        notes,
        isPreOrder: hasPreOrder,
        preOrderNote: hasPreOrder ? preOrderNote : ''
      });

      setCreatedOrder(result.order);
      cacheOrderLocally(result.order);
      setStep('payment');
      pushToast('Pesanan Dibuat', `Nomor order ${result.order.orderId}`, 'success');

      /*
       * Langsung buka popup pembayaran. Pesanan sudah tersimpan di server
       * sebelum ini, jadi kalau pembeli menutup popup tanpa membayar,
       * pesanannya tetap ada dan bisa dibayar lagi nanti dari halaman lacak.
       */
      if (midtransSiap) {
        setSnapOutcome(null);
        await snap.bayar(result.order.orderId, (outcome) => {
          setSnapOutcome(outcome);
        });
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Gagal membuat pesanan. Coba lagi ya.';
      setErrorMsg(message);
      pushToast('Checkout Gagal', message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    setCreatedOrder(createdOrder);
    clearCart();
    setStep('done');
  };


  const copyText = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    pushToast('Disalin!', `${label}: ${value}`, 'info');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6 overflow-y-auto print:static print:block print:overflow-visible print:p-0">
      <div
        onClick={() => setIsCheckoutOpen(false)}
        className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs print:hidden"
      />

      {/*
        HP: tampil sebagai lembar bawah (bottom sheet) yang menempel ke bawah
        layar, membulat di sudut atas. Ketukan Latar belakang menutup modal.
        Desktop: tetap kartu tengah seperti sebelumnya.
      */}
      <div className="relative z-10 w-full max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col print:hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 bg-navy-800 text-white flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold">
              {step === 'form' && 'Checkout Pesanan — Cilegon Enggih'}
              {step === 'payment' && 'Selesaikan Pembayaran'}
              {step === 'done' && 'Pesanan Berhasil Dibuat!'}
            </h3>
            <p className="text-xs text-slate-300">
              {step === 'form' && 'Guest checkout • Tanpa perlu daftar akun'}
              {step === 'payment' && 'QRIS, e-wallet, Virtual Account, atau kartu • Terverifikasi otomatis'}
              {step === 'done' && 'Terima kasih sudah belanja produk lokal Cilegon'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCheckoutOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          {step === 'form' && (
            <form id="checkout-form" onSubmit={handleProceedToPayment} className="space-y-6">
              {/* Customer Data */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap Penerima *
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nomor WhatsApp Aktif *
                  </label>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Contoh: 082249879873"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap & Patokan Pengiriman *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={addressDetail}
                    onChange={(e) => setAddressDetail(e.target.value)}
                    placeholder="Nama jalan, nomor rumah/gedung, RT/RW, kelurahan, kecamatan, kode pos..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email untuk Invoice (Opsional)
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Pesanan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Mis. Kartu ucapan ulang tahun"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
              </div>

              {/* Shipping Calculator */}
              <ShippingCalculator
                weightGrams={cartWeightGrams || 350}
                selectedServiceId={selectedCourier.id}
                onSelectService={(srv, zoneLabel) =>
                  setSelectedCourier({
                    id: srv.id,
                    courier: srv.courier,
                    cost: srv.cost,
                    zoneLabel,
                    zoneId: selectedCourier.zoneId
                  })
                }
              />

              {/* Voucher */}
              <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50/70">
                <label className="block text-xs font-bold text-navy-800 mb-2">
                  <Ticket className="w-4 h-4 inline mr-1.5 text-amberbrand-600" />
                  Gunakan Voucher Promo
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={voucherInput}
                    onChange={(e) => setVoucherInput(e.target.value)}
                    placeholder="Masukkan kode voucher"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm uppercase font-semibold outline-none focus:border-forest-600"
                  />
                  <button
                    type="button"
                    onClick={handleApplyVoucher}
                    className="px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-900 text-white text-xs font-bold transition-colors"
                  >
                    Terapkan
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {vouchers.map((v) => (
                    <button
                      key={v.code}
                      type="button"
                      onClick={() => setVoucherInput(v.code)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-forest-500 text-slate-700 font-medium"
                    >
                      <strong>{v.code}</strong> (-{formatRupiah(v.discountAmount)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Metode Pembayaran — Midtrans */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Metode Pembayaran
                </h4>

                {midtransSiap ? (
                  <>
                    <div className="p-3.5 rounded-2xl border bg-forest-50 border-forest-600 ring-1 ring-forest-600/30 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white text-navy-800 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-slate-800">
                          QRIS, GoPay, ShopeePay, Virtual Account, Kartu
                        </div>
                        <span className="text-[11px] text-forest-700 font-semibold">
                          Dibayar aman lewat Midtrans • Otomatis terverifikasi
                        </span>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-forest-600 shrink-0 ml-auto" />
                    </div>

                    <div className="mt-2.5 flex items-start gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <ShieldCheck className="w-4 h-4 text-navy-700 shrink-0 mt-0.5" />
                      <span>
                        Tekan <strong>Bayar Sekarang</strong> untuk memilih metode pembayaran.
                        Pesanan Anda langsung terverifikasi otomatis — tanpa perlu kirim bukti
                        transfer dan tanpa menunggu admin.
                      </span>
                    </div>
                  </>
                ) : (
                  /*
                   * Jalur cadangan. Hanya tampil kalau kunci Midtrans di server
                   * belum diisi, supaya toko tidak pernah mati total.
                   */
                  <div className="p-3.5 rounded-2xl border border-amberbrand-300 bg-amberbrand-50">
                    <div className="text-xs sm:text-sm font-bold text-amberbrand-900">
                      Pembayaran otomatis belum aktif
                    </div>
                    <p className="text-[11px] text-amberbrand-900 mt-1">
                      Pesanan tetap bisa dibuat. Admin akan menghubungi Anda untuk pengaturan
                      pembayaran setelah pesanan masuk.
                    </p>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          )}

          {step === 'payment' && createdOrder && (
            <div className="space-y-5">
              {/* Ringkasan tagihan */}
              <div className="rounded-2xl border-2 border-amberbrand-300 bg-amberbrand-50 p-4 text-center">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-amberbrand-900 mb-1">
                  <Clock className="w-3.5 h-3.5" /> Selesaikan dalam {settings.payment.paymentWindowHours} jam
                </div>
                <div className="text-xs text-amberbrand-900">Total yang harus dibayar</div>
                <div className="text-3xl font-extrabold text-navy-800 tracking-tight">
                  {formatRupiah(createdOrder.totalAmount)}
                </div>
                <div className="text-[11px] text-amberbrand-900 mt-1">
                  Nomor pesanan <strong>{createdOrder.orderId}</strong>
                </div>
              </div>

              {/* Status pembayaran otomatis */}
              {midtransSiap ? (
                <div className="rounded-2xl border border-slate-200 p-4 space-y-3">
                  {(snapOutcome === 'success' || snapOutcome === 'pending') && (
                    <div className="flex items-start gap-2 text-xs text-forest-800 bg-forest-50 border border-forest-200 rounded-xl p-3">
                      <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {snapOutcome === 'success'
                          ? 'Pembayaran diterima Midtrans. Pesanan Anda sedang diverifikasi otomatis — status berubah menjadi LUNAS begitu konfirmasi resmi masuk, biasanya dalam hitungan detik.'
                          : 'Menunggu Anda menyelesaikan pembayaran. Kalau sudah dibayar, status akan berubah otomatis — tidak perlu kirim bukti transfer.'}
                      </span>
                    </div>
                  )}

                  {snapOutcome === 'closed' && (
                    <div className="flex items-start gap-2 text-xs text-amberbrand-900 bg-amberbrand-50 border border-amberbrand-200 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        Jendela pembayaran ditutup. Pesanan Anda <strong>tetap tersimpan</strong> —
                        tekan tombol di bawah untuk membuka pembayaran lagi.
                      </span>
                    </div>
                  )}

                  {snapOutcome === 'error' && (
                    <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {snap.galat || 'Pembayaran belum berhasil.'} Anda bisa mencoba lagi.
                      </span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={async () => {
                      setSnapOutcome(null);
                      await snap.bayar(createdOrder.orderId, (outcome) => setSnapOutcome(outcome));
                    }}
                    disabled={snap.sedangMenyiapkan}
                    className="w-full py-3.5 px-6 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-sm transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    {snap.sedangMenyiapkan
                      ? 'Membuka pembayaran...'
                      : snapOutcome === 'closed' || snapOutcome === 'error'
                        ? 'Coba Bayar Lagi'
                        : 'Pilih Metode Pembayaran'}
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setMemeriksaStatus(true);
                      try {
                        const hasil = await snap.checkStatus(createdOrder.orderId);
                        if (hasil.paymentStatus === 'LUNAS') {
                          setCreatedOrder({ ...createdOrder, paymentStatus: 'LUNAS' });
                          pushToast('Pembayaran Lunas', 'Pesanan Anda sudah lunas.', 'success');
                        } else {
                          pushToast(
                            'Belum Lunas',
                            'Pembayaran belum kami terima. Kalau Anda baru saja membayar, tunggu beberapa saat lalu periksa lagi.',
                            'info'
                          );
                        }
                      } catch {
                        pushToast('Gagal Memeriksa', 'Coba lagi beberapa saat lagi.', 'warning');
                      } finally {
                        setMemeriksaStatus(false);
                      }
                    }}
                    disabled={memeriksaStatus}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    {memeriksaStatus ? 'Memeriksa...' : 'Saya Sudah Bayar — Periksa Status'}
                  </button>

                  <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                    Pembayaran diproses oleh <strong>Midtrans</strong> — QRIS, GoPay, ShopeePay,
                    Virtual Account, atau kartu. Status pesanan berubah otomatis tanpa perlu
                    konfirmasi manual.
                  </p>
                </div>
              ) : (
                /*
                 * JALUR CADANGAN — hanya tampil kalau kunci Midtrans belum diisi.
                 *
                 * Tanpa panel ini, pembeli yang checkout sebelum Midtrans aktif
                 * tidak melihat cara membayar sama sekali. Rekening tetap
                 * ditampilkan (bukan tautan pemesanan via WhatsApp) supaya
                 * pesanan yang sudah masuk tetap bisa diselesaikan.
                 */
                <div className="space-y-3">
                  <div className="rounded-2xl border border-amberbrand-300 bg-amberbrand-50 p-3 text-[11px] text-amberbrand-900">
                    Pembayaran otomatis belum aktif. Silakan transfer ke rekening di bawah, lalu
                    simpan nomor pesanan Anda untuk konfirmasi ke admin.
                  </div>

                  {(createdOrder.bankAccount
                    ? [createdOrder.bankAccount]
                    : settings.banks.filter((b) => !b.isPlaceholder)
                  ).map((bank) => (
                    <div
                      key={bank.id}
                      className="rounded-2xl border border-slate-200 overflow-hidden"
                    >
                      <div
                        className="px-4 py-2 text-white text-xs font-extrabold flex items-center justify-between"
                        style={{ backgroundColor: bank.color || '#1B365D' }}
                      >
                        <span>{bank.bank}</span>
                        <span className="text-[10px] font-semibold opacity-90">
                          a.n. {bank.accountHolder}
                        </span>
                      </div>
                      <div className="p-3 flex items-center justify-between gap-3 bg-white">
                        <div>
                          <div className="text-[10px] text-slate-400">Nomor Rekening</div>
                          <div className="text-base font-extrabold tracking-wider text-navy-800 font-mono">
                            {bank.accountNumber}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(bank.accountNumber, 'Nomor rekening')}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" /> Salin
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => copyText(String(createdOrder.totalAmount), 'Nominal transfer')}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" /> Salin Nominal: {formatRupiah(createdOrder.totalAmount)}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    handleFinish();
                    setTimeout(() => navigate(`/lacak-pesanan?q=${createdOrder.orderId}`), 150);
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                >
                  Lacak Status Pesanan
                </button>
              </div>
            </div>
          )}

          {step === 'done' && createdOrder && (
            <div className="text-center py-6 space-y-5 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center mx-auto">
                <PackageCheck className="w-9 h-9" />
              </div>
              <div>
                <h4 className="text-xl font-extrabold text-navy-800">
                  Terima Kasih, {createdOrder.customerName}!
                </h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  Pesanan Anda tercatat. Begitu pembayaran terkonfirmasi, status berubah menjadi{' '}
                  <strong className="text-forest-700">Lunas</strong> secara otomatis dan admin
                  menginput nomor resi asli setelah paket diserahkan ke ekspedisi. Pantau di halaman
                  Lacak Pesanan.
                </p>
              </div>

              <div className="bg-surface-warm rounded-2xl border border-slate-200 p-4 text-left space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Order:</span>
                  <strong className="text-navy-800 font-extrabold">{createdOrder.orderId}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Invoice:</span>
                  <strong className="text-slate-800">{createdOrder.invoiceNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Nomor Resi:</span>
                  <strong className="text-amberbrand-700 font-bold">
                    {createdOrder.resi || 'Menunggu input resi kurir'}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ekspedisi:</span>
                  <span className="font-semibold text-slate-800">{createdOrder.courier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Bayar:</span>
                  <span className="font-semibold text-slate-800">
                    {createdOrder.paymentStatus}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-slate-600 font-semibold">Total Tagihan:</span>
                  <strong className="text-base text-navy-800">
                    {formatRupiah(createdOrder.totalAmount)}
                  </strong>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="px-3 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-900 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Invoice / Label
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    navigate(`/lacak-pesanan?q=${encodeURIComponent(createdOrder.orderId)}`);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  Lacak <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="text-xs font-semibold text-slate-500 hover:text-navy-800"
              >
                Lanjut belanja
              </button>
            </div>
          )}
        </div>

        {/* Sticky Summary Footer on Step Form */}
        {step === 'form' && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 pb-safe">
            <div className="text-xs sm:text-sm space-y-0.5 w-full sm:w-auto">
              <div className="text-slate-500">
                Produk {formatRupiah(cartSubtotal)} + Ongkir {formatRupiah(selectedCourier.cost)}
                {voucherDiscount > 0 && (
                  <span className="text-forest-700 font-bold">
                    {' '}
                    − Promo {formatRupiah(voucherDiscount)}
                  </span>
                )}
              </div>
              <div className="text-base sm:text-lg font-extrabold text-navy-800">
                Total Tagihan: {formatRupiah(estimatedTotal)}
                {/*
                 * Kode unik hanya berlaku di jalur transfer manual (supaya admin
                 * bisa mencocokkan nominal di mutasi bank). Dengan Midtrans,
                 * pencocokan itu tidak lagi manual, jadi tidak ada kode unik —
                 * dan total bayar kembali ke angka bulat.
                 */}
                {!midtransSiap && (
                  <span className="text-[10px] font-semibold text-slate-500 ml-1">
                    (termasuk kode unik 3 digit)
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 disabled:opacity-60 text-navy-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <CreditCard className="w-4 h-4" />
              <span>{submitting ? 'Memproses...' : 'Lanjut ke Pembayaran'}</span>
            </button>
          </div>
        )}
      </div>

      {showInvoice && createdOrder && (
        <div className="print:block">
          <InvoiceDocument
            order={createdOrder}
            mode="invoice"
            onClose={() => setShowInvoice(false)}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Render payload QRIS menjadi gambar QR.
 *
 * Penting: QRIS nyata yang dipindai aplikasi pembayaran harus berupa **gambar
 * QRIS resmi dari bank/merchant** (berisi tanda tangan PSP), bukan QR yang
 * dibangun sendiri dari NMID. Karena itu urutannya:
 *   1. `qrImageUrl` — gambar QRIS resmi yang diunggah admin (mode statis)
 *   2. render payload dinamis (hanya untuk uji coba)
 *   3. pesan jelas — bukan spinner yang menggantung selamanya
 */
