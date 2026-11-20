import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Facebook, Link2, MessageCircle, Send, Share2, X } from 'lucide-react';
import {
  SHARE_TARGETS,
  canNativeShare,
  copyText,
  openShareWindow,
  type ShareChannel
} from '../lib/share';
import { trackShare } from '../lib/tracker';

/**
 * PANEL BAGIKAN PRODUK.
 *
 * KENAPA BUKAN HANYA `navigator.share`
 * Satu tombol dengan Web Share API terlihat rapi, tetapi di lapangan:
 *  - desktop Chrome/Firefox: `navigator.share` tidak ada → dulu jatuh ke
 *    "salin tautan" tanpa pilihan lain;
 *  - browser in-app Instagram/Facebook/TikTok: Web Share ada tetapi dialognya
 *    tidak muncul, atau muncul lalu langsung tertutup;
 *  - sebagian pengguna memang ingin menyalin tautan, bukan membuka dialog.
 *
 * Karena itu panel ini selalu menampilkan pilihan nyata (WhatsApp, Facebook,
 * Telegram, X, salin) dan menambahkan "Bagikan ke aplikasi lain" hanya ketika
 * perangkat benar-benar mendukungnya.
 */
interface Props {
  /** URL bersih yang akan dibagikan (sudah canonical). */
  url: string;
  /** Judul produk untuk teks ajakan. */
  title: string;
  /** Nama produk (untuk pesan toast & analitik). */
  productName: string;
  productId: string;
  onToast: (title: string, message: string, kind?: 'success' | 'info' | 'error') => void;
  /** Ubah gaya tombol pemicu bila perlu. */
  triggerClassName?: string;
  triggerLabel?: string;
  /** Panel langsung terbuka (dipakai di halaman detail bila diinginkan). */
  compact?: boolean;
}

const IKON: Record<ShareChannel, React.FC<{ className?: string }>> = {
  whatsapp: MessageCircle,
  facebook: Facebook,
  telegram: Send,
  x: X,
  copy: Link2,
  native: Share2
};

export const ShareMenu: React.FC<Props> = ({
  url,
  title,
  productName,
  productId,
  onToast,
  triggerClassName,
  triggerLabel = 'Bagikan',
  compact = false
}) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Tutup saat klik di luar atau tekan Escape — sama seperti popover lain.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const teks = `${title} — Cilegon Enggih`;

  const pilih = async (channel: ShareChannel, build?: (u: string, t: string) => string) => {
    if (channel === 'copy') {
      const ok = await copyText(url);
      setCopied(ok);
      onToast(
        ok ? 'Tautan Disalin' : 'Gagal Menyalin',
        ok ? 'Tempel di WhatsApp, Instagram, atau mana pun.' : 'Salin manual dari address bar.',
        ok ? 'success' : 'error'
      );
      if (ok) {
        trackShare(productId, productName);
        window.setTimeout(() => setCopied(false), 2000);
      }
      return;
    }

    if (channel === 'native') {
      try {
        await navigator.share({ title, text: teks, url });
        trackShare(productId, productName);
        setOpen(false);
      } catch (err) {
        // Pengguna menutup dialog: bukan kesalahan, jangan beri peringatan.
        if (!(err instanceof DOMException && err.name === 'AbortError')) {
          onToast('Bagikan Tidak Tersedia', 'Coba salah satu tombol di bawah.', 'info');
        }
      }
      return;
    }

    if (build) {
      openShareWindow(build(url, teks));
      trackShare(productId, productName);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          triggerClassName ||
          'py-1.5 px-3 rounded-lg hover:bg-slate-50 flex items-center justify-center gap-1.5'
        }
      >
        <Share2 className="w-4 h-4" />
        <span>{triggerLabel}</span>
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute z-40 ${compact ? 'left-0' : 'right-0'} mt-1 w-56 rounded-xl border border-slate-200 bg-white shadow-xl p-1.5`}
        >
          <div className="px-2 pt-1 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Bagikan produk
          </div>

          {canNativeShare() && (
            <button
              type="button"
              onClick={() => pilih('native')}
              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <Share2 className="w-4 h-4 text-navy-700" />
              Bagikan ke aplikasi lain
            </button>
          )}

          {SHARE_TARGETS.map((t) => {
            const Ikon = IKON[t.channel];
            return (
              <button
                key={t.channel}
                type="button"
                onClick={() => pilih(t.channel, t.build)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <Ikon className="w-4 h-4 text-navy-700" />
                {t.label}
              </button>
            );
          })}

          <div className="my-1 h-px bg-slate-100" />

          <button
            type="button"
            onClick={() => pilih('copy')}
            className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 text-xs font-semibold text-slate-700"
          >
            {copied ? (
              <Check className="w-4 h-4 text-forest-600" />
            ) : (
              <Copy className="w-4 h-4 text-navy-700" />
            )}
            {copied ? 'Tersalin!' : 'Salin tautan'}
          </button>

          {/* Tautan ditampilkan supaya pengguna bisa menyalin manual bila
              clipboard diblokir browser in-app. */}
          <div className="mt-1 px-2 pb-1">
            <div className="text-[9.5px] text-slate-400 break-all leading-snug">{url}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShareMenu;
