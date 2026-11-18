import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Eye,
  EyeOff,
  Layers,
  MapPin,
  MonitorSmartphone,
  Package,
  RefreshCw,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react';
import { adminInsights, adminInsightsCsv, ApiError } from '../lib/api';
import { AnalyticsTools } from './AnalyticsTools';

/**
 * Panel "Insight" — analitik trafik & konversi.
 *
 * Dirancang untuk menjawab tiga keputusan nyata:
 *   1. Produk mana yang harus diproduksi lebih banyak?
 *   2. Promosi diarahkan ke daerah mana?
 *   3. Kapan waktu paling efektif untuk promosi?
 *
 * Semua label sengaja memakai bahasa toko, bukan istilah teknis,
 * supaya bisa langsung dipakai tanpa menafsirkan angka.
 */

const RUPIAH = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    Number(n) || 0
  );

const Card: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; hint?: string }> = ({
  title,
  icon,
  children,
  hint
}) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <div className="flex items-start gap-2 mb-3">
      <span className="text-forest-600 mt-0.5">{icon}</span>
      <div>
        <h3 className="text-sm font-extrabold text-navy-800">{title}</h3>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{hint}</p>}
      </div>
    </div>
    {children}
  </div>
);

const Stat: React.FC<{ label: string; value: string; sub?: string; delta?: number | null }> = ({
  label,
  value,
  sub,
  delta
}) => (
  <div className="rounded-lg bg-surface-warm px-3 py-2">
    <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500">{label}</p>
    <div className="flex items-baseline gap-1">
      <p className="text-lg font-extrabold text-navy-800 leading-tight">{value}</p>
      {typeof delta === 'number' && <Delta value={delta} />}
    </div>
    {sub && <p className="text-[10px] text-slate-500">{sub}</p>}
  </div>
);

/**
 * Pembanding naik/turun terhadap periode sebelumnya (panjang sama).
 * Angka absolut tanpa pembanding sulit ditafsirkan pemilik toko.
 */
const Delta: React.FC<{ value: number }> = ({ value }) => {
  if (!Number.isFinite(value)) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`inline-flex items-center text-[10px] font-extrabold ${
        flat ? 'text-slate-400' : up ? 'text-forest-700' : 'text-red-600'
      }`}
      title="Dibanding periode sebelumnya yang panjangnya sama"
    >
      {!flat && (up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />)}
      {Math.abs(value)}%
    </span>
  );
};

/** Sel heatmap: makin gelap makin ramai. */
const heatColor = (value: number, max: number) => {
  if (!value) return 'bg-slate-100';
  const ratio = max > 0 ? value / max : 0;
  if (ratio > 0.75) return 'bg-forest-700';
  if (ratio > 0.5) return 'bg-forest-600';
  if (ratio > 0.3) return 'bg-forest-500';
  if (ratio > 0.15) return 'bg-forest-400';
  return 'bg-forest-300';
};

/** Grafik batang sederhana tanpa library tambahan. */
const BarChart: React.FC<{ data: { label: string; value: number }[]; unit?: string }> = ({
  data,
  unit = ''
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-[3px] h-24" role="img" aria-label="Grafik harian">
      {data.map((d) => {
        const h = Math.max(2, (d.value / max) * 100);
        return (
          <div
            key={d.label}
            className="flex-1 bg-forest-500/80 hover:bg-forest-600 rounded-t-sm relative group"
            style={{ height: `${h}%` }}
            title={`${d.label}: ${d.value}${unit}`}
          />
        );
      })}
    </div>
  );
};

export const InsightsPanel: React.FC = () => {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (range: 7 | 30 | 90) => {
    setLoading(true);
    setError(null);
    try {
      setData(await adminInsights(range));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data insight.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const download = async () => {
    try {
      const csv = await adminInsightsCsv(days);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      // iOS Safari mengabaikan click() pada <a> yang belum masuk DOM.
      a.style.display = 'none';
      document.body.appendChild(a);
      a.download = `insight-cilegon-enggih-${days}hari.csv`;
      a.click();
      document.body.removeChild(a);
      // Beri jeda: Safari butuh waktu memulai unduhan sebelum URL dicabut.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError('Gagal mengunduh CSV.');
    }
  };

  const daily = useMemo(
    () => (data?.traffic?.daily || []).map((d: any) => ({ label: d.day, value: d.views })),
    [data]
  );
  const hourBars = useMemo(
    () =>
      (data?.hours?.buckets || []).map((h: any) => ({
        label: `${String(h.hour).padStart(2, '0')}:00`,
        value: h.orders
      })),
    [data]
  );

  if (loading && !data) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        <RefreshCw className="w-4 h-4 animate-spin inline mr-2" /> Memuat insight…
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
        {error}
        <button onClick={() => load(days)} className="ml-2 underline font-bold">
          Coba lagi
        </button>
      </div>
    );
  }

  const t = data.traffic;
  const funnel = data.funnel;

  return (
    <div className="space-y-4">
      {/* Kontrol periode */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d as 7 | 30 | 90)}
            className={`px-3 py-2 sm:py-1.5 rounded-lg text-xs font-extrabold border ${
              days === d
                ? 'bg-forest-600 text-white border-forest-600'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {d} hari
          </button>
        ))}
        <button
          onClick={() => load(days)}
          className="px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 inline-flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Segarkan
        </button>
        <button
          onClick={download}
          className="px-3 py-2 sm:py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 inline-flex items-center gap-1"
        >
          <Download className="w-3 h-3" /> Unduh CSV
        </button>
        <span className="w-full sm:w-auto sm:ml-auto text-[11px] text-slate-400">
          {data.period.from} → {data.period.to}
        </span>
      </div>

      {/* Alat: pengecualian perangkat sendiri & pembuat link kampanye */}
      <AnalyticsTools />

      {/* Pemberitahuan bila data belum cukup */}
      {data.dataStatus?.note && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {data.dataStatus.note} Angka konversi baru bisa dipercaya setelah ±1–2 minggu
            pengunjung nyata. Data lain (lokasi, waktu, stok) sudah bisa dipakai sekarang.
          </span>
        </div>
      )}

      {/* A. Trafik */}
      <Card
        title="Trafik & Konversi"
        icon={<Activity className="w-4 h-4" />}
        hint="Kunjungan halaman dan berapa yang berubah menjadi pesanan."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <Stat
            label="Kunjungan"
            value={String(t.totalViews)}
            delta={data.comparison?.hasPreviousData ? data.comparison.views : undefined}
            sub={data.comparison?.hasPreviousData ? 'vs periode lalu' : undefined}
          />
          <Stat
            label="Pengunjung"
            value={String(t.totalVisitors)}
            sub="unik per hari"
            delta={data.comparison?.hasPreviousData ? data.comparison.visitors : undefined}
          />
          <Stat
            label="Pesanan"
            value={String(t.totalOrders)}
            delta={data.comparison?.hasPreviousData ? data.comparison.orders : undefined}
          />
          <Stat
            label="Konversi"
            value={`${t.conversion}%`}
            sub={t.totalVisitors ? 'pesanan ÷ pengunjung' : 'belum ada data'}
          />
        </div>
        <BarChart data={daily} unit=" kunjungan" />
        <p className="text-[10px] text-slate-400 mt-1">Kunjungan per hari (hover untuk angka).</p>
      </Card>

      {/* Funnel */}
      <Card
        title="Corong Pembelian"
        icon={<ShoppingCart className="w-4 h-4" />}
        hint="Di tahap mana calon pembeli berhenti — ini yang paling menentukan perbaikan."
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <Stat label="Lihat produk" value={String(funnel.productViews)} />
          <Stat label="Masuk keranjang" value={String(funnel.addToCart)} />
          <Stat label="Mulai checkout" value={String(funnel.checkoutStart)} />
          <Stat label="Pesanan" value={String(funnel.orders)} />
          <Stat
            label="Batal di checkout"
            value={funnel.dropOff.checkoutToOrder === null ? '—' : `${funnel.dropOff.checkoutToOrder}%`}
            sub="dari yang mulai checkout"
          />
        </div>
        {funnel.trackingGap && (
          <p className="text-[11px] text-amber-700 mt-2">
            Catatan: ada pesanan yang terjadi sebelum pelacakan aktif, sehingga angka “mulai
            checkout” lebih kecil dari jumlah pesanan. Ini normal pada masa awal.
          </p>
        )}
      </Card>

      {/* B. Produk */}
      <Card
        title="Produk: Dilihat vs Dibeli"
        icon={<Package className="w-4 h-4" />}
        hint="Gunakan kolom Catatan untuk memutuskan produksi & perbaikan halaman produk."
      >
        {data.products.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada data produk pada periode ini.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[11px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-2 font-bold">Produk</th>
                  <th className="py-1.5 px-2 font-bold text-right">Dilihat</th>
                  <th className="py-1.5 px-2 font-bold text-right">Keranjang</th>
                  <th className="py-1.5 px-2 font-bold text-right">Terjual</th>
                  <th className="py-1.5 px-2 font-bold text-right">Konversi</th>
                  <th className="py-1.5 pl-2 font-bold">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {data.products.slice(0, 12).map((p: any) => (
                  <tr key={p.productId || p.name} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 font-semibold text-navy-800">{p.name}</td>
                    <td className="py-1.5 px-2 text-right">{p.views}</td>
                    <td className="py-1.5 px-2 text-right">{p.carts}</td>
                    <td className="py-1.5 px-2 text-right font-bold">{p.sold}</td>
                    <td className="py-1.5 px-2 text-right">
                      {p.conversion === null ? '—' : `${p.conversion}%`}
                    </td>
                    <td className="py-1.5 pl-2 text-slate-600">{p.verdict}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sm:hidden text-[10px] text-slate-400 text-center mt-1">
              Geser tabel untuk melihat semua kolom →
            </p>
          </div>
        )}
      </Card>

      {/* Stok */}
      <Card
        title="Perkiraan Stok Habis"
        icon={<TrendingUp className="w-4 h-4" />}
        hint="Dihitung dari laju penjualan periode ini. Yang ditandai merah perlu segera diproduksi."
      >
        {data.stockForecast.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada penjualan pada periode ini.</p>
        ) : (
          <div className="space-y-1.5">
            {data.stockForecast.slice(0, 8).map((p: any) => (
              <div
                key={p.id}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] ${
                  p.urgent ? 'bg-red-50 border border-red-200' : 'bg-surface-warm'
                }`}
              >
                <span className="font-semibold text-navy-800 truncate pr-2">{p.name}</span>
                <span className="text-slate-600 whitespace-nowrap">
                  stok {p.stock} · {p.perDay}/hari ·{' '}
                  <strong className={p.urgent ? 'text-red-700' : 'text-forest-700'}>
                    {p.daysLeft === null ? '—' : `${p.daysLeft} hari lagi`}
                  </strong>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* C. Lokasi: pengunjung vs pembeli */}
      <Card
        title="Lokasi Pengunjung"
        icon={<MapPin className="w-4 h-4" />}
        hint="Perkiraan kota asal pengunjung (nama kota saja, tanpa IP). Ini calon pembeli, bukan hanya yang sudah membeli."
      >
        {(!data.byVisitorZone || data.byVisitorZone.length === 0) ? (
          <p className="text-xs text-slate-500">
            Belum ada data lokasi pengunjung. Data ini terisi otomatis saat situs diakses dari
            domain produksi (Vercel) — bukan dari komputer lokal.
          </p>
        ) : (
          <div className="space-y-1.5">
            {data.byVisitorZone.map((z: any) => (
              <div key={z.zone}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-navy-800">{z.label}</span>
                  <span className="text-slate-600">
                    {z.visitors} pengunjung · {z.share}%
                  </span>
                </div>
                <div className="h-2 rounded bg-slate-100 overflow-hidden">
                  <div className="h-full bg-navy-800" style={{ width: `${z.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
            Zona pembeli (dari alamat pengiriman)
          </p>
          {data.byZone.length === 0 ? (
            <p className="text-[11px] text-slate-500">Belum ada pesanan.</p>
          ) : (
            <div className="space-y-1.5">
              {data.byZone.map((z: any) => (
                <div key={z.zone} className="flex justify-between text-[11px]">
                  <span className="font-semibold text-navy-800">{z.label}</span>
                  <span className="text-slate-600">
                    {z.orders} pesanan · {z.share}% · {RUPIAH(z.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* C2. Lokasi (versi lama dipertahankan untuk rincian omzet) */}
      <Card
        title="Omzet per Zona"
        icon={<MapPin className="w-4 h-4" />}
        hint="Zona dengan omzet terbesar = target promosi & peluang reseller lokal."
      >
        {data.byZone.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada pesanan.</p>
        ) : (
          <div className="space-y-1.5">
            {data.byZone.map((z: any) => (
              <div key={z.zone}>
                <div className="flex justify-between text-[11px] mb-0.5">
                  <span className="font-semibold text-navy-800">{z.label}</span>
                  <span className="text-slate-600">
                    {z.orders} pesanan · {z.share}% · {RUPIAH(z.revenue)}
                  </span>
                </div>
                <div className="h-2 rounded bg-slate-100 overflow-hidden">
                  <div className="h-full bg-forest-500" style={{ width: `${z.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* D. Waktu */}
      <Card
        title="Waktu Paling Ramai"
        icon={<Users className="w-4 h-4" />}
        hint="Jadwalkan posting promosi mendekati jam & hari tersibuk ini."
      >
        <BarChart data={hourBars} unit=" pesanan" />
        <div className="flex flex-wrap gap-1.5 mt-2">
          {data.hours.busiest.map((h: any) => (
            <span
              key={h.hour}
              className="px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 text-[10px] font-bold"
            >
              {String(h.hour).padStart(2, '0')}:00 — {h.orders} pesanan
            </span>
          ))}
        </div>
        {Object.keys(data.hours.byWeekday).length > 0 && (
          <p className="text-[11px] text-slate-600 mt-2">
            Hari tersibuk:{' '}
            {Object.entries(data.hours.byWeekday)
              .sort((a: any, b: any) => b[1] - a[1])
              .slice(0, 3)
              .map(([d, n]) => `${d} (${n})`)
              .join(', ')}
          </p>
        )}

        {/* Peta panas hari x jam: lebih tepat untuk jadwal posting */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[10px] uppercase tracking-wide font-bold text-slate-500 mb-1.5">
            Peta ramai: hari × jam (WIB)
          </p>
          {data.heatmap?.max > 0 ? (
            <>
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                  {data.heatmap.grid.map((row: number[], d: number) => (
                    <div key={d} className="flex items-center gap-[2px] mb-[2px]">
                      <span className="w-7 sm:w-12 shrink-0 text-[8px] sm:text-[9px] font-bold text-slate-500">
                        {data.heatmap.weekdays[d].slice(0, 3)}
                      </span>
                      {row.map((v: number, h: number) => (
                        <div
                          key={h}
                          className={`flex-1 h-3.5 sm:h-3 rounded-[2px] ${heatColor(v, data.heatmap.max)}`}
                          title={`${data.heatmap.weekdays[d]} ${String(h).padStart(2, '0')}:00 — ${v} kunjungan`}
                        />
                      ))}
                    </div>
                  ))}
                  <div className="flex items-center gap-[2px] mt-0.5">
                    <span className="w-7 sm:w-12 shrink-0" />
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} className="flex-1 text-center text-[8px] text-slate-400">
                        {h % 6 === 0 ? h : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <p className="sm:hidden text-[10px] text-slate-400 mt-1">
                Geser peta untuk melihat jam lainnya →
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {data.heatmap.peakSlots.map((p: any) => (
                  <span
                    key={`${p.day}-${p.hour}`}
                    className="px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 text-[10px] font-bold"
                  >
                    {p.day} {String(p.hour).padStart(2, '0')}:00 — {p.views} kunjungan
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Gelap = paling ramai. Jadwalkan posting 1–2 jam sebelum jam teramai.
              </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">Belum ada kunjungan untuk dipetakan.</p>
          )}
        </div>
      </Card>

      {/* F. Perangkat */}
      <Card
        title="Perangkat yang Dipakai"
        icon={<MonitorSmartphone className="w-4 h-4" />}
        hint="Menentukan prioritas desain: kalau mayoritas memakai HP, fokuskan perbaikan tampilan HP."
      >
        {(!data.byDevice || data.byDevice.every((d: any) => d.visitors === 0)) ? (
          <p className="text-xs text-slate-500">Belum ada data perangkat.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {data.byDevice.map((d: any) => (
              <Stat
                key={d.device}
                label={d.label}
                value={`${d.share}%`}
                sub={`${d.visitors} pengunjung`}
              />
            ))}
          </div>
        )}
      </Card>

      {/* G. Halaman paling sering dibuka */}
      <Card
        title="Halaman Paling Sering Dibuka"
        icon={<Eye className="w-4 h-4" />}
        hint="Halaman yang paling banyak jadi pintu masuk = yang paling layak dirapikan lebih dulu."
      >
        {(!data.topPaths || data.topPaths.length === 0) ? (
          <p className="text-xs text-slate-500">Belum ada data halaman.</p>
        ) : (
          <div className="space-y-1">
            {(() => {
              const maxViews = Math.max(...data.topPaths.map((p: any) => p.views), 1);
              return data.topPaths.map((p: any) => (
                <div key={p.path} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 truncate text-[11px] font-semibold text-navy-800" title={p.path}>
                    {p.label}
                  </span>
                  <div className="flex-1 h-2.5 rounded bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-forest-500"
                      style={{ width: `${Math.max(3, (p.views / maxViews) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[10px] text-slate-600">
                    {p.views} · {p.visitors} org
                  </span>
                </div>
              ));
            })()}
          </div>
        )}
      </Card>

      {/* H. Varian produk */}
      <Card
        title="Varian Paling Diminati"
        icon={<Layers className="w-4 h-4" />}
        hint="Penting untuk produksi: varian mana yang paling banyak dilihat dan dibeli, agar komposisi stok tidak salah."
      >
        {(!data.variants || data.variants.length === 0) ? (
          <p className="text-xs text-slate-500">
            Belum ada data varian. Pastikan produk memiliki pilihan ukuran/paket.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-[11px]">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="py-1.5 pr-2 font-bold">Varian</th>
                  <th className="py-1.5 px-2 font-bold text-right">Dilihat</th>
                  <th className="py-1.5 px-2 font-bold text-right">Keranjang</th>
                  <th className="py-1.5 px-2 font-bold text-right">Terjual</th>
                  <th className="py-1.5 pl-2 font-bold text-right">Omzet</th>
                </tr>
              </thead>
              <tbody>
                {data.variants.slice(0, 10).map((v: any) => (
                  <tr key={`${v.productId}-${v.variantId}`} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2">
                      <span className="font-semibold text-navy-800">{v.label}</span>
                      {v.productName && (
                        <span className="block text-[10px] text-slate-500 truncate max-w-[160px]">
                          {v.productName}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right">{v.views}</td>
                    <td className="py-1.5 px-2 text-right">{v.carts}</td>
                    <td className="py-1.5 px-2 text-right font-bold">{v.sold}</td>
                    <td className="py-1.5 pl-2 text-right text-slate-600">{RUPIAH(v.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="sm:hidden text-[10px] text-slate-400 text-center mt-1">
              Geser tabel untuk melihat semua kolom →
            </p>
          </div>
        )}
      </Card>

      {/* E. Sumber */}
      <Card
        title="Sumber Kunjungan"
        icon={<Eye className="w-4 h-4" />}
        hint="Dari mana orang menemukan toko Anda. Arahkan promosi ke saluran yang paling ramai."
      >
        {data.bySource.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada data sumber.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {data.bySource.map((s: any) => (
              <Stat
                key={s.source}
                label={s.label || s.source}
                value={`${s.views}`}
                sub={`${s.visitors} pengunjung`}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default InsightsPanel;
