import React, { useEffect, useState } from 'react';
import { Check, Copy, EyeOff, Link2, ShieldCheck } from 'lucide-react';
import { isTrackingOptedOut, setTrackingOptOut } from '../lib/tracker';

/**
 * Alat bantu analitik untuk pemilik toko.
 *
 * Dua masalah nyata yang diselesaikan di sini:
 *
 * 1. KUNJUNGAN SENDIRI MENGOTORI DATA.
 *    Pemilik & karyawan sering membuka situs sendiri, sehingga "jam ramai"
 *    dan "sumber trafik" jadi bias. Tombol di bawah mengecualikan perangkat
 *    ini saja — tidak ada data yang dikirim ke server.
 *
 * 2. REFERRER HILANG DARI INSTAGRAM / WHATSAPP.
 *    Browser dalam aplikasi IG/TikTok tidak mengirim referrer, jadi semua
 *    kunjungan terlihat "langsung". Solusinya: pakai link dengan parameter
 *    ?src=..., yang dibaca langsung oleh pencatat event.
 */

const CHANNELS: { id: string; label: string; note: string }[] = [
  { id: 'ig-bio', label: 'Instagram — bio', note: 'Link di bio profil' },
  { id: 'ig-story', label: 'Instagram — story', note: 'Sticker link di story' },
  { id: 'tiktok-bio', label: 'TikTok — bio', note: 'Link di bio TikTok' },
  { id: 'wa-broadcast', label: 'WhatsApp — broadcast', note: 'Pesan broadcast / status' },
  { id: 'wa-katalog', label: 'WhatsApp — katalog', note: 'Balasan chat ke pembeli' },
  { id: 'fb-page', label: 'Facebook — halaman', note: 'Postingan / bio halaman' },
  { id: 'offline-qr', label: 'QR — offline', note: 'Kartu nama / kemasan / spanduk' }
];

const baseUrl = () => {
  try {
    return window.location.origin;
  } catch {
    return 'https://cilegon-enggih.vercel.app';
  }
};

export const AnalyticsTools: React.FC = () => {
  const [optedOut, setOptedOut] = useState(false);
  const [channel, setChannel] = useState(CHANNELS[0].id);
  const [path, setPath] = useState('/');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOptedOut(isTrackingOptedOut());
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const campaignUrl = `${baseUrl()}${path.startsWith('/') ? path : `/${path}`}?src=${channel}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(campaignUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {/* --- Pengecualian perangkat sendiri --- */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-forest-600 mt-0.5">
            <EyeOff className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-navy-800">
              Jangan catat kunjungan dari perangkat ini
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Nyalakan di HP & laptop milik Anda dan karyawan. Tanpa ini, kunjungan sendiri membuat
              angka jam ramai dan sumber trafik jadi menyesatkan.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            const next = !optedOut;
            setTrackingOptOut(next);
            setOptedOut(next);
          }}
          className={`mt-1 w-full py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 border ${
            optedOut
              ? 'bg-navy-800 text-white border-navy-800'
              : 'bg-white text-slate-600 border-slate-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          {optedOut ? 'Aktif — perangkat ini tidak dicatat' : 'Belum aktif — kunjungan Anda masih dicatat'}
        </button>
        <p className="text-[10px] text-slate-400 mt-1.5">
          Hanya tersimpan di browser ini. Tidak ada data yang dikirim ke server.
          {optedOut && ' Matikan lagi bila ingin kembali dicatat.'}
        </p>
      </div>

      {/* --- Pembuat link kampanye --- */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-start gap-2 mb-2">
          <span className="text-forest-600 mt-0.5">
            <Link2 className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-navy-800">Buat link kampanye</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Instagram &amp; WhatsApp menyembunyikan asal pengunjung, sehingga semua kunjungan
              tertulis “langsung”. Pakai link di bawah supaya sumbernya tercatat benar.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mt-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Saluran
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-navy-800 bg-white"
            >
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-bold text-slate-500 uppercase">
            Halaman tujuan
            <select
              value={path}
              onChange={(e) => setPath(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-navy-800 bg-white"
            >
              <option value="/">Beranda</option>
              <option value="/katalog">Katalog</option>
              <option value="/produk/gantungan-kunci-karet-3d">Produk: Gantungan Kunci</option>
              <option value="/produk/mug-keramik-souvenir">Produk: Mug Keramik</option>
              <option value="/produk/paket-hemat-wisatawan">Produk: Paket Wisatawan</option>
              <option value="/produk/paket-eksekutif-korporat">Produk: Paket Korporat</option>
            </select>
          </label>
        </div>

        <div className="mt-2 rounded-lg bg-surface-warm px-2.5 py-2">
          <p className="text-[10px] text-slate-500 mb-0.5">
            {CHANNELS.find((c) => c.id === channel)?.note}
          </p>
          <code className="block text-[10px] font-mono text-navy-800 break-all leading-snug">
            {campaignUrl}
          </code>
        </div>

        <button
          onClick={copy}
          className="mt-2 w-full py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 bg-forest-600 text-white hover:bg-forest-700"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Tersalin' : 'Salin link'}
        </button>
      </div>
    </div>
  );
};

export default AnalyticsTools;
