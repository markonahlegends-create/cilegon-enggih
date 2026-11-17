import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Home, MessageCircle, PackageSearch } from 'lucide-react';
import { buildWhatsAppUrl } from '../data/products';

/**
 * Halaman 404. Sebelumnya semua URL tak dikenal diarahkan ke HomePage, sehingga
 * salah ketik tampak "berhasil" dan Google mengindeks halaman duplikat.
 */
export const NotFoundPage: React.FC = () => {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center space-y-5">
      <div className="w-16 h-16 rounded-2xl bg-forest-50 text-forest-600 flex items-center justify-center mx-auto">
        <Compass className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <p className="text-xs font-extrabold uppercase tracking-wider text-forest-600">
          Halaman tidak ditemukan
        </p>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-800">
          Sepertinya tautan ini sudah tidak ada
        </h1>
        <p className="text-sm text-slate-500 leading-relaxed">
          Mungkin alamatnya salah ketik, atau produk yang Anda cari sudah tidak dijual lagi.
          Silakan kembali ke beranda atau cari produk lewat katalog.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
        <Link
          to="/"
          className="px-4 py-2.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-extrabold inline-flex items-center justify-center gap-2"
        >
          <Home className="w-4 h-4" /> Ke Beranda
        </Link>
        <Link
          to="/katalog"
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-forest-400 hover:text-forest-700 text-navy-800 text-sm font-extrabold inline-flex items-center justify-center gap-2"
        >
          <PackageSearch className="w-4 h-4" /> Lihat Katalog
        </Link>
        <a
          href={buildWhatsAppUrl('Halo, saya tidak menemukan halaman yang saya cari di website.')}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:border-forest-400 hover:text-forest-700 text-navy-800 text-sm font-extrabold inline-flex items-center justify-center gap-2"
        >
          <MessageCircle className="w-4 h-4" /> Tanya via WhatsApp
        </a>
      </div>
    </div>
  );
};

export default NotFoundPage;
