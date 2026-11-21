import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, Search, TrendingUp, X } from 'lucide-react';
import { useApi, useDebounced } from '../lib/hooks';
import type { ArticleListResponse } from '../lib/api';
import { useSite } from '../lib/site';

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [term, setTerm] = useState('');
  const debounced = useDebounced(term, 250);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: site } = useSite();

  const path = useMemo(
    () => (debounced.trim().length >= 2 ? `/api/articles?q=${encodeURIComponent(debounced.trim())}&limit=6` : null),
    [debounced]
  );
  const { data, loading } = useApi<ArticleListResponse>(path);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setTerm('');
  }, [open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!term.trim()) return;
    onClose();
    navigate(`/cari?q=${encodeURIComponent(term.trim())}`);
  };

  const trending = (site?.tags || []).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Pencarian">
      <button
        type="button"
        aria-label="Tutup pencarian"
        onClick={onClose}
        className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-2xl animate-fadeUp overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-float dark:border-white/10 dark:bg-navy-900">
        <form onSubmit={submit} className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/10">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Cari berita, pengumuman, agenda…"
            className="w-full bg-transparent py-4 text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
            aria-label="Kata kunci"
          />
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
            aria-label="Tutup"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </form>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {term.trim().length < 2 && (
            <div className="p-3">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" /> Populer dicari
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {trending.map((tag) => (
                  <button
                    key={tag.slug}
                    type="button"
                    onClick={() => setTerm(tag.name)}
                    className="chip"
                  >
                    {tag.name}
                    <span className="text-[10px] text-slate-400">{tag.count}</span>
                  </button>
                ))}
                {!trending.length &&
                  ['Musrenbang', 'Posyandu', 'Drainase', 'UMKM', 'DBD'].map((word) => (
                    <button key={word} type="button" onClick={() => setTerm(word)} className="chip">
                      {word}
                    </button>
                  ))}
              </div>
              <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
                Tips: gunakan kata kunci singkat seperti <em>drainase</em> atau <em>posyandu</em>. Tekan{' '}
                <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] dark:border-white/20">Esc</kbd>{' '}
                untuk menutup.
              </p>
            </div>
          )}

          {loading && term.trim().length >= 2 && (
            <div className="space-y-2 p-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 rounded-xl p-2">
                  <div className="skeleton h-14 w-20" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="skeleton h-3 w-4/5" />
                    <div className="skeleton h-3 w-2/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && data?.items.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Tidak ada hasil untuk “{term}”. Coba kata kunci lain.
            </p>
          )}

          {!loading &&
            data?.items.map((article) => (
              <Link
                key={article.id}
                to={`/artikel/${article.slug}`}
                onClick={onClose}
                className="flex gap-3 rounded-xl p-2 transition hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <img
                  src={article.cover}
                  alt=""
                  loading="lazy"
                  className="h-14 w-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: article.categoryAccent }}>
                    {article.categoryName}
                  </p>
                  <p className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                    {article.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-400">
                    <Clock className="h-3 w-3" /> {article.readingTime} menit baca
                  </p>
                </div>
              </Link>
            ))}

          {!loading && data && data.items.length > 0 && (
            <button
              type="button"
              onClick={submit}
              className="mt-1 flex w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
            >
              Lihat semua hasil untuk “{term}”
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
