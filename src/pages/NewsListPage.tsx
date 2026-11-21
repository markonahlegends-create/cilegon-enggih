import { useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, ChevronDown, Search, SlidersHorizontal } from 'lucide-react';
import { ArticleCard } from '../components/ArticleCard';
import { SectionHeading } from '../components/SectionHeading';
import { Sidebar } from '../components/Sidebar';
import { useApi, useMeta } from '../lib/hooks';
import { useSite } from '../lib/site';
import type { ArticleListResponse } from '../lib/api';
import { slugToTitle } from '../lib/format';

export function NewsListPage({ mode = 'all' }: { mode?: 'all' | 'category' | 'search' | 'tag' | 'saved' }) {
  const { slug = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { search, pathname } = useLocation();
  const { data: site } = useSite();
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'latest';
  const category = site?.categories.find((item) => item.slug === slug);
  const title = mode === 'category' ? category?.name || slugToTitle(slug) : mode === 'search' ? `Hasil pencarian: “${q}”` : mode === 'tag' ? `Topik: ${slugToTitle(slug)}` : mode === 'saved' ? 'Berita Tersimpan' : 'Semua Berita';

  const apiPath = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: '12', sort });
    if (mode === 'category') params.set('category', slug);
    if (mode === 'search') params.set('q', q);
    if (mode === 'tag') params.set('tag', slug);
    return `/api/articles?${params.toString()}`;
  }, [mode, page, sort, slug, q]);
  const { data, loading, error } = useApi<ArticleListResponse>(mode === 'saved' ? null : apiPath);
  const items = mode === 'saved' ? [] : data?.items || [];

  useMeta({ title: `${title} — Info Kelurahan`, description: mode === 'category' ? category?.description : `Baca ${title.toLowerCase()} dari Info Kelurahan, portal informasi seluruh kelurahan Kota Cilegon.` });

  const setSort = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('sort', value);
    next.delete('page');
    setSearchParams(next);
    setPage(1);
  };

  return (
    <div className="container-news py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-slate-500"><Link to="/" className="hover:text-brand-600">Beranda</Link><span>/</span><span className="text-slate-700 dark:text-slate-300">{title}</span></div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500 dark:text-slate-400">{mode === 'category' && category ? category.description : mode === 'search' ? `Menelusuri berita yang cocok dengan kata kunci “${q}”.` : mode === 'tag' ? 'Berita dan informasi terkini berdasarkan topik.' : 'Ikuti berita dan informasi terbaru dari berbagai wilayah di Kota Cilegon.'}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <SlidersHorizontal className="h-4 w-4" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="field !w-auto !py-2 !text-xs">
            <option value="latest">Terbaru</option><option value="popular">Terpopuler</option><option value="oldest">Terlama</option>
          </select>
        </label>
      </div>

      {mode === 'search' && <form onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const value = String(form.get('q') || ''); setSearchParams(value ? { q: value } : {}); setPage(1); }} className="mb-6 flex max-w-xl gap-2"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input name="q" defaultValue={q} placeholder="Cari berita…" className="field !pl-9"/></div><button className="btn-primary">Cari</button></form>}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main>
          {loading && <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <div key={i}><div className="skeleton aspect-[16/10]"/><div className="skeleton mt-3 h-4 w-4/5"/><div className="skeleton mt-2 h-4 w-3/5"/></div>)}</div>}
          {error && <div className="surface p-6 text-sm text-brand-600">{error}</div>}
          {!loading && !items.length && !error && <div className="surface px-6 py-14 text-center"><Search className="mx-auto h-8 w-8 text-slate-300"/><h2 className="mt-3 font-bold text-slate-800 dark:text-white">Belum ada berita ditemukan</h2><p className="mt-1 text-sm text-slate-500">Coba kata kunci atau filter yang berbeda.</p></div>}
          {!!items.length && <>
            {mode === 'category' && items[0] && page === 1 && <div className="mb-7"><ArticleCard article={items[0]} variant="hero" /></div>}
            <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">{(mode === 'category' && page === 1 ? items.slice(1) : items).map((article) => <ArticleCard key={article.id} article={article} variant="feature" />)}</div>
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-white/10">
              <button disabled={page <= 1} onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-ghost !py-2 disabled:opacity-40"><ArrowLeft className="h-4 w-4"/> Sebelumnya</button>
              <span className="text-xs font-medium text-slate-500">Halaman {data?.meta.page || page} dari {data?.meta.totalPages || 1}</span>
              <button disabled={!data?.meta.hasMore} onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="btn-ghost !py-2 disabled:opacity-40">Berikutnya <ArrowRight className="h-4 w-4"/></button>
            </div>
          </>}
        </main>
        <Sidebar />
      </div>
    </div>
  );
}
