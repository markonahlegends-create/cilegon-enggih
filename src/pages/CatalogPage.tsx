import React, { useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  SlidersHorizontal,
  Search,
  RotateCcw,
  Heart,
  Sparkles,
  Check
} from 'lucide-react';
import {
  CategorySlug,
  formatRupiah
} from '../data/products';
import { ProductCard } from '../components/ProductCard';
import { useStore } from '../context/StoreContext';

type SortMode = 'terlaris' | 'termurah' | 'termahal' | 'rating';

export const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { wishlist, products, categories } = useStore();

  const activeCat = (searchParams.get('kategori') || 'semua') as CategorySlug;
  const queryParam = searchParams.get('q') || '';
  const wishlistOnly = searchParams.get('wishlist') === '1';

  const [sortBy, setSortBy] = useState<SortMode>('terlaris');
  const [priceRange, setPriceRange] = useState<'all' | 'under50' | '50to120' | 'above120'>('all');

  const setCategory = (slug: CategorySlug) => {
    const next = new URLSearchParams(searchParams);
    if (slug === 'semua') {
      next.delete('kategori');
    } else {
      next.set('kategori', slug);
    }
    next.delete('wishlist');
    setSearchParams(next);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (wishlistOnly && !wishlist.includes(p.id)) return false;
      if (activeCat !== 'semua' && p.categorySlug !== activeCat) return false;

      if (queryParam.trim()) {
        const q = queryParam.toLowerCase();
        const match =
          p.name.toLowerCase().includes(q) ||
          p.shortName.toLowerCase().includes(q) ||
          p.categoryLabel.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!match) return false;
      }

      if (priceRange === 'under50' && p.price > 50000) return false;
      if (priceRange === '50to120' && (p.price < 50000 || p.price > 120000)) return false;
      if (priceRange === 'above120' && p.price <= 120000) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'termurah') return a.price - b.price;
      if (sortBy === 'termahal') return b.price - a.price;
      if (sortBy === 'rating') return b.rating - a.rating;
      return b.soldCount - a.soldCount;
    });
  }, [activeCat, queryParam, wishlistOnly, wishlist, priceRange, sortBy, products]);

  const activeCategoryMeta =
    categories.find((c) => c.slug === activeCat) || categories[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Page Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-navy-800 via-navy-800 to-forest-700 text-white p-6 sm:p-8 mb-6 shadow-soft flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-amberbrand-300 uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            {wishlistOnly ? 'Koleksi Favorit Anda' : 'Katalog Resmi Cilegon Enggih'}
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold">
            {wishlistOnly
              ? `Wishlist Produk Tersimpan (${wishlist.length})`
              : activeCategoryMeta.label}
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 mt-1">
            {wishlistOnly
              ? 'Daftar produk yang Anda tandai untuk dibeli sekarang atau nanti.'
              : activeCategoryMeta.description}
          </p>
        </div>

        <Link
          to="/custom-korporat"
          className="px-4 py-2.5 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 text-xs sm:text-sm font-extrabold shrink-0 text-center"
        >
          Pesan Grosir / Custom Logo →
        </Link>
      </div>

      {/* Main Layout: Sidebar Filter + Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar Filter */}
        <aside className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-soft space-y-5 lg:sticky lg:top-32">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-navy-800">
                <SlidersHorizontal className="w-4 h-4 text-forest-600" />
                <span>Filter Katalog</span>
              </div>
              {(activeCat !== 'semua' || priceRange !== 'all' || queryParam || wishlistOnly) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchParams({});
                    setPriceRange('all');
                  }}
                  className="text-xs font-semibold text-forest-600 hover:underline inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
            </div>

            {/* Kategori */}
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Sub-Menu Kategori
              </h3>
              <div className="space-y-1">
                {categories.map((cat) => {
                  const selected = !wishlistOnly && activeCat === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => setCategory(cat.slug)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors ${
                        selected
                          ? 'bg-forest-50 text-forest-700 border border-forest-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{cat.label}</span>
                      {selected && <Check className="w-4 h-4 text-forest-600" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filter Anggaran / Harga */}
            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                Rentang Anggaran
              </h3>
              <div className="space-y-1.5 text-xs">
                {[
                  { id: 'all', label: 'Semua Harga' },
                  { id: 'under50', label: 'Ekonomis (≤ Rp 50.000)' },
                  { id: '50to120', label: 'Menengah (Rp 50rb – Rp 120rb)' },
                  { id: 'above120', label: 'Premium & Bundling (> Rp 120rb)' }
                ].map((pr) => (
                  <label
                    key={pr.id}
                    className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="price-filter"
                      checked={priceRange === pr.id}
                      onChange={() => setPriceRange(pr.id as any)}
                      className="accent-forest-600"
                    />
                    <span className="font-medium text-slate-700">{pr.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Wishlist Shortcut */}
            <div className="pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  if (wishlistOnly) {
                    setSearchParams({});
                  } else {
                    setSearchParams({ wishlist: '1' });
                  }
                }}
                className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-colors ${
                  wishlistOnly
                    ? 'bg-rose-50 text-rose-600 border-rose-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Heart className={`w-4 h-4 ${wishlistOnly ? 'fill-current' : ''}`} />
                <span>Tampilkan Wishlist ({wishlist.length})</span>
              </button>
            </div>
          </div>
        </aside>

        {/* Right Product Grid */}
        <div className="lg:col-span-9 space-y-5">
          {/* Top Sort Bar */}
          <div className="bg-white rounded-2xl border border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-soft">
            <div className="text-xs sm:text-sm text-slate-600">
              Menampilkan <strong className="text-navy-800">{filteredProducts.length}</strong> produk
              {queryParam && (
                <span>
                  {' '}
                  untuk pencarian <strong>“{queryParam}”</strong>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-500">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortMode)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 font-bold text-navy-800 outline-none focus:border-forest-600"
              >
                <option value="terlaris">Paling Laris</option>
                <option value="rating">Ulasan Tertinggi</option>
                <option value="termurah">Harga Terendah ({formatRupiah(8000)}+)</option>
                <option value="termahal">Harga Tertinggi</option>
              </select>
            </div>
          </div>

          {/* Results */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
              <Search className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-extrabold text-navy-800">
                Produk Tidak Ditemukan
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Coba ubah filter kategori atau rentang anggaran untuk melihat seluruh koleksi Cilegon Enggih.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchParams({});
                  setPriceRange('all');
                }}
                className="px-5 py-2.5 rounded-xl bg-forest-600 text-white text-xs font-bold"
              >
                Tampilkan Semua Produk
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
