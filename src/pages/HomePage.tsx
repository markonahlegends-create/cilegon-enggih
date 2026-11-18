import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Sparkles,
  Award,
  ShieldCheck,
  Building2,
  Zap,
  Star,
  ChevronRight,
  Clock,
  ShoppingBag,
  Layers,
  CheckCircle2,
  Ticket,
  Quote
} from 'lucide-react';
import { formatRupiah, buildWhatsAppUrl } from '../data/products';
import { ProductCard } from '../components/ProductCard';
import { useStore } from '../context/StoreContext';

const HERO_SLIDES = [
  {
    id: 'slide-1',
    badge: 'OFFICIAL MERCHANDISE KOTA BAJA',
    tagline: 'Khas Kota Baja, Bangga Membawanya.',
    title: 'Koleksi Eksklusif Ikon Landmark Simpang Tiga Cilegon',
    description:
      'Hadirkan kebanggaan arsitektur Kota Cilegon dalam produk fungsional premium: Kaos Distro Cotton Combed, Lampu Tidur 3D, Tumbler Sporty 304, hingga Tote Bag Kanvas.',
    ctaPrimary: { label: 'Jelajahi Katalog Lengkap', to: '/katalog' },
    ctaSecondary: { label: 'Lihat Paket Bundling', to: '/katalog?kategori=paket-bundling' },
    featuredImage: '/products/lampu-tidur-3d.png',
    secondaryImage: '/products/kaos-distro.png',
    highlightName: 'Lampu Tidur 3D Arsitektur',
    highlightPrice: 'Rp 169.000'
  },
  {
    id: 'slide-2',
    badge: 'OLEH-OLEH MODERN KEBANGGAAN CILEGON',
    tagline: 'Oleh-Oleh Modern Kebanggaan Cilegon.',
    title: 'Buah Tangan Berkelas yang Tak Lekang oleh Waktu',
    description:
      'Tak bingung lagi mencari cendera mata khas Cilegon! Dari Gantungan Kunci Karet 3D timbul, Stiker Die-Cut tahan cuaca, hingga Mug Keramik SNI siap dibungkus untuk kerabat.',
    ctaPrimary: { label: 'Belanja Oleh-Oleh Praktis', to: '/katalog?kategori=aksesoris-dekorasi' },
    ctaSecondary: { label: 'Cek Ongkir Instan Cilegon', to: '/cara-order-faq' },
    featuredImage: '/products/tote-bag-kanvas.png',
    secondaryImage: '/products/gantungan-kunci-3d.png',
    highlightName: 'Tote Bag Kanvas Premium',
    highlightPrice: 'Rp 68.000'
  },
  {
    id: 'slide-3',
    badge: 'SOLUSI SUVENIR KORPORAT & INSTANSI (B2B)',
    tagline: 'Cilegon dalam Setiap Karya.',
    title: 'Suvenir Resmi Gathering Industri, BUMN & Tamu VIP',
    description:
      'Melayani pemesanan jumlah besar dengan opsi tambahan logo perusahaan/instansi, kemasan Hardbox Magnetik eksklusif, dan faktur resmi.',
    ctaPrimary: { label: 'Simulasi Harga Grosir B2B', to: '/custom-korporat' },
    ctaSecondary: { label: 'Lihat Paket Eksekutif', to: '/produk/paket-eksekutif-korporat' },
    featuredImage: '/products/tumbler-sporty.png',
    secondaryImage: '/products/payung-geometris.png',
    highlightName: 'Tumbler Stainless 304 UV 360°',
    highlightPrice: 'Rp 109.000'
  }
];

const TESTIMONIALS = [
  {
    name: 'Ir. Hendra Pratama',
    role: 'Manajer Humas Industri Baja — Kota Cilegon',
    avatar: 'HP',
    rating: 5,
    product: 'Paket Eksekutif / Korporat (40 Box)',
    quote:
      'Selama ini tamu bisnis dari luar negeri selalu kami beri suvenir standar. Sejak ada Cilegon Enggih, Paket Hardbox berisi Tumbler UV & Payung Geometris Landmark Simpang Tiga jadi kebanggaan tersendiri!'
  },
  {
    name: 'Anisa Rahmawati',
    role: 'Wisatawan & Content Creator — Bandung',
    avatar: 'AR',
    rating: 5,
    product: 'Lampu Tidur 3D & Kaos Distro',
    quote:
      'Desain ilustrasinya modern banget, jauh dari kesan oleh-oleh daerah yang kaku. Lampu tidur 3D menaranya estetik parah di kamar, kaosnya juga adem dipakai jalan.'
  },
  {
    name: 'Fikri Maulana',
    role: 'ASN Pemerintah Kota Cilegon',
    avatar: 'FM',
    rating: 5,
    product: 'Kalender A3, Tote Bag & Ganci 3D',
    quote:
      'Pesan pagi pakai GoSend Instant langsung tiba di kantor sebelum makan siang! Kualitas karet gantungan kunci 3D dan tote bag kanvasnya benar-benar tebal rapi.'
  }
];

export const HomePage: React.FC = () => {
  const { addToCart, pushToast, products, categories, vouchers } = useStore();
  const [activeSlide, setActiveSlide] = useState(0);
  const [countdown, setCountdown] = useState({ h: 5, m: 42, s: 18 });

  useEffect(() => {
    const slideTimer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => clearInterval(slideTimer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.s > 0) return { ...prev, s: prev.s - 1 };
        if (prev.m > 0) return { ...prev, m: prev.m - 1, s: 59 };
        if (prev.h > 0) return { h: prev.h - 1, m: 59, s: 59 };
        return { h: 5, m: 59, s: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currentHero = HERO_SLIDES[activeSlide];
  const singleProducts = products.filter((p) => !p.isBundle);
  const bundleProducts = products.filter((p) => p.isBundle);
  const bestSellers = products.filter((p) => p.isBestSeller && !p.isBundle);

  return (
    <div className="space-y-12 pb-8">
      {/* 1. HERO BANNER (Tokopedia Official Flagship Carousel Style) */}
      {/*
        HERO: di HP dibuat ringkas (sudut 12px, padding ketat) agar produk
        pertama muncul di layar pertama. Di desktop tetap megah.
        Sebelumnya hero setinggi ±600px sehingga produk baru terlihat
        setelah menggulir 3,6 layar.
      */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 pt-2.5 sm:pt-5">
        <div className="relative rounded-xl sm:rounded-3xl overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-forest-700 text-white sm:shadow-card-hover border border-white/10">
          {/* Subtle decorative radial glow */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #E5A93C 0%, transparent 70%)'
            }}
          />
          <div
            className="absolute -bottom-28 left-1/3 w-80 h-80 rounded-full opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, #5fa978 0%, transparent 70%)'
            }}
          />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-8 items-center p-3.5 sm:p-10 lg:p-12">
            {/* Left Copywriting */}
            <div className="lg:col-span-7 space-y-2.5 sm:space-y-5">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3.5 sm:py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-amberbrand-300 text-[10px] sm:text-xs font-bold tracking-wide sm:tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{currentHero.badge}</span>
              </div>

              <h1 className="text-[19px] sm:text-4xl lg:text-[42px] font-extrabold leading-tight tracking-tight">
                {currentHero.title}
              </h1>

              {/* Deskripsi & slogan disembunyikan di HP — bukan informasi
                  yang dicari pembeli saat pertama membuka toko. */}
              <p className="hidden sm:block text-sm sm:text-base text-slate-200/95 max-w-2xl leading-relaxed">
                {currentHero.description}
              </p>

              <div className="hidden sm:flex items-center gap-2 text-xs sm:text-sm italic text-amberbrand-200 font-medium">
                <span>✦ Slogan Resmi: “{currentHero.tagline}”</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-0.5 sm:pt-1">
                <Link
                  to={currentHero.ctaPrimary.to}
                  className="px-3.5 py-2 sm:px-6 sm:py-3.5 rounded-lg sm:rounded-xl bg-amberbrand-400 active:bg-amberbrand-500 text-navy-950 font-extrabold text-xs sm:text-sm inline-flex items-center gap-1.5 sm:gap-2 sm:shadow-lg transition-all"
                >
                  <span>{currentHero.ctaPrimary.label}</span>
                  <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </Link>
                <Link
                  to={currentHero.ctaSecondary.to}
                  className="px-3 py-2 sm:px-5 sm:py-3.5 rounded-lg sm:rounded-xl bg-white/10 active:bg-white/20 text-white border border-white/20 font-bold text-xs sm:text-sm transition-colors"
                >
                  {currentHero.ctaSecondary.label}
                </Link>
              </div>

              {/* Slide Indicators */}
              <div className="flex items-center gap-2 pt-2">
                {/*
                  Titik navigasi slider: visual tetap kecil (8px), tetapi
                  area sentuh diperbesar jadi 32x32px agar mudah ditekan jari.
                */}
                {HERO_SLIDES.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSlide(idx)}
                    aria-label={`Slide ${idx + 1}`}
                    className="p-2.5 -m-2.5 flex items-center justify-center min-w-[32px] min-h-[32px]"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all ${
                        activeSlide === idx
                          ? 'w-8 bg-amberbrand-400'
                          : 'w-2 bg-white/35 hover:bg-white/60'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/*
              Showcase kanan.
              Di HP dipakai versi ringkas: SATU gambar kecil + nama & harga
              dalam satu baris. Versi desktop (dua gambar besar + kartu
              harga) memakan 250px vertikal sehingga hero membengkak dan
              produk pertama terdorong jauh ke bawah.
            */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="relative w-full max-w-md">
                {/* Versi HP */}
                <Link
                  to={currentHero.ctaPrimary.to}
                  className="lg:hidden flex items-center gap-2.5 rounded-lg bg-white/10 border border-white/20 p-2 active:bg-white/20"
                >
                  <img
                    src={currentHero.featuredImage}
                    alt={currentHero.highlightName}
                    className="w-11 h-11 rounded-md object-cover shrink-0"
                  />
                  <div className="min-w-0 text-left">
                    <div className="text-[9px] uppercase tracking-wider text-amberbrand-300 font-bold">
                      Produk Unggulan
                    </div>
                    <div className="text-[11px] font-bold text-white truncate">
                      {currentHero.highlightName}
                    </div>
                    <div className="text-[12px] font-extrabold text-amberbrand-400 leading-tight">
                      {currentHero.highlightPrice}
                    </div>
                  </div>
                  <span className="ml-auto text-white/50 text-[10px] shrink-0">Lihat →</span>
                </Link>

                {/* Versi desktop */}
                <div className="hidden lg:block">
                  <div className="grid grid-cols-12 gap-3 items-center">
                    <div className="col-span-7 rounded-2xl overflow-hidden border-2 border-white/25 shadow-2xl bg-navy-950 aspect-[4/4.8]">
                      <img
                        src={currentHero.featuredImage}
                        alt={currentHero.highlightName}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="col-span-5 space-y-3">
                      <div className="rounded-2xl overflow-hidden border-2 border-white/20 shadow-xl bg-navy-950 aspect-square">
                        <img
                          src={currentHero.secondaryImage}
                          alt="Koleksi Cilegon Enggih"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="rounded-2xl bg-white/12 backdrop-blur-md border border-white/20 p-3 text-left">
                        <div className="text-[10px] uppercase tracking-wider text-amberbrand-300 font-bold">
                          Produk Unggulan
                        </div>
                        <div className="text-xs font-bold text-white line-clamp-1 mt-0.5">
                          {currentHero.highlightName}
                        </div>
                        <div className="text-sm font-extrabold text-amberbrand-400 mt-1">
                          {currentHero.highlightPrice}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/*
        2. KEUNGGULAN PRODUK.
        Di HP keempat kartu ini dijadikan satu baris horizontal yang bisa
        digeser (bukan 4 kartu bertumpuk setinggi ±700px). Alasannya:
        pengunjung HP ingin melihat PRODUK lebih dulu; keunggulan toko
        cukup sekilas dan tetap terbaca.
      */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 mt-2.5 sm:mt-4">
        <div className="lg:hidden -mx-3 px-3 flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { icon: Award, title: 'Desain Eksklusif', accent: 'bg-navy-50 text-navy-800 border-navy-100' },
            { icon: ShieldCheck, title: 'Material Premium', accent: 'bg-forest-50 text-forest-700 border-forest-100' },
            { icon: Building2, title: 'Custom Logo', accent: 'bg-amberbrand-50 text-amberbrand-800 border-amberbrand-100' },
            { icon: Zap, title: 'Kirim 1–2 Jam', accent: 'bg-forest-50 text-forest-700 border-forest-100' }
          ].map((vp, idx) => {
            const Icon = vp.icon;
            return (
              <div
                key={idx}
                className={`shrink-0 inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1.5 rounded-lg border bg-white ${vp.accent}`}
              >
                <span className={`w-6 h-6 rounded-md border flex items-center justify-center ${vp.accent}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="text-[11px] font-bold whitespace-nowrap">{vp.title}</span>
              </div>
            );
          })}
        </div>

        <div className="hidden lg:grid grid-cols-4 gap-4">
          {[
            {
              icon: Award,
              title: 'Desain Eksklusif Ikon Cilegon',
              desc: 'Ilustrasi orisinal Menara Landmark Simpang Tiga Cilegon yang modern & ikonik.',
              accent: 'bg-navy-50 text-navy-800 border-navy-100'
            },
            {
              icon: ShieldCheck,
              title: 'Material Premium & Tahan Lama',
              desc: 'Cotton Combed 24s, Stainless 304, Kanvas Marsoto, hingga Keramik berstandar SNI.',
              accent: 'bg-forest-50 text-forest-700 border-forest-100'
            },
            {
              icon: Building2,
              title: 'Bisa Custom Logo Perusahaan / Acara',
              desc: 'Siap cetak logo BUMN, industri, instansi pemerintah & seminar dengan harga grosir.',
              accent: 'bg-amberbrand-50 text-amberbrand-800 border-amberbrand-100'
            },
            {
              icon: Zap,
              title: 'Pengiriman Cepat dari Kota Cilegon',
              desc: 'Tersedia GoSend/GrabExpress Instan 1–2 jam area Cilegon & ekspedisi nasional.',
              accent: 'bg-forest-50 text-forest-700 border-forest-100'
            }
          ].map((vp, idx) => {
            const Icon = vp.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-xl p-4 border border-slate-200/80 flex items-start gap-3.5 hover:border-forest-400 transition-colors"
              >
                <div
                  className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${vp.accent}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-navy-800 leading-snug">
                    {vp.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {vp.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. KATEGORI PILIHAN & VOUCHER TOKO (Tokopedia Official Store Style) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-forest-600">
              Eksplorasi Koleksi
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-navy-800">
              Kategori Pilihan Cilegon Enggih
            </h2>
          </div>
          <Link
            to="/katalog"
            className="text-xs sm:text-sm font-bold text-forest-700 hover:text-forest-800 inline-flex items-center gap-1"
          >
            Lihat Semua <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/*
          Di HP kategori menjadi SATU baris chip yang bisa digeser.
          Sebelumnya grid 2 kolom × 5 baris = 963px hanya untuk kategori,
          mendorong produk pertama ke y=1752. Versi chip ini ±90px saja.
          Di layar lebih besar tetap kartu bergambar.
        */}
        <div className="lg:hidden -mx-3 px-3 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={cat.slug === 'semua' ? '/katalog' : `/katalog?kategori=${cat.slug}`}
              className="shrink-0 flex flex-col items-center gap-1 w-[62px]"
            >
              <img
                src={
                  cat.slug === 'apparel-tas'
                    ? '/products/tote-bag-kanvas.png'
                    : cat.slug === 'drinkware'
                      ? '/products/tumbler-sporty.png'
                      : cat.slug === 'aksesoris-dekorasi'
                        ? '/products/gantungan-kunci-3d.png'
                        : cat.slug === 'perlengkapan-cetak'
                          ? '/products/payung-geometris.png'
                          : '/products/lampu-tidur-3d.png'
                }
                alt={cat.label}
                className="w-12 h-12 rounded-full object-cover border border-slate-200"
              />
              <span className="text-[10px] font-semibold text-slate-600 text-center leading-tight line-clamp-2">
                {cat.label}
              </span>
            </Link>
          ))}
        </div>

        <div className="hidden lg:grid grid-cols-5 gap-3.5">
          {[
            {
              slug: 'apparel-tas',
              title: 'Apparel & Tas',
              sub: 'Kaos Distro & Tote Bag',
              img: '/products/tote-bag-kanvas.png'
            },
            {
              slug: 'drinkware',
              title: 'Drinkware',
              sub: 'Tumbler 304 & Mug SNI',
              img: '/products/tumbler-sporty.png'
            },
            {
              slug: 'aksesoris-dekorasi',
              title: 'Aksesoris & 3D',
              sub: 'Ganci 3D, Stiker & Lampu',
              img: '/products/gantungan-kunci-3d.png'
            },
            {
              slug: 'perlengkapan-cetak',
              title: 'Payung & Cetak',
              sub: 'Payung & Kalender A3',
              img: '/products/payung-geometris.png'
            },
            {
              slug: 'paket-bundling',
              title: 'Paket Bundling',
              sub: 'Hampers Wisata & VIP',
              img: '/products/lampu-tidur-3d.png'
            }
          ].map((cat) => (
            <Link
              key={cat.slug}
              to={`/katalog?kategori=${cat.slug}`}
              className="group bg-white rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 hover:border-forest-500 shadow-card hover:shadow-card-hover transition-all flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3"
            >
              {/*
                Di HP kartu jadi vertikal (gambar di atas, teks di bawah).
                Sebelumnya horizontal: gambar 56px + teks di sisa ~90px
                membuat "Apparel & Tas", "Drinkware", "Aksesoris & 3D" dan
                lainnya terpotong jadi "Appare…", "Drinkw…", "Akseso…".
              */}
              <img
                src={cat.img}
                alt={cat.title}
                className="w-full h-24 sm:w-14 sm:h-14 rounded-xl object-cover shrink-0 group-hover:scale-105 transition-transform"
              />
              <div className="min-w-0 w-full">
                <div className="text-xs sm:text-sm font-extrabold text-navy-800 group-hover:text-forest-700 leading-snug sm:truncate">
                  {cat.title}
                </div>
                <div className="text-[10px] sm:text-[11px] text-slate-500 line-clamp-2 sm:line-clamp-1 mt-0.5 leading-snug">
                  {cat.sub}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/*
          Voucher: di HP menjadi baris horizontal yang bisa digeser.
          Sebelumnya 3 kartu penuh bertumpuk (±300px) sebelum produk
          pertama. Di desktop tetap 3 kolom seperti semula.
        */}
        <div className="lg:hidden -mx-3 px-3 flex gap-2 overflow-x-auto no-scrollbar pt-1">
          {vouchers.map((v) => (
            <button
              key={v.code}
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(v.code);
                pushToast(`Kode Voucher ${v.code} Disalin!`, v.description, 'success');
              }}
              className="shrink-0 inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 rounded-lg border border-forest-200 bg-forest-50 active:bg-forest-100"
            >
              <Ticket className="w-3.5 h-3.5 text-forest-600 shrink-0" />
              <span className="text-[10.5px] font-extrabold text-forest-700 whitespace-nowrap">
                {v.code}
              </span>
              <span className="text-[10px] text-slate-500 whitespace-nowrap">
                min {formatRupiah(v.minPurchase)}
              </span>
            </button>
          ))}
        </div>

        <div className="hidden lg:grid grid-cols-3 gap-3 pt-2">
          {vouchers.map((v) => (
            <div
              key={v.code}
              className="bg-gradient-to-r from-forest-50 via-white to-amberbrand-50/50 rounded-2xl border border-forest-200/80 p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3"
            >
              <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-forest-600 text-white flex items-center justify-center shrink-0">
                  <Ticket className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="min-w-0">
                  {/* Judul voucher dibiarkan 2 baris di HP, bukan dipotong "…" */}
                  <div className="text-xs font-extrabold text-navy-800 leading-snug line-clamp-2 sm:truncate">
                    {v.title}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                    Kode: <strong className="text-forest-700">{v.code}</strong> • Min.{' '}
                    {formatRupiah(v.minPurchase)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(v.code);
                  pushToast(`Kode Voucher ${v.code} Disalin!`, v.description, 'success');
                }}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-xs font-bold shrink-0 transition-colors"
              >
                Klaim
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 4. KEJAR DISKON / PRODUK TERLARIS (Tokopedia Flash Deal Rail) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-r from-forest-700 via-forest-600 to-navy-800 p-5 sm:p-7 shadow-card-hover">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 text-white">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amberbrand-400 text-navy-950 text-xs font-extrabold">
                <Zap className="w-3.5 h-3.5 fill-current" /> PRODUK TERLARIS MINGGU INI
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold">
                Paling Banyak Diborong Wisatawan & Korporat
              </h2>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold bg-navy-950/40 px-3.5 py-2 rounded-xl border border-white/15 w-fit">
              <Clock className="w-4 h-4 text-amberbrand-400" />
              <span>Promo Berakhir:</span>
              <span className="px-1.5 py-0.5 rounded bg-amberbrand-400 text-navy-950 font-extrabold">
                0{countdown.h}
              </span>
              :
              <span className="px-1.5 py-0.5 rounded bg-amberbrand-400 text-navy-950 font-extrabold">
                {String(countdown.m).padStart(2, '0')}
              </span>
              :
              <span className="px-1.5 py-0.5 rounded bg-amberbrand-400 text-navy-950 font-extrabold">
                {String(countdown.s).padStart(2, '0')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            {bestSellers.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        </div>
      </section>

      {/* 5. KATALOG LENGKAP 9 PRODUK IKONIK CILEGON ENGGIH */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold uppercase tracking-wider text-forest-600">
              Official Merchandise Lineup
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-navy-800">
              9 Produk Ikonik Edisi Landmark Cilegon
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Seluruh produk tersedia pembelian satuan (eceran) maupun harga grosir otomatis
            </p>
          </div>
          <Link
            to="/katalog"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-navy-800 hover:bg-navy-900 text-white text-xs sm:text-sm font-bold w-fit"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Filter & Cari di Katalog</span>
          </Link>
        </div>

        {/* 2 kolom di HP agar produk cepat terlihat, bukan 1 kartu raksasa per layar */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-4">
          {singleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 6. PAKET BUNDLING / PAKET OLEH-OLEH HEMAT (Requirement Section 4) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-extrabold uppercase tracking-wider text-amberbrand-600">
              <Layers className="w-3.5 h-3.5" /> Lebih Hemat & Praktis
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-navy-800">
              Paket Bundling Oleh-Oleh & Hampers Eksekutif
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Rekomendasi paket siap hadiah untuk wisatawan, keluarga, maupun relasi korporat
            </p>
          </div>
          <Link
            to="/custom-korporat"
            className="text-xs sm:text-sm font-bold text-forest-700 hover:underline"
          >
            Butuh Custom Isi Hampers? Klik di sini →
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {bundleProducts.map((bundle) => (
            <div
              key={bundle.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-card hover:shadow-card-hover transition-all overflow-hidden flex flex-col"
            >
              <div className="relative h-56 bg-slate-100 overflow-hidden">
                <div className="grid grid-cols-3 h-full gap-0.5 bg-white">
                  {(bundle.galleryImages || [bundle.image]).slice(0, 3).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={bundle.name}
                      className="w-full h-full object-cover"
                    />
                  ))}
                </div>
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-navy-800/95 text-amberbrand-300 text-xs font-extrabold shadow">
                  {bundle.badges[0]}
                </div>
                <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-forest-600 text-white text-xs font-bold shadow">
                  Hemat {formatRupiah(bundle.originalPrice - bundle.price)}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <Link
                    to={`/produk/${bundle.slug}`}
                    className="text-base sm:text-lg font-extrabold text-navy-800 hover:text-forest-700"
                  >
                    {bundle.name}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {bundle.description}
                  </p>

                  <ul className="mt-3 space-y-1.5">
                    {bundle.bundleItems?.map((bi, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-slate-700 flex items-start gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4 text-forest-600 shrink-0 mt-0.5" />
                        <span>{bi}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-400 line-through">
                      {formatRupiah(bundle.originalPrice)}
                    </div>
                    <div className="text-lg font-extrabold text-navy-800">
                      {formatRupiah(bundle.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/produk/${bundle.slug}`}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:border-navy-800 text-xs font-bold text-slate-700"
                    >
                      Detail
                    </Link>
                    <button
                      type="button"
                      onClick={() => addToCart(bundle, 1, bundle.variants?.[0])}
                      className="px-4 py-2 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 text-xs font-extrabold shadow-sm"
                    >
                      + Ambil Paket
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. B2B CORPORATE CALLOUT BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="rounded-3xl bg-navy-800 text-white p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center border border-navy-700">
          <div className="lg:col-span-8 space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-forest-600/30 border border-forest-400/40 text-forest-200 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5" /> LAYANAN B2B, INDUSTRI & PEMERINTAHAN
            </span>
            <h3 className="text-xl sm:text-3xl font-extrabold leading-tight">
              Pesan Suvenir Seminar, Gathering Pabrik, atau Kunjungan Dinas?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Dapatkan diskon grosir hingga 30%, gratis mockup penempatan logo perusahaan/instansi Anda berdampingan dengan Landmark Cilegon, serta dukungan faktur/invoice pengadaan resmi.
            </p>
          </div>
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3">
            <Link
              to="/custom-korporat"
              className="px-5 py-3.5 rounded-xl bg-amberbrand-400 hover:bg-amberbrand-500 text-navy-950 font-extrabold text-sm text-center shadow-sm"
            >
              Buka Kalkulator Harga Grosir B2B →
            </Link>
            <a
              href={buildWhatsAppUrl(
                'Halo Tim Korporat Cilegon Enggih! Kami ingin meminta penawaran harga grosir / custom logo instansi.'
              )}
              target="_blank"
              rel="noreferrer"
              className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 font-bold text-xs sm:text-sm text-center"
            >
              Konsultasi Langsung via WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* 8. TESTIMONI PELANGGAN */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
        <div className="text-center max-w-2xl mx-auto">
          <span className="text-xs font-extrabold uppercase tracking-wider text-forest-600">
            Ulasan Terverifikasi (4.9 / 5.0)
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-navy-800 mt-1">
            Dipercaya Warga Lokal, Wisatawan & Industri Kota Baja
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, idx) => (
            <div
              key={idx}
              className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-soft flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5 text-amberbrand-400">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <Quote className="w-5 h-5 text-slate-200" />
                </div>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                  “{t.quote}”
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-navy-800 text-amberbrand-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                  {t.avatar}
                </div>
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-bold text-navy-800 truncate">
                    {t.name}
                  </div>
                  {/* Dibiarkan 2 baris agar jabatan & produk tidak terpotong "…" */}
                  <div className="text-[11px] text-slate-500 leading-snug line-clamp-2">
                    {t.role}
                  </div>
                  <div className="text-[10.5px] font-semibold text-forest-700 leading-snug line-clamp-2 mt-0.5">
                    Membeli: {t.product}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
