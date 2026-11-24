import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { trackProductView, trackShare } from '../lib/tracker';
import { ShareMenu } from '../components/ShareMenu';
import { productShareUrl } from '../lib/share';
import {
  Star,
  ShoppingCart,
  Heart,
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
  ArrowLeft,
  Play,
  X
} from 'lucide-react';
import {
  KAOS_SIZE_CHART,
  formatRupiah,
  ProductVariant,
  Product
} from '../data/products';
import {
  defaultSelection,
  isSelectionComplete,
  isValueAvailable,
  resolveSelection,
  unitPriceFor,
  type SelectedOptions
} from '../lib/variantPricing';
import { useStore } from '../context/StoreContext';
import { ShippingCalculator } from '../components/ShippingCalculator';
import ProductVideoPlayer, { GaleriVideo } from '../components/ProductVideoPlayer';
import { ProductCard } from '../components/ProductCard';
import { useBackClose } from '../hooks/useBackClose';

/**
 * Isi halaman detail produk. Hanya dirender kalau produknya SUDAH pasti ada,
 * sehingga seluruh hook di dalamnya selalu dijalankan dalam urutan yang sama.
 */
const ProductDetailView: React.FC<{ product: Product }> = ({ product }) => {
  const { slug } = useParams<{ slug: string }>();
  const {
    addToCart,
    setIsCheckoutOpen,
    wishlist,
    toggleWishlist,
    pushToast,
    products
  } = useStore();

  /*
   * Produk multi-dimensi (Model x Ukuran x Warna) memakai `options`, produk
   * biasa tetap memakai `selectedVariant`. Keduanya hidup berdampingan supaya
   * 20 produk lama tidak perlu diubah.
   */
  const optionGroups = product.optionGroups || [];
  const isMultiOption = optionGroups.length > 0;
  const [options, setOptions] = useState<SelectedOptions>(() => defaultSelection(product));
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(
    product?.variants?.[0]
  );
  const [activeImage, setActiveImage] = useState(product?.image);
  /*
   * TAMPILKAN VIDEO DI GALERI, BUKAN DI BAWAH HALAMAN.
   *
   * Sebelumnya video diletakkan setelah tabel spesifikasi — pembeli harus
   * menggulir jauh dan tidak pernah menyadarinya. Video produk adalah hal
   * pertama yang membuat orang berhenti menggulir, jadi tempatnya di layar
   * pertama, di dalam galeri.
   *
   * Video tetap bisa dikembalikan ke foto kapan saja (tombol "Lihat foto").
   */
  const [modeGaleri, setModeGaleri] = useState<'foto' | 'video'>('foto');
  const videoGaleri = product?.videos?.find((v) => v && v.url) || null;
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [activeTab, setActiveTab] = useState<'deskripsi' | 'spesifikasi' | 'ulasan'>('deskripsi');
  const [showSizeChartModal, setShowSizeChartModal] = useState(false);
  // Bilah beli melayang (HP): muncul setelah panel tombol desktop terlewat.
  const [showMobileBuyBar, setShowMobileBuyBar] = useState(false);
  const desktopBuyRef = useRef<HTMLDivElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  /*
   * Tombol kembali HP menutup popup yang sedang terbuka, bukan
   * meninggalkan halaman produk. Lightbox galeri dan popup ukuran boleh
   * terbuka bersamaan dari sudut pandang state, jadi kalau keduanya
   * terbuka kita tutup yang paling atas dulu (popup ukuran).
   */
  useBackClose(lightboxIndex !== null || showSizeChartModal, () => {
    if (showSizeChartModal) {
      setShowSizeChartModal(false);
      return;
    }
    setLightboxIndex(null);
  });

  useEffect(() => {
    setSelectedVariant(product.variants?.[0]);
    setOptions(defaultSelection(product));
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

  const productGallery = product.galleryImages?.length
    ? product.galleryImages
    : [product.image];

  /**
   * Galeri mengikuti varian yang dipilih.
   *
   * Aturan:
   * - Varian punya foto → foto varian tampil lebih dulu, lalu SISA galeri produk
   *   (supaya pembeli tetap bisa melihat detail lain).
   * - Varian belum punya foto → pakai galeri produk apa adanya. Tidak pernah
   *   menghasilkan galeri kosong / gambar rusak.
   * - Duplikat dibuang: kalau foto varian sama dengan foto galeri, tidak tampil dua kali.
   */
  /*
   * Harga & stok hasil pilihan. resolveSelection() adalah modul yang SAMA
   * dengan yang dipakai server, jadi angka di layar tidak mungkin berbeda
   * dari angka yang ditagih.
   */
  const selection = isMultiOption ? resolveSelection(product, options) : null;
  const optionsReady = !isMultiOption || isSelectionComplete(optionGroups, options);

  const gallery = useMemo(() => {
    /*
     * Untuk produk multi-dimensi, gambar mengikuti nilai yang dipilih
     * (mis. warna Navy -> foto Navy). Kombinasi menang atas nilai, nilai
     * menang atas galeri produk.
     */
    const variantShots = (
      isMultiOption
        ? [selection?.image]
        : [selectedVariant?.image, ...(selectedVariant?.images || [])]
    ).filter(Boolean) as string[];

    if (variantShots.length === 0) return productGallery;

    const unique = Array.from(new Set([...variantShots, ...productGallery]));
    return unique;
  }, [
    isMultiOption,
    selection?.image,
    selectedVariant?.id,
    selectedVariant?.image,
    selectedVariant?.images,
    productGallery.join('|')
  ]);

  /* Saat varian berganti, gambar utama kembali ke foto pertama varian. */
  useEffect(() => {
    if (isMultiOption && selection?.image) {
      setActiveImage(selection.image);
      return;
    }
    if (selectedVariant?.image) setActiveImage(selectedVariant.image);
  }, [isMultiOption, selection?.image, selectedVariant?.id, selectedVariant?.image]);

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

  const baseUnitPrice = selection ? selection.price : selectedVariant?.price ?? product.price;
  /*
   * Harga grosir hanya berlaku bila admin MEMANG mengisi minimal grosir
   * (> 0). Dulu syaratnya cuma `qty >= minWholesaleQty`, sehingga produk baru
   * (bawaan editor: minimal 0) langsung tampil seharga grosir untuk 1 pcs.
   */
  const effectiveUnitPrice = unitPriceFor({
    price: product.price,
    wholesalePrice: product.wholesalePrice,
    minWholesaleQty: product.minWholesaleQty,
    variantPrice: selectedVariant?.price,
    optionPrice: selection ? selection.price : undefined,
    qty
  });
  const isWholesaleActive = effectiveUnitPrice < baseUnitPrice;
  const subtotal = effectiveUnitPrice * qty;

  const isWishlisted = wishlist.includes(product.id);
  const bundleSuggestions = products.filter((p) => p.isBundle);
  const relatedProducts = products
    .filter((p) => p.id !== product?.id && !p.isBundle)
    .slice(0, 4);

  /**
   * URL yang dibagikan HARUS canonical dan bersih.
   *
   * `window.location.href` sering membawa `?utm=…`, `#galeri`, atau domain
   * preview. Crawler WhatsApp tidak menemukan kartu OG untuk URL seperti itu dan
   * menampilkan gambar default toko — keluhan "thumbnail tidak sesuai".
   * `productShareUrl()` menormalkannya menjadi <domain-toko>/produk/<slug>.
   */
  const shareUrl = useMemo(() => productShareUrl(product.slug), [product.slug]);

  /**
   * Tambah ke keranjang, satu pintu untuk produk biasa maupun multi-dimensi.
   *
   * Kalau pilihan belum lengkap, pesanan TIDAK boleh jalan — server akan
   * menolaknya nanti, tapi menolak lebih awal dengan pesan jelas jauh lebih
   * baik daripada pembeli baru tahu saat checkout.
   */
  const submitToCart = () => {
    if (isMultiOption && !optionsReady) {
      pushToast('Pilihan belum lengkap', 'Lengkapi Model, Ukuran, dan Warna dulu.', 'info');
      return false;
    }
    if (isMultiOption) {
      addToCart(product, qty, undefined, note, options, selection?.label);
      return true;
    }
    addToCart(product, qty, selectedVariant, note);
    return true;
  };

  const handleBuyNowDirect = () => {
    if (!submitToCart()) return;
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
                {videoGaleri && (
                  <button
                    type="button"
                    onClick={() => setModeGaleri('video')}
                    aria-label="Putar video produk"
                    title="Video produk"
                    className={`relative w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                      modeGaleri === 'video'
                        ? 'border-forest-600 ring-1 ring-forest-600/30'
                        : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    {videoGaleri.poster || gallery[0] ? (
                      <img
                        src={videoGaleri.poster || gallery[0]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="absolute inset-0 bg-gradient-to-br from-navy-800 to-forest-700" />
                    )}
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className="w-4 h-4 text-white" fill="currentColor" />
                    </span>
                  </button>
                )}
                {gallery.map((img, idx) => (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => {
                      setActiveImage(img);
                      setModeGaleri('foto');
                    }}
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
              {/*
                Di HP tinggi gambar dibatasi 260px (bukan persegi 326px) agar
                judul + harga produk masuk layar pertama tanpa menggulir.
                Di desktop tetap persegi penuh.
              */}
              <div className="h-[260px] lg:h-auto lg:aspect-square rounded-xl overflow-hidden bg-white border border-slate-200 relative group">
                {modeGaleri === 'video' && videoGaleri ? (
                  /*
                   * Video berjalan SENYAP dan berulang di dalam galeri supaya
                   * pembeli langsung melihat produk bergerak tanpa harus
                   * menekan apa pun. Suara hanya aktif bila ia menekannya —
                   * itu satu-satunya bentuk autoplay yang diizinkan browser.
                   */
                  <GaleriVideo
                    videos={product.videos}
                    autoplay
                    fallbackPoster={activeImage || gallery[0]}
                    className="h-full w-full"
                  />
                ) : (
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
                )}
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
                {modeGaleri === 'foto' && gallery.length > 1 && (
                  <span className="absolute bottom-3 right-3 px-2 py-0.5 rounded-md bg-navy-950/70 text-white text-[10.5px] font-bold">
                    {Math.max(1, gallery.indexOf(activeImage || gallery[0]) + 1)}/{gallery.length}
                  </span>
                )}

                {/*
                  Tombol kembali ke foto. Tanpa ini, pembeli yang ingin melihat
                  detail produk diam-diam terjebak menonton video berulang.
                */}
                {modeGaleri === 'video' && videoGaleri && (
                  <button
                    type="button"
                    onClick={() => setModeGaleri('foto')}
                    className="absolute top-2 right-2 z-10 rounded-lg bg-black/60 px-2.5 py-1 text-[10.5px] font-bold text-white backdrop-blur-sm hover:bg-black/80"
                  >
                    Lihat foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Thumbnail horizontal (mobile) */}
          {gallery.length > 1 && (
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-1">
              {videoGaleri && (
                <button
                  type="button"
                  onClick={() => setModeGaleri('video')}
                  aria-label="Putar video produk"
                  className={`relative w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                    modeGaleri === 'video' ? 'border-forest-600' : 'border-slate-200 opacity-75'
                  }`}
                >
                  {videoGaleri.poster || gallery[0] ? (
                    <img
                      src={videoGaleri.poster || gallery[0]}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="absolute inset-0 bg-gradient-to-br from-navy-800 to-forest-700" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Play className="w-4 h-4 text-white" fill="currentColor" />
                  </span>
                </button>
              )}
              {gallery.map((img, idx) => (
                <button
                  key={`m-${img}-${idx}`}
                  type="button"
                  onClick={() => {
                    setActiveImage(img);
                    setModeGaleri('foto');
                  }}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                    activeImage === img ? 'border-forest-600' : 'border-slate-200 opacity-75'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Column 2: Product Information, Variants, Size Chart & Shipping Calculator */}
        <div className="lg:col-span-5 space-y-5">
          <div>
            <div className="text-xs font-bold text-forest-700 uppercase tracking-wider mb-1">
              {product.englishSubtitle}
            </div>
            <div className="flex items-start justify-between gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-navy-800 leading-snug">
                {product.name}
              </h1>
              {/*
                Tombol bagikan tepat di samping judul: inilah tempat yang dicari
                pembeli saat ingin menyebarkan produk. Sebelumnya hanya ada di
                baris paling bawah, sehingga dianggap "tidak ada tombol share".
              */}
              <ShareMenu
                url={shareUrl}
                title={product.name}
                productName={product.name}
                productId={product.id}
                onToast={pushToast}
                triggerLabel=""
                triggerClassName="shrink-0 w-9 h-9 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600"
              />
            </div>

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

          {/*
            Baris toko ringkas — SATU baris (tinggi ±34px), bukan kartu
            tersendiri setinggi 90px di atas judul produk. Sebelumnya kartu
            ini tampil lebih dulu daripada nama & harga produk, sehingga
            pembeli harus menggulir satu layar untuk melihat harga.
          */}
          <div className="flex items-center gap-2 text-[11.5px] text-slate-600 pb-0.5">
            <span className="w-6 h-6 rounded-md bg-navy-800 text-amberbrand-400 font-extrabold text-[9px] flex items-center justify-center shrink-0">
              CE
            </span>
            <span className="font-extrabold text-navy-800 truncate">Cilegon Enggih Official</span>
            <ShieldCheck className="w-3.5 h-3.5 text-forest-600 shrink-0" />
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-0.5 shrink-0">
              <Star className="w-3 h-3 fill-amberbrand-400 text-amberbrand-400" /> 4.9
            </span>
            <span className="ml-auto text-slate-400 shrink-0 hidden sm:inline">
              Dikirim dari gudang mitra
            </span>
          </div>

          {/* Price Highlight Box */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-navy-50/70 via-white to-forest-50/60 border border-slate-200/80 space-y-1.5">
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl sm:text-3xl font-extrabold text-navy-800">
                {formatRupiah(effectiveUnitPrice)}
              </span>
              {(() => {
                const coret = selection
                  ? selection.originalPrice
                  : selectedVariant?.originalPrice || product.originalPrice;
                if (!coret || coret <= effectiveUnitPrice) return null;
                const persen = Math.round((1 - effectiveUnitPrice / coret) * 100);
                return (
                  <>
                    <span className="text-sm text-slate-400 line-through">
                      {formatRupiah(coret)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-forest-600 text-white text-xs font-bold">
                      Hemat {persen}%
                    </span>
                  </>
                );
              })()}
            </div>
            <div className="text-xs text-slate-500">
              Kisaran Harga Rekomendasi Retail: <strong>{product.priceRangeText}</strong>
            </div>
            {/*
              * Banner grosir hanya muncul bila admin MEMANG mengisi minimal
              * grosir (> 0). Produk baru dibuat dengan minimal 0; dulu banner
              * tetap tampil "≥ 0 pcs" dengan harga grosir, sehingga pembeli
              * mengira harga 1 pcs = harga grosir.
              */}
            {Number(product.minWholesaleQty) > 0 && Number(product.wholesalePrice) > 0 && (
              <div className="pt-1 flex items-center gap-1.5 text-xs font-semibold text-forest-700">
                <Building2 className="w-3.5 h-3.5" />
                <span>
                  Harga Grosir Otomatis ≥ {product.minWholesaleQty} pcs:{' '}
                  <strong>{formatRupiah(product.wholesalePrice)} / pcs</strong>
                </span>
              </div>
            )}
          </div>

          {/*
            PILIHAN MULTI-DIMENSI (Model x Ukuran x Warna).
            Satu baris per dimensi — bukan 168 tombol berisi nama gabungan.
            Nilai yang tidak tersedia (mis. warna yang tidak dibuat untuk model
            tertentu) dinonaktifkan, bukan disembunyikan, supaya pembeli tahu
            pilihannya memang tidak ada dan tidak mengira halaman bermasalah.
          */}
          {isMultiOption && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-extrabold text-navy-800">
                  {selection?.label || 'Pilih varian'}
                </span>
                {product.hasSizeChart && (
                  <button
                    type="button"
                    onClick={() => setShowSizeChartModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-forest-700 hover:text-forest-800 bg-forest-50 px-2.5 py-1 rounded-lg border border-forest-200"
                  >
                    <Ruler className="w-3.5 h-3.5" /> Panduan Size Chart
                  </button>
                )}
              </div>

              {optionGroups.map((group) => (
                <div key={group.id} className="space-y-1.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-500">
                      {group.name}
                    </span>
                    {group.required !== false && !options[group.id] && (
                      <span className="text-[10px] text-red-600 font-bold">wajib dipilih</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {group.values.map((value) => {
                      const active = options[group.id] === value.id;
                      const usable = isValueAvailable(product, group.id, value, options);
                      const isColor = group.display === 'swatch' && value.colorHex;

                      return (
                        <button
                          key={value.id}
                          type="button"
                          disabled={!usable}
                          title={usable ? value.label : `${value.label} — tidak tersedia`}
                          onClick={() =>
                            setOptions((prev) => ({ ...prev, [group.id]: value.id }))
                          }
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all inline-flex items-center gap-1.5 ${
                            !usable
                              ? 'bg-slate-50 border-slate-200 text-slate-300 line-through cursor-not-allowed'
                              : active
                                ? 'bg-forest-50 border-forest-600 text-forest-800 ring-1 ring-forest-600/30'
                                : 'bg-white border-slate-200 text-slate-700 hover:border-forest-400'
                          }`}
                        >
                          {isColor && (
                            <span
                              className="w-3 h-3 rounded-full border border-slate-300 shrink-0"
                              style={{ backgroundColor: value.colorHex }}
                            />
                          )}
                          {value.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {selection?.originalPrice && selection.originalPrice > selection.price && (
                <div className="text-[11px] text-slate-500">
                  Harga normal{' '}
                  <span className="line-through">{formatRupiah(selection.originalPrice)}</span> —
                  hemat {formatRupiah(selection.originalPrice - selection.price)}
                </div>
              )}
            </div>
          )}

          {/* Variant Selector + Size Chart Button */}
          {!isMultiOption && product.variants && product.variants.length > 0 && (
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
                  <Ruler className="w-4 h-4 text-forest-600" /> Panduan Ukuran Kaos
                </h4>
                <span className="text-[11px] text-slate-400">Toleransi jahit ±1 cm</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <th className="py-2 px-2.5 font-bold">Ukuran</th>
                      <th className="py-2 px-2.5 font-bold">Lebar</th>
                      <th className="py-2 px-2.5 font-bold">Panjang</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/*
            Video produk. Diletakkan tepat di atas tab — setelah pembeli melihat
            foto, sebelum membaca deskripsi. Komponen mengembalikan null bila
            produk tidak punya video, jadi tidak ada ruang kosong.
          */}
          {/*
            Hanya untuk produk dengan LEBIH DARI SATU video.
            Satu video sudah tampil di galeri (layar pertama) dengan autoplay
            senyap — menampilkannya lagi di sini hanya mendorong deskripsi
            produk ke bawah tanpa menambah informasi.
          */}
          {product.videos && product.videos.filter((v) => v && v.url).length > 1 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-3">
              <ProductVideoPlayer videos={product.videos} />
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
                  {/*
                   * `white-space: pre-line` menampilkan enter yang diketik admin
                   * di textarea sebagai baris baru. Tanpa ini, semua enter
                   * diruntuhkan menjadi satu paragraf menumpuk.
                   *
                   * `break-words` mencegah kata/URL panjang menembus kolom.
                   * Spasi berlebih dirapikan (baris kosong ganda jadi satu).
                   */}
                  <p className="whitespace-pre-line break-words">
                    {String(product.description || '')
                      .replace(/\r\n?/g, '\n')
                      .replace(/\n{3,}/g, '\n\n')
                      .trim()}
                  </p>
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
                <strong className="text-navy-800 break-words">
                  {selection?.label || selectedVariant?.label}
                </strong>
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
                Stok:{' '}
                <strong className="text-slate-800">
                  {selection?.stock ?? selectedVariant?.stock ?? product.stock}
                </strong>
              </span>
            </div>

            {/* Quick Wholesale Trigger — disembunyikan bila grosir tidak diaktifkan */}
            {Number(product.minWholesaleQty) > 0 && !isWholesaleActive ? (
              <button
                type="button"
                onClick={() => setQty(product.minWholesaleQty)}
                className="w-full text-left px-3 py-2 rounded-xl bg-amberbrand-50 hover:bg-amberbrand-100/80 border border-amberbrand-200 text-[11px] text-amberbrand-900 font-semibold transition-colors"
              >
                💡 Beli <strong>{product.minWholesaleQty} pcs</strong> otomatis dapat Harga Grosir{' '}
                <strong>{formatRupiah(product.wholesalePrice)}/pcs</strong> (Klik untuk set)
              </button>
            ) : isWholesaleActive ? (
              <div className="px-3 py-2 rounded-xl bg-forest-50 border border-forest-200 text-[11px] text-forest-800 font-bold">
                ✓ Harga Grosir Aktif! Anda hemat{' '}
                {formatRupiah((baseUnitPrice - effectiveUnitPrice) * qty)}
              </div>
            ) : null}

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
                onClick={() => submitToCart()}
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
              <ShareMenu
                url={shareUrl}
                title={product.name}
                productName={product.name}
                productId={product.id}
                onToast={pushToast}
                compact
                triggerClassName="py-1.5 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5"
              />
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

          {/* 2 kolom di HP agar tidak menjadi kartu raksasa satu per satu */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            {bundleSuggestions.slice(0, 2).map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-xl p-2.5 border border-slate-200/80 flex flex-col gap-2 justify-between"
              >
                <div className="min-w-0">
                  <img
                    src={b.image}
                    alt={b.shortName}
                    className="w-full h-24 rounded-lg object-cover border border-slate-100"
                  />
                  {/*
                    `min-w-0` WAJIB pada anak flex yang berisi teks panjang.
                    Tanpa ini, teks tidak mau menyusut dan mendorong kartu
                    melewati lebar layar (overflow 3px di layar 280px).
                  */}
                  <div className="min-w-0 mt-1.5">
                    <Link
                      to={`/produk/${b.slug}`}
                      className="text-[12px] leading-snug font-bold text-slate-700 line-clamp-2 hover:text-navy-800"
                    >
                      {b.name}
                    </Link>
                    <div className="mt-1 flex items-baseline gap-1 flex-wrap">
                      <span className="text-[13px] font-extrabold text-forest-700 whitespace-nowrap">
                        {formatRupiah(b.price)}
                      </span>
                      <span className="text-[10px] text-slate-400 line-through whitespace-nowrap">
                        {formatRupiah(b.originalPrice)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => addToCart(b, 1, b.variants?.[0])}
                  className="w-full px-2 py-1.5 rounded-lg bg-forest-600 active:bg-forest-700 text-white text-[11px] font-bold shrink-0"
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
        <h2 className="text-base sm:text-xl font-extrabold text-navy-800">
          Produk Lainnya
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
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
              Ukuran diukur dari pakaian yang dilipat rata, bukan lingkar badan.
            </p>
            <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[300px] text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
              <thead className="bg-navy-800 text-white">
                <tr>
                  <th className="py-2.5 px-3">Size</th>
                  <th className="py-2.5 px-3">Lebar</th>
                  <th className="py-2.5 px-3">Panjang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {KAOS_SIZE_CHART.map((s) => (
                  <tr key={s.size}>
                    <td className="py-2 px-3 font-extrabold text-navy-800">{s.size}</td>
                    <td className="py-2 px-3">{s.chest}</td>
                    <td className="py-2 px-3">{s.length}</td>
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
        /*
          Ditempel DI ATAS bilah navigasi bawah (bottom = 52px + safe-area),
          bukan menimpanya. Kalau keduanya di bottom-0, tombol "Beli
          Sekarang" akan menutupi tab navigasi dan tab tidak bisa ditekan.
        */
        style={{ bottom: 'calc(52px + env(safe-area-inset-bottom, 0px))' }}
        className={`lg:hidden fixed left-0 right-0 w-full max-w-full box-border z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] px-3 pt-2.5 pb-2.5 transition-transform duration-200 ${
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
            onClick={() => submitToCart()}
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

/**
 * Halaman detail produk.
 *
 * KENAPA ADA PEMBUNGKUS TERPISAH:
 * Dulu isi halaman memakai `products.find(...) || products[0]`. Saat katalog
 * dari API belum selesai dimuat (atau slug tidak dikenal), yang dirender
 * adalah PRODUK PERTAMA di katalog. Akibatnya, membuka halaman Kaos lalu
 * menekan refresh sempat menampilkan halaman Gantungan Kunci sebelum berganti
 * ke Kaos — kedipan yang membingungkan dan bisa membuat pembeli salah beli.
 *
 * Pembungkus ini memutuskan LEBIH DULU: katalog masih dimuat -> kerangka;
 * slug tidak dikenal -> "produk tidak ditemukan"; baru kalau produknya pasti
 * ada, isi halaman dirender. Dengan begitu tidak pernah ada produk yang salah
 * tampil, sekaligus urutan hook di ProductDetailView tetap utuh.
 */
export const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { products, storefrontLoading } = useStore();
  const product = products.find((p) => p.slug === slug);

  if (!product && storefrontLoading) {
    return (
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Memuat produk">
          <div className="h-3 w-40 bg-slate-200 rounded" />
          <div className="aspect-square sm:aspect-[4/3] w-full bg-slate-200 rounded-2xl" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-5 w-3/4 bg-slate-200 rounded" />
          <div className="h-8 w-40 bg-slate-200 rounded" />
          <div className="h-11 w-full bg-slate-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-lg font-extrabold text-navy-800 mb-2">Produk tidak ditemukan</h1>
        <p className="text-sm text-slate-600 mb-5">
          Produk yang Anda cari mungkin sudah tidak dijual atau tautannya berubah.
        </p>
        <Link
          to="/katalog"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-bold"
        >
          <ArrowLeft className="w-4 h-4" /> Lihat semua produk
        </Link>
      </div>
    );
  }

  return <ProductDetailView product={product} />;
};
