import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Info,
  LogOut,
  Package,
  PackageCheck,
  RefreshCcw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Wallet
} from 'lucide-react';
import { formatRupiah } from '../data/products';
import {
  ApiError,
  buyerLogout,
  buyerOrders,
  buyerRequestOtp,
  buyerSession,
  buyerVerifyOtp,
  type BuyerOrder,
  type BuyerOrderSummary
} from '../lib/api';

/**
 * HALAMAN "PESANAN SAYA"
 *
 * Kenapa halaman ini ada
 * ----------------------
 * Pembeli yang memesan 5 barang di waktu berbeda tidak punya tempat untuk
 * melihat semuanya sekaligus. Satu-satunya cara sebelumnya: buka Lacak
 * Pesanan, ketik nomor pesanan, ulangi. Lima pesanan = lima kali kerja, dan
 * tetap tidak ada jawaban untuk "apakah ada uang saya yang sedang dikembalikan?".
 *
 * Prinsip yang dipegang di sini
 * -----------------------------
 * 1. AKUN OPSIONAL. Halaman ini tidak pernah memblokir checkout. Pembeli yang
 *    tidak mau mendaftar tetap bisa memesan dan tetap bisa memakai halaman
 *    Lacak Pesanan seperti biasa. Halaman ini hanya menawarkan kenyamanan.
 * 2. Verifikasi lewat nomor WhatsApp yang SUDAH dipakai saat memesan, supaya
 *    riwayat langsung lengkap — tanpa perlu memigrasikan data apa pun.
 * 3. Tidak ada password. Tidak ada form panjang. Hanya nomor + 6 digit.
 */

const LABEL_STATUS: Record<string, string> = {
  MENUNGGU_KONFIRMASI: 'Menunggu konfirmasi',
  DIPROSES: 'Sedang disiapkan',
  DIKIRIM: 'Sedang dikirim',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan'
};

const tanggal = (iso?: string | null) => {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(iso));
  } catch {
    return '—';
  }
};

/** Warna & ikon mengikuti satu pertanyaan: "pembeli harus berbuat apa sekarang?" */
const nadaStatus = (order: BuyerOrder) => {
  if (order.status === 'DIBATALKAN') return 'bg-slate-100 text-slate-600 border-slate-200';
  if (order.paymentStatus !== 'LUNAS') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (order.status === 'DIKIRIM') return 'bg-sky-50 text-sky-800 border-sky-200';
  if (order.status === 'SELESAI') return 'bg-forest-50 text-forest-800 border-forest-200';
  return 'bg-forest-50 text-forest-700 border-forest-200';
};

const KartuRingkasan: React.FC<{ ikon: React.ReactNode; label: string; nilai: string; catatan?: string }> = ({
  ikon,
  label,
  nilai,
  catatan
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4">
    <div className="flex items-center gap-2 text-slate-500 text-xs font-medium uppercase tracking-wide">
      {ikon}
      {label}
    </div>
    <p className="mt-2 text-xl font-semibold text-slate-900">{nilai}</p>
    {catatan ? <p className="mt-1 text-xs text-slate-500">{catatan}</p> : null}
  </div>
);

const KartuPesanan: React.FC<{ order: BuyerOrder }> = ({ order }) => {
  const [bukaRiwayat, setBukaRiwayat] = useState(false);
  const perluBayar = order.paymentStatus !== 'LUNAS' && order.status !== 'DIBATALKAN';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="font-semibold text-slate-900">{order.orderId}</p>
          <p className="text-xs text-slate-500">
            {tanggal(order.createdAt)} · {order.invoiceNumber || 'tanpa invoice'}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${nadaStatus(order)}`}>
          {LABEL_STATUS[order.status] || order.status}
        </span>
      </header>

      <div className="px-4 py-3 space-y-2">
        {(order.items || []).map((it, i) => (
          <div key={`${order.orderId}-${i}`} className="flex justify-between gap-3 text-sm">
            <span className="text-slate-700">
              {it.name}
              {it.optionsLabel ? <span className="text-slate-400"> · {it.optionsLabel}</span> : null}
            </span>
            <span className="text-slate-500 shrink-0">
              {it.qty} × {formatRupiah(it.price)}
            </span>
          </div>
        ))}
      </div>

      {/*
        Tiga keadaan yang benar-benar ditanyakan pembeli lewat WhatsApp:
        "sudah dibayar belum", "barangnya di mana", "uang saya kembali tidak".
        Ditulis sebagai kalimat, bukan kode status.
      */}
      <div className="mx-4 mb-3 space-y-2">
        {perluBayar ? (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Belum dibayar. Buka detail pesanan untuk menyelesaikan pembayaran (QRIS / Virtual Account).
            </span>
          </p>
        ) : null}

        {order.refund === 'diproses' ? (
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <RefreshCcw className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Pesanan dibatalkan setelah pembayaran diterima. Pengembalian dana sedang diproses admin ke rekening
              Anda. Status ini akan berubah menjadi &ldquo;dana sudah dikembalikan&rdquo; setelah selesai.
            </span>
          </p>
        ) : null}

        {order.refund === 'selesai' ? (
          <p className="flex items-start gap-2 rounded-xl bg-forest-50 px-3 py-2 text-xs text-forest-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Dana untuk pesanan yang dibatalkan sudah dikembalikan.</span>
          </p>
        ) : null}

        {order.status === 'DIKIRIM' && order.resi ? (
          <p className="flex items-start gap-2 rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <Truck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Dikirim via {order.courier || 'kurir'} · resi <strong>{order.resi}</strong>
              {order.trackingLinks?.utama ? (
                <a
                  href={order.trackingLinks.utama}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 underline inline-flex items-center gap-0.5"
                >
                  lacak <ExternalLink className="w-3 h-3" />
                </a>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
        <div className="text-sm">
          <span className="text-slate-500">Total </span>
          <span className="font-semibold text-slate-900">{formatRupiah(order.totalAmount)}</span>
          <span className={`ml-2 text-xs ${order.paymentStatus === 'LUNAS' ? 'text-forest-700' : 'text-amber-700'}`}>
            {order.paymentStatus === 'LUNAS' ? 'Lunas' : 'Belum lunas'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setBukaRiwayat((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
          >
            {bukaRiwayat ? 'Tutup riwayat' : 'Lihat riwayat'}
          </button>
          <Link
            to={`/lacak-pesanan?q=${encodeURIComponent(order.orderId)}`}
            className="rounded-lg bg-forest-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-800"
          >
            Buka pesanan
          </Link>
        </div>
      </footer>

      {bukaRiwayat ? (
        <ul className="space-y-2 border-t border-slate-100 px-4 py-3">
          {(order.timeline || []).length === 0 ? (
            <li className="text-xs text-slate-500">Belum ada catatan.</li>
          ) : (
            (order.timeline || []).map((t, i) => (
              <li key={`${order.orderId}-t-${i}`} className="flex gap-2 text-xs text-slate-600">
                <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  <span className="text-slate-400">{tanggal(t.at)}</span> — {t.note}
                </span>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </article>
  );
};

/** Form masuk: nomor → kode. Dua langkah saja, tanpa password. */
const FormMasuk: React.FC<{ onMasuk: () => void }> = ({ onMasuk }) => {
  const [langkah, setLangkah] = useState<'nomor' | 'kode'>('nomor');
  const [nomor, setNomor] = useState('');
  const [kode, setKode] = useState('');
  const [nomorMasked, setNomorMasked] = useState('');
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [sibuk, setSibuk] = useState(false);

  const mintaKode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSibuk(true);
    try {
      const res = await buyerRequestOtp(nomor);
      setNomorMasked(res.nomorMasked);
      setLangkah('kode');
      setInfo(res.pesan);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim kode. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  const verifikasi = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSibuk(true);
    try {
      await buyerVerifyOtp(nomor, kode);
      onMasuk();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Verifikasi gagal. Coba lagi.');
    } finally {
      setSibuk(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
            <ShieldCheck className="w-6 h-6" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Pesanan Saya</h1>
            <p className="text-sm text-slate-500">Semua pesanan Anda di satu tempat.</p>
          </div>
        </div>

        {langkah === 'nomor' ? (
          <form onSubmit={mintaKode} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Nomor WhatsApp saat memesan</span>
              <input
                type="tel"
                inputMode="tel"
                required
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </label>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={sibuk}
              className="w-full rounded-xl bg-forest-700 px-4 py-3 font-semibold text-white hover:bg-forest-800 disabled:opacity-60"
            >
              {sibuk ? 'Mengirim…' : 'Kirim kode verifikasi'}
            </button>
            <p className="text-xs text-slate-500">
              Kami tidak meminta password. Kode 6 digit dikirim <strong>langsung ke WhatsApp</strong> nomor
              yang Anda masukkan — tidak lewat admin, jadi tidak ada yang bisa membacanya selain Anda.
              Nomor ini juga yang dipakai untuk melacak pesanan, jadi riwayat lama Anda langsung muncul.
            </p>
          </form>
        ) : (
          <form onSubmit={verifikasi} className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              Kode dikirim untuk nomor <strong>{nomorMasked}</strong>.
            </p>
            {/*
              Jalur pengiriman ditampilkan apa adanya.
              Kalau gateway WhatsApp belum diatur, pembeli harus tahu kodenya
              lewat admin — bukan menunggu pesan WhatsApp yang tidak akan datang.
            */}
            {info ? <p className="text-xs text-slate-500">{info}</p> : null}
            <label className="block">
              <span className="text-sm font-medium text-slate-700">6 digit kode</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={kode}
                onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))}
                placeholder="••••••"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.5em] text-slate-900 outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
              />
            </label>
            {info ? <p className="text-sm text-forest-700">{info}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
              type="submit"
              disabled={sibuk || kode.length !== 6}
              className="w-full rounded-xl bg-forest-700 px-4 py-3 font-semibold text-white hover:bg-forest-800 disabled:opacity-60"
            >
              {sibuk ? 'Memeriksa…' : 'Masuk'}
            </button>
            <button
              type="button"
              onClick={() => {
                setLangkah('nomor');
                setKode('');
                setError('');
              }}
              className="w-full text-sm text-slate-500 hover:text-slate-700"
            >
              Ganti nomor
            </button>
          </form>
        )}
      </div>

      {/*
        Penting: jangan sampai pembeli mengira akun ini syarat untuk memesan.
        Tanpa kalimat ini, halaman login di depan riwayat pesanan mudah dibaca
        sebagai "harus daftar dulu".
      */}
      <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <span>
          Akun ini <strong>opsional</strong>. Anda tetap bisa memesan tanpa mendaftar. Halaman ini hanya untuk
          menyimpan riwayat agar tidak perlu mengetik nomor pesanan satu per satu — dan agar bisa dibuka dari
          perangkat lain.
        </span>
      </p>
    </div>
  );
};

const PesananSayaPage: React.FC = () => {
  const [params] = useSearchParams();
  const [memuat, setMemuat] = useState(true);
  const [sesi, setSesi] = useState<{ loggedIn: boolean; nama?: string; nomorMasked?: string }>({ loggedIn: false });
  const [ringkasan, setRingkasan] = useState<BuyerOrderSummary | null>(null);
  const [daftar, setDaftar] = useState<BuyerOrder[]>([]);
  const [error, setError] = useState('');
  const [cari, setCari] = useState(params.get('q') || '');
  const [salin, setSalin] = useState(false);

  const muat = async () => {
    setMemuat(true);
    setError('');
    try {
      const s = await buyerSession();
      setSesi(s);
      if (s.loggedIn) {
        const data = await buyerOrders();
        setRingkasan(data.ringkasan);
        setDaftar(data.orders);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data pesanan.');
    } finally {
      setMemuat(false);
    }
  };

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    if (!q) return daftar;
    return daftar.filter(
      (o) =>
        o.orderId.toLowerCase().includes(q) ||
        (o.invoiceNumber || '').toLowerCase().includes(q) ||
        (o.resi || '').toLowerCase().includes(q) ||
        (o.items || []).some((it) => it.name.toLowerCase().includes(q))
    );
  }, [daftar, cari]);

  const keluar = async () => {
    await buyerLogout().catch(() => null);
    setSesi({ loggedIn: false });
    setDaftar([]);
    setRingkasan(null);
  };

  const salinDaftar = async () => {
    const teks = tersaring
      .map((o) => `${o.orderId} · ${LABEL_STATUS[o.status] || o.status} · ${formatRupiah(o.totalAmount)}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(teks);
      setSalin(true);
      setTimeout(() => setSalin(false), 2000);
    } catch {
      /* clipboard bisa diblokir — biarkan, tidak kritis */
    }
  };

  if (memuat) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-slate-500">
        <Package className="mx-auto mb-3 h-8 w-8 animate-pulse text-slate-300" />
        Memuat pesanan Anda…
      </div>
    );
  }

  if (!sesi.loggedIn) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <FormMasuk onMasuk={() => void muat()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pesanan Saya</h1>
          <p className="text-sm text-slate-500">
            {sesi.nama ? `Halo, ${sesi.nama}. ` : ''}Nomor {sesi.nomorMasked}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void muat()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            <RefreshCcw className="w-4 h-4" /> Muat ulang
          </button>
          <button
            type="button"
            onClick={() => void keluar()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white"
          >
            <LogOut className="w-4 h-4" /> Keluar
          </button>
        </div>
      </div>

      {error ? (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {ringkasan ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KartuRingkasan
            ikon={<ShoppingBag className="w-4 h-4" />}
            label="Total pesanan"
            nilai={String(ringkasan.total)}
            catatan={`Belanja lunas ${formatRupiah(ringkasan.totalBelanjaLunas)}`}
          />
          <KartuRingkasan
            ikon={<Wallet className="w-4 h-4" />}
            label="Perlu dibayar"
            nilai={String(ringkasan.perluDibayar)}
            catatan={ringkasan.perluDibayar > 0 ? 'Selesaikan pembayaran Anda' : 'Tidak ada tagihan'}
          />
          <KartuRingkasan
            ikon={<Truck className="w-4 h-4" />}
            label="Sedang dikirim"
            nilai={String(ringkasan.dikirim)}
            catatan={`${ringkasan.selesai} pesanan sudah selesai`}
          />
          <KartuRingkasan
            ikon={<RefreshCcw className="w-4 h-4" />}
            label="Pengembalian dana"
            nilai={String(ringkasan.refundDiproses)}
            catatan={ringkasan.refundDiproses > 0 ? 'Sedang diproses admin' : 'Tidak ada'}
          />
        </div>
      ) : null}

      {daftar.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nomor pesanan, resi, atau nama barang"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-100"
            />
          </div>
          <button
            type="button"
            onClick={() => void salinDaftar()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-white"
          >
            <Copy className="w-4 h-4" /> {salin ? 'Tersalin' : 'Salin daftar'}
          </button>
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        {daftar.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <PackageCheck className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="font-medium text-slate-800">Belum ada pesanan untuk nomor ini.</p>
            <p className="mt-1 text-sm text-slate-500">
              Kalau Anda memesan dengan nomor WhatsApp lain, keluar lalu masuk dengan nomor tersebut.
            </p>
            <Link
              to="/katalog"
              className="mt-4 inline-block rounded-xl bg-forest-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest-800"
            >
              Mulai belanja
            </Link>
          </div>
        ) : tersaring.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
            Tidak ada pesanan yang cocok dengan &ldquo;{cari}&rdquo;.
          </p>
        ) : (
          tersaring.map((o) => <KartuPesanan key={o.orderId} order={o} />)
        )}
      </div>
    </div>
  );
};

export default PesananSayaPage;
