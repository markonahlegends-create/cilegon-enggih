/**
 * PENANGKAP GALAT TAMPILAN (error boundary).
 *
 * MASALAH YANG DISELESAIKAN
 * Sebelum ini tidak ada penangkap galat sama sekali: `grep -c ErrorBoundary`
 * di seluruh src/ hasilnya nol. Artinya satu galat JavaScript di satu
 * komponen mengosongkan SELURUH halaman — React melepas pohon DOM-nya dan
 * yang tersisa hanya latar putih kosong. Pembeli tidak melihat pesan, tidak
 * melihat tombol, tidak tahu harus berbuat apa; pemilik toko hanya melihat
 * "situsnya blank" tanpa petunjuk penyebabnya.
 *
 * APA YANG DILAKUKAN
 *   - Menampilkan pesan yang bisa dibaca manusia, bukan layar putih.
 *   - Memberi jalan keluar: muat ulang, atau kembali ke beranda.
 *   - Menyimpan sebabnya di sesi peramban supaya bisa diceritakan ke admin.
 *   - TIDAK menampilkan stack trace ke pembeli (itu membocorkan struktur
 *     internal dan tidak berguna bagi mereka).
 *
 * Catatan penting: penangkap galat TIDAK bisa menyelamatkan kegagalan
 * memuat berkas CSS/JS — itu terjadi sebelum React berjalan. Untuk kasus
 * itu, lihat scripts/test-build-integrity.mjs dan header Cache-Control HTML.
 */
import React from 'react';

interface Props {
  children: React.ReactNode;
  /** Nama bagian, untuk membedakan galat halaman vs galat satu panel. */
  bagian?: string;
}

interface State {
  galat: Error | null;
  kunciSesi: string;
}

const KUNCI_SIMPAN = 'ce-galat-terakhir';

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { galat: null, kunciSesi: '' };

  static getDerivedStateFromError(galat: Error): Partial<State> {
    return { galat };
  }

  componentDidCatch(galat: Error, info: React.ErrorInfo) {
    /*
     * Dicatat ke console (untuk pengembang) DAN ke sessionStorage (untuk
     * pemilik toko). Tanpa jejak ini, laporan "situs saya blank" tidak bisa
     * ditindaklanjuti sama sekali — persis yang terjadi pada keluhan
     * halaman tanpa gaya sebelumnya.
     */
    console.error('[tampilan] galat tak tertangkap:', galat, info?.componentStack);

    try {
      const jejak = {
        pesan: galat.message,
        bagian: this.props.bagian || 'aplikasi',
        waktu: new Date().toISOString(),
        jalur: typeof window !== 'undefined' ? window.location.pathname : '',
        komponen: String(info?.componentStack || '').slice(0, 800)
      };
      window.sessionStorage.setItem(KUNCI_SIMPAN, JSON.stringify(jejak));
      this.setState({ kunciSesi: jejak.waktu });
    } catch {
      /* sessionStorage bisa dilarang (mode privat) — jangan gagal lagi. */
    }
  }

  muatUlang = () => {
    /*
     * `location.reload()` biasa bisa memakai berkas dari cache yang rusak.
     * Memaksa permintaan baru memastikan aset diambil ulang dari server.
     */
    window.location.reload();
  };

  render() {
    if (!this.state.galat) return this.props.children;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-3 shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-2xl">
            ⚠️
          </div>
          <h1 className="text-base font-extrabold text-navy-800">
            Halaman ini gagal ditampilkan
          </h1>
          <p className="text-xs leading-relaxed text-slate-600">
            Ada bagian yang tidak bisa dimuat. Produk dan pesanan Anda{' '}
            <strong>tidak terpengaruh</strong> — silakan muat ulang halaman ini.
          </p>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={this.muatUlang}
              className="w-full rounded-xl bg-forest-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-forest-700"
            >
              Muat Ulang Halaman
            </button>
            <a
              href="/"
              className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              Kembali ke Beranda
            </a>
          </div>

          {/*
            Sebab ditampilkan dalam bentuk yang bisa DICERITAKAN ke admin,
            tanpa stack trace mentah. Pembeli cukup menyebutkan kode waktu.
          */}
          {this.state.kunciSesi && (
            <p className="text-[10px] text-slate-400">
              Bila masih gagal, hubungi admin dan sebutkan waktu ini:{' '}
              <span className="font-mono">{this.state.kunciSesi}</span>
            </p>
          )}
        </div>
      </div>
    );
  }
}

/**
 * Pembungkus untuk bagian kecil di dalam halaman.
 *
 * Galat di satu panel (mis. kalkulator ongkir) tidak boleh mengosongkan
 * seluruh halaman produk — pembeli masih bisa membaca dan memesan.
 */
export const PanelAman: React.FC<{ children: React.ReactNode; bagian?: string }> = ({
  children,
  bagian
}) => (
  <ErrorBoundary bagian={bagian}>{children}</ErrorBoundary>
);
