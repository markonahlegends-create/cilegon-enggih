import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  PackageSearch,
  Search,
  Truck,
  CheckCircle2,
  MapPin,
  Clock,
  AlertCircle,
  ExternalLink,
  Printer,
  MessageCircle,
  Info,
  Copy
} from 'lucide-react';
import { formatRupiah, buildWhatsAppUrlFor } from '../data/products';
import { useStore, findCachedOrder } from '../context/StoreContext';
import { trackOrder, ApiError } from '../lib/api';
import { InvoiceDocument } from '../components/InvoiceDocument';

const STATUS_STEPS = ['MENUNGGU_KONFIRMASI', 'DIPROSES', 'DIKIRIM', 'SELESAI'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  MENUNGGU_KONFIRMASI: { label: 'Menunggu Konfirmasi Admin', color: 'bg-amberbrand-500' },
  DIPROSES: { label: 'Sedang Dikemas', color: 'bg-navy-700' },
  DIKIRIM: { label: 'Dalam Pengiriman', color: 'bg-forest-600' },
  SELESAI: { label: 'Pesanan Selesai', color: 'bg-forest-700' },
  DIBATALKAN: { label: 'Dibatalkan', color: 'bg-red-600' }
};

export const TrackOrderPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { settings, pushToast } = useStore();
  const initialQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQuery);
  const [order, setOrder] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const runTracking = async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setErrorMsg('');
    setOffline(false);
    try {
      const data = await trackOrder(code.trim());
      setOrder(data.order);
    } catch (err) {
      const cached = findCachedOrder(code.trim());
      if (cached) {
        setOrder(cached);
        setOffline(true);
        setErrorMsg('');
      } else {
        setOrder(null);
        setErrorMsg(
          err instanceof ApiError
            ? err.message
            : 'Data tidak ditemukan. Periksa kembali nomor order/resi Anda.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      runTracking(initialQuery);
    } else {
      runTracking('CE-20261116-102');
      setQuery('CE-20261116-102');
    }
  }, [initialQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query.trim() ? { q: query.trim() } : {});
    runTracking(query);
  };

  const stepIndex = order ? STATUS_STEPS.indexOf(order.status) : -1;
  const statusMeta = order ? STATUS_META[order.status] || STATUS_META.MENUNGGU_KONFIRMASI : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Search Box */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-forest-700 text-white rounded-3xl p-6 sm:p-10 shadow-card-hover space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-amberbrand-400">
            <PackageSearch className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold">Lacak Pesanan & Resi Kurir</h1>
            <p className="text-xs sm:text-sm text-slate-200">
              Cari dengan Nomor Order, Nomor Resi ekspedisi, atau Nomor WhatsApp Anda
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nomor Order (CE-...), No. Resi, atau No. WhatsApp"
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white text-slate-800 text-sm font-semibold outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3.5 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 disabled:opacity-60 text-navy-950 font-extrabold text-sm shrink-0"
          >
            {loading ? 'Melacak...' : 'Lacak Sekarang'}
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-300">Coba nomor sampel:</span>
          {[
            { code: 'CE-20261116-102', label: 'Dikirim + Resi' },
            { code: 'CE-20261115-089', label: 'Selesai' },
            { code: 'CE-20261116-108', label: 'Menunggu Verifikasi' }
          ].map((s) => (
            <button
              key={s.code}
              type="button"
              onClick={() => {
                setQuery(s.code);
                setSearchParams({ q: s.code });
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-amberbrand-200 font-semibold"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {errorMsg && (
        <div className="bg-amberbrand-50 border border-amberbrand-200 rounded-2xl p-5 flex items-start gap-3 text-amberbrand-900 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 text-amberbrand-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div>{errorMsg}</div>
            <a
              href={buildWhatsAppUrlFor(settings.whatsapp, `Halo Admin, saya ingin menanyakan status pesanan saya.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-bold text-forest-700 hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Hubungi admin via WhatsApp
            </a>
          </div>
        </div>
      )}

      {offline && order && (
        <div className="bg-navy-50 border border-navy-200 rounded-2xl p-3.5 flex items-start gap-2 text-navy-800 text-[11px] sm:text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Menampilkan salinan pesanan yang tersimpan di perangkat ini (server sedang tidak dapat
            dihubungi). Data resi terbaru dari admin akan muncul saat koneksi pulih.
          </span>
        </div>
      )}

      {order && (
        <div className="space-y-5">
          {/* Status card */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-soft overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-surface-warm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs text-slate-500">
                  Order: <strong className="text-navy-800">{order.orderId}</strong> • Invoice:{' '}
                  <strong className="text-slate-700">{order.invoiceNumber || '-'}</strong>
                </div>
                <h2 className="text-lg font-extrabold text-navy-800">
                  Penerima: {order.customerName}
                </h2>
                <div className="text-xs text-slate-500 flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-forest-600 shrink-0 mt-0.5" />
                  <span>{order.fullAddress || order.destination}</span>
                </div>
              </div>

              <div className="flex flex-col sm:items-end gap-1.5 shrink-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-white text-xs font-extrabold w-fit ${statusMeta?.color}`}
                >
                  <Truck className="w-3.5 h-3.5" /> {statusMeta?.label}
                </span>
                <span className="text-xs text-slate-500">
                  Kurir: <strong className="text-slate-700">{order.courier}</strong>
                </span>
              </div>
            </div>

            {/* Progress bar */}
            {order.status !== 'DIBATALKAN' && (
              <div className="px-5 sm:px-6 pt-5">
                <div className="flex items-center">
                  {STATUS_STEPS.map((s, idx) => {
                    const reached = stepIndex >= idx;
                    return (
                      <React.Fragment key={s}>
                        <div className="flex flex-col items-center shrink-0">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-extrabold ${
                              reached ? 'bg-forest-600 text-white' : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {idx + 1}
                          </div>
                          <span
                            className={`text-[9px] sm:text-[10px] mt-1 text-center w-16 sm:w-24 leading-tight ${
                              reached ? 'text-forest-800 font-bold' : 'text-slate-400'
                            }`}
                          >
                            {STATUS_META[s].label}
                          </span>
                        </div>
                        {idx < STATUS_STEPS.length - 1 && (
                          <div
                            className={`h-1 flex-1 mx-1 rounded ${
                              stepIndex > idx ? 'bg-forest-600' : 'bg-slate-200'
                            }`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resi & actions */}
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 space-y-4">
                {/* Resi Card */}
                <div
                  className={`rounded-2xl border p-3.5 ${
                    order.resi
                      ? 'bg-forest-50 border-forest-200'
                      : 'bg-amberbrand-50 border-amberbrand-200'
                  }`}
                >
                  <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500">
                    Nomor Resi / AWB {order.courier}
                  </div>
                  {order.resi ? (
                    <>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <div className="text-base sm:text-lg font-extrabold tracking-wider text-navy-800 font-mono">
                          {order.resi}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(order.resi);
                            pushToast('Resi Disalin', order.resi, 'info');
                          }}
                          className="p-1.5 rounded-lg bg-white border border-forest-200 text-forest-700"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(order.trackingLinks || []).map((link: any) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-forest-300 text-forest-800 text-[11px] font-bold hover:bg-forest-100"
                          >
                            {link.label} <ExternalLink className="w-3 h-3" />
                          </a>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-0.5 text-xs sm:text-sm text-amberbrand-900 font-semibold">
                      Menunggu input resi kurir — admin akan mengirim nomor resi asli setelah paket
                      diserahkan ke ekspedisi.
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-extrabold text-navy-800 uppercase tracking-wider mb-3">
                    Riwayat Perjalanan Pesanan
                  </h3>
                  <div className="space-y-3.5 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-forest-200">
                    {[...(order.timeline || [])].reverse().map((tl: any, idx: number) => (
                      <div key={idx} className="relative pl-8">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center absolute left-0 top-0.5 ${
                            idx === 0
                              ? 'bg-forest-600 text-white ring-4 ring-forest-100'
                              : 'bg-white border-2 border-forest-400 text-forest-600'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            idx === 0 ? 'text-forest-800' : 'text-slate-700'
                          }`}
                        >
                          {tl.status}
                        </div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {tl.time}
                          </span>
                          <span>•</span>
                          <span>{tl.location}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="lg:col-span-5 space-y-3">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <h3 className="text-xs font-extrabold text-navy-800 uppercase tracking-wider">
                    Rincian Pesanan
                  </h3>
                  <div className="divide-y divide-slate-200/70 text-xs space-y-2">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="pt-2 first:pt-0 flex justify-between gap-2">
                        <span className="text-slate-700 font-medium">
                          {item.qty}x {item.name}
                        </span>
                        <strong className="text-navy-800 shrink-0">
                          {formatRupiah(item.price * item.qty)}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between text-slate-500">
                      <span>Ongkos Kirim:</span>
                      <span>{formatRupiah(order.shippingCost || 0)}</span>
                    </div>
                    {(order.voucherDiscount || 0) > 0 && (
                      <div className="flex justify-between text-forest-700">
                        <span>Voucher {order.voucherCode}:</span>
                        <span>-{formatRupiah(order.voucherDiscount)}</span>
                      </div>
                    )}
                    {(order.uniqueCodeValue || 0) > 0 && (
                      <div className="flex justify-between text-amberbrand-700">
                        <span>Kode Unik:</span>
                        <span>{order.uniqueCodeValue}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-extrabold text-navy-800 pt-1">
                      <span>Total:</span>
                      <span>{formatRupiah(order.totalAmount)}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-500">Pembayaran:</span>
                      <span
                        className={`font-bold ${
                          order.paymentStatus === 'LUNAS' ? 'text-forest-700' : 'text-amberbrand-700'
                        }`}
                      >
                        {order.paymentStatus}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowInvoice(true)}
                  className="w-full py-2.5 rounded-xl bg-navy-800 hover:bg-navy-900 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Cetak Invoice / Label Pengiriman
                </button>
                <a
                  href={buildWhatsAppUrlFor(
                    settings.whatsapp,
                    `Halo Admin Cilegon Enggih, saya ingin menanyakan pesanan ${order.orderId}.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1eb955] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <MessageCircle className="w-4 h-4" /> Tanya Admin via WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvoice && order && (
        <InvoiceDocument order={order} mode="invoice" onClose={() => setShowInvoice(false)} />
      )}
    </div>
  );
};
