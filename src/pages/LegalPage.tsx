import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, FileCheck, RotateCcw } from 'lucide-react';
import { STORE_DOMAIN } from '../data/products';
import { useStore } from '../context/StoreContext';

export const LegalPage: React.FC = () => {
  const { settings } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'privasi';

  const tabs = [
    { id: 'privasi', label: 'Kebijakan Privasi (Privacy Policy)', icon: Shield },
    { id: 'syarat', label: 'Syarat & Ketentuan (Terms of Service)', icon: FileCheck },
    { id: 'pengembalian', label: 'Kebijakan Pengembalian (Refund Policy)', icon: RotateCcw }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="text-center space-y-1.5">
        <span className="text-xs font-extrabold uppercase tracking-wider text-forest-600">
          Dokumen Resmi Toko — Privasi, Syarat & Pengembalian
        </span>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy-800">
          Halaman Legalitas Standar Cilegon Enggih
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Berlaku untuk seluruh transaksi resmi pada domain {STORE_DOMAIN}
        </p>
        <div className="text-[11px] text-slate-600 bg-white border border-slate-200 rounded-xl p-3 mt-2 shadow-soft">
          <strong className="text-navy-800">{settings.legalName}</strong> — {settings.address}
          <br />
          Email {settings.email} • WhatsApp {settings.whatsappDisplay}
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSearchParams({ tab: t.id })}
              className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                active
                  ? 'bg-navy-800 text-white border-navy-800 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-forest-500'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-9 shadow-soft text-xs sm:text-sm text-slate-700 leading-relaxed space-y-5">
        {activeTab === 'privasi' && (
          <>
            <h2 className="text-lg font-extrabold text-navy-800">
              Kebijakan Privasi (Privacy Policy) — Cilegon Enggih
            </h2>
            <p>
              <strong>Cilegon Enggih</strong> ({STORE_DOMAIN}) menghormati dan melindungi
              privasi data pribadi seluruh pelanggan retail maupun mitra korporat sesuai
              Undang-Undang Perlindungan Data Pribadi (UU PDP) Republik Indonesia.
            </p>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">1. Data yang Kami Kumpulkan</h3>
              <p>
                Kami hanya mengumpulkan informasi yang dibutuhkan untuk memproses pengiriman
                dan verifikasi pembayaran pesanan Anda, meliputi: Nama Lengkap, Nomor
                Telepon/WhatsApp, Alamat Email, serta Alamat Pengiriman Lengkap.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">2. Penggunaan & Keamanan Data</h3>
              <p>
                Data pelanggan digunakan semata-mata untuk pemrosesan pesanan, penerbitan
                nomor resi ekspedisi (GoSend, GrabExpress, JNE, J&T, SiCepat), serta layanan
                purna jual. Kami tidak pernah menjual atau membagikan data pelanggan kepada
                pihak ketiga di luar mitra logistik dan layanan pembayaran resmi (bank/QRIS).
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">3. Kontak Pengelola Data</h3>
              <p>
                Untuk permintaan perubahan atau penghapusan data pelanggan, hubungi email
                resmi kami di <strong>{settings.email}</strong> atau WhatsApp{' '}
                <strong>{settings.whatsappDisplay}</strong>.
              </p>
            </div>
          </>
        )}

        {activeTab === 'syarat' && (
          <>
            <h2 className="text-lg font-extrabold text-navy-800">
              Syarat & Ketentuan Layanan (Terms of Service)
            </h2>
            <p>
              Dengan berbelanja di situs resmi <strong>{STORE_DOMAIN}</strong>, pelanggan
              dianggap telah membaca, memahami, dan menyetujui ketentuan layanan berikut:
            </p>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">1. Keaslian Produk & Hak Cipta Desain</h3>
              <p>
                Seluruh ilustrasi arsitektur Landmark Simpang Tiga Cilegon dan tipografi
                merek “CILEGON ENGGIH” merupakan karya orisinal yang dilindungi hak cipta.
                Dilarang memperbanyak desain tanpa izin tertulis untuk tujuan komersial.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">2. Harga & Pembayaran</h3>
              <p>
                Seluruh harga produk tercantum dalam mata uang Rupiah (IDR). Pesanan eceran
                diproses setelah pembayaran <strong>transfer bank atau QRIS toko</strong>{' '}
                terverifikasi oleh admin (termasuk 3 digit kode unik pada nominal transfer).
                Untuk pemesanan Custom &amp; Korporat (B2B), produksi dimulai setelah
                konfirmasi mockup dan pembayaran uang muka (DP) minimal 50%.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">3. Jadwal Pengiriman</h3>
              <p>
                Pesanan produk ready stock sebelum pukul 16.00 WIB dikirim pada hari kerja
                yang sama dari {settings.addressShort}. Nomor resi kurir diinput setelah
                paket diserahkan ke ekspedisi (JNE / J&T / SiCepat / GoSend / GrabExpress)
                dan dapat dilacak pada halaman Lacak Pesanan.
              </p>
            </div>
          </>
        )}

        {activeTab === 'pengembalian' && (
          <>
            <h2 className="text-lg font-extrabold text-navy-800">
              Kebijakan Pengembalian Barang & Dana (Refund & Return Policy)
            </h2>
            <p>
              Kepuasan pelanggan adalah prioritas utama <strong>Cilegon Enggih</strong>. Kami
              memberikan jaminan perlindungan penuh atas setiap produk yang dikirimkan:
            </p>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">1. Garansi Ganti Baru 100% (Barang Rusak / Pecah)</h3>
              <p>
                Khusus produk Mug Keramik SNI, Lampu Tidur 3D Arsitektur, dan Tumbler:
                apabila produk diterima dalam keadaan pecah, retak, atau lampu LED tidak
                menyala, kami mengganti dengan unit baru <strong>100% GRATIS beserta ongkos kirim</strong>.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">2. Ketentuan Klaim & Tukar Ukuran Kaos</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Wajib menyertakan video unboxing utuh tanpa jeda maksimal 2x24 jam setelah paket berstatus diterima.</li>
                <li>Penukaran ukuran Kaos Distro dapat diajukan maksimal 3 hari selama produk belum dicuci dan label masih utuh.</li>
                <li>Pengembalian dana (Refund) penuh diproses maksimal 2 hari kerja apabila stok pengganti tidak tersedia.</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-navy-800">3. Saluran Pengajuan Klaim</h3>
              <p>
                Kirimkan nomor order beserta bukti video ke email{' '}
                <strong>{settings.email}</strong> atau WhatsApp Layanan Pelanggan Resmi{' '}
                <strong>{settings.whatsappDisplay}</strong>. Alamat surat menyurat:{' '}
                {settings.address}.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
