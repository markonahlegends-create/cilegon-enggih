import { useState } from 'react';
import { Check, Copy, Facebook, Link2, Send, Share2 } from 'lucide-react';
import { useCopy } from '../lib/hooks';

export function ShareButtons({ title, compact = false }: { title: string; compact?: boolean }) {
  const { copied, copy } = useCopy();
  const [shared, setShared] = useState(false);
  const url = typeof window !== 'undefined' ? window.location.href : '';
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const buttonClass = compact
    ? 'grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-300'
    : 'inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-300';

  const shareNative = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        setShared(true);
        setTimeout(() => setShared(false), 1500);
      } else {
        await copy(url);
      }
    } catch {
      /* cancel */
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!compact && <span className="mr-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Bagikan</span>}
      <a className={buttonClass} href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`} target="_blank" rel="noreferrer" aria-label="Bagikan ke Facebook" title="Facebook"><Facebook className="h-4 w-4" />{!compact && 'Facebook'}</a>
      <a className={buttonClass} href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`} target="_blank" rel="noreferrer" aria-label="Bagikan ke Telegram" title="Telegram"><Send className="h-4 w-4" />{!compact && 'Telegram'}</a>
      <button type="button" className={buttonClass} onClick={() => copy(url)} aria-label="Salin tautan" title="Salin tautan">
        {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}{!compact && (copied ? 'Tersalin' : 'Salin tautan')}
      </button>
      <button type="button" className={`${buttonClass} sm:hidden`} onClick={shareNative} aria-label="Bagikan" title="Bagikan">
        {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
