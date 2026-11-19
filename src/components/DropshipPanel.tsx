import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Truck,
  X
} from 'lucide-react';
import { formatRupiah } from '../data/products';
import { adminDropship, adminDropshipChecklist, ApiError } from '../lib/api';

type VendorRow = {
  id: string;
  name: string;
  code?: string;
  contactName?: string;
  phone?: string;
  category?: string;
  active?: boolean;
  score: number;
  eligible: boolean;
  blockers: string[];
  notes: string[];
  productCount: number;
  avgMarginPercent: number | null;
  products: {
    id: string;
    name: string;
    sellPrice: number;
    hpp: number;
    margin: number;
    marginPercent: number;
    health: string;
    note: string;
  }[];
};

type Readiness = {
  vendors: VendorRow[];
  eligibleVendors: number;
  totalVendors: number;
  coverage: {
    totalProducts: number;
    percentCovered: number;
    withoutVendor: { id: string; name: string; price: number }[];
    withoutHpp: { id: string; name: string; price: number }[];
  };
  requiredChecks: { key: string; label: string; why: string }[];
  bonusChecks: { key: string; label: string; penalty: number }[];
  returnReservePercent: number;
  adminFeePercent: number;
};

type ChecklistStep = { title: string; items: string[] };

const HEALTH_STYLE: Record<string, { label: string; cls: string }> = {
  sehat: { label: 'Sehat', cls: 'bg-forest-50 text-forest-700 border-forest-200' },
  cukup: { label: 'Cukup', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  tipis: { label: 'Tipis', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  rugi: { label: 'Rugi', cls: 'bg-red-50 text-red-700 border-red-200' },
  'belum-diketahui': { label: 'HPP kosong', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
};

const ScoreBadge: React.FC<{ score: number; eligible: boolean }> = ({ score, eligible }) => {
  const tone = !eligible
    ? 'bg-red-50 text-red-700 border-red-200'
    : score >= 85
      ? 'bg-forest-50 text-forest-700 border-forest-200'
      : score >= 60
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-orange-50 text-orange-700 border-orange-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${tone}`}>
      {eligible ? <ShieldCheck className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
      {eligible ? `Layak · ${score}` : `Belum layak · ${score}`}
    </span>
  );
};

const DropshipPanel: React.FC<{ pushToast: (t: string, m?: string, v?: any) => void }> = ({
  pushToast
}) => {
  const [data, setData] = useState<Readiness | null>(null);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [openGuide, setOpenGuide] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [readiness, guide] = await Promise.all([
        adminDropship(),
        adminDropshipChecklist()
      ]);
      setData(readiness as Readiness);
      setSteps((guide as any).steps || []);
      setRestrictions((guide as any).restrictions || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat data dropship.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kritis = useMemo(() => {
    if (!data) return 0;
    return data.vendors.filter((v) => !v.eligible || v.products.some((p) => p.health === 'rugi' || p.health === 'tipis'))
      .length;
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-400 text-[12px]">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Memuat kesiapan dropship…
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-[12px] text-red-700 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <div className="font-bold">Tidak bisa memuat data dropship.</div>
          <div className="mt-1">{error}</div>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-2 px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-bold"
          >
            Coba lagi
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { coverage } = data;

  return (
    <div className="space-y-3">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Vendor layak</div>
          <div className="text-[20px] font-extrabold text-navy-700 leading-tight">
            {data.eligibleVendors}
            <span className="text-[12px] text-slate-400 font-bold"> / {data.totalVendors}</span>
          </div>
          <div className="text-[9.5px] text-slate-400">memenuhi 3 syarat wajib</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Produk terpetakan</div>
          <div className="text-[20px] font-extrabold text-navy-700 leading-tight">
            {coverage.percentCovered}%
          </div>
          <div className="text-[9.5px] text-slate-400">
            {coverage.totalProducts - coverage.withoutVendor.length} dari {coverage.totalProducts} produk
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">HPP kosong</div>
          <div
            className={`text-[20px] font-extrabold leading-tight ${
              coverage.withoutHpp.length ? 'text-amber-600' : 'text-forest-700'
            }`}
          >
            {coverage.withoutHpp.length}
          </div>
          <div className="text-[9.5px] text-slate-400">margin belum bisa dihitung</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Perlu perhatian</div>
          <div
            className={`text-[20px] font-extrabold leading-tight ${
              kritis ? 'text-red-600' : 'text-forest-700'
            }`}
          >
            {kritis}
          </div>
          <div className="text-[9.5px] text-slate-400">vendor bermasalah / margin tipis</div>
        </div>
      </div>

      {/* Peringatan keras */}
      {restrictions.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-amber-900">
            <AlertTriangle className="w-3.5 h-3.5" /> Yang TIDAK boleh dijanjikan selama dropship
          </div>
          <ul className="mt-1.5 space-y-1">
            {restrictions.map((r, i) => (
              <li key={i} className="text-[10.5px] text-amber-900 leading-snug flex gap-1.5">
                <span className="text-amber-500 font-bold">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Panduan operasional */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          type="button"
          onClick={() => setOpenGuide((v) => !v)}
          className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-slate-50"
        >
          <span className="flex items-center gap-1.5 text-[11.5px] font-extrabold text-slate-800">
            <Truck className="w-3.5 h-3.5 text-forest-600" /> Prosedur dropship harian
          </span>
          {openGuide ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>
        {openGuide && (
          <div className="px-3 pb-3 grid gap-2 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.title} className="bg-slate-50 rounded-xl p-2.5">
                <div className="text-[10.5px] font-extrabold text-navy-700 mb-1">{s.title}</div>
                <ol className="space-y-1">
                  {s.items.map((it, i) => (
                    <li key={i} className="text-[10px] text-slate-600 leading-snug flex gap-1.5">
                      <span className="text-forest-600 font-bold shrink-0">{i + 1}.</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Produk belum terpetakan */}
      {coverage.withoutVendor.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 mb-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            {coverage.withoutVendor.length} produk belum punya vendor
          </div>
          <div className="flex flex-wrap gap-1.5">
            {coverage.withoutVendor.map((p) => (
              <span
                key={p.id}
                className="px-2 py-1 rounded-lg bg-slate-100 text-[10px] text-slate-600 font-semibold"
              >
                {p.name} · {formatRupiah(p.price)}
              </span>
            ))}
          </div>
          <div className="mt-1.5 text-[9.5px] text-slate-400">
            Isi di tab Keuangan → Vendor, lalu pilih vendor per produk di tab Produk.
          </div>
        </div>
      )}

      {/* Daftar vendor */}
      {data.vendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 text-center">
          <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <div className="text-[12px] font-bold text-slate-700">Belum ada vendor</div>
          <p className="text-[10.5px] text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
            Tambahkan vendor Shopee/Tokopedia di tab <strong>Keuangan → Vendor</strong>. Setelah itu
            centang tiga syarat dropship di sana, dan penilaian akan muncul otomatis di halaman ini.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.vendors.map((v) => {
            const open = expanded[v.id] ?? false;
            return (
              <div key={v.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded((e) => ({ ...e, [v.id]: !open }))}
                  className="w-full px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 text-left"
                >
                  {open ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11.5px] font-extrabold text-slate-800 truncate">{v.name}</span>
                      <ScoreBadge score={v.score} eligible={v.eligible} />
                      {v.active === false && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 text-[9px] font-bold">
                          nonaktif
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] text-slate-400 mt-0.5">
                      {v.productCount} produk
                      {v.avgMarginPercent !== null && ` · margin rata-rata ${v.avgMarginPercent}%`}
                      {v.phone && ` · ${v.phone}`}
                    </div>
                  </div>
                  {v.blockers.length > 0 && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[9px] font-extrabold border border-red-200">
                      {v.blockers.length} syarat gagal
                    </span>
                  )}
                </button>

                {open && (
                  <div className="px-3 pb-3 border-t border-slate-100 pt-2 space-y-2">
                    {v.blockers.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-2">
                        <div className="text-[10px] font-extrabold text-red-700 mb-1">
                          Tidak layak dropship — perbaiki dulu:
                        </div>
                        <ul className="space-y-0.5">
                          {v.blockers.map((b, i) => (
                            <li key={i} className="text-[10px] text-red-700 leading-snug flex gap-1.5">
                              <X className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {v.notes.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-2">
                        <div className="text-[10px] font-extrabold text-amber-800 mb-1">Catatan</div>
                        <ul className="space-y-0.5">
                          {v.notes.map((n, i) => (
                            <li key={i} className="text-[10px] text-amber-800 leading-snug">
                              • {n}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {v.products.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px]">
                          <thead className="text-slate-500">
                            <tr>
                              <th className="text-left py-1 font-bold">Produk</th>
                              <th className="text-right py-1 font-bold">Jual</th>
                              <th className="text-right py-1 font-bold">HPP</th>
                              <th className="text-right py-1 font-bold">Margin</th>
                              <th className="text-right py-1 font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {v.products.map((p) => {
                              const st = HEALTH_STYLE[p.health] || HEALTH_STYLE['belum-diketahui'];
                              return (
                                <tr key={p.id} className="border-t border-slate-100">
                                  <td className="py-1 pr-2 text-slate-700 font-semibold">{p.name}</td>
                                  <td className="py-1 text-right text-slate-600">{formatRupiah(p.sellPrice)}</td>
                                  <td className="py-1 text-right text-slate-600">{formatRupiah(p.hpp)}</td>
                                  <td className="py-1 text-right font-bold text-slate-800">
                                    {formatRupiah(p.margin)}
                                    <span className="text-slate-400 font-normal"> ({p.marginPercent}%)</span>
                                  </td>
                                  <td className="py-1 text-right">
                                    <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${st.cls}`}>
                                      {st.label}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400">
                        Belum ada produk yang dipetakan ke vendor ini.
                      </div>
                    )}

                    <div className="text-[9.5px] text-slate-400">
                      Ubah data vendor di tab <strong>Keuangan → Vendor</strong>.
                      {v.productCount > 0 &&
                        ` Margin sudah dikurangi cadangan retur ${data.returnReservePercent}%.`}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between text-[9.5px] text-slate-400 px-1">
        <span className="flex items-center gap-1">
          <Check className="w-3 h-3 text-forest-500" />
          Skor = 100 dikurangi pelanggaran syarat, rating, ulasan, lama proses
        </span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1 font-bold text-slate-500 hover:text-slate-700"
        >
          <RefreshCw className="w-3 h-3" /> Muat ulang
        </button>
      </div>
    </div>
  );
};

export default DropshipPanel;
