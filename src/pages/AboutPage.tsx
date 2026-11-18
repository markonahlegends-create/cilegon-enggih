import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  HeartHandshake,
  Compass,
  Award,
  Clock,
  Mail,
  Phone,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { STORE_DOMAIN, STORE_INFO, buildWhatsAppUrl } from '../data/products';
import { useStore } from '../context/StoreContext';

export const AboutPage: React.FC = () => {
  const { settings } = useStore();
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 pb-4 sm:py-8 space-y-4 sm:space-y-12">
      {/* Hero Banner */}
      <div className="rounded-3xl bg-gradient-to-br from-navy-900 via-navy-800 to-forest-700 text-white p-6 sm:p-12 shadow-card-hover grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/15 text-amberbrand-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> Cerita & Filosofi Merek
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold leading-tight">
            Cilegon Enggih: Oleh-Oleh Modern Kebanggaan Kota Baja
          </h1>
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
            Memadukan ketangguhan karakter industri baja Kota Cilegon dengan
            keramahan budaya lokal Banten dalam wujud merchandise fungsional
            berstandar tinggi.
          </p>
          <div className="flex flex-wrap gap-2 pt-1 text-xs font-bold">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-amberbrand-200">
              “Khas Kota Baja, Bangga Membawanya.”
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-forest-200">
              “Cilegon dalam Setiap Karya.”
            </span>
          </div>
        </div>

        <div className="lg:col-span-5 grid grid-cols-2 gap-3">
          <img
            src="/products/lampu-tidur-3d.png"
            alt="Lampu 3D Landmark Cilegon"
            className="rounded-2xl object-cover aspect-[4/5] border-2 border-white/20 shadow-lg"
          />
          <img
            src="/products/tote-bag-kanvas.png"
            alt="Tote Bag Cilegon Enggih"
            className="rounded-2xl object-cover aspect-[4/5] border-2 border-white/20 shadow-lg mt-6"
          />
        </div>
      </div>

      {/* Main Story Section (Exact Brand Copywriting Requirement Section 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-soft space-y-5">
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-800">
            Lahir dari Kecintaan terhadap Tanah Kelahiran
          </h2>
          <div className="space-y-4 text-sm sm:text-base text-slate-700 leading-relaxed">
            <p>
              Lahir dari kecintaan terhadap tanah kelahiran,{' '}
              <strong className="text-navy-800">Cilegon Enggih</strong> hadir untuk
              menjawab kebutuhan akan buah tangan dan merchandise khas Kota Cilegon
              yang modern, estetik, dan fungsional. Nama{' '}
              <em className="font-semibold text-forest-700">“Enggih”</em> diambil dari
              sapaan khas masyarakat lokal (Bahasa Jawa Cilegon / Bebasan) yang
              mencerminkan keramahan, kesantunan, dan penerimaan yang hangat bagi siapa
              saja yang singgah di Kota Baja.
            </p>
            <p>
              Kami memadukan kekayaan ikon arsitektur dan budaya lokal Cilegon ke
              dalam berbagai produk sehari-hari seperti kaos distro, tumbler,
              payung, tote bag kanvas, hingga lampu tidur 3D. Setiap produk
              dirancang dengan detail ilustrasi eksklusif dan standar kualitas
              tinggi, sehingga tidak hanya layak dijadikan kenang-kenangan
              perjalanan, tetapi juga suvenir resmi perusahaan, instansi, maupun
              hadiah spesial.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-extrabold text-navy-800">9+</div>
              <div className="text-xs text-slate-500">Lini Produk Ikonik</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-forest-600">8.500+</div>
              <div className="text-xs text-slate-500">Produk Terjual</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-amberbrand-500">4.9/5</div>
              <div className="text-xs text-slate-500">Rating Kepuasan</div>
            </div>
          </div>
        </div>

        {/* Filosofi Desain & Palet Warna */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-4">
            <h3 className="text-base sm:text-lg font-extrabold text-navy-800 flex items-center gap-2">
              <Compass className="w-5 h-5 text-forest-600" />
              Filosofi Desain Landmark & Warna
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Seluruh ilustrasi kami mengangkat siluet geometris{' '}
              <strong>Menara/Tugu Landmark Simpang Tiga Cilegon</strong>—simbol titik
              temu kemajuan industri nasional, pelabuhan gerbang Pulau Jawa, dan
              semangat masyarakat Cilegon yang dinamis.
            </p>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                <span className="w-8 h-8 rounded-lg bg-[#1B365D] shrink-0 shadow-inner" />
                <div className="text-xs">
                  <div className="font-bold text-navy-800">
                    Biru Baja / Navy (#1B365D)
                  </div>
                  <div className="text-slate-500">
                    Industri baja, profesionalisme, dan kepercayaan
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                <span className="w-8 h-8 rounded-lg bg-[#2E6F40] shrink-0 shadow-inner" />
                <div className="text-xs">
                  <div className="font-bold text-forest-700">
                    Hijau Tosca / Forest Green (#2E6F40)
                  </div>
                  <div className="text-slate-500">
                    Kesegaran pesisir Anyer-Merak & harmoni lingkungan
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50">
                <span className="w-8 h-8 rounded-lg bg-[#E5A93C] shrink-0 shadow-inner" />
                <div className="text-xs">
                  <div className="font-bold text-amberbrand-800">
                    Kuning Emas / Amber (#E5A93C)
                  </div>
                  <div className="text-slate-500">
                    Energi kreatif, kehangatan sapaan “Enggih”, dan kualitas emas
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Workshop & Store Card */}
          <div className="bg-navy-800 text-white rounded-3xl p-6 space-y-3">
            <h3 className="text-base font-extrabold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-amberbrand-400" />
              Lokasi Workshop & Galeri Store
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {settings.address}
            </p>
            <div className="text-xs text-slate-300 space-y-1 pt-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-forest-300" />
                <span>{settings.openHours}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-forest-300" />
                <span className="break-all">{settings.email} • www.{STORE_DOMAIN}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-forest-300" />
                <span>{settings.whatsappDisplay} (WhatsApp Resmi)</span>
              </div>
            </div>
            <div className="pt-2 flex gap-2">
              <Link
                to="/katalog"
                className="flex-1 py-2.5 px-4 rounded-xl bg-amberbrand-400 text-navy-950 font-extrabold text-xs text-center inline-flex items-center justify-center gap-1"
              >
                Lihat Katalog <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <a
                href={buildWhatsAppUrl(`Halo Cilegon Enggih! Saya ingin berkunjung ke Workshop/Store di ${STORE_INFO.addressShort}.`)}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs text-center"
              >
                Hubungi Store
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
