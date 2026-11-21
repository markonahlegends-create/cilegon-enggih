import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, Bookmark, CalendarDays, Clock, Eye, MessageCircle, Printer, Share2, UserRound } from 'lucide-react';
import { ArticleCard } from '../components/ArticleCard';
import { Comments } from '../components/Comments';
import { SectionHeading } from '../components/SectionHeading';
import { ShareButtons } from '../components/ShareButtons';
import { Sidebar } from '../components/Sidebar';
import { useApi, useBookmarks, useMeta, useScrollProgress } from '../lib/hooks';
import { renderMarkdown } from '../lib/markdown';
import type { ArticleResponse } from '../lib/api';
import { formatCompact, formatDateWithTime } from '../lib/format';

export function ArticlePage() {
  const { slug = '' } = useParams();
  const { data, loading, error } = useApi<ArticleResponse>(`/api/articles/${encodeURIComponent(slug)}`, [slug]);
  const { has, toggle } = useBookmarks();
  const progress = useScrollProgress();
  const [renderedContent, setRenderedContent] = useState('');
  const article = data?.article;

  useEffect(() => {
    if (!article) return;
    setRenderedContent(renderMarkdown(article.content));
  }, [article?.content]);

  useMeta({
    title: data?.seo?.title || article?.title || 'Memuat berita… — Info Kelurahan',
    description: data?.seo?.description || article?.dek,
    image: data?.seo?.image || article?.cover,
    type: 'article',
    publishedAt: article?.publishedAt,
    author: article?.authorName,
  });

  const shareTitle = article?.title || '';
  const canonical = useMemo(() => `/artikel/${slug}`, [slug]);

  if (loading && !article) return <ArticleSkeleton />;
  if (error || !article) {
    return <div className="container-news py-16 text-center"><AlertTriangle className="mx-auto h-9 w-9 text-brand-500"/><h1 className="mt-4 text-xl font-extrabold text-navy-900 dark:text-white">Berita tidak ditemukan</h1><p className="mt-2 text-sm text-slate-500">Tautan mungkin sudah berubah atau berita tidak tersedia.</p><Link to="/berita" className="btn-primary mt-5"><ArrowLeft className="h-4 w-4"/> Kembali ke berita</Link></div>;
  }

  const saved = has(article.slug);
  const related = data?.related || [];
  const popular = data?.popular || [];

  return (
    <>
      <div className="fixed left-0 top-0 z-[60] h-[3px] bg-brand-600 transition-[width]" style={{ width: `${progress}%` }} />
      <div className="container-news py-5 sm:py-7">
        <div className="mb-5 flex flex-wrap items-center gap-2 text-[11px] font-medium text-slate-500">
          <Link to="/" className="hover:text-brand-600">Beranda</Link><span>/</span><Link to={`/kategori/${article.category}`} className="hover:text-brand-600">{article.categoryName}</Link><span>/</span><span className="max-w-[55vw] truncate text-slate-700 dark:text-slate-300">Berita</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="min-w-0">
            <article>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Link to={`/kategori/${article.category}`} className="badge" style={{ backgroundColor: article.categoryAccent }}>{article.categoryName}</Link>
                {article.breaking && <span className="badge bg-brand-600">Berita Terkini</span>}
                {article.tags?.slice(0, 2).map((tag) => <Link key={tag} to={`/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`} className="text-[10.5px] font-semibold text-slate-500 hover:text-brand-600">#{tag}</Link>)}
              </div>
              <h1 className="text-[25px] font-extrabold leading-[1.2] tracking-tight text-navy-950 dark:text-white sm:text-3xl lg:text-[40px]">{article.title}</h1>
              {article.dek && <p className="mt-3 font-serif text-[16px] leading-relaxed text-slate-600 dark:text-slate-300 sm:text-lg">{article.dek}</p>}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-y border-slate-200 py-3 dark:border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10"><UserRound className="h-5 w-5"/></span>
                  <span><span className="block text-[12px] font-bold text-slate-800 dark:text-slate-100">{article.authorName}</span><span className="mt-0.5 block text-[10.5px] text-slate-500">{article.authorRole || 'Redaksi Info Kelurahan'}</span></span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
                  <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5"/>{formatDateWithTime(article.publishedAt)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5"/>{article.readingTime} menit baca</span>
                  <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5"/>{formatCompact(article.views)} dibaca</span>
                </div>
              </div>

              <figure className="mt-5 overflow-hidden rounded-2xl bg-slate-100 dark:bg-white/5">
                <img src={article.cover} alt={article.title} className="max-h-[560px] w-full object-cover" fetchPriority="high" />
                {article.coverCaption && <figcaption className="px-3 py-2 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">{article.coverCaption}</figcaption>}
              </figure>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <ShareButtons title={shareTitle} />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => toggle(article.slug)} className="btn-ghost !rounded-full !px-3 !py-2 text-[11px]" aria-pressed={saved}><Bookmark className={`h-4 w-4 ${saved ? 'fill-brand-600 text-brand-600' : ''}`}/>{saved ? 'Tersimpan' : 'Simpan'}</button>
                  <button type="button" onClick={() => window.print()} className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10" aria-label="Cetak"><Printer className="h-4 w-4"/></button>
                </div>
              </div>

              <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_230px]">
                <div className="prose-news min-w-0" dangerouslySetInnerHTML={{ __html: renderedContent }} />
                <aside className="hidden xl:block">
                  <div className="sticky top-28 rounded-xl border border-slate-200 p-4 dark:border-white/10">
                    <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-400">Di dalam berita</p>
                    <div className="mt-3 space-y-2 text-xs leading-snug text-slate-600 dark:text-slate-300">
                      {article.content.split('\n').filter((line: string) => line.startsWith('## ')).map((line: string, i: number) => <p key={i} className="border-l-2 border-brand-500/50 pl-2">{line.replace(/^##\s+/, '')}</p>)}
                      {!article.content.includes('## ') && <p>Berita lengkap</p>}
                    </div>
                    <a href="#komentar" className="mt-4 flex items-center gap-2 text-xs font-bold text-brand-600"><MessageCircle className="h-4 w-4"/> Diskusi warga</a>
                  </div>
                </aside>
              </div>

              {article.sourceUrl && <aside className="mt-7 rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/5"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-sky-800 dark:text-sky-300">Sumber informasi</p><p className="mt-1 text-xs text-slate-700 dark:text-slate-200">Ringkasan dari {article.sourceName || 'sumber resmi'}{article.sourceDate ? ` · terbit ${article.sourceDate}` : ''}.</p><a href={article.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-bold text-sky-800 underline underline-offset-2 dark:text-sky-300">Baca publikasi asli <ArrowRight className="ml-1 h-3.5 w-3.5"/></a></aside>}

              <div className="mt-8 rounded-2xl border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-500/20 dark:bg-brand-500/5 sm:p-5">
                <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-brand-600 shadow-sm dark:bg-white/10"><Share2 className="h-4 w-4"/></span><p className="text-[12px] leading-relaxed text-slate-600 dark:text-slate-300"><b className="text-slate-800 dark:text-white">Punya informasi terkait?</b> Kirim klarifikasi atau informasi tambahan kepada redaksi melalui <Link to="/kontak" className="font-bold text-brand-600 underline underline-offset-2">halaman kontak</Link>. Setiap informasi akan diverifikasi sebelum dipublikasikan.</p></div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">{article.tags?.map((tag) => <Link key={tag} to={`/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`} className="chip">#{tag}</Link>)}</div>
            </article>

            <div className="mt-8 grid grid-cols-2 gap-3 border-y border-slate-200 py-4 dark:border-white/10">
              {data?.prev ? <Link to={`/artikel/${data.prev.slug}`} className="group"><span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400"><ArrowLeft className="h-3 w-3"/> Berita sebelumnya</span><span className="mt-1 line-clamp-2 block text-xs font-bold leading-snug text-slate-700 group-hover:text-brand-600 dark:text-slate-200">{data.prev.title}</span></Link> : <span />}
              {data?.next && <Link to={`/artikel/${data.next.slug}`} className="group text-right"><span className="flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Berita selanjutnya <ArrowRight className="h-3 w-3"/></span><span className="mt-1 line-clamp-2 block text-xs font-bold leading-snug text-slate-700 group-hover:text-brand-600 dark:text-slate-200">{data.next.title}</span></Link>}
            </div>

            {!!related.length && <section className="mt-8"><SectionHeading title="Berita Terkait" to={`/kategori/${article.category}`}/><div className="grid gap-5 sm:grid-cols-2">{related.slice(0,4).map((item) => <ArticleCard key={item.id} article={item} variant="feature"/>)}</div></section>}
            <div className="mt-9"><Comments slug={article.slug} comments={article.comments || []}/></div>
          </main>
          <div><Sidebar popular={popular}/></div>
        </div>
      </div>
    </>
  );
}

function ArticleSkeleton() {
  return <div className="container-news py-8"><div className="skeleton h-5 w-1/3"/><div className="skeleton mt-4 h-12 w-full sm:w-4/5"/><div className="skeleton mt-3 h-5 w-2/3"/><div className="skeleton mt-6 aspect-[16/8] rounded-2xl"/><div className="mt-7 space-y-3">{[1,2,3,4].map((i)=><div key={i} className="skeleton h-4 w-full"/>)}</div></div>;
}
