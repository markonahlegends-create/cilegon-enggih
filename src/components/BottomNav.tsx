import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, PackageSearch, ShoppingBag, Store, type LucideIcon } from 'lucide-react';
import { useStore } from '../context/StoreContext';

/**
 * Bilah navigasi bawah (bottom navigation) — HANYA tampil di HP.
 *
 * MENGAPA ADA
 * ------------------------------------------------------------------
 * Aplikasi ini dipasang sebagai PWA (`display: standalone`), sehingga
 * TIDAK ADA address bar, tombol kembali browser, maupun cara mengetik
 * URL. Tanpa navigasi tetap di bawah layar, pengguna yang sudah masuk
 * ke satu halaman produk kesulitan kembali ke beranda — dan pemilik
 * toko tidak punya jalan masuk ke /admin sama sekali.
 *
 * Pola ini meniru aplikasi marketplace (Tokopedia): 4–5 tab tetap di
 * bawah layar, selalu terlihat apa pun posisi gulir.
 *
 * MENGAPA 5 TAB
 * ------------------------------------------------------------------
 * Beranda · Katalog · Lacak · Keranjang · Toko
 * - "Lacak" adalah pertanyaan pelanggan paling sering setelah bayar.
 * - "Keranjang" memakai tombol yang membuka drawer, bukan pindah
 *   halaman, supaya pembeli tidak kehilangan posisi belanja.
 * - "Toko" menjadi pintu masuk ke halaman lain (B2B, FAQ, Tentang,
 *   dan Admin) tanpa memenuhi layar dengan belasan ikon.
 */

interface NavItem {
  key: string;
  label: string;
  to: string;
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { key: 'beranda', label: 'Beranda', to: '/', icon: Home },
  { key: 'katalog', label: 'Katalog', to: '/katalog', icon: LayoutGrid },
  { key: 'lacak', label: 'Lacak', to: '/lacak-pesanan', icon: PackageSearch },
  { key: 'keranjang', label: 'Keranjang', to: '#keranjang', icon: ShoppingBag },
  { key: 'toko', label: 'Toko', to: '/tentang-kami', icon: Store }
];

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { setIsCartOpen, setIsCheckoutOpen, isCheckoutOpen, cartCount } = useStore();

  /**
   * Menentukan tab yang sedang aktif.
   * `#keranjang` tidak pernah "aktif" karena hanya membuka drawer.
   */
  const isActive = (item: NavItem): boolean => {
    if (item.to === '#keranjang') return false;
    if (item.to === '/') return location.pathname === '/';
    if (item.to === '/tentang-kami') {
      // Tab "Toko" mewakili semua halaman informasi, bukan hanya Tentang Kami.
      return ['/tentang-kami', '/custom-korporat', '/cara-order-faq', '/legalitas'].some(
        (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
      );
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
  };

  const handleCart = () => {
    // Jangan timpa checkout yang sedang berjalan.
    if (isCheckoutOpen) return;
    setIsCartOpen(true);
  };

  return (
    <nav
      aria-label="Navigasi utama"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/80 shadow-[0_-2px_12px_rgba(15,23,42,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          const inner = (
            <>
              <span className="relative inline-flex">
                <Icon
                  className={`w-[22px] h-[22px] ${
                    active ? 'text-forest-600' : 'text-slate-500'
                  }`}
                  strokeWidth={active ? 2.4 : 1.9}
                />
                {item.key === 'keranjang' && cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amberbrand-400 text-navy-950 text-[10px] font-extrabold leading-4 text-center">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </span>
              <span
                className={`text-[10px] leading-none font-semibold ${
                  active ? 'text-forest-700' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </>
          );

          // Area sentuh minimal 48px tinggi — di bawah itu jari sering salah tekan.
          const baseClass =
            'flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 min-h-[52px] w-full transition-colors active:bg-slate-100';

          return (
            <li key={item.key} className="relative">
              {/* Penanda tab aktif: garis tipis di atas ikon */}
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-forest-600" />
              )}
              {item.to === '#keranjang' ? (
                <button
                  type="button"
                  onClick={handleCart}
                  aria-label={`Buka keranjang${cartCount > 0 ? `, ${cartCount} barang` : ''}`}
                  className={baseClass}
                >
                  {inner}
                </button>
              ) : (
                <Link
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={baseClass}
                >
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
