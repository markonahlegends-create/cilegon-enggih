import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Flame, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArticleCard } from '../components/ArticleCard';
import { SectionHeading } from '../components/SectionHeading';
import { Sidebar } from '../components/Sidebar';
import { useApi, useMeta } from '../lib/hooks';
import { useSite } from '../lib/site';
import type { ArticleListResponse, ArticleListItem } from '../lib/api';
import { formatDate, todayLabel } from '../lib/format';

function Rail({ title, subtitle, category, items, color = 'navy' }: { title: string; subtitle?: string; category: string; items: ArticleListItem[]; color?: 'navy' | 'brand' }) {
  if (!items.length) return null;
  const catTitle = category || '';
  return (
    <section className="mt-10">
      <SectionHeading title={title} subtitle={subtitle} to={`/kategori/${catTitle}`} accent={color === 'brand' ? 'brand' : 'navy'} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 3).map((article) => <ArticleCard key={article.id} article={article} variant="feature" />)}
      </div>
    </section>
  );
}

function HomeSkeleton() {
  return (
    <div className="container-news py-7">
      <div className="skeleton h-[320px] rounded-2xl sm:h-[440px]" />
      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-5 sm:grid-cols-3">{[1, 2, 3].map((i) => <div key={i}><div className="skeleton aspect-[16/10]"/><div className="skeleton mt-3 h-4 w-4/5"/><div className="skeleton mt-2 h-4 w-3/5"/></div>)}</div>
        <div className="skeleton h-72 rounded-2xl" />
      </div>
    </div>
  );
}

export function HomePage() {
  const { data: site, loading } = useSite();
  const { data: latest } = useApi<ArticleListResponse>('/api/articles?limit=12');
  const { data: popular } = useApi<{ items: ArticleListItem[] }>('/api/popular?limit=5');
  const [page, setPage] = useState(0);
  const headlines = site?.headlines || [];
  const hero = headlines[0];
  const sideHeadlines = headlines.slice(1, 4);

  useMeta({ title: 'Info Kelurahan — Kabar Warga Karang Asem, Cilegon', description: site?.settings.description || 'Berita, informasi, layanan publik, dan agenda warga Kelurahan Karang Asem, Cilegon.' });

  useEffect(() => {
    if (headlines.length < 2) return;
    const timer = window.setInterval(() => setPage((p) => (p + 1) % headlines.length), 7000);
    return () => window.clearInterval(timer);
  }, [headlines.length]);

  const categories = site?.categories || [];
  const articleItems = latest?.items || [];
  const heroArticle = headlines.length ? headlines[page % headlines.length] : hero;
  const heroList = useMemo(() => articleItems.filter((item) => item.id !== heroArticle?.id).slice(0, 6), [articleItems, heroArticle]);

  if (loading && !site) return <HomeSkeleton />;

  return (
    <>
      <div className="container-news pt-4 sm:pt-6">
        {/* Headline utama dengan deretan berita pilihan */}
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.8fr)_minmax(270px,.85fr)]">
          {heroArticle ? (
            <div className="relative min-h-[300px] sm:min-h-[420px]">
              <ArticleCard article={heroArticle} variant="hero" className="h-full" />
              {headlines.length > 1 && (
                <div className="absolute bottom-3 right-3 z-20 flex gap-1.5 sm:bottom-4 sm:right-4">
                  <button type="button" aria-label="Berita sebelumnya" onClick={() => setPage((p) => (p - 1 + headlines.length) % headlines.length)} className="grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur hover:bg-black/40"><ChevronLeft className="h-4 w-4" /></button>
                  <button type="button" aria-label="Berita berikutnya" onClick={() => setPage((p) => (p + 1) % headlines.length)} className="grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-black/20 text-white backdrop-blur hover:bg-black/40"><ChevronRight className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          ) : <div className="surface grid min-h-[300px] place-items-center text-sm text-slate-500">Berita utama segera hadir.</div>}

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {sideHeadlines.map((article, index) => (
              <ArticleCard key={article.id} article={article} variant="wide" showDek={index === 0} className="surface p-3 sm:p-0 sm:shadow-none sm:border-0 sm:bg-transparent dark:sm:bg-transparent" />
            ))}
            {sideHeadlines.length === 0 && heroList.slice(0, 3).map((article) => <ArticleCard key={article.id} article={article} variant="row" />)}
          </div>
        </div>

        {/* Headline navigation indicators */}
        {headlines.length > 1 && <div className="mt-3 flex items-center gap-1.5">{headlines.slice(0, 7).map((a, i) => <button key={a.id} type="button" onClick={() => setPage(i)} aria-label={`Headline ${i + 1}`} className={`h-1.5 rounded-full transition-all ${page % headlines.length === i ? 'w-7 bg-brand-600' : 'w-2 bg-slate-300 dark:bg-white/20'}`} />)}<span className="ml-auto text-[10px] font-medium text-slate-400">{todayLabel()}</span></div>}
      </div>

      {/* konten utama + sidebar */}
      <div className="container-news mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 h-7 w-1 rounded-full bg-brand-600" />
              <div><h2 className="text-lg font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-xl">Berita Terbaru</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Informasi terkini dari lingkungan kita</p></div>
            </div>
            <Link to="/berita" className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:gap-2 dark:text-brand-400">Semua berita <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>

          <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
            {articleItems.slice(0, 6).map((article) => <ArticleCard key={article.id} article={article} variant="feature" />)}
          </div>
          {!articleItems.length && <div className="surface p-8 text-center text-sm text-slate-500">Belum ada berita terbaru.</div>}

          <div className="mt-10 overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-[#a81c2d] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-5 sm:p-6">
            <div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15"><Flame className="h-5 w-5" /></div><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-white/70">Info penting</p><h3 className="mt-1 text-lg font-extrabold">Ada informasi yang perlu diketahui warga?</h3><p className="mt-1 text-xs text-white/75">Kirim pengumuman, aduan, atau kabar dari lingkungan Anda.</p></div></div>
            <Link to="/kontak" className="mt-4 inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-brand-700 transition hover:bg-white/90 sm:mt-0">Hubungi Redaksi <ArrowRight className="h-4 w-4" /></Link>
          </div>

          {categories.slice(0, 3).map((category, index) => (
            <CategoryRail key={category.id} category={category} index={index} />
          ))}

          <section className="mt-10 surface p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <SectionHeading title="Kabar Pilihan" subtitle="Pilihan redaksi untuk Anda" accent="gold" />
              <Sparkles className="mb-4 h-4 w-4 text-gold-500" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {articleItems.slice(6, 10).map((article) => <ArticleCard key={article.id} article={article} variant="row" />)}
            </div>
          </section>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link to="/agenda" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-card dark:border-white/10 dark:bg-white/[.03]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10"><CalendarDays className="h-5 w-5" /></span><span className="flex-1"><span className="block text-sm font-extrabold text-slate-900 dark:text-white">Agenda Warga</span><span className="mt-0.5 block text-xs text-slate-500">Lihat kegiatan di sekitar Anda</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" /></Link>
            <Link to="/berita?sort=popular" className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-200 hover:shadow-card dark:border-white/10 dark:bg-white/[.03]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10"><Flame className="h-5 w-5" /></span><span className="flex-1"><span className="block text-sm font-extrabold text-slate-900 dark:text-white">Paling Banyak Dibaca</span><span className="mt-0.5 block text-xs text-slate-500">Berita populer pilihan warga</span></span><ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" /></Link>
          </div>
        </main>
        <div className="lg:pt-0"><Sidebar popular={popular?.items} /></div>
      </div>
    </>
  );
}

function CategoryRail({ category, index }: { category: { slug: string; name: string }; index: number }) {
  const { data } = useApi<ArticleListResponse>(`/api/articles?category=${encodeURIComponent(category.slug)}&limit=3`);
  if (!data?.items.length) return null;
  return (
    <section className="mt-10">
      <SectionHeading title={category.name} to={`/kategori/${category.slug}`} accent={index === 1 ? 'gold' : 'navy'} />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((article) => <ArticleCard key={article.id} article={article} variant="feature" />)}</div>
    </section>
  );
}
