import React, { useRef, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trackProductView } from '../lib/tracker';
import {
  Star,
  ShoppingCart,
  MessageCircle,
  Heart,
  Share2,
  ShieldCheck,
  Ruler,
  Plus,
  Minus,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Building2,
  CreditCard,
  X
} from 'lucide-react';
import {
  KAOS_SIZE_CHART,
  formatRupiah,
  buildWhatsAppUrl,
  ProductVariant
} from '../data/products';
import { useStore } from '../context/StoreContext';
import { ShippingCalculator } from '../components/ShippingCalculator';
import { ProductCard } from '../components/ProductCard';

export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const {
    addToCart,
    setIsCheckoutOpen,
    wishlist,
    toggleWishlist,
    pushToast,
    products
  } = useStore();

  const product = products.find((p) => p.slug === slug) || products[0];
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product?.variants?.[0]
  );
  const [activeImage, setActiveImage] = useState(product?.image);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [activeTab, setActiveTab] = useState<'deskripsi' | 'spesifikasi' | 'ulasan'>('deskripsi');
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
  // Bilah beli melayang (HP): muncul setelah panel tombol desktop terlewat.
  const [showMobileBuyBar, setShowMobileBuyBar] = useState(false);
  const desktopBuyRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedVariant(product.variants?.[0]);
    setActiveImage(product.image);
    setQty(1);
    setNote('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Kunjungan halaman produk (dasar perhitungan konversi per produk).
    trackProductView({
      id: product.id,
      name: product.shortName || product.name,
      variantId: product.variants?.[0]?.id,
      variantLabel: product.variants?.[0]?.label
    });
  }, [product]);

  /**
   * Bilah beli melayang untuk HP.
   * Muncul hanya setelah panel tombol beli (versi desktop) terlewat ke atas,
   * supaya pembeli di HP tidak perlu menggulir jauh ke bawah untuk membeli.
   */
  useEffect(() => {
    const el = desktopBuyRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setShowMobileBuyBar(!entry.isIntersecting),
      { rootMargin: '-72px 0px 0px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [product?.id]);

  const gallery = product.galleryImages?.length
    ? product.galleryImages
    : [product.image];

  // Navigasi lightbox (keyboard) — hanya aktif saat lightbox terbuka.
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setLightboxIndex(null);
      if (ev.key === 'ArrowRight') setLightboxIndex((i) => (i === null ? null : (i + 1) % gallery.length));
      if (ev.key === 'ArrowLeft')
        setLightboxIndex((i) => (i === null ? null : (i - 1 + gallery.length) % gallery.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, gallery.length]);

  const baseUnitPrice = selectedVariant?.price ?? product.price;
  const isWholesaleActive = qty >= product.minWholesaleQty;
  const effectiveUnitPrice = isWholesaleActive
    ? Math.min(baseUnitPrice, product.wholesalePrice)
    : baseUnitPrice;
  const subtotal = effectiveUnitPrice * qty;

  const isWishlisted = wishlist.includes(product.id);
  const bundleSuggestions = products.filter((p) => p.isBundle);
  const relatedProducts = products
    .filter((p) => p.id !== product?.id && !p.isBundle)
    .slice(0, 4);

  const handleOrderWhatsApp = () => {
    const msg = `Halo Admin Cilegon Enggih! Saya tertarik memesan:\n\n• Produk: *${
      product.name
    }*\n• Varian: ${selectedVariant ? selectedVariant.label : 'Standar'}\n• Jumlah: *${qty} pcs*\n• Harga Estimasi: *${formatRupiah(
      subtotal
    )}*${note ? `\n• Catatan: ${note}` : ''}\n\nMohon info ketersediaan stok & pengiriman. Terima kasih!`;
    window.open(buildWhatsAppUrl(msg), '_blank', 'noopener,noreferrer');
  };

  const handleBuyNowDirect = () => {
    addToCart(product, qty, selectedVariant, note);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 lg:pb-8 space-y-12">
      {/* Breadcrumb */}
      {/*
        Breadcrumb: di HP nama produk panjang hanya menyisakan 164px sehingga
        terpotong. Sisa teks dibiarkan menggulir horizontal, bukan dipotong —
        pembeli tetap bisa membaca nama produk lengkap.
      */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto no-scrollbar whitespace-nowrap w-full max-w-full min-w-0">
        <Link to="/" className="hover:text-forest-600 font-medium">
          Beranda
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        <Link
          to={`/katalog?kategori=${product.categorySlug}`}
          className="hover:text-forest-600 font-medium"
        >
          {product.categoryLabel}
        </Link>
        <ChevronRight className="w-3.5 h-3.5 shrink-0" />
        {/* Nama produk panjang dibiarkan terpotong di breadcrumb (wajar),
            tapi breadcrumb kini bisa digeser agar tetap terbaca penuh. */}
        <span className="text-navy-800 font-bold">{product.name}</span>
      </nav>

      {/* Tokopedia 3-Column Layout: Left Gallery (4) + Middle Details (5) + Right Sticky Checkout Box (3) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-7 items-start">
        {/* Column 1: Product Gallery */}
        <div className="lg:col-span-4 lg:sticky lg:top-32 space-y-3">
          <div className="flex gap-2.5">
            {/* Thumbnail vertikal (desktop) — gaya Tokopedia */}
            {gallery.length > 1 && (
              <div className="hidden lg:flex flex-col gap-2 max-h-[430px] overflow-y-auto pr-0.5 shrink-0">
                {gallery.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => setActiveImage(img)}
                    aria-label={`Gambar ${idx + 1}`}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      activeImage === img
                        ? 'border-forest-600 ring-1 ring-forest-600/30'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="aspect-square rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-card relative group">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(Math.max(0, gallery.indexOf(activeImage || gallery[0])))}
                  className="w-full h-full block cursor-zoom-in"
                  aria-label="Perbesar gambar"
                >
                  <img
                    src={activeImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </button>
                <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 pointer-events-none">
                  {product.badges.map((b, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-navy-800/90 text-white text-[11px] font-bold backdrop-blur-xs"
                    >
                      {b}
                    </span>
                  ))}
                  {product.isPreOrder && (
                    <span className="px-2.5 py-1 rounded-lg bg-forest-600 text-white text-[11px] font-extrabold backdrop-blur-xs">
                      ⏳ PRE-ORDER
                    </span>
                  )}
                </div>
                {gallery.length > 1 && (
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-navy-950/70 text-white text-[10.5px] font-bold">
                    {Math.max(1, gallery.indexOf(activeImage || gallery[0]) + 1)}/{gallery.length}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Thumbnail horizontal (mobile) */}
          {gallery.length > 1 && (
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1">
              {gallery.map((img, idx) => (
                <button
                  key={`m-${img}-${idx}`}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                    activeImage === img ? 'border-forest-600' : 'border-slate-200 opacity-75'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Store Official Trust Badge Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-navy-800 text-amberbrand-400 font-extrabold text-xs flex items-center justify-center">
                CE
              </div>
              <div>
                <div className="text-xs font-extrabold text-navy-800 flex items-center gap-1">
                  Cilegon Enggih Official
                  <ShieldCheck className="w-3.5 h-3.5 text-forest-600" />
                </div>
                <div className="text-[11px] text-slate-500">
                  Online • Dikirim dari Kota Cilegon
                </div>
              </div>
            </div>
            <span className="text-xs font-bold text-forest-700 bg-forest-50 px-2.5 py-1 rounded-lg">
              ★ 4.9 Toko
            </span>
          </div>
        </div>

        {/* Column 2: Product Information, Variants, Size Chart & Shipping Calculator */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <div className="text-xs font-bold text-forest-700 uppercase tracking-wider mb-1">
              {product.englishSubtitle}
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-navy-800 leading-snug">
              {product.name}
            </h1>

            {product.isPreOrder && (
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-forest-50 border border-forest-200 px-3 py-2">
                <span className="text-base leading-none">⏳</span>
                <div className="text-[11.5px] leading-snug text-forest-900">
                  <strong className="font-extrabold">Produk Pre-Order.</strong>{' '}
                  {product.preOrderNote || 'Pre Order 7–15 hari kerja'} dihitung setelah pembayaran
                  diverifikasi.
                </div>
              </div>
            )}

            {/* Rating & Sold Stats */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600 mt-2.5">
              <span className="inline-flex items-center gap-1 font-bold text-slate-800">
                Terjual {product.soldCount}+
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amberbrand-50 border border-amberbrand-200 text-slate-800 font-bold">
                <Star className="w-3.5 h-3.5 fill-amberbrand-400 text-amberbrand-400" />
                {product.rating.toFixed(1)}{' '}
                <span className="font-normal text-slate-500">
                  ({product.reviewCount} ulasan)
                </span>
              </span>
              <span>•</span>
              <span className="text-slate-500">Stok Tersedia: {product.stock}</span>
            </div>
          </div>

          {/* Price Highlight Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-navy-50/70 via-white to-forest-50/60 border border-slate-200/80 space-y-1.5">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-navy-800">
                {formatRupiah(effectiveUnitPrice)}
              </span>
              <span className="text-sm text-slate-400 line-through">
                {formatRupiah(selectedVariant?.originalPrice || product.originalPrice)}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-forest-600 text-white text-xs font-bold">
                Hemat {product.discountPercent}%
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Kisaran Harga Rekomendasi Retail: <strong>{product.priceRangeText}</strong>
            </div>
            <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-forest-700">
              <Building2 className="w-3.5 h-3.5" />
              <span>
                Harga Grosir Otomatis ≥ {product.minWholesaleQty} pcs:{' '}
                <strong>{formatRupiah(product.wholesalePrice)} / pcs</strong>
              </span>
            </div>
          </div>

          {/* Variant Selector + Size Chart Button */}
          {product.variants && product.variants.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-extrabold text-navy-800">
                  Pilih Varian / Ukuran:{' '}
                  <span className="text-forest-700 font-semibold">
                    {selectedVariant?.label}
                  </span>
                </span>

                {product.hasSizeChart && (
                  <button
                    type="button"
                    onClick={() => setShowSizeChartModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-forest-700 hover:text-forest-800 bg-forest-50 px-2.5 py-1 rounded-lg border border-forest-200"
                  >
                    <Ruler className="w-3.5 h-3.5" /> Panduan Size Chart Kaos
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const active = selectedVariant?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? 'bg-forest-50 border-forest-600 text-forest-800 ring-1 ring-forest-600/30'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-forest-400'
                      }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Inline Size Chart Preview for Kaos */}
          {product.hasSizeChart && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-navy-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-forest-600" /> Tabel Size Chart Kaos Regular Fit Unisex
                </h4>
                <span className="text-[11px] text-slate-400">Toleransi jahit ±1 cm</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-2.5 font-bold">Ukuran</th>
                      <th className="py-2 px-2.5 font-bold">Lebar Dada</th>
                      <th className="py-2 px-2.5 font-bold">Panjang Badan</th>
                      <th className="py-2 px-2.5 font-bold">Estimasi BB</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {KAOS_SIZE_CHART.map((row) => (
                      <tr key={row.size} className="hover:bg-forest-50/40">
                        <td className="py-1.5 px-2.5 font-extrabold text-navy-800">
                          {row.size}
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-700">{row.chest}</td>
                        <td className="py-1.5 px-2.5 text-slate-700">{row.length}</td>
                        <td className="py-1.5 px-2.5 text-slate-500">{row.weightRec}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabs: Deskripsi, Spesifikasi Teknis, Ulasan */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex overflow-x-auto no-scrollbar border-b border-slate-200 text-xs sm:text-sm font-bold">
              {[
                { id: 'deskripsi', label: 'Deskripsi' },
                { id: 'spesifikasi', label: 'Rincian Spesifikasi' },
                { id: 'ulasan', label: `Ulasan (${(product.reviews || []).length})` }
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as any)}
                  className={`shrink-0 whitespace-nowrap py-3 px-3.5 sm:px-4 border-b-2 transition-colors ${
                    activeTab === t.id
                      ? 'border-forest-600 text-forest-700 bg-forest-50/40'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 sm:p-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
              {activeTab === 'deskripsi' && (
                <div className="space-y-3">
                  <p>{product.description}</p>
                  {product.bundleItems && (
                    <div className="pt-2 space-y-1.5">
                      <div className="font-bold text-navy-800">Rincian Isi Paket:</div>
                      {product.bundleItems.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'spesifikasi' && (
                <div className="divide-y divide-slate-100">
                  {product.specs.map((spec, idx) => (
                    <div
                      key={idx}
                      className="py-2.5 grid grid-cols-1 sm:grid-cols-12 gap-1 sm:gap-3"
                    >
                      <span className="sm:col-span-4 font-bold text-slate-500">
                        {spec.label}
                      </span>
                      <span className="sm:col-span-8 text-slate-800 font-medium">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'ulasan' && (
                <div className="space-y-4">
                  {(product.reviews || []).map((rev) => (
                    <div key={rev.id} className="pb-3 border-b border-slate-100 last:border-none">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-navy-800">{rev.user}</span>
                        <span className="text-[11px] text-slate-400">{rev.date}</span>
                      </div>
                      <div className="text-[11px] text-forest-700 font-medium">
                        {rev.role} {rev.variant ? `• Varian: ${rev.variant}` : ''}
                      </div>
                      <p className="mt-1.5 text-slate-600">{rev.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Integrated Automatic Shipping Calculator (Requirement Section 4) */}
          <ShippingCalculator weightGrams={product.weightGrams * qty} compact />
        </div>

        {/* Column 3: Tokopedia-style Sticky Atur Jumlah & Tombol Checkout Ganda */}
        <div ref={desktopBuyRef} className="lg:col-span-3 lg:sticky lg:top-32">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-hover p-5 space-y-4">
            <h3 className="text-sm font-extrabold text-navy-800">
              Atur Jumlah & Catatan
            </h3>

            {selectedVariant && (
              <div className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 leading-snug">
                Varian dipilih:{' '}
                <strong className="text-navy-800 break-words">{selectedVariant.label}</strong>
              </div>
            )}

            {/* Quantity Stepper */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="p-2.5 text-slate-600 hover:text-navy-800"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-12 text-center text-sm font-extrabold text-navy-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setQty((q) => q + 1)}
                  className="p-2.5 text-slate-600 hover:text-navy-800"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <span className="text-xs text-slate-500">
                Stok: <strong className="text-slate-800">{selectedVariant?.stock ?? product.stock}</strong>
              </span>
            </div>

            {/* Quick Wholesale Trigger */}
            {!isWholesaleActive ? (
              <button
                type="button"
                onClick={() => setQty(product.minWholesaleQty)}
                className="w-full text-left px-3 py-2 rounded-xl bg-amberbrand-50 hover:bg-amberbrand-100/80 border border-amberbrand-200 text-[11px] text-amberbrand-900 font-semibold transition-colors"
              >
                💡 Beli <strong>{product.minWholesaleQty} pcs</strong> otomatis dapat Harga Grosir{' '}
                <strong>{formatRupiah(product.wholesalePrice)}/pcs</strong> (Klik untuk set)
              </button>
            ) : (
              <div className="px-3 py-2 rounded-xl bg-forest-50 border border-forest-200 text-[11px] text-forest-800 font-bold">
                ✓ Harga Grosir Aktif! Anda hemat{' '}
                {formatRupiah((baseUnitPrice - effectiveUnitPrice) * qty)}
              </div>
            )}

            {/* Optional Note */}
            <div>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Tambah catatan (contoh: bungkus kado)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:border-forest-600 outline-none"
              />
            </div>

            {/* Subtotal */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Subtotal</span>
              <span className="text-xl font-extrabold text-navy-800">
                {formatRupiah(subtotal)}
              </span>
            </div>

            {/* TOMBOL CHECKOUT GANDA (Requirement Section 4) */}
            <div className="space-y-2.5">
              {/* 1. Tambah ke Keranjang */}
              <button
                type="button"
                onClick={() => addToCart(product, qty, selectedVariant, note)}
                className="w-full py-3 px-4 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>+ Tambah ke Keranjang</span>
              </button>

              {/* Beli Langsung (Payment Gateway QRIS/VA) */}
              <button
                type="button"
                onClick={handleBuyNowDirect}
                className="w-full py-2.5 px-4 rounded-xl bg-navy-800 hover:bg-navy-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <CreditCard className="w-4 h-4 text-amberbrand-400" />
                <span>Beli Langsung (QRIS / VA)</span>
              </button>

              {/* 2. Pesan via WhatsApp */}
              <button
                type="button"
                onClick={handleOrderWhatsApp}
                className="w-full py-2.5 px-4 rounded-xl bg-forest-600 hover:bg-forest-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Pesan via WhatsApp</span>
              </button>
            </div>

            {/* Wishlist & Share */}
            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className="py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isWishlisted ? 'fill-rose-500 text-rose-500' : ''
                  }`}
                />
                <span>Wishlist</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  pushToast('Tautan Produk Disalin!', product.name, 'info');
                }}
                className="py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* BAGIAN BUNDLING / PAKET OLEH-OLEH (Requirement Section 4) */}
      {!product.isBundle && (
        <section className="bg-gradient-to-r from-forest-50 via-white to-amberbrand-50/50 rounded-3xl border border-forest-200/80 p-6 sm:p-8 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 text-xs font-extrabold text-forest-700 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5" /> Rekomendasi Paket Hemat Oleh-Oleh
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-navy-800 mt-0.5">
                Lebih Hemat dengan Paket Bundling Cilegon Enggih!
              </h2>
            </div>
            <Link
              to="/katalog?kategori=paket-bundling"
              className="text-xs font-bold text-forest-700 hover:underline"
            >
              Lihat Semua Paket →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bundleSuggestions.slice(0, 2).map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4 justify-between shadow-soft"
              >
                <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                  <img
                    src={b.image}
                    alt={b.shortName}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-100 shrink-0"
                  />
                  {/*
                    `min-w-0` WAJIB pada anak flex yang berisi teks panjang.
                    Tanpa ini, teks tidak mau menyusut dan mendorong kartu
                    melewati lebar layar (overflow 3px di layar 280px).
                  */}
                  <div className="min-w-0">
                    <Link
                      to={`/produk/${b.slug}`}
                      className="text-sm font-extrabold text-navy-800 hover:text-forest-700"
                    >
                      {b.name}
                    </Link>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {b.bundleItems?.slice(0, 3).join(' • ')}
                    </p>
                    <div className="mt-1.5 flex items-baseline gap-2">
                      <span className="text-base font-extrabold text-navy-800">
                        {formatRupiah(b.price)}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        {formatRupiah(b.originalPrice)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(b, 1, b.variants?.[0])}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-xs font-bold shrink-0"
                >
                  + Ambil Paket
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Produk Lainnya */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-navy-800">
          Pilihan Merchandise Cilegon Enggih Lainnya
        </h2>
        <div className="grid grid-cols-1 min-[400px]:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {relatedProducts.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {/* Size Chart Popup Modal */}
      {showSizeChartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setShowSizeChartModal(false)}
            className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs"
          />
          <div className="relative z-10 bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-navy-800">
                Panduan Ukuran Kaos Distro Cilegon Enggih
              </h3>
              <button
                type="button"
                onClick={() => setShowSizeChartModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Potongan <strong>Regular Fit Unisex</strong> berbahan 100% Cotton Combed 24s yang sejuk dan tidak menyusut setelah dicuci.
            </p>
            <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-navy-800 text-white">
                <tr>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Lebar Dada</th>
                  <th className="py-2.5 px-3">Panjang</th>
                  <th className="py-2.5 px-3">Bahu</th>
                  <th className="py-2.5 px-3">Rekomendasi BB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {KAOS_SIZE_CHART.map((s) => (
                  <tr key={s.size}>
                    <td className="py-2 px-3 font-extrabold text-navy-800">{s.size}</td>
                    <td className="py-2 px-3">{s.chest}</td>
                    <td className="py-2 px-3">{s.length}</td>
                    <td className="py-2 px-3">{s.shoulder}</td>
                    <td className="py-2 px-3 text-slate-500">{s.weightRec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sm:hidden text-[10px] text-slate-400 text-center mt-1">
              Geser tabel untuk melihat semua ukuran →
            </p>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox galeri */}
      {lightboxIndex !== null && gallery[lightboxIndex] && (
        <div
          className="fixed inset-0 z-[70] bg-navy-950/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i === null ? null : (i - 1 + gallery.length) % gallery.length));
            }}
            className="absolute left-3 sm:left-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Sebelumnya"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <img
            src={gallery[lightboxIndex]}
            alt={`${product.name} ${lightboxIndex + 1}`}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((i) => (i === null ? null : (i + 1) % gallery.length));
            }}
            className="absolute right-3 sm:right-6 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white"
            aria-label="Berikutnya"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-bold">
            {lightboxIndex + 1} / {gallery.length}
          </div>
        </div>
      )}

      {/*
        Bilah beli melayang — HANYA di HP (lg:hidden).
        Tujuan: pembeli tidak perlu menggulir sejauh isi deskripsi & ulasan
        untuk menemukan tombol beli. Padding bawah mengikuti safe-area agar
        tidak tertutup gesture bar iPhone/Android.
      */}
      <div
        className={`lg:hidden fixed bottom-0 left-0 right-0 w-full max-w-full box-border z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] px-3 pt-2.5 pb-2.5 pb-safe transition-transform duration-200 ${
          showMobileBuyBar && !showSizeChartModal && lightboxIndex === null
            ? 'translate-y-0'
            : 'translate-y-full'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-500 truncate">
              {selectedVariant?.label || product.shortName}
            </p>
            <p className="text-base font-extrabold text-navy-800 leading-tight truncate">
              {formatRupiah(subtotal)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => addToCart(product, qty, selectedVariant, note)}
            aria-label="Tambah ke keranjang"
            className="shrink-0 p-3 rounded-xl border border-amberbrand-400 bg-amberbrand-50 text-amberbrand-700 active:bg-amberbrand-100"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleBuyNowDirect}
            className="shrink-0 px-4 py-3 rounded-xl bg-amberbrand-400 active:bg-amberbrand-500 text-navy-950 font-extrabold text-xs inline-flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4" /> Beli Sekarang
          </button>
        </div>
      </div>

    </div>
  );
};
