/**
 * PANEL PEMBAYARAN — satu komponen untuk semua tempat.
 *
 * Dipakai di dua tempat:
 *   1. CheckoutModal  — tepat setelah pesanan dibuat
 *   2. TrackOrderPage — saat pembeli kembali ke pesanannya (dari tautan
 *                       di email/riwayat peramban, atau setelah menutup popup
 *                       Midtrans)
 *
 * KENAPA DIPISAH
 * Sebelumnya seluruh logika pembayaran hanya ada di CheckoutModal. Akibatnya
 * pembeli yang menutup popup Snap TIDAK punya jalan kembali ke tagihannya —
 * dan pesanan menggantung selamanya. Marketplace seperti Tokopedia/Shopee
 * selalu menyediakan "Lanjutkan Pembayaran" dari halaman pesanan.
 *
 * TIGA PRINSIP YANG DIPEGANG
 *
 *  1. `onSuccess` dari Snap BUKAN bukti lunas. Setelah callback itu, layar
 *     hanya menampilkan "menunggu konfirmasi" dan menanyakan status ke server.
 *  2. Hitung mundur hanya untuk tampilan. Yang menentukan kedaluwarsa tetap
 *     Midtrans; server tidak pernah menolak pembayaran berdasarkan jam lokal
 *     pembeli.
 *  3. Selalu ada jalan keluar: bayar lagi, periksa status, atau batalkan.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle
} from 'lucide-react';
import { cancelUnpaidOrder } from '../lib/api';
import { useMidtransSnap, type SnapOutcome } from '../lib/midtransSnap';
import { formatRupiah } from '../data/products';

interface Props {
  orderId: string;
  totalAmount: number;
  /** 4 digit terakhir No. WhatsApp — bukti kedua untuk cek status & batal. */
  phoneLast4: string;
  /** Batas waktu pembayaran dalam jam (dari pengaturan toko). */
  windowHours?: number;
  createdAt?: string;
  /** Dipanggil setiap status berubah, supaya halaman induk ikut segar. */
  onStatusChange?: (paymentStatus: string, gateway?: any) => void;
  onCancelled?: () => void;
  /** Buka popup Midtrans otomatis saat panel pertama tampil (setelah checkout). */
  autoOpen?: boolean;
  pushToast?: (title: string, message: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

/** "23:52:25" — sisa waktu, hanya untuk tampilan. */
const sisaWaktu = (batas: number, sekarang: number) => {
  const sisa = Math.max(0, batas - sekarang);
  const jam = Math.floor(sisa / 3_600_000);
  const menit = Math.floor((sisa % 3_600_000) / 60_000);
  const detik = Math.floor((sisa % 60_000) / 1000);
  return { teks: `${jam}j ${menit}m ${detik}d`, habis: sisa <= 0 };
};

export const PaymentPanel: React.FC<Props> = ({
  orderId,
  totalAmount,
  phoneLast4,
  windowHours = 24,
  createdAt,
  onStatusChange,
  onCancelled,
  autoOpen = false,
  pushToast
}) => {
  const snap = useMidtransSnap();
  const [outcome, setOutcome] = useState<SnapOutcome | null>(null);
  const [memeriksa, setMemeriksa] = useState(false);
  const [lunas, setLunas] = useState(false);
  const [membatalkan, setMembatalkan] = useState(false);
  const [konfirmasiBatal, setKonfirmasiBatal] = useState(false);
  const [kedaluwarsa, setKedaluwarsa] = useState<string | null>(null);
  /*
   * Alasan gateway gagal memeriksa status. SENGAJA DITAMPILKAN, bukan hanya
   * dilempar ke toast: kalau pembeli sudah membayar tetapi status tidak bisa
   * dipastikan, menyembunyikan sebabnya persis yang membuat orang menghubungi
   * admin tanpa informasi apa pun.
   */
  const [alasanGagal, setAlasanGagal] = useState<string | null>(null);
  const [dibatalkan, setDibatalkan] = useState(false);
  const [sekarang, setSekarang] = useState(() => Date.now());
  const diprosesRef = useRef(false);

  /*
   * Hitung mundur. Sengaja hanya untuk tampilan: kalau jam perangkat pembeli
   * salah, yang tetap berlaku adalah keputusan Midtrans di server.
   */
  const batas = useMemo(() => {
    const mulai = createdAt ? new Date(createdAt).getTime() : Date.now();
    return (Number.isFinite(mulai) ? mulai : Date.now()) + windowHours * 3_600_000;
  }, [createdAt, windowHours]);

  useEffect(() => {
    if (lunas) return;
    const id = window.setInterval(() => setSekarang(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lunas]);

  const sisa = sisaWaktu(batas, sekarang);

  const periksaStatus = useCallback(
    async (otomatis = false) => {
      if (diprosesRef.current) return;
      diprosesRef.current = true;
      setMemeriksa(true);
      setAlasanGagal(null);
      try {
        const hasil = await snap.checkStatus(orderId, phoneLast4);
        if (hasil.paymentStatus === 'LUNAS') {
          setLunas(true);
          onStatusChange?.('LUNAS', hasil.gateway);
          if (!otomatis) pushToast?.('Pembayaran Lunas', 'Pesanan Anda sudah lunas.', 'success');
        } else if (hasil.kedaluwarsa) {
          /*
           * Tagihan sudah mati di Midtrans. Beri tahu apa adanya + arahkan ke
           * tombol bayar lagi; jangan biarkan pembeli menebak-nebak.
           */
          setKedaluwarsa(hasil.kedaluwarsa);
          if (!otomatis) {
            pushToast?.(
              hasil.kedaluwarsa === 'kedaluwarsa' ? 'Tagihan Kedaluwarsa' : 'Tagihan Dibatalkan',
              'Tagihan ini sudah tidak aktif. Tekan "Buat Tagihan Baru" untuk membayar dengan kode baru.',
              'info'
            );
          }
        } else if (hasil.gateway && hasil.gateway.ok === false) {
          /*
           * Midtrans menjawab tetapi menolak (mis. 404). Pembeli TIDAK boleh
           * dibiarkan mengira tombolnya berfungsi: katakan apa adanya, dan
           * jangan menyarankan membayar lagi.
           */
          const alasan =
            hasil.gateway.alasan ||
            `Midtrans belum bisa memastikan pembayaran ini${
              hasil.gateway.httpStatus ? ` (HTTP ${hasil.gateway.httpStatus})` : ''
            }.`;
          setAlasanGagal(alasan);
          if (!otomatis) {
            pushToast?.('Status Belum Bisa Dipastikan', alasan, 'warning');
          }
        } else if (hasil.kunciCocok === false) {
          /*
           * Midtrans MENJAWAB, tetapi kunci di server bukan kunci akun tempat
           * transaksi ini dibuat — jadi notifikasi pembayaran akan selalu
           * ditolak dan pesanan tidak akan pernah lunas otomatis.
           *
           * Pembeli tidak bisa memperbaiki ini, dan tidak boleh dibiarkan
           * menekan tombol berulang kali. Yang bisa ia lakukan: hubungi admin
           * lewat Bantuan. Sebabnya ikut ditampilkan supaya admin langsung
           * tahu apa yang harus diganti.
           */
          const alasan =
            'Pembayaran Anda sudah masuk di Midtrans, tetapi sistem toko belum bisa memverifikasinya karena kunci pembayaran di server tidak cocok dengan akun Midtrans toko. Ini masalah di sisi toko, BUKAN pada pembayaran Anda — tidak perlu membayar ulang. Hubungi admin lewat tombol Bantuan dan sebutkan nomor pesanan ini.';
          setAlasanGagal(alasan);
          if (!otomatis) {
            pushToast?.('Perlu Bantuan Admin', alasan, 'warning');
          }
        } else if (hasil.nominalTidakCocok) {
          pushToast?.(
            'Nominal Tidak Cocok',
            'Pembayaran yang masuk berbeda dari total tagihan. Hubungi admin agar bisa dicocokkan.',
            'warning'
          );
        } else if (!otomatis) {
          pushToast?.(
            'Belum Lunas',
            'Pembayaran belum kami terima. Kalau Anda baru saja membayar, tunggu beberapa saat lalu periksa lagi.',
            'info'
          );
        }
      } catch (err) {
        if (!otomatis) {
          const pesan = err instanceof Error ? err.message : 'Gagal memeriksa status.';
          pushToast?.('Gagal Memeriksa', pesan, 'warning');
        }
      } finally {
        setMemeriksa(false);
        diprosesRef.current = false;
      }
    },
    [orderId, phoneLast4, snap, onStatusChange, pushToast]
  );

  /*
   * Setelah popup Snap menyatakan sukses, TANYAKAN ke server — jangan pernah
   * menganggap lunas berdasarkan callback peramban saja. Webhook Midtrans
   * biasanya sudah masuk dalam hitungan detik; kalau belum, periksa sekali
   * lagi setelah 4 detik.
   */
  useEffect(() => {
    if (outcome !== 'success' && outcome !== 'pending') return;
    periksaStatus(true);
    const id = window.setTimeout(() => periksaStatus(true), 4000);
    return () => window.clearTimeout(id);
  }, [outcome, periksaStatus]);

  const batalkan = async () => {
    setMembatalkan(true);
    try {
      await cancelUnpaidOrder(orderId, phoneLast4);
      setDibatalkan(true);
      pushToast?.('Pesanan Dibatalkan', 'Stok sudah dikembalikan ke toko.', 'info');
      onCancelled?.();
    } catch (err) {
      const pesan = err instanceof Error ? err.message : 'Gagal membatalkan pesanan.';
      pushToast?.('Gagal Membatalkan', pesan, 'warning');
    } finally {
      setMembatalkan(false);
      setKonfirmasiBatal(false);
    }
  };

  /*
   * Buka popup otomatis SETELAH pesanan dibuat.
   *
   * Dijalankan sekali saja (penanda ref), dan tidak pernah untuk pesanan yang
   * dibuka dari halaman lacak — di sana pembeli sengaja datang untuk melihat
   * status, bukan untuk ditagih lagi.
   */
  const autoDibuka = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoDibuka.current || lunas) return;
    autoDibuka.current = true;
    snap.bayar(orderId, (hasil) => setOutcome(hasil));
    // sengaja hanya sekali; `snap` & `lunas` berubah tanpa perlu memicu ulang
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen, orderId, lunas]);

  /* ---------- Dibatalkan pembeli ---------- */
  if (dibatalkan) {
    return (
      <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-5 text-center space-y-2">
        <XCircle className="w-10 h-10 text-slate-500 mx-auto" />
        <div className="text-sm font-extrabold text-navy-800">Pesanan Dibatalkan</div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Pesanan <strong>{orderId}</strong> sudah dibatalkan dan stoknya dikembalikan ke toko.
          Kode pembayaran lama juga sudah dinonaktifkan. Kalau berubah pikiran, silakan buat
          pesanan baru dari katalog.
        </p>
      </div>
    );
  }

  /* ---------- Sudah lunas ---------- */
  if (lunas) {
    return (
      <div className="rounded-2xl border-2 border-forest-600 bg-forest-50 p-5 text-center space-y-2">
        <CheckCircle2 className="w-10 h-10 text-forest-600 mx-auto" />
        <div className="text-sm font-extrabold text-forest-800">Pembayaran Lunas</div>
        <p className="text-[11px] text-forest-700 leading-relaxed">
          Terima kasih. Pesanan <strong>{orderId}</strong> sudah masuk antrean proses dan akan
          segera kami siapkan. Status bisa Anda pantau di halaman ini.
        </p>
      </div>
    );
  }

  /* ---------- Belum lunas ---------- */
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      {/* Kepala: total + hitung mundur */}
      <div className="bg-amberbrand-50 border-b border-amberbrand-200 p-4 text-center">
        <div className="text-[11px] text-amberbrand-900">Total yang harus dibayar</div>
        <div className="text-2xl font-extrabold text-navy-800 tracking-tight">
          {formatRupiah(totalAmount)}
        </div>
        <div
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold mt-1 ${
            sisa.habis ? 'text-red-700' : 'text-amberbrand-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          {sisa.habis ? 'Batas waktu pembayaran sudah lewat' : `Bayar dalam ${sisa.teks}`}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {outcome === 'success' && (
          <div className="flex items-start gap-2 text-xs text-forest-800 bg-forest-50 border border-forest-200 rounded-xl p-3">
            <Loader2 className="w-4 h-4 shrink-0 mt-0.5 animate-spin" />
            <span>
              Pembayaran diterima Midtrans. Kami sedang memastikan statusnya — halaman ini
              diperbarui otomatis, tidak perlu menekan apa pun.
            </span>
          </div>
        )}

        {outcome === 'pending' && (
          <div className="flex items-start gap-2 text-xs text-amberbrand-900 bg-amberbrand-50 border border-amberbrand-200 rounded-xl p-3">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Menunggu pembayaran Anda selesai. Kalau sudah dibayar, status berubah otomatis —
              tidak perlu kirim bukti transfer.
            </span>
          </div>
        )}

        {outcome === 'closed' && (
          <div className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Jendela pembayaran ditutup. Pesanan Anda <strong>tetap tersimpan</strong> — tekan
              tombol di bawah untuk membuka pembayaran lagi.
            </span>
          </div>
        )}

        {outcome === 'error' && (
          <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{snap.galat || 'Pembayaran belum berhasil.'} Anda bisa mencoba lagi.</span>
          </div>
        )}

        {alasanGagal && !lunas && (
          <div className="flex items-start gap-2 text-xs text-amberbrand-900 bg-amberbrand-50 border border-amberbrand-300 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {alasanGagal}{' '}
              <strong>Kalau Anda sudah membayar</strong>, tunjukkan pesan ini ke admin — kami bisa
              mencocokkan pembayaran Anda secara manual tanpa Anda perlu membayar dua kali.
            </span>
          </div>
        )}

        {kedaluwarsa && (
          <div className="flex items-start gap-2 text-xs text-amberbrand-900 bg-amberbrand-50 border border-amberbrand-300 rounded-xl p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {kedaluwarsa === 'kedaluwarsa'
                ? 'Batas waktu pembayaran sudah lewat, jadi tagihan lama tidak bisa dipakai lagi.'
                : 'Tagihan lama sudah dibatalkan oleh sistem pembayaran.'}{' '}
              Pesanan Anda <strong>tetap tersimpan</strong> — tekan tombol di bawah untuk membuat
              kode pembayaran baru.
            </span>
          </div>
        )}

        {/*
          TAGIHAN LAMA DIPAKAI ULANG.

          Pembeli yang menunda pembayaran lalu kembali beberapa jam kemudian
          akan menerima tagihan yang SAMA — bukan kode baru. Ini disengaja:
          kalau ia sudah menyimpan atau memotret QRIS, kode itu tetap berlaku.
          Tanpa penjelasan, pembeli justru bingung melihat angka yang sama
          dan mengira sistemnya tidak bekerja.
        */}
        {snap.tagihan?.reused && (
          <div className="flex items-start gap-2 text-xs text-sky-800 bg-sky-50 border border-sky-200 rounded-xl p-3">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Ini <strong>tagihan yang sama</strong> seperti sebelumnya. Kalau Anda sempat
              menyimpan kode QRIS atau nomor Virtual Account, itu masih berlaku — tidak perlu
              meminta kode baru.
            </span>
          </div>
        )}

        {/*
          TAUTAN TAGIHAN — KUNCI UNTUK PEMBAYARAN YANG DITUNDA.

          Popup Snap mudah tertutup dan tidak bisa dibuka kembali tanpa token
          baru. Tautan ini membuka halaman pembayaran Midtrans dengan token
          yang sedang berlaku, jadi pembeli bisa menyimpannya (bookmark /
          WhatsApp ke diri sendiri) dan kembali kapan saja sebelum tagihan
          kedaluwarsa — termasuk dari perangkat lain.
        */}
        {snap.tagihan?.redirectUrl && (
          <a
            href={snap.tagihan.redirectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 rounded-xl bg-white border border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Buka Halaman Pembayaran (bisa disimpan)
          </a>
        )}

        <button
          type="button"
          onClick={async () => {
            setOutcome(null);
            setKedaluwarsa(null);
            await snap.bayar(orderId, (hasil) => setOutcome(hasil));
          }}
          disabled={snap.sedangMenyiapkan}
          className="w-full py-3.5 px-6 rounded-xl bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white font-extrabold text-sm shadow-sm transition-colors inline-flex items-center justify-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          {snap.sedangMenyiapkan
            ? 'Membuka pembayaran...'
            : kedaluwarsa
              ? 'Buat Tagihan Baru'
              : outcome === 'closed' || outcome === 'error'
                ? 'Coba Bayar Lagi'
                : 'Pilih Metode Pembayaran'}
        </button>

        <button
          type="button"
          onClick={() => periksaStatus(false)}
          disabled={memeriksa}
          className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-60 text-slate-700 text-xs font-bold inline-flex items-center justify-center gap-1.5"
        >
          {memeriksa ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {memeriksa ? 'Memeriksa status...' : 'Saya Sudah Bayar — Periksa Status'}
        </button>

        {/* Batalkan pesanan — setara marketplace, mencegah pesanan menggantung */}
        {!konfirmasiBatal ? (
          <button
            type="button"
            onClick={() => setKonfirmasiBatal(true)}
            className="w-full py-2 text-[11px] font-semibold text-slate-500 hover:text-red-700 transition-colors"
          >
            Batalkan pesanan ini
          </button>
        ) : (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
            <div className="flex items-start gap-2 text-[11px] text-red-800">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Yakin membatalkan? Pesanan <strong>{orderId}</strong> akan dibatalkan dan tidak
                bisa dibayar lagi.
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setKonfirmasiBatal(false)}
                disabled={membatalkan}
                className="py-2 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700"
              >
                Tidak, lanjutkan
              </button>
              <button
                type="button"
                onClick={batalkan}
                disabled={membatalkan}
                className="py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-[11px] font-bold text-white inline-flex items-center justify-center gap-1"
              >
                {membatalkan ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {membatalkan ? 'Membatalkan...' : 'Ya, batalkan'}
              </button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-slate-500 text-center leading-relaxed flex items-center justify-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          Pembayaran diproses <strong>Midtrans</strong> — QRIS, GoPay, ShopeePay, Virtual Account,
          atau kartu.
        </p>
      </div>
    </div>
  );
};

export default PaymentPanel;
