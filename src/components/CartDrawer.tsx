import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  X,
  ShoppingBag,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  MessageCircle,
  ShieldCheck,
  Sparkles
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatRupiah, buildWhatsAppUrl } from '../data/products';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    setIsCheckoutOpen,
    updateCartQty,
    removeFromCart,
    cartCount,
    cartSubtotal,
    cartWeightGrams
  } = useStore();

  /**
   * Kunci gulir latar belakang selama keranjang terbuka.
   * Di HP tanpa ini, halaman di belakang drawer ikut bergulir dan pembeli
   * bisa kehilangan posisi saat menutup keranjang.
   */
  useEffect(() => {
    if (!isCartOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCartOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isCartOpen, setIsCartOpen]);

  if (!isCartOpen) return null;

  const handleCheckoutViaWA = () => {
    const lines = cart.map((item, i) => {
      const unitPrice = item.variant?.price ?? item.product.price;
      const effectivePrice =
        item.qty >= item.product.minWholesaleQty
          ? Math.min(unitPrice, item.product.wholesalePrice)
          : unitPrice;
      return `${i + 1}. ${item.product.name}${
        item.variant ? ` [${item.variant.label}]` : ''
      } x ${item.qty} pcs = ${formatRupiah(effectivePrice * item.qty)}`;
    });

    const msg = `Halo Admin Cilegon Enggih! Saya ingin memesan produk berikut:\n\n${lines.join(
      '\n'
    )}\n\nSubtotal Produk: *${formatRupiah(
      cartSubtotal
    )}*\nEstimasi Berat: ${cartWeightGrams} gram\n\nMohon info ketersediaan & total ongkirnya. Terima kasih!`;

    window.open(buildWhatsAppUrl(msg), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={() => setIsCartOpen(false)}
        className="fixed inset-0 bg-navy-950/50 backdrop-blur-xs transition-opacity"
      />

      {/* Drawer Panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-navy-800 text-white">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-amberbrand-400" />
            <div>
              <h3 className="text-base font-bold leading-tight">
                Keranjang Belanja ({cartCount})
              </h3>
              <p className="text-xs text-slate-300">
                Cilegon Enggih Official Store
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Tutup keranjang"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Promo Progress Banner */}
        {cart.length > 0 && (
          <div className="px-5 py-2.5 bg-forest-50 border-b border-forest-100 flex items-center gap-2 text-xs text-forest-800">
            <Sparkles className="w-4 h-4 text-forest-600 shrink-0" />
            {cartSubtotal >= 100000 ? (
              <span>
                Selamat! Belanja Anda memenuhi syarat kode promo{' '}
                <strong>ENGGIHBARU</strong> (Hemat Rp 15.000).
              </span>
            ) : (
              <span>
                Tambah{' '}
                <strong>{formatRupiah(100000 - cartSubtotal)}</strong> lagi untuk
                klaim voucher diskon <strong>Rp 15.000</strong>!
              </span>
            )}
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 rounded-full bg-forest-50 text-forest-600 flex items-center justify-center mb-4">
                <ShoppingBag className="w-10 h-10" />
              </div>
              <h4 className="text-base font-bold text-navy-800 mb-1">
                Keranjang Anda Masih Kosong
              </h4>
              <p className="text-xs text-slate-500 max-w-xs mb-6">
                Yuk jelajahi koleksi merchandise khas Landmark Simpang Tiga Kota
                Cilegon atau pilih Paket Bundling Hemat!
              </p>
              <Link
                to="/katalog"
                onClick={() => setIsCartOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-bold transition-colors"
              >
                Mulai Belanja Sekarang
              </Link>
            </div>
          ) : (
            cart.map((item) => {
              const unitPrice = item.variant?.price ?? item.product.price;
              const isWholesale = item.qty >= item.product.minWholesaleQty;
              const effectivePrice = isWholesale
                ? Math.min(unitPrice, item.product.wholesalePrice)
                : unitPrice;

              return (
                <div
                  key={item.key}
                  className="flex gap-3.5 p-3 rounded-2xl border border-slate-200/80 bg-surface/60"
                >
                  <img
                    src={item.product.image}
                    alt={item.product.shortName}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/produk/${item.product.slug}`}
                      onClick={() => setIsCartOpen(false)}
                      className="text-xs sm:text-sm font-bold text-slate-800 hover:text-navy-800 line-clamp-2"
                    >
                      {item.product.name}
                    </Link>

                    {item.variant && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Varian: <strong className="text-slate-700">{item.variant.label}</strong>
                      </div>
                    )}

                    <div className="mt-1.5 flex items-baseline gap-1.5">
                      <span className="text-sm font-extrabold text-navy-800">
                        {formatRupiah(effectivePrice)}
                      </span>
                      {isWholesale && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amberbrand-100 text-amberbrand-800">
                          Harga Grosir Aktif!
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.key, item.qty - 1)}
                          className="p-1.5 text-slate-600 hover:text-navy-800"
                          aria-label="Kurangi jumlah"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-slate-800">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.key, item.qty + 1)}
                          className="p-1.5 text-slate-600 hover:text-navy-800"
                          aria-label="Tambah jumlah"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.key)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                        aria-label="Hapus produk"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Dual Checkout Buttons */}
        {cart.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-white space-y-3 pb-safe">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Total Berat Estimasi ({cartCount} item)</span>
              <span>{(cartWeightGrams / 1000).toFixed(2)} kg</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700">
                Subtotal Produk
              </span>
              <span className="text-lg font-extrabold text-navy-800">
                {formatRupiah(cartSubtotal)}
              </span>
            </div>

            {/* Dual Checkout Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setIsCartOpen(false);
                  setIsCheckoutOpen(true);
                }}
                className="w-full py-3 px-4 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <span>Checkout Pembayaran Otomatis (QRIS / VA)</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleCheckoutViaWA}
                className="w-full py-2.5 px-4 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Pesan Cepat via WhatsApp Admin</span>
              </button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
              <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
              <span>100% Transaksi Aman & Garansi Produk Resmi Cilegon Enggih</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
