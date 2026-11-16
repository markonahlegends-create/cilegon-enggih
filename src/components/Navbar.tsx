import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Search,
  ShoppingCart,
  MapPin,
  ChevronDown,
  Truck,
  Building2,
  HelpCircle,
  Info,
  Sparkles,
  Menu,
  X,
  CheckCircle2,
  Heart,
  Grid,
  PackageSearch,
  Lock,
  PhoneCall
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { formatRupiah, buildWhatsAppUrl } from '../data/products';
import { useStore } from '../context/StoreContext';

const QUICK_ZONES = [
  { id: 'cilegon-pusat', label: 'Kota Cilegon (Instan 1-2 Jam)' },
  { id: 'cilegon-industri', label: 'Ciwandan / Merak / Anyer' },
  { id: 'serang', label: 'Kota Serang & Sekitarnya' },
  { id: 'tangerang', label: 'Tangerang Raya' },
  { id: 'jakarta', label: 'DKI Jakarta' },
  { id: 'bandung-jabar', label: 'Bandung & Jawa Barat' }
];

export const Navbar: React.FC = () => {
  const {
    cartCount,
    wishlist,
    setIsCartOpen,
    selectedZoneId,
    setSelectedZoneId,
    pushToast,
    products,
    categories,
    settings,
    vouchers
  } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showZoneMenu, setShowZoneMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setShowCategoryMenu(false);
    setShowSuggestions(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSuggestions = searchQuery.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.categoryLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5)
    : products.slice(0, 4);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQuery.trim()) {
      navigate(`/katalog?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/katalog');
    }
  };

  const currentZone =
    QUICK_ZONES.find((z) => z.id === selectedZoneId) || QUICK_ZONES[0];

  const isActivePath = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      {settings.announcement && (
        <div className="bg-forest-600 text-white text-[11px]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-center gap-1.5 text-center">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-amberbrand-300" />
            <span>{settings.announcement}</span>
          </div>
        </div>
      )}
      {/* Top Utility Bar (Tokopedia-inspired Official Store Ribbon) */}
      <div className="bg-navy-800 text-slate-100 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 font-medium text-amberbrand-300">
              <Sparkles className="w-3.5 h-3.5" />
              {vouchers[0] ? (
                <>
                  Promo Kode: <strong className="text-white">{vouchers[0].code}</strong> (
                  {vouchers[0].title})
                </>
              ) : (
                <>Merchandise Resmi Cilegon Enggih</>
              )}
            </span>
            <span className="hidden md:inline text-white/30">|</span>
            <span className="hidden md:inline-flex items-center gap-1 text-slate-200">
              <Truck className="w-3.5 h-3.5 text-forest-300" />
              GoSend / GrabExpress Instan Area Kota Cilegon
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-5 whitespace-nowrap">
            <Link
              to="/tentang-kami"
              className="hover:text-amberbrand-300 transition-colors flex items-center gap-1"
            >
              <Info className="w-3.5 h-3.5" /> Tentang Cilegon Enggih
            </Link>
            <Link
              to="/custom-korporat"
              className="hover:text-amberbrand-300 transition-colors flex items-center gap-1"
            >
              <Building2 className="w-3.5 h-3.5" /> Pesanan Grosir / B2B
            </Link>
            <Link
              to="/cara-order-faq"
              className="hover:text-amberbrand-300 transition-colors flex items-center gap-1"
            >
              <HelpCircle className="w-3.5 h-3.5" /> Cara Order & FAQ
            </Link>
            <Link
              to="/lacak-pesanan"
              className="hover:text-amberbrand-300 transition-colors flex items-center gap-1 font-medium text-amberbrand-200"
            >
              <PackageSearch className="w-3.5 h-3.5" /> Lacak Pesanan
            </Link>
            <Link
              to="/admin"
              className="hover:text-amberbrand-300 transition-colors flex items-center gap-1 text-slate-300/80"
              title="Dashboard Super Admin (khusus pemilik toko)"
            >
              <Lock className="w-3.5 h-3.5" /> Admin
            </Link>
          </div>
        </div>
      </div>

      {/* Main Tokopedia-style Search & Action Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-3 lg:gap-6">
          {/* Logo */}
          <Link to="/" className="shrink-0">
            <BrandLogo variant="dark" size="md" />
          </Link>

          {/* Category Dropdown Trigger (Desktop) */}
          <div className="relative hidden lg:block">
            <button
              type="button"
              onClick={() => setShowCategoryMenu((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                showCategoryMenu
                  ? 'bg-forest-50 text-forest-700'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-forest-600'
              }`}
            >
              <Grid className="w-4 h-4 text-forest-600" />
              Kategori
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  showCategoryMenu ? 'rotate-180' : ''
                }`}
              />
            </button>

            {showCategoryMenu && (
              <div
                onMouseLeave={() => setShowCategoryMenu(false)}
                className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-card-hover border border-slate-100 p-3 z-50"
              >
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1.5">
                  Kategori Merchandise Resmi
                </div>
                <div className="space-y-1">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      to={
                        cat.slug === 'semua'
                          ? '/katalog'
                          : `/katalog?kategori=${cat.slug}`
                      }
                      className="flex flex-col px-3 py-2 rounded-xl hover:bg-forest-50/80 transition-colors group"
                    >
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-forest-700">
                        {cat.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {cat.itemsSummary}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Search Bar with Live Autocomplete */}
          <div ref={searchRef} className="flex-1 max-w-2xl relative">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(true);
                }}
                placeholder="Cari di Cilegon Enggih (mis. Kaos Distro, Lampu 3D, Tumbler, Paket Hampers)..."
                className="w-full pl-10 pr-24 py-2.5 text-sm bg-slate-50/90 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-forest-600 focus:ring-2 focus:ring-forest-600/15 outline-none transition-all text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-16 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                  aria-label="Hapus pencarian"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3.5 py-1.5 rounded-lg bg-forest-600 hover:bg-forest-700 text-white text-xs font-semibold transition-colors"
              >
                Cari
              </button>
            </form>

            {/* Instant Search Dropdown */}
            {showSuggestions && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-card-hover border border-slate-100 overflow-hidden z-50">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">
                    {searchQuery.trim()
                      ? `Hasil Pencarian "${searchQuery}"`
                      : 'Pencarian Populer di Cilegon Enggih'}
                  </span>
                  <Link
                    to="/katalog"
                    onClick={() => setShowSuggestions(false)}
                    className="text-xs font-semibold text-forest-600 hover:underline"
                  >
                    Lihat Semua Katalog →
                  </Link>
                </div>

                {filteredSuggestions.length === 0 ? (
                  <div className="p-5 text-center text-sm text-slate-500">
                    Produk belum ditemukan. Coba kata kunci <strong>Kaos</strong>,{' '}
                    <strong>Tumbler</strong>, atau <strong>Gantungan Kunci</strong>.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredSuggestions.map((item) => (
                      <Link
                        key={item.id}
                        to={`/produk/${item.slug}`}
                        onClick={() => setShowSuggestions(false)}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-forest-50/50 transition-colors"
                      >
                        <img
                          src={item.image}
                          alt={item.shortName}
                          className="w-11 h-11 rounded-lg object-cover border border-slate-100 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-slate-800 truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>{item.categoryLabel}</span>
                            <span>•</span>
                            <span className="text-forest-700 font-bold">
                              {formatRupiah(item.price)}
                            </span>
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amberbrand-50 text-amberbrand-700 border border-amberbrand-200">
                          ★ {item.rating.toFixed(1)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Actions: Wishlist, Cart, WhatsApp Quick Chat, Mobile Menu */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Link
              to="/katalog?wishlist=1"
              title="Produk Favorit / Wishlist"
              className="relative p-2.5 rounded-xl text-slate-600 hover:text-forest-700 hover:bg-slate-100 transition-colors hidden sm:inline-flex"
            >
              <Heart className="w-5 h-5" />
              {wishlist.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center">
                  {wishlist.length}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label="Buka Keranjang Belanja"
              className="relative inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-forest-50 hover:bg-forest-100 text-forest-700 border border-forest-200/80 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden xl:inline text-sm font-semibold">
                Keranjang
              </span>
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-forest-600 text-white text-xs font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </button>

            <a
              href={buildWhatsAppUrl(
                'Halo Admin Cilegon Enggih! Saya ingin bertanya mengenai produk merchandise resmi Landmark Cilegon.'
              )}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 text-xs sm:text-sm font-bold shadow-sm transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Chat Admin</span>
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100"
              aria-label="Menu Navigasi"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Sub-navigation bar + Tokopedia-style "Dikirim ke" Destination Bar */}
        <div className="hidden lg:flex items-center justify-between pt-2.5 mt-2.5 border-t border-slate-100 text-xs">
          <nav className="flex items-center gap-1">
            {[
              { to: '/', label: 'Beranda' },
              { to: '/katalog', label: 'Katalog Produk' },
              { to: '/katalog?kategori=paket-bundling', label: 'Paket Bundling & Hampers' },
              { to: '/custom-korporat', label: 'Custom & Korporat (B2B)' },
              { to: '/tentang-kami', label: 'Tentang Kami' },
              { to: '/cara-order-faq', label: 'Cara Order & FAQ' },
              { to: '/lacak-pesanan', label: 'Lacak Pesanan' }
            ].map((item) => {
              const active =
                item.to.includes('?')
                  ? location.pathname + location.search === item.to
                  : isActivePath(item.to) && !location.search.includes('paket-bundling');
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    active
                      ? 'bg-navy-800 text-white'
                      : 'text-slate-600 hover:text-navy-800 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Dikirim ke widget */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowZoneMenu((v) => !v)}
              className="inline-flex items-center gap-1.5 text-slate-600 hover:text-forest-700 px-2.5 py-1 rounded-lg hover:bg-forest-50 transition-colors"
            >
              <MapPin className="w-3.5 h-3.5 text-forest-600" />
              <span>Dikirim ke</span>
              <strong className="text-slate-800">{currentZone.label}</strong>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showZoneMenu && (
              <div
                onMouseLeave={() => setShowZoneMenu(false)}
                className="absolute right-0 mt-1.5 w-72 bg-white rounded-2xl shadow-card-hover border border-slate-100 p-2.5 z-50"
              >
                <div className="text-[11px] font-bold text-slate-400 uppercase px-2.5 py-1">
                  Pilih Lokasi Tujuan Estimasi Ongkir
                </div>
                {QUICK_ZONES.map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => {
                      setSelectedZoneId(z.id);
                      setShowZoneMenu(false);
                      pushToast('Lokasi Pengiriman Diperbarui', z.label, 'info');
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs flex items-center justify-between ${
                      selectedZoneId === z.id
                        ? 'bg-forest-50 text-forest-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{z.label}</span>
                    {selectedZoneId === z.id && (
                      <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-slate-200 px-4 py-4 space-y-3 shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: '/', label: 'Beranda' },
              { to: '/katalog', label: 'Katalog Produk' },
              { to: '/katalog?kategori=paket-bundling', label: 'Paket Bundling' },
              { to: '/custom-korporat', label: 'Custom & B2B' },
              { to: '/tentang-kami', label: 'Tentang Kami' },
              { to: '/cara-order-faq', label: 'Cara Order & FAQ' },
              { to: '/lacak-pesanan', label: 'Lacak Pesanan' },
              { to: '/katalog?wishlist=1', label: `Wishlist (${wishlist.length})` }
            ].map((nav) => (
              <Link
                key={nav.to}
                to={nav.to}
                className="px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-forest-50 text-slate-800 hover:text-forest-700 text-xs font-semibold border border-slate-200/60"
              >
                {nav.label}
              </Link>
            ))}
          </div>
          <a
            href={buildWhatsAppUrl(
              'Halo Admin Cilegon Enggih! Saya ingin konsultasi pemesanan merchandise.'
            )}
            target="_blank"
            rel="noreferrer"
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amberbrand-400 text-navy-950 font-bold text-sm"
          >
            <PhoneCall className="w-4 h-4" />
            Pesan / Tanya via WhatsApp
          </a>
        </div>
      )}
    </header>
  );
};
