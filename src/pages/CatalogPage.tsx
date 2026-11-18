import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  SlidersHorizontal,
  X,
  Check,
  RotateCcw,
  Heart,
  ChevronRight,
  Sparkles,
  ArrowUpDown
} from 'lucide-react';
import { ProductCard } from '../components/ProductCard';
import { useStore } from '../context/StoreContext';
import { useBackClose } from '../hooks/useBackClose';

type SortMode = 'terlaris' | 'rating' | 'termurah' | 'termahal';
type PriceRange = 'all' | 'under50' | '50to120' | 'above120';

const SORT_LABEL: Record<SortMode, string> = {
  terlaris: 'Paling Laris',
  rating: 'Ulasan Tertinggi',
  termurah: 'Harga Terendah',
  termahal: 'Harga Tertinggi'
};

const PRICE_LABEL: Record<PriceRange, string> = {
  all: 'Semua Harga',
  under50: '≤ Rp 50rb',
  '50to120': 'Rp 50rb – 120rb',
  above120: '> Rp 120rb'
};

export const CatalogPage: React.FC = () => {
  const { products, wishlist, categories } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sortBy, setSortBy] = useState<SortMode>('terlaris');
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [showFilters, setShowFilters] = useState(false);

  /*
   * Tombol kembali HP menutup panel filter, bukan meninggalkan halaman.
   * Konsisten dengan keranjang & checkout (lihat hooks/useBackClose).
   */
  useBackClose(showFilters, () => setShowFilters(false));

  const activeCat = searchParams.get('kategori') || 'semua';
  const queryParam = searchParams.get('q') || '';
  const wishlistOnly = searchParams.get('wishlist') === '1';

  const setCategory = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    if (slug === 'semua') next.delete('kategori');
    else next.set('kategori', slug);
    next.delete('wishlist');
    setSearchParams(next);
  };

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (wishlistOnly) {
      list = list.filter((p) => wishlist.includes(p.id));
    } else if (activeCat !== 'semua') {
      list = list.filter((p) => p.categorySlug === activeCat);
    }
    if (queryParam) {
      const q = queryParam.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.categoryLabel.toLowerCase().includes(q)
      );
    }
    if (priceRange === 'under50') list = list.filter((p) => p.price <= 50000);
    if (priceRange === '50to120') list = list.filter((p) => p.price > 50000 && p.price <= 120000);
    if (priceRange === 'above120') list = list.filter((p) => p.price > 120000);

    if (sortBy === 'terlaris') list.sort((a, b) => b.soldCount - a.soldCount);
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    if (sortBy === 'termurah') list.sort((a, b) => a.price - b.price);
    if (sortBy === 'termahal') list.sort((a, b) => b.price - a.price);
    return list;
  }, [activeCat, queryParam, wishlistOnly, wishlist, priceRange, sortBy, products]);

  const activeCategoryMeta = categories.find((c) => c.slug === activeCat) || categories[0];
  const hasActiveFilter = activeCat !== 'semua' || priceRange !== 'all' || !!queryParam || wishlistOnly;

  const resetAll = () => {
    setSearchParams({});
    setPriceRange('all');
  };

  return (
    /*
     * TATA LETAK RAMPING (gaya marketplace).
     * Sebelumnya halaman ini memakai banner gradien 210px + panel filter
     * penuh + dropdown, sehingga di layar 360px satu layar penuh habis
     * SEBELUM satu produk pun terlihat utuh. Sekarang:
     *   - tanpa banner; hanya baris judul ringkas
     *   - kategori jadi baris chip yang bisa digeser
     *   - filter & urutan pindah ke bottom sheet
     *   - grid produk 2 kolom langsung terlihat
     */
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 sm:py-8 pb-4">
      {/* Baris judul ringkas — menggantikan banner 210px */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <h1 className="text-base sm:text-2xl font-extrabold text-navy-800 leading-tight truncate">
            {wishlistOnly
              ? `Wishlist (${wishlist.length})`
              : activeCat === 'semua'
                ? 'Semua Koleksi'
                : activeCategoryMeta.label}
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            {filteredProducts.length} produk
            {queryParam && <> untuk “{queryParam}”</>}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={resetAll}
                className="ml-2 font-bold text-forest-600 underline"
              >
                Reset
              </button>
            )}
          </p>
        </div>

        <Link
          to="/custom-korporat"
          className="shrink-0 hidden sm:inline-flex px-3 py-1.5 rounded-lg bg-navy-800 text-white text-xs font-bold"
        >
          Grosir / Custom
        </Link>
      </div>

      {/* Baris chip kategori — bisa digeser ke samping, hemat tinggi */}
      <div className="-mx-3 px-3 flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5 mb-2">
        {categories.map((cat) => {
          const selected = !wishlistOnly && activeCat === cat.slug;
          return (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setCategory(cat.slug)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[11.5px] font-bold border transition-colors ${
                selected
                  ? 'bg-forest-600 text-white border-forest-600'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              {cat.slug === 'semua' ? 'Semua' : cat.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => (wishlistOnly ? setSearchParams({}) : setSearchParams({ wishlist: '1' }))}
          className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-bold border transition-colors ${
            wishlistOnly
              ? 'bg-rose-500 text-white border-rose-500'
              : 'bg-white text-slate-600 border-slate-200'
          }`}
        >
          <Heart className={`w-3 h-3 ${wishlistOnly ? 'fill-current' : ''}`} /> Wishlist
        </button>
      </div>

      {/*
        Filter rentang harga untuk DESKTOP.
        Saat panel filter dipindah ke bottom sheet (khusus HP), desktop
        sempat kehilangan filter harga sama sekali. Baris chip ini
        mengembalikannya tanpa memakan lebar seperti sidebar lama.
      */}
      <div className="hidden lg:flex items-center gap-1.5 mb-2.5">
        <span className="text-[11px] font-bold text-slate-500 shrink-0">Harga:</span>
        {(Object.keys(PRICE_LABEL) as PriceRange[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setPriceRange(id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              priceRange === id
                ? 'bg-forest-600 text-white border-forest-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-forest-300'
            }`}
          >
            {PRICE_LABEL[id]}
          </button>
        ))}
      </div>

      {/* Baris alat: filter + urutan cepat */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11.5px] font-bold text-navy-800"
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-forest-600" /> Filter
          {priceRange !== 'all' && (
            <span className="w-1.5 h-1.5 rounded-full bg-forest-600" aria-hidden />
          )}
        </button>

        <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 min-w-0 flex-1">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="sr-only">Urutkan produk</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMode)}
            className="flex-1 min-w-0 bg-transparent text-[11.5px] font-bold text-navy-800 outline-none truncate"
          >
            {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => (
              <option key={k} value={k}>
                {SORT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Grid produk — 2 kolom di HP (sebelumnya 1 kolom) */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
          <Search className="w-9 h-9 text-slate-300 mx-auto" />
          <h3 className="text-sm font-extrabold text-navy-800">Produk Tidak Ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-xs mx-auto">
            Coba ubah kategori atau rentang anggaran untuk melihat koleksi lainnya.
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="px-4 py-2 rounded-lg bg-forest-600 text-white text-xs font-bold"
          >
            Tampilkan Semua
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <p className="text-center text-[11px] text-slate-400 pt-4">
            Semua {filteredProducts.length} produk sudah ditampilkan
          </p>
        </>
      )}

      {/*
        Panel filter: di HP muncul sebagai bottom sheet (naik dari bawah),
        di desktop tetap sebagai panel samping yang menempel.
        Bottom sheet dipilih karena tidak mendorong konten produk dan
        mudah dijangkau ibu jari.
      */}
      {showFilters && (
        <div className="lg:hidden fixed inset-0 z-[60] flex items-end">
          <button
            type="button"
            aria-label="Tutup filter"
            onClick={() => setShowFilters(false)}
            className="fixed inset-0 bg-navy-950/50 backdrop-blur-xs"
          />
          <div
            className="relative w-full bg-white rounded-t-2xl max-h-[85dvh] overflow-y-auto overscroll-contain"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-extrabold text-navy-800">Filter & Urutan</span>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Tutup"
                className="p-1.5 rounded-lg text-slate-500 active:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 py-3 space-y-4">
              <div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Kategori
                </h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {categories.map((cat) => {
                    const selected = !wishlistOnly && activeCat === cat.slug;
                    return (
                      <button
                        key={cat.slug}
                        type="button"
                        onClick={() => setCategory(cat.slug)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-[11.5px] font-bold border ${
                          selected
                            ? 'bg-forest-50 text-forest-700 border-forest-300'
                            : 'bg-white text-slate-600 border-slate-200'
                        }`}
                      >
                        <span>{cat.label}</span>
                        {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Rentang Anggaran
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(PRICE_LABEL) as PriceRange[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPriceRange(id)}
                      className={`px-2.5 py-2 rounded-lg text-[11.5px] font-bold border ${
                        priceRange === id
                          ? 'bg-forest-50 text-forest-700 border-forest-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {PRICE_LABEL[id]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5">
                  Urutkan
                </h3>
                <div className="grid grid-cols-2 gap-1.5">
                  {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSortBy(k)}
                      className={`px-2.5 py-2 rounded-lg text-[11.5px] font-bold border ${
                        sortBy === k
                          ? 'bg-forest-50 text-forest-700 border-forest-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {SORT_LABEL[k]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-100 px-4 py-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPriceRange('all');
                  setSearchParams({});
                }}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 inline-flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="flex-[2] py-2.5 rounded-lg bg-forest-600 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5"
              >
                Lihat {filteredProducts.length} Produk
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
