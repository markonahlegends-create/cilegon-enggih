import React, { useState, useEffect, useCallback } from 'react';
import {
  HeartPulse,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ExternalLink,
  Copy
} from 'lucide-react';

interface Check {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
  fix: string;
}

interface DiagnoseResult {
  ready: boolean;
  summary: { ok: number; warn: number; fail: number };
  storage: string;
  checks: Check[];
  generatedAt: string;
  note: string;
}

const STATUS_STYLE: Record<string, { bg: string; text: string; icon: any; label: string }> = {
  ok: { bg: 'bg-forest-50 border-forest-200', text: 'text-forest-800', icon: CheckCircle2, label: 'Siap' },
  warn: {
    bg: 'bg-amberbrand-50 border-amberbrand-200',
    text: 'text-amberbrand-900',
    icon: AlertTriangle,
    label: 'Perlu perhatian'
  },
  fail: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', icon: XCircle, label: 'Wajib diperbaiki' }
};

/**
 * Panel kesehatan konfigurasi produksi.
 * Hanya menampilkan STATUS (tidak pernah menampilkan nilai kunci/password).
 */
export const HealthCheckPanel: React.FC = () => {
  const [data, setData] = useState<DiagnoseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/diagnose', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat status konfigurasi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copyReport = () => {
    if (!data) return;
    const lines = [
      `Cilegon Enggih — Diagnosa ${new Date(data.generatedAt).toLocaleString('id-ID')}`,
      `Storage: ${data.storage} | Siap: ${data.ready ? 'YA' : 'BELUM'}`,
      ...data.checks.map((c) => `[${c.status.toUpperCase()}] ${c.label} — ${c.detail}`)
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-soft p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold text-navy-800 flex items-center gap-1.5">
            <HeartPulse className="w-4 h-4 text-forest-600" /> Kesiapan Go-Live
          </h3>
          <p className="text-[11px] text-slate-500">
            {data ? (
              <>
                {data.summary.ok} siap • {data.summary.warn} perhatian • {data.summary.fail} wajib
                diperbaiki
              </>
            ) : (
              'Memeriksa konfigurasi server...'
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={copyReport}
            disabled={!data}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700 inline-flex items-center gap-1 disabled:opacity-50"
          >
            <Copy className="w-3 h-3" /> {copied ? 'Tersalin' : 'Salin laporan'}
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-900 text-[11px] font-bold text-white inline-flex items-center gap-1 disabled:opacity-60"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Cek Ulang
          </button>
        </div>
      </div>

      {error && (
        <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5">
          {error}
        </div>
      )}

      {data && (
        <>
          <div
            className={`rounded-xl border p-2.5 text-[11px] font-bold ${
              data.ready
                ? 'bg-forest-50 border-forest-200 text-forest-800'
                : 'bg-amberbrand-50 border-amberbrand-200 text-amberbrand-900'
            }`}
          >
            {data.ready
              ? '✅ Semua syarat wajib terpenuhi — toko siap menerima order sungguhan.'
              : '⚠️ Masih ada syarat wajib yang belum terpenuhi. Perbaiki item berlabel merah sebelum promosi.'}
            <div className="font-normal text-slate-600 mt-0.5">
              Penyimpanan: <strong>{data.storage}</strong> · data diperiksa{' '}
              {new Date(data.generatedAt).toLocaleTimeString('id-ID')}
            </div>
          </div>

          <div className="space-y-1.5">
            {data.checks.map((check) => {
              const style = STATUS_STYLE[check.status];
              const Icon = style.icon;
              const open = openId === check.id;
              return (
                <div key={check.id} className={`rounded-xl border ${style.bg}`}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : check.id)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${style.text}`} />
                      <span className={`text-[11px] font-bold ${style.text}`}>{check.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold ${style.text} opacity-80`}>
                        {style.label}
                      </span>
                      {check.fix && (
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                            open ? 'rotate-180' : ''
                          }`}
                        />
                      )}
                    </span>
                  </button>
                  {(open || check.status === 'fail') && (
                    <div className="px-2.5 pb-2 space-y-1">
                      <p className="text-[10px] text-slate-600">{check.detail}</p>
                      {check.fix && (
                        <p className="text-[10px] text-slate-700 bg-white/70 rounded-lg p-1.5 border border-white">
                          <strong>Cara perbaiki:</strong> {check.fix}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-navy-700 inline-flex items-center gap-1 hover:underline"
            >
              Lihat /api/health <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <a
              href="/api/diagnose"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-bold text-navy-700 inline-flex items-center gap-1 hover:underline"
            >
              JSON diagnosa <ExternalLink className="w-2.5 h-2.5" />
            </a>
            <span className="text-[10px] text-slate-400">{data.note}</span>
          </div>
        </>
      )}
    </div>
  );
};
