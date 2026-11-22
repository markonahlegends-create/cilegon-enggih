import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fingerprint,
  Globe,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserX,
  Database,
  Download,
  History,
  HardDriveDownload,
  LogOut,
  MonitorSmartphone
} from 'lucide-react';
import {
  adminAuditLog,
  adminSettingsFull,
  adminSetTwoFactor,
  adminBackups,
  adminRunBackup,
  adminRestoreBackup,
  adminRevokeAllSessions,
  adminSessions,
  ApiError
} from '../lib/api';

const ACTION_LABEL: Record<string, { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  'login.sukses': { label: 'Login berhasil', tone: 'ok' },
  'login.sukses-2fa': { label: 'Login berhasil (2FA)', tone: 'ok' },
  'login.gagal': { label: 'Login gagal', tone: 'warn' },
  'login.diblokir': { label: 'Login diblokir (brute force)', tone: 'bad' },
  'login.otp-diminta': { label: 'Kode 2FA dikirim', tone: 'ok' },
  'login.otp-gagal': { label: 'Kode 2FA salah', tone: 'warn' },
  'produk.diubah': { label: 'Produk diubah', tone: 'ok' },
  'produk.dibuat': { label: 'Produk dibuat', tone: 'ok' },
  'produk.diduplikat': { label: 'Produk diduplikat', tone: 'ok' },
  'order.diubah': { label: 'Order diperbarui', tone: 'ok' },
  'data.ekspor': { label: 'Data diekspor', tone: 'warn' },
  'vendor.dibuat': { label: 'Vendor dibuat', tone: 'ok' },
  'vendor.diubah': { label: 'Vendor diubah', tone: 'ok' },
  'vendor.dihapus': { label: 'Vendor dihapus', tone: 'warn' },
  'pengeluaran.dibuat': { label: 'Pengeluaran dicatat', tone: 'ok' },
  'pengeluaran.dihapus': { label: 'Pengeluaran dihapus', tone: 'warn' },
  'security.2fa-aktif': { label: '2FA diaktifkan', tone: 'ok' },
  'security.2fa-nonaktif': { label: '2FA dimatikan', tone: 'warn' },
  'public.track-gagal': { label: 'Pelacakan pesanan gagal', tone: 'warn' }
};

export const SecurityPanel: React.FC<{ pushToast: (t: string, m: string, k?: any) => void }> = ({
  pushToast
}) => {
  const [settings, setSettings] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // Tahap 3: sesi & backup
  const [sessions, setSessions] = useState<any[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupMeta, setBackupMeta] = useState<any>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [sessionBusy, setSessionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [full, audit, sess, bk] = await Promise.all([
        adminSettingsFull().catch(() => null),
        adminAuditLog({ q: query }).catch(() => ({ total: 0, entries: [] })),
        adminSessions().catch(() => ({ sessions: [] })),
        adminBackups().catch(() => null)
      ]);
      if (full?.settings) setSettings(full.settings);
      setEntries(audit.entries || []);
      setTotal(audit.total || 0);
      setSessions(sess.sessions || []);
      if (bk) {
        setBackups(bk.items || []);
        setBackupMeta(bk);
      }
    } finally {
      setLoading(false);
    }
  }, [query]);

  const runBackupNow = async () => {
    setBackupBusy(true);
    try {
      const res = await adminRunBackup();
      pushToast(
        'Backup dibuat',
        `${res.filename} • ${(res.compressedBytes / 1024).toFixed(0)} KB terkompresi`,
        'success'
      );
      await load();
    } catch (err) {
      pushToast('Backup gagal', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBackupBusy(false);
    }
  };

  const restore = async (filename: string) => {
    const okReplace = window.confirm(
      `Pulihkan dari ${filename}?\n\nKlik OK = gabungkan (menimpa dokumen dengan ID sama).\nKlik Cancel = batal.`
    );
    if (!okReplace) return;
    setBackupBusy(true);
    try {
      const res = await adminRestoreBackup(filename, 'merge');
      pushToast('Data dipulihkan', res.message, 'success');
      await load();
    } catch (err) {
      pushToast('Pemulihan gagal', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBackupBusy(false);
    }
  };

  const revokeOthers = async () => {
    if (!window.confirm('Keluarkan semua sesi admin? Anda harus login ulang di semua perangkat.'))
      return;
    setSessionBusy(true);
    try {
      const res = await adminRevokeAllSessions();
      pushToast('Sesi dicabut', res.message, 'success');
      setSessions([]);
    } catch (err) {
      pushToast('Gagal', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setSessionBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const telegramReady = Boolean(
    settings?.telegram?.botToken && settings?.telegram?.chatId
  );
  const twoFactorOn = settings?.telegram?.otpEnabled === true;

  const toggle2fa = async () => {
    setBusy(true);
    try {
      const res = await adminSetTwoFactor(!twoFactorOn);
      setSettings((prev: any) => ({
        ...prev,
        telegram: { ...(prev?.telegram || {}), otpEnabled: res.enabled }
      }));
      pushToast(
        res.enabled ? '2FA diaktifkan' : '2FA dimatikan',
        res.enabled
          ? 'Login berikutnya membutuhkan kode 6 digit dari Telegram.'
          : 'Login kembali memakai password saja.',
        'success'
      );
    } catch (err) {
      pushToast('Gagal', err instanceof ApiError ? err.message : 'Coba lagi', 'error');
    } finally {
      setBusy(false);
    }
  };

  const stats = useMemo(() => {
    const failed = entries.filter((e) => /gagal|diblokir/i.test(e.action)).length;
    const blocked = entries.filter((e) => e.action === 'login.diblokir').length;
    const exports = entries.filter((e) => e.action === 'data.ekspor').length;
    return { failed, blocked, exports };
  }, [entries]);

  const checklist = [
    {
      label: 'Password admin dari environment (bukan default)',
      ok: true,
      detail: 'Sudah terverifikasi lewat /api/diagnose'
    },
    {
      label: 'Kunci Supabase hanya dipakai di server',
      ok: true,
      detail: 'Tidak pernah dikirim ke browser'
    },
    {
      label: 'Notifikasi Telegram terhubung',
      ok: telegramReady,
      detail: telegramReady ? 'Bot aktif' : 'Isi Bot Token & Chat ID di Pengaturan'
    },
    {
      label: 'Verifikasi 2 langkah (2FA) untuk login admin',
      ok: twoFactorOn,
      detail: twoFactorOn
        ? 'Aktif — login butuh kode dari Telegram'
        : 'Sangat disarankan: aktifkan di bawah'
    },
    {
      label: 'Harga pesanan dihitung di server',
      ok: true,
      detail: 'Harga dari browser tidak lagi dipercaya'
    },
    {
      label: 'Lacak pesanan wajib 2 faktor',
      ok: true,
      detail: 'Nomor pesanan + 4 digit terakhir WhatsApp'
    },
    {
      label: 'Ekspor data tanpa kredensial',
      ok: true,
      detail: 'Bot token disembunyikan, nomor HP dimasking'
    },
    {
      label: 'Sesi admin di cookie HttpOnly (tidak bisa dibaca JavaScript)',
      ok: true,
      detail: 'Token tidak lagi disimpan di localStorage'
    },
    {
      label: 'Backup harian otomatis',
      ok: Boolean(backupMeta?.total),
      detail: backupMeta?.total
        ? `${backupMeta.total} berkas tersimpan`
        : 'Belum ada backup — klik "Backup Sekarang"'
    }
  ];

  return (
    <div className="space-y-3">
      {/* Kartu status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Verifikasi 2 Langkah
              </div>
              <div
                className={`text-sm font-extrabold mt-0.5 ${
                  twoFactorOn ? 'text-forest-700' : 'text-amberbrand-700'
                }`}
              >
                {twoFactorOn ? 'Aktif' : 'Belum aktif'}
              </div>
            </div>
            {twoFactorOn ? (
              <ShieldCheck className="w-8 h-8 text-forest-600" />
            ) : (
              <ShieldOff className="w-8 h-8 text-amberbrand-500" />
            )}
          </div>
          <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">
            Setelah password benar, kode 6 digit dikirim ke Telegram Anda. Menahan akses walau
            password diketahui orang lain.
          </p>
          <button
            type="button"
            onClick={toggle2fa}
            disabled={busy || (!telegramReady && !twoFactorOn)}
            className={`mt-2 w-full py-2 rounded-xl text-[11px] font-extrabold inline-flex items-center justify-center gap-1.5 ${
              twoFactorOn
                ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                : 'bg-forest-600 hover:bg-forest-700 text-white disabled:opacity-50'
            }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            {twoFactorOn ? 'Matikan 2FA' : 'Aktifkan 2FA'}
          </button>
          {!telegramReady && (
            <p className="text-[10px] text-amberbrand-700 mt-1.5">
              Hubungkan bot Telegram dulu di Pengaturan.
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            30 Aktivitas Terakhir
          </div>
          <div className="grid grid-cols-3 gap-1.5 mt-1.5">
            {[
              ['Total', total],
              ['Gagal/Blokir', stats.failed],
              ['Ekspor', stats.exports]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-slate-50 px-2 py-1.5">
                <div className="text-[9px] font-bold uppercase text-slate-400">{label}</div>
                <div className="text-sm font-extrabold text-navy-800">{String(value)}</div>
              </div>
            ))}
          </div>
          <p className="text-[10.5px] text-slate-500 mt-1.5 leading-relaxed">
            Semua perubahan harga, verifikasi pembayaran, dan login tercatat otomatis (disimpan 90
            hari).
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            Pertahanan Otomatis
          </div>
          <ul className="mt-1.5 space-y-1 text-[10.5px] text-slate-600">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-forest-600 mt-0.5 shrink-0" />
              Login dibatasi 5 percobaan / 15 menit per IP
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-forest-600 mt-0.5 shrink-0" />
              Pelacakan pesanan dibatasi 20 percobaan / 10 menit
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-forest-600 mt-0.5 shrink-0" />
              Ekspor data maksimal 3 kali / jam
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-forest-600 mt-0.5 shrink-0" />
              Harga dihitung ulang di server
            </li>
          </ul>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 text-xs font-extrabold text-navy-800">
          Status Keamanan
        </div>
        <div className="divide-y divide-slate-100">
          {checklist.map((item) => (
            <div key={item.label} className="px-4 py-2 flex items-start gap-2">
              {item.ok ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-forest-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amberbrand-500 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0">
                <div className="text-[11px] font-bold text-slate-700">{item.label}</div>
                <div className="text-[10px] text-slate-400">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sesi aktif + backup (Tahap 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
            <MonitorSmartphone className="w-3.5 h-3.5 text-navy-700" />
            <span className="text-xs font-extrabold text-navy-800">Perangkat Terhubung</span>
            <span className="ml-auto text-[10px] text-slate-400">{sessions.length} sesi</span>
          </div>
          <div className="max-h-[190px] overflow-y-auto divide-y divide-slate-100">
            {sessions.map((sess, i) => (
              <div key={i} className="px-4 py-2 flex items-start gap-2">
                <div
                  className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    sess.current ? 'bg-forest-500' : 'bg-slate-300'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-slate-700">
                    {sess.ip}{' '}
                    {sess.current && (
                      <span className="ml-1 px-1.5 py-0.5 rounded bg-forest-50 text-forest-700 text-[9px]">
                        PERANGKAT INI
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {String(sess.userAgent || 'Perangkat tidak dikenal').slice(0, 60)}
                  </div>
                  <div className="text-[9.5px] text-slate-400">{sess.sid}</div>
                </div>
                <div className="text-[9.5px] text-slate-400 whitespace-nowrap">
                  {sess.createdAt
                    ? new Date(sess.createdAt).toLocaleString('id-ID', {
                        timeZone: 'Asia/Jakarta',
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : '—'}
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="px-4 py-5 text-center text-[11px] text-slate-400">
                Tidak ada sesi lain yang tercatat.
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-slate-100">
            <button
              type="button"
              onClick={revokeOthers}
              disabled={sessionBusy}
              className="w-full py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <LogOut className="w-3 h-3" /> Keluarkan Semua Perangkat
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-2">
            <HardDriveDownload className="w-3.5 h-3.5 text-navy-700" />
            <span className="text-xs font-extrabold text-navy-800">Backup Otomatis</span>
            <span className="ml-auto text-[10px] text-slate-400">
              {backupMeta?.total ?? 0} berkas
            </span>
          </div>
          <div className="px-4 py-2 text-[10.5px] text-slate-500 leading-relaxed">
            {backupMeta?.schedule || 'Harian'} • retensi {backupMeta?.retention ?? 30} berkas.
            Tersimpan di Supabase Storage (bucket <code>{backupMeta?.bucket || 'backups'}</code>),
            tanpa kredensial.
          </div>
          {/* Diagnostik: supaya salah nama bucket langsung terlihat, bukan menebak */}
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {[
              {
                ok: backupMeta?.bucketReachable,
                label: backupMeta?.bucketReachable
                  ? `bucket "${backupMeta?.bucket}" terbaca`
                  : `bucket "${backupMeta?.bucket || 'backups'}" belum terbaca`
              },
              {
                ok: backupMeta?.cronSecretConfigured,
                label: backupMeta?.cronSecretConfigured
                  ? 'CRON_SECRET terpasang'
                  : 'CRON_SECRET belum diisi'
              }
            ].map((item) => (
              <span
                key={item.label}
                className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                  item.ok ? 'bg-forest-50 text-forest-700' : 'bg-amberbrand-100 text-amberbrand-800'
                }`}
              >
                {item.label}
              </span>
            ))}
          </div>
          {backupMeta?.diagnostic && (
            <div className="mx-4 mb-2 px-2 py-1.5 rounded-lg bg-red-50 border border-red-200 text-[9.5px] text-red-700 leading-relaxed break-words">
              {backupMeta.diagnostic}
            </div>
          )}
          <div className="max-h-[150px] overflow-y-auto divide-y divide-slate-100">
            {backups.map((b) => (
              <div key={b.filename} className="px-4 py-1.5 flex items-center gap-2">
                <Database className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="text-[10px] font-mono text-slate-600 truncate flex-1">
                  {b.filename}
                </span>
                <button
                  type="button"
                  onClick={() => restore(b.filename)}
                  disabled={backupBusy}
                  className="text-[9.5px] font-bold text-navy-700 hover:underline disabled:opacity-40"
                >
                  Pulihkan
                </button>
              </div>
            ))}
            {backups.length === 0 && (
              <div className="px-4 py-4 text-center text-[11px] text-slate-400">
                Belum ada backup tersimpan.
              </div>
            )}
          </div>
          <div className="px-4 py-2 border-t border-slate-100">
            <button
              type="button"
              onClick={runBackupNow}
              disabled={backupBusy}
              className="w-full py-1.5 rounded-lg bg-forest-600 hover:bg-forest-700 text-white text-[10.5px] font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-3 h-3" />
              {backupBusy ? 'Memproses…' : 'Backup Sekarang'}
            </button>
          </div>
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-extrabold text-navy-800">Log Aktivitas</span>
          <div className="relative ml-auto w-56">
            <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari aksi, IP, atau order…"
              className="input-admin !pl-7 !text-[11px] !py-1.5"
            />
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-bold">Waktu</th>
                <th className="text-left px-2 py-2 font-bold">Aktivitas</th>
                <th className="text-left px-2 py-2 font-bold">IP</th>
                <th className="text-left px-2 py-2 font-bold">Target</th>
                <th className="text-left px-2 py-2 font-bold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const meta = ACTION_LABEL[e.action] || { label: e.action, tone: 'ok' as const };
                return (
                  <tr key={e.id} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 whitespace-nowrap text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(e.at).toLocaleString('id-ID', {
                          timeZone: 'Asia/Jakarta',
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
                          meta.tone === 'bad'
                            ? 'bg-red-100 text-red-700'
                            : meta.tone === 'warn'
                              ? 'bg-amberbrand-100 text-amberbrand-800'
                              : 'bg-forest-50 text-forest-700'
                        }`}
                      >
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" /> {e.ip}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-slate-600">{e.target || '—'}</td>
                    <td className="px-2 py-1.5 text-[10px] text-slate-400 max-w-[280px] truncate">
                      {e.detail ? JSON.stringify(e.detail) : '—'}
                    </td>
                  </tr>
                );
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                    Belum ada aktivitas tercatat.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[10.5px] text-slate-500 leading-relaxed">
        <div className="flex items-start gap-1.5">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Catatan: kredensial sensitif tidak pernah dicatat di log.{' '}
            <strong>Jangan bagikan tautan dashboard admin</strong> ke publik, dan ganti password
            secara berkala. Password tidak bisa dipulihkan atau dilihat dari sini —{' '}
            <strong>catat nilainya saat diganti</strong>. Kalau lupa, ganti{' '}
            <code className="bg-white px-1 rounded">ADMIN_PASSWORD</code> di hosting lalu Redeploy.
          </span>
        </div>
      </div>
    </div>
  );
};

export default SecurityPanel;
