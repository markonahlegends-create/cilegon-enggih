import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CreditCard,
  QrCode,
  Building,
  CheckCircle2,
  Ticket,
  ShieldCheck,
  Copy,
  PackageCheck,
  ArrowRight,
  Upload,
  Printer,
  MessageCircle,
  Clock,
  AlertTriangle,
  Smartphone
} from 'lucide-react';
import { useStore, cacheOrderLocally } from '../context/StoreContext';
import { formatRupiah, buildWhatsAppUrlFor, buildWhatsAppUrl } from '../data/products';
import { ShippingCalculator } from './ShippingCalculator';
import { InvoiceDocument } from './InvoiceDocument';
import { createOrder, requestQris, uploadPaymentProof, ApiError } from '../lib/api';

const toBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsDataURL(file);
  });

const compressImage = (file: File, maxSize = 1100, quality = 0.72): Promise<string> =>
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

  const [selectedCourier, setSelectedCourier] = useState({
    id: 'gosend-instant',
    courier: 'GoSend Instant',
    cost: 14000,
    zoneLabel: 'Kota Cilegon',
    zoneId: 'cilegon-pusat'
  });

  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'qris'>('bank');
  const [selectedBankId, setSelectedBankId] = useState(settings.banks[0]?.id || 'bca');
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{ code: string; discount: number } | null>(
    null
  );

  const [qrPayload, setQrPayload] = useState<string>('');
  const [staticQris, setStaticQris] = useState<string>('');
  const [proofNote, setProofNote] = useState('');
  const [proofImage, setProofImage] = useState('');
  const [proofUploading, setProofUploading] = useState(false);
  const [proofSaved, setProofSaved] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [createdOrder, setCreatedOrder] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isCheckoutOpen) {
      setStep('form');
      setCreatedOrder(null);
      setShowInvoice(false);
      setProofNote('');
      setProofImage('');
      setProofSaved(false);
      setErrorMsg('');
    }
  }, [isCheckoutOpen]);

  const selectedBank = useMemo(
    () => settings.banks.find((b) => b.id === selectedBankId) || settings.banks[0],
    [settings.banks, selectedBankId]
  );

  const voucherDiscount = appliedVoucher?.discount || 0;
  const totalBeforeCode = Math.max(0, cartSubtotal + selectedCourier.cost - voucherDiscount);

  // Kode unik 3 digit — ditampilkan sebagai estimasi; server menentukan nilai final.
  const previewUniqueCode = useMemo(() => Number(String(Date.now()).slice(-3)), [isCheckoutOpen]);
  const estimatedTotal =
    settings.payment.uniqueCodeEnabled === false ? totalBeforeCode : totalBeforeCode + previewUniqueCode;

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
        const unitPrice = item.variant?.price ?? item.product.price;
        const effectivePrice =
          item.product.minWholesaleQty > 0 && item.qty >= item.product.minWholesaleQty
            ? Math.min(unitPrice, item.product.wholesalePrice || unitPrice)
            : unitPrice;
        return {
          name: `${item.product.shortName}${item.variant ? ` (${item.variant.label})` : ''}`,
          qty: item.qty,
          price: effectivePrice
        };
      });

      const result = await createOrder({
        customerName,
        customerPhone,
        customerEmail,
        destination: selectedCourier.zoneLabel,
        addressDetail,
        courier: selectedCourier.courier,
        courierService: selectedCourier.courier,
        shippingCost: selectedCourier.cost,
        paymentMethod:
          paymentMethod === 'qris'
            ? 'QRIS Toko Cilegon Enggih'
            : `Transfer Bank ${selectedBank?.bank || 'BCA'}`,
        bankId: paymentMethod === 'bank' ? selectedBank?.id : undefined,
        voucherCode: appliedVoucher?.code,
        voucherDiscount,
        items: orderItems,
        notes
      });

      setCreatedOrder(result.order);
      cacheOrderLocally(result.order);

      if (paymentMethod === 'qris') {
        try {
          const qris = await requestQris(result.order.totalAmount, result.order.orderId);
          if (qris.mode === 'static') setStaticQris(qris.imageUrl || '');
          else setQrPayload(qris.payload || '');
        } catch {
          setStaticQris(settings.qris.staticImageUrl);
        }
      } else if (settings.qris.staticImageUrl) {
        setStaticQris(settings.qris.staticImageUrl);
      }

      setStep('payment');
      pushToast('Pesanan Dibuat', `Nomor order ${result.order.orderId}`, 'success');
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Gagal membuat pesanan. Coba lagi ya.';
      setErrorMsg(message);
      pushToast('Checkout Gagal', message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProofFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('Format Tidak Didukung', 'Unggah foto/screenshot (JPG atau PNG)', 'warning');
      return;
    }
    setProofUploading(true);
    try {
      const compressed = file.size > 400_000 ? await compressImage(file) : await toBase64(file);
      setProofImage(compressed);
      setProofSaved(false);
      pushToast('Bukti Transfer Siap', 'Tekan "Kirim Bukti" untuk menyimpan', 'info');
    } catch {
      pushToast('Gagal Memproses Gambar', 'Coba unggah file lain', 'warning');
    } finally {
      setProofUploading(false);
    }
  };

  const handleSendProof = async () => {
    if (!createdOrder) return;
    if (!proofNote.trim() && !proofImage) {
      pushToast('Bukti Belum Lengkap', 'Isi catatan atau unggah foto bukti transfer', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await uploadPaymentProof(createdOrder.orderId, {
        paymentProofNote: proofNote,
        paymentProofImage: proofImage
      });
      setCreatedOrder(res.order);
      cacheOrderLocally(res.order);
      setProofSaved(true);
      pushToast('Bukti Terkirim', 'Admin akan memverifikasi pembayaran Anda', 'success');
    } catch (err) {
      pushToast(
        'Gagal Mengirim Bukti',
        err instanceof ApiError ? err.message : 'Coba lagi atau kirim via WhatsApp',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    setCreatedOrder(createdOrder);
    clearCart();
    setStep('done');
  };

  const waConfirmMessage = createdOrder
    ? `Halo Admin Cilegon Enggih, saya sudah transfer untuk pesanan *${
        createdOrder.orderId
      }* sebesar *${formatRupiah(createdOrder.totalAmount)}* (termasuk kode unik ${
        createdOrder.uniqueCodeValue
      }). Mohon diverifikasi ya. Terima kasih!`
    : '';

  const copyText = (value: string, label: string) => {
    navigator.clipboard?.writeText(value);
    pushToast('Disalin!', `${label}: ${value}`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto print:static print:block print:overflow-visible print:p-0">
      <div
        onClick={() => setIsCheckoutOpen(false)}
        className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs print:hidden"
      />

      <div className="relative z-10 w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col print:hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-navy-800 text-white flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold">
              {step === 'form' && 'Checkout Pesanan — Cilegon Enggih'}
              {step === 'payment' && 'Selesaikan Pembayaran'}
              {step === 'done' && 'Pesanan Berhasil Dibuat!'}
            </h3>
            <p className="text-xs text-slate-300">
              {step === 'form' && 'Guest checkout • Tanpa perlu daftar akun'}
              {step === 'payment' && 'Transfer bank / QRIS toko • Tanpa biaya admin gateway'}
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
                    placeholder="Contoh: 081927157103"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:border-forest-600 outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Alamat Lengkap & Patokan Pengiriman *
                  </label>
                  <textarea
                    rows={2}
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

              {/* Payment Method */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Metode Pembayaran (Langsung ke Rekening Toko)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div
                    onClick={() => setPaymentMethod('bank')}
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${
                      paymentMethod === 'bank'
                        ? 'bg-forest-50 border-forest-600 ring-1 ring-forest-600/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center">
                      <Building className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-800">
                        Transfer Bank
                      </div>
                      <span className="text-[11px] text-forest-700 font-semibold">
                        BCA / Mandiri / BRI / SeaBank / DANA
                      </span>
                    </div>
                    {paymentMethod === 'bank' && (
                      <CheckCircle2 className="w-5 h-5 text-forest-600 shrink-0 ml-auto" />
                    )}
                  </div>

                  <div
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3.5 rounded-2xl border cursor-pointer flex items-center gap-3 transition-all ${
                      paymentMethod === 'qris'
                        ? 'bg-forest-50 border-forest-600 ring-1 ring-forest-600/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-navy-50 text-navy-800 flex items-center justify-center">
                      <QrCode className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-bold text-slate-800">QRIS Toko</div>
                      <span className="text-[11px] text-forest-700 font-semibold">
                        Semua e-wallet & m-banking
                      </span>
                    </div>
                    {paymentMethod === 'qris' && (
                      <CheckCircle2 className="w-5 h-5 text-forest-600 shrink-0 ml-auto" />
                    )}
                  </div>
                </div>

                {paymentMethod === 'bank' && (
                  <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {settings.banks.map((bank) => (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => setSelectedBankId(bank.id)}
                        className={`text-left p-2.5 rounded-xl border transition-all ${
                          selectedBankId === bank.id
                            ? 'border-navy-800 bg-navy-50/60 ring-1 ring-navy-800/20'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="text-[11px] font-extrabold text-slate-800">
                          {bank.bank}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {bank.accountNumber}
                        </div>
                        <div className="text-[10px] text-slate-400">{bank.accountHolder}</div>
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-2.5 flex items-start gap-2 text-[11px] text-slate-600 bg-amberbrand-50 border border-amberbrand-200 rounded-xl p-2.5">
                  <ShieldCheck className="w-4 h-4 text-amberbrand-600 shrink-0 mt-0.5" />
                  <span>
                    100% dana masuk langsung ke rekening toko tanpa potongan gateway. Anda akan
                    mendapat <strong>3 digit kode unik</strong> agar pembayaran mudah diverifikasi.
                  </span>
                </div>
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
              <div className="rounded-2xl border-2 border-amberbrand-300 bg-amberbrand-50 p-4 text-center">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-amberbrand-900 mb-1">
                  <Clock className="w-3.5 h-3.5" /> Selesaikan dalam{' '}
                  {settings.payment.paymentWindowHours} jam
                </div>
                <div className="text-xs text-amberbrand-900">Total yang harus dibayar</div>
                <div className="text-3xl font-extrabold text-navy-800 tracking-tight">
                  {formatRupiah(createdOrder.totalAmount)}
                </div>
                <div className="text-[11px] text-amberbrand-900 mt-1">
                  Nominal akhir sudah termasuk kode unik{' '}
                  <strong>{createdOrder.uniqueCodeValue}</strong> — transfer <strong>tepat</strong>{' '}
                  sebesar nominal ini.
                </div>
              </div>

              {/* Bank transfer */}
              {createdOrder.paymentMethod?.toLowerCase().includes('transfer') &&
                createdOrder.bankAccount && (
                  <div className="rounded-2xl border border-slate-200 overflow-hidden">
                    <div
                      className="px-4 py-2.5 text-white text-xs font-extrabold flex items-center justify-between"
                      style={{ backgroundColor: createdOrder.bankAccount.color || '#1B365D' }}
                    >
                      <span>{createdOrder.bankAccount.bank}</span>
                      <span className="text-[10px] font-semibold opacity-90">
                        a.n. {createdOrder.bankAccount.accountHolder}
                      </span>
                    </div>
                    <div className="p-4 flex items-center justify-between gap-3 bg-white">
                      <div>
                        <div className="text-[11px] text-slate-400">Nomor Rekening</div>
                        <div className="text-lg font-extrabold tracking-wider text-navy-800 font-mono">
                          {createdOrder.bankAccount.accountNumber}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(createdOrder.bankAccount.accountNumber, 'Nomor rekening')
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 inline-flex items-center gap-1"
                      >
                        <Copy className="w-3.5 h-3.5" /> Salin
                      </button>
                    </div>
                    <div className="px-4 pb-3 flex items-center justify-between bg-white border-t border-slate-100 pt-2">
                      <span className="text-[11px] text-slate-500">Nominal transfer</span>
                      <button
                        type="button"
                        onClick={() =>
                          copyText(String(createdOrder.totalAmount), 'Nominal transfer')
                        }
                        className="text-xs font-extrabold text-forest-700 inline-flex items-center gap-1 hover:underline"
                      >
                        {formatRupiah(createdOrder.totalAmount)} <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

              {/* QRIS */}
              {createdOrder.paymentMethod?.toLowerCase().includes('qris') && (
                <div className="max-w-xs mx-auto bg-white rounded-3xl border-2 border-navy-800 p-5 shadow-soft text-center">
                  <div className="text-xs font-extrabold text-navy-800 tracking-wider uppercase mb-2">
                    QRIS Resmi {settings.qris.merchantName}
                  </div>
                  <QrisImage payload={qrPayload} fallbackSrc={staticQris} />
                  <p className="text-[11px] text-slate-500 mt-2">{settings.qris.note}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    NMID: {settings.qris.nmid} • Nominal: {formatRupiah(createdOrder.totalAmount)}
                  </p>
                </div>
              )}

              {/* Upload proof */}
              <div className="rounded-2xl border border-slate-200 p-4 space-y-2.5 bg-slate-50/70">
                <div className="text-xs font-bold text-navy-800">
                  <Upload className="w-4 h-4 inline mr-1.5 text-forest-600" />
                  Konfirmasi Pembayaran (opsional, mempercepat verifikasi)
                </div>
                <input
                  type="text"
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder="Mis. Transfer BCA Rp 129.559 a.n. Budi, 16 Nov 14:20"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-forest-600"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <label className="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:border-forest-500 text-xs font-bold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    {proofUploading ? 'Memproses...' : 'Unggah Bukti Transfer'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProofFile}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleSendProof}
                    disabled={submitting || proofUploading}
                    className="px-3 py-2 rounded-xl bg-navy-800 hover:bg-navy-900 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {proofSaved ? 'Bukti Terkirim ✓' : 'Kirim Bukti'}
                  </button>
                  {proofImage && (
                    <img
                      src={proofImage}
                      alt="Bukti transfer"
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200"
                    />
                  )}
                </div>
                <p className="text-[10px] text-slate-500">
                  Link notifikasi WA & pelacakan order: <strong>{createdOrder.orderId}</strong>
                </p>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleFinish}
                  className="w-full py-3.5 px-6 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-extrabold text-sm shadow-sm transition-colors inline-flex items-center justify-center gap-2"
                >
                  <PackageCheck className="w-4 h-4" />
                  Saya Sudah Transfer — Selesai & Simpan Pesanan
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <a
                    href={buildWhatsAppUrlFor(settings.whatsapp, waConfirmMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1eb955] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" /> Konfirmasi via WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      handleFinish();
                      setTimeout(() => navigate(`/lacak-pesanan?q=${createdOrder.orderId}`), 150);
                    }}
                    className="py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                  >
                    Lacak Status Pesanan
                  </button>
                </div>
                <p className="text-[10px] text-slate-500 text-center">
                  Pembayaran diverifikasi manual oleh admin (rata-rata &lt; 30 menit pada jam
                  operasional {settings.openHours}).
                </p>
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
                  Pesanan Anda tercatat. Admin akan memverifikasi pembayaran lalu menginput nomor
                  resi kurir asli setelah paket diserahkan ke ekspedisi.
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="px-3 py-2.5 rounded-xl bg-navy-800 hover:bg-navy-900 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Invoice / Label
                </button>
                <a
                  href={buildWhatsAppUrlFor(settings.whatsapp, waConfirmMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1eb955] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> Konfirmasi WA
                </a>
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
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
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
                <span className="text-[10px] font-semibold text-slate-500 ml-1">
                  (termasuk kode unik 3 digit)
                </span>
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

/** Render QRIS payload → gambar, render di klien (library open-source `qrcode`). */
const QrisImage: React.FC<{ payload: string; fallbackSrc?: string }> = ({
  payload,
  fallbackSrc
}) => {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!payload) {
      setDataUrl('');
      return;
    }
    import('qrcode')
      .then((mod) => {
        const QR = (mod as any).default || mod;
        return QR.toDataURL(payload, {
          width: 260,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#1B365D', light: '#FFFFFF' }
        });
      })
      .then((url: string) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [payload]);

  if (dataUrl) {
    return <img src={dataUrl} alt="QRIS Cilegon Enggih" className="w-52 h-52 mx-auto rounded-xl" />;
  }
  if (fallbackSrc && (failed || !payload)) {
    return (
      <img src={fallbackSrc} alt="QRIS Cilegon Enggih" className="w-52 h-52 mx-auto rounded-xl" />
    );
  }
  return (
    <div className="w-52 h-52 mx-auto bg-slate-100 rounded-xl flex items-center justify-center text-xs text-slate-500">
      <Smartphone className="w-5 h-5 mr-1.5" /> Memuat QRIS...
    </div>
  );
};
