import React, { useState } from 'react';
import {
  ShoppingBag,
  CreditCard,
  Truck,
  PackageCheck,
  ChevronDown,
  ShieldCheck,
  MessageCircle,
  HelpCircle
} from 'lucide-react';
import { ShippingCalculator } from '../components/ShippingCalculator';
import { buildWhatsAppUrl } from '../data/products';
import { useStore } from '../context/StoreContext';

const ORDER_STEPS = [
  {
    step: '01',
    icon: ShoppingBag,
    title: 'Pilih Produk & Varian',
    desc: 'Pilih produk merchandise atau Paket Bundling di Katalog. Untuk kaos, cek panduan Size Chart terlebih dahulu.'
  },
  {
    step: '02',
    icon: CreditCard,
    title: 'Checkout Tanpa Daftar Akun',
    desc: 'Isi nama, WhatsApp, dan alamat — tidak perlu membuat akun. Pilih Transfer Bank / QRIS toko dan bayar sesuai nominal akhir (termasuk 3 kode unik).'
  },
  {
    step: '03',
    icon: Truck,
    title: 'Pengiriman Instan / Ekspedisi',
    desc: 'Pesanan area Kota Cilegon bisa dikirim 1–2 jam via GoSend/GrabExpress. Luar kota dikirim hari yang sama via JNE/J&T/SiCepat.'
  },
  {
    step: '04',
    icon: PackageCheck,
    title: 'Resi Kurir Asli & Garansi Aman',
    desc: 'Nomor resi diinput admin setelah paket diserahkan ke JNE/J&T/SiCepat/GoSend, lalu bisa dilacak di menu Lacak Pesanan beserta tautan resmi kurir.'
  }
];

const FAQS = [
  {
    q: 'Apakah bisa dikirim langsung hari ini untuk area Kota Cilegon & Serang?',
    a: 'Sangat bisa! Untuk pemesanan sebelum pukul 17.00 WIB dengan kurir GoSend Instant atau GrabExpress dari workshop Kel. Karang Asem, Kec. Cibeber, Kota Cilegon, pesanan rata-rata tiba dalam 1–2 jam di area Cilegon, Ciwandan, Merak, Anyer, dan Kramatwatu.'
  },
  {
    q: 'Bagaimana jika Mug Keramik atau Lampu Tidur 3D pecah saat pengiriman luar kota?',
    a: 'Tenang, setiap produk pecah belah dikemas menggunakan box kardus tebal + bubble wrap berlapis tanpa biaya tambahan. Jika tetap terjadi kerusakan akibat ekspedisi, cukup kirimkan video unboxing maksimal 2x24 jam dan kami kirimkan unit baru 100% GRATIS.'
  },
  {
    q: 'Berapa minimal pemesanan untuk harga grosir atau custom logo perusahaan?',
    a: 'Harga grosir otomatis langsung aktif mulai pembelian 15–50 pcs (tergantung jenis produk). Untuk penambahan cetak logo instansi/perusahaan tersedia mulai 25 pcs, dan GRATIS biaya cetak logo untuk pemesanan minimal 100 pcs.'
  },
  {
    q: 'Apakah Cilegon Enggih melayani dokumen pengadaan perusahaan / SPK / Faktur?',
    a: 'Ya, kami berpengalaman melayani pengadaan suvenir BUMN, industri kawasan KIEC/Ciwandan, perbankan, serta instansi pemerintah lengkap dengan Quotation resmi, Invoice, Kwitansi bermeterai, dan E-Faktur.'
  },
  {
    q: 'Apakah ukuran kaos distro bisa ditukar jika kekecilan/kebesaran?',
    a: 'Bisa! Kami memberikan garansi tukar ukuran maksimal 3 hari sejak barang diterima selama hangtag masih terpasang, kaos belum dicuci, dan stok ukuran pengganti tersedia.'
  }
];

export const HowToOrderFaqPage: React.FC = () => {
  const { settings } = useStore();
  const [openIdx, setOpenIdx] = useState<number>(0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <span className="text-xs font-extrabold uppercase tracking-wider text-forest-600">
          Panduan Pelanggan Resmi
        </span>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-navy-800">
          Cara Order, Estimasi Ongkir & FAQ
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Belanja mudah secara mandiri via sistem otomatis website atau berbincang
          langsung dengan admin ramah kami.
        </p>
      </div>

      {/* 4 Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {ORDER_STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.step}
              className="bg-white rounded-3xl border border-slate-200 p-6 shadow-soft space-y-3 relative overflow-hidden"
            >
              <span className="text-4xl font-extrabold text-slate-100 absolute top-4 right-5 select-none">
                {s.step}
              </span>
              <div className="w-12 h-12 rounded-2xl bg-forest-50 text-forest-700 flex items-center justify-center">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-navy-800">{s.title}</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {s.desc}
              </p>
            </div>
          );
        })}
      </div>

      {/* Shipping Sim + Guarantee */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-navy-800">
            Cek Estimasi Ongkir dari Kota Cilegon
          </h2>
          <ShippingCalculator weightGrams={500} />

          <div className="p-4 rounded-2xl bg-navy-800 text-white flex items-start gap-3">
            <ShieldCheck className="w-6 h-6 text-amberbrand-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <div className="font-extrabold text-amberbrand-300">
                Garansi Retur & Penggantian Produk 100%
              </div>
              <p className="text-slate-200 mt-0.5 leading-relaxed">
                Apabila produk cacat produksi, salah ukuran dari pihak kami, atau
                pecah dalam perjalanan ekspedisi, kami ganti unit baru tanpa biaya
                ongkir tambahan.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ Accordion */}
        <div className="lg:col-span-6 space-y-4">
          <h2 className="text-lg sm:text-xl font-extrabold text-navy-800 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-forest-600" />
            Pertanyaan yang Sering Diajukan (FAQ)
          </h2>

          <div className="space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openIdx === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-soft"
                >
                  <button
                    type="button"
                    onClick={() => setOpenIdx(isOpen ? -1 : idx)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-3"
                  >
                    <span className="text-xs sm:text-sm font-extrabold text-navy-800">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180 text-forest-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Kartu Kontak & Alamat Resmi */}
          <div className="mt-6 bg-navy-800 text-white rounded-3xl p-5 sm:p-6 space-y-2.5">
            <h3 className="text-sm font-extrabold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amberbrand-400" />
              Kontak & Alamat Resmi Cilegon Enggih
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">{settings.address}</p>
            <div className="text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
              <span>WhatsApp: <strong className="text-white">{settings.whatsappDisplay}</strong></span>
              <span>Email: <strong className="text-white break-all">{settings.email}</strong></span>
              <span>{settings.openHours}</span>
            </div>
          </div>

          <div className="pt-2">
            <a
              href={buildWhatsAppUrl(
                'Halo Admin Cilegon Enggih! Saya punya pertanyaan terkait pemesanan.'
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-xs sm:text-sm font-bold"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Masih Ada Pertanyaan? Chat WhatsApp Admin</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
