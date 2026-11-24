import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  Truck,
  CreditCard,
  Clock
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { STORE_DOMAIN, buildWhatsAppUrl } from '../data/products';
import { useStore } from '../context/StoreContext';

export const Footer: React.FC = () => {
  const { settings } = useStore();
  return (
    <footer className="bg-navy-900 text-slate-300 border-t border-navy-800 mt-16">
      {/* Top Trust Strip */}
      <div className="border-b border-white/10 bg-navy-800/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-600/20 border border-forest-500/30 text-forest-300 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">100% Produk Original</div>
              <div className="text-slate-400">Desain Eksklusif Landmark Cilegon</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amberbrand-400/15 border border-amberbrand-400/30 text-amberbrand-300 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">Kirim Seluruh Indonesia</div>
              <div className="text-slate-400">JNE, J&amp;T, SiCepat</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-forest-600/20 border border-forest-500/30 text-forest-300 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">Pembayaran Fleksibel</div>
              <div className="text-slate-400">Transfer Bank, QRIS Toko & WhatsApp</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amberbrand-400/15 border border-amberbrand-400/30 text-amberbrand-300 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-white">Layanan B2B & Grosir</div>
              <div className="text-slate-400">Custom Logo Instansi & Industri</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Columns */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
        {/* Col 1: Brand Bio (Requirement Section 2) */}
        <div className="lg:col-span-4 space-y-4">
          <BrandLogo variant="light" size="lg" />
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            <strong className="text-white">Cilegon Enggih</strong> adalah brand
            merchandise dan oleh-oleh kreatif khas Kota Cilegon. Menghadirkan produk
            fungsional berkualitas tinggi—mulai dari apparel, tumbler, hingga
            dekorasi 3D—dengan sentuhan ilustrasi ikonik Landmark Cilegon.
          </p>
          <div className="inline-block px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs italic text-amberbrand-300">
            “Khas Kota Baja, Bangga Membawanya.”
          </div>
        </div>

        {/* Col 2: Kategori Produk */}
        <div className="lg:col-span-3 space-y-3">
          <h4 className="text-sm font-extrabold text-white tracking-wide uppercase">
            Katalog Merchandise
          </h4>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li>
              <Link to="/katalog?kategori=apparel-tas" className="hover:text-amberbrand-300 transition-colors">
                Apparel & Tas (Kaos, Tote Bag)
              </Link>
            </li>
            <li>
              <Link to="/katalog?kategori=drinkware" className="hover:text-amberbrand-300 transition-colors">
                Drinkware (Tumbler 304, Mug SNI)
              </Link>
            </li>
            <li>
              <Link to="/katalog?kategori=aksesoris-dekorasi" className="hover:text-amberbrand-300 transition-colors">
                Aksesoris & 3D (Ganci, Stiker, Lampu 3D)
              </Link>
            </li>
            <li>
              <Link to="/katalog?kategori=perlengkapan-cetak" className="hover:text-amberbrand-300 transition-colors">
                Perlengkapan & Cetak (Payung, Kalender A3)
              </Link>
            </li>
            <li>
              <Link to="/katalog?kategori=paket-bundling" className="hover:text-amberbrand-300 transition-colors font-semibold text-forest-300">
                Paket Bundling / Hampers Oleh-Oleh
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 3: Navigasi & Legalitas Standar */}
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-sm font-extrabold text-white tracking-wide uppercase">
            Informasi & Legal
          </h4>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li>
              <Link to="/custom-korporat" className="hover:text-amberbrand-300 transition-colors">
                Custom & Korporat (B2B)
              </Link>
            </li>
            <li>
              <Link to="/tentang-kami" className="hover:text-amberbrand-300 transition-colors">
                Tentang Kami
              </Link>
            </li>
            <li>
              <Link to="/cara-order-faq" className="hover:text-amberbrand-300 transition-colors">
                Cara Order & FAQ
              </Link>
            </li>
            <li>
              <Link to="/lacak-pesanan" className="hover:text-amberbrand-300 transition-colors">
                Lacak Pesanan / Resi
              </Link>
            </li>
            <li>
              <Link to="/pesanan-saya" className="hover:text-amberbrand-300 transition-colors">
                Pesanan Saya (riwayat)
              </Link>
            </li>
            <li>
              <Link to="/legalitas?tab=privasi" className="hover:text-amberbrand-300 transition-colors">
                Kebijakan Privasi
              </Link>
            </li>
            <li>
              <Link to="/legalitas?tab=syarat" className="hover:text-amberbrand-300 transition-colors">
                Syarat & Ketentuan
              </Link>
            </li>
            <li>
              <Link to="/legalitas?tab=pengembalian" className="hover:text-amberbrand-300 transition-colors">
                Kebijakan Pengembalian
              </Link>
            </li>
          </ul>
        </div>

        {/* Col 4: Kontak & Lokasi Workshop */}
        <div className="lg:col-span-3 space-y-3">
          <h4 className="text-sm font-extrabold text-white tracking-wide uppercase">
            Workshop & Store Resmi
          </h4>
          <ul className="space-y-2.5 text-xs sm:text-sm">
            <li className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-amberbrand-400 shrink-0 mt-0.5" />
              <a
                href={settings.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white leading-relaxed"
              >
                {settings.address}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-amberbrand-400 shrink-0" />
              <a href={`mailto:${settings.email}`} className="hover:text-white break-all">
                {settings.email}
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-amberbrand-400 shrink-0" />
              <span>www.{STORE_DOMAIN}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="w-4 h-4 text-amberbrand-400 shrink-0" />
              <a
                href={buildWhatsAppUrl('Halo Admin Cilegon Enggih! Saya butuh BANTUAN (bukan pemesanan). Pesanan saya: ')}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white font-semibold text-forest-300"
              >
                {settings.whatsappDisplay} (WhatsApp Resmi)
              </a>
            </li>
            <li className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amberbrand-400 shrink-0" />
              <span>{settings.openHours}</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom Copyright */}
      <div className="border-t border-white/10 py-5 text-center text-xs text-slate-400 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>
            © {new Date().getFullYear()} <strong className="text-slate-200">Cilegon Enggih</strong> ({STORE_DOMAIN}). Oleh-Oleh Modern Kebanggaan Cilegon.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <a
              href={settings.developerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-amberbrand-300 hover:border-amberbrand-400/40 transition-colors font-semibold"
              title="Lihat portofolio developer"
            >
              <Globe className="w-3.5 h-3.5" />
              {settings.developerTitle}
            </a>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-slate-500">Open-Source Stack • QRIS & Transfer Bank Resmi</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
