import React from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle2, Info, AlertCircle, X, MessageCircle } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { buildWhatsAppUrl } from '../data/products';

export const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useStore();

  return (
    /*
      Di HP notifikasi diletakkan di ATAS, bukan bawah.
      Sebelumnya di bawah dan menutupi tombol "Checkout" pada keranjang serta
      kolom isian pada form checkout — pembeli bisa salah tekan atau tidak
      melihat field yang sedang diisi.
    */
    <div className="fixed top-16 sm:top-auto sm:bottom-6 left-3 right-3 sm:right-auto sm:left-6 z-[60] flex flex-col gap-2 max-w-sm sm:w-[calc(100vw-3rem)] pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white rounded-2xl shadow-card-hover border border-slate-200 p-3.5 flex items-start gap-3 animate-fade-in"
        >
          {toast.type === 'success' && (
            <CheckCircle2 className="w-5 h-5 text-forest-600 shrink-0 mt-0.5" />
          )}
          {toast.type === 'info' && (
            <Info className="w-5 h-5 text-navy-700 shrink-0 mt-0.5" />
          )}
          {toast.type === 'warning' && (
            <AlertCircle className="w-5 h-5 text-amberbrand-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs sm:text-sm font-bold text-slate-800">
              {toast.title}
            </div>
            {toast.subtitle && (
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {toast.subtitle}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const FloatingWhatsApp: React.FC = () => {
  const location = useLocation();

  /*
   * Di halaman produk pada HP, bilah beli melayang SUDAH memenuhi bagian
   * bawah layar. Tombol WA hijau yang juga melayang akan menutupi tombol
   * "Beli Sekarang" — terlihat jelas pada pengujian 360px. Karena itu
   * tombol WA disembunyikan khusus di halaman produk pada layar kecil;
   * dari desktop ia tetap tampil, dan di HP pembeli tetap bisa menghubungi
   * admin lewat menu (Chat Admin) atau tombol WhatsApp di dalam keranjang.
   */
  const isProductPage = location.pathname.startsWith('/produk/');

  /*
   * Tombol WA melayang juga disembunyikan saat menu HP terbuka.
   * Tanpa ini tombol hijau menembus panel menu dan menutupi tombol
   * "Lacak Pesanan" di dalamnya (terlihat pada pengujian 360px).
   */
  const [menuOpen, setMenuOpen] = React.useState(false);
  React.useEffect(() => {
    const read = () => setMenuOpen(document.body.dataset.mobileMenuOpen === '1');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-mobile-menu-open'] });
    return () => obs.disconnect();
  }, []);

  return (
    <a
      href={buildWhatsAppUrl(
        'Halo Admin Cilegon Enggih! Saya butuh BANTUAN (bukan pemesanan): '
      )}
      target="_blank"
      rel="noreferrer"
      aria-label="Hubungi Admin via WhatsApp"
      /*
        Di HP tombol ini lebih kecil dan menempel ke tepi kanan bawah.
        Sebelumnya 56px + jarak 20px sehingga menutupi tombol "Klaim" pada
        kartu voucher dan tombol "+ Keranjang" pada kartu produk saat
        halaman digulir. Sekarang ikut safe-area agar tidak tertutup
        gesture bar.
      */
      /*
        Jarak bawah = tinggi bilah navigasi (52px) + safe-area + 12px.
        Sebelumnya menempel di bottom-4 sehingga menutupi tab "Toko"
        begitu bilah navigasi bawah dipasang.
      */
      className={`fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] right-4 sm:bottom-5 sm:right-5 z-40 items-center gap-2 p-3 sm:px-4 sm:py-3 rounded-full bg-forest-600 hover:bg-forest-700 text-white shadow-card-hover transition-transform hover:scale-105 ${
        isProductPage || menuOpen ? 'hidden lg:inline-flex' : 'inline-flex'
      }`}
      style={{ marginBottom: '0px' }}
    >
      <MessageCircle className="w-5 h-5 shrink-0" />
      <span className="text-xs font-extrabold hidden sm:inline">
        Tanya / Pesan WA
      </span>
    </a>
  );
};
