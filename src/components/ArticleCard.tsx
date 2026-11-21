import { Link } from 'react-router-dom';
import { Bookmark, Clock, Eye, MessageSquare } from 'lucide-react';
import type { ArticleListItem } from '../lib/api';
import { formatCompact, formatDate, timeAgo } from '../lib/format';
import { useBookmarks } from '../lib/hooks';

type Variant = 'hero' | 'feature' | 'standard' | 'wide' | 'row' | 'numbered' | 'minimal';

interface Props {
  article: ArticleListItem;
  variant?: Variant;
  index?: number;
  showDek?: boolean;
  className?: string;
}

function CategoryBadge({ article, className = '' }: { article: ArticleListItem; className?: string }) {
  return (
    <Link
      to={`/kategori/${article.category}`}
      className={`badge relative z-10 ${className}`}
      style={{ backgroundColor: article.categoryAccent }}
    >
      {article.categoryName}
    </Link>
  );
}

function Meta({ article, light = false }: { article: ArticleListItem; light?: boolean }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium ${
        light ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        <Clock className="h-3 w-3" /> {article.readingTime} mnt baca
      </span>
      <span className="opacity-40">•</span>
      <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt)}</time>
      {article.views > 0 && (
        <>
          <span className="opacity-40">•</span>
          <span className="inline-flex items-center gap-1">
            <Eye className="h-3 w-3" /> {formatCompact(article.views)}
          </span>
        </>
      )}
    </div>
  );
}

function SaveButton({ slug, overlay = false }: { slug: string; overlay?: boolean }) {
  const { has, toggle } = useBookmarks();
  const saved = has(slug);
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(slug);
      }}
      aria-label={saved ? 'Hapus dari tersimpan' : 'Simpan berita'}
      className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur transition ${
        overlay
          ? 'border-white/30 bg-black/25 text-white hover:bg-black/40'
          : 'border-slate-200 bg-white text-slate-500 hover:text-brand-600 dark:border-white/10 dark:bg-navy-900 dark:text-slate-400'
      } ${saved ? '!border-brand-500 !text-brand-600 dark:!text-brand-400' : ''}`}
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} />
    </button>
  );
}

export function ArticleCard({ article, variant = 'standard', index, showDek = true, className = '' }: Props) {
  if (variant === 'numbered') {
    return (
      <article className={`group flex gap-3.5 ${className}`}>
        <span className="w-7 shrink-0 pt-0.5 font-sans text-2xl font-extrabold leading-none text-brand-600/25 dark:text-brand-400/30">
          {String((index ?? 0) + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h3 className="text-[13.5px] font-bold leading-snug text-slate-800 transition group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
            <Link to={`/artikel/${article.slug}`} className="line-clamp-2">
              {article.title}
            </Link>
          </h3>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span style={{ color: article.categoryAccent }} className="font-semibold">
              {article.categoryName}
            </span>
            <span className="opacity-40">•</span>
            <span>{formatCompact(article.views)} dibaca</span>
          </div>
        </div>
      </article>
    );
  }

  if (variant === 'row') {
    return (
      <article className={`group flex gap-3 ${className}`}>
        <Link to={`/artikel/${article.slug}`} className="relative block w-[92px] shrink-0 overflow-hidden rounded-lg bg-slate-100 dark:bg-white/5 sm:w-[104px]">
          <img
            src={article.cover}
            alt={article.title}
            loading="lazy"
            className="h-[64px] w-full object-cover transition duration-500 group-hover:scale-105 sm:h-[72px]"
          />
        </Link>
        <div className="min-w-0">
          <Link
            to={`/kategori/${article.category}`}
            className="text-[10px] font-bold uppercase tracking-wider"
            style={{ color: article.categoryAccent }}
          >
            {article.categoryName}
          </Link>
          <h3 className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug text-slate-800 transition group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
            <Link to={`/artikel/${article.slug}`}>{article.title}</Link>
          </h3>
          <p className="mt-1 text-[10.5px] text-slate-500 dark:text-slate-400">{timeAgo(article.publishedAt)}</p>
        </div>
      </article>
    );
  }

  if (variant === 'minimal') {
    return (
      <article className={`group ${className}`}>
        <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-wider">
          <span style={{ color: article.categoryAccent }}>{article.categoryName}</span>
          <span className="text-slate-400">•</span>
          <span className="font-medium normal-case tracking-normal text-slate-500 dark:text-slate-400">
            {timeAgo(article.publishedAt)}
          </span>
        </div>
        <h3 className="mt-1 text-[15px] font-bold leading-snug text-slate-900 transition group-hover:text-brand-600 dark:text-slate-100 dark:group-hover:text-brand-400">
          <Link to={`/artikel/${article.slug}`} className="line-clamp-2">
            {article.title}
          </Link>
        </h3>
      </article>
    );
  }

  if (variant === 'hero') {
    return (
      <article className={`group relative overflow-hidden rounded-2xl bg-navy-900 ${className}`}>
        <Link to={`/artikel/${article.slug}`} className="block">
          <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[16/9]">
            <img
              src={article.cover}
              alt={article.title}
              className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/55 to-transparent" />
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-7">
            <div className="flex items-center gap-2">
              {article.breaking && (
                <span className="badge bg-brand-600">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-white animate-pulseDot" />
                  Breaking
                </span>
              )}
              <CategoryBadge article={article} />
            </div>
            <h2 className="mt-2.5 text-lg font-extrabold leading-[1.25] text-white sm:text-2xl lg:text-[32px]">
              <span className="link-underline">{article.title}</span>
            </h2>
            {showDek && article.dek && (
              <p className="mt-2 line-clamp-2 max-w-2xl font-serif text-[12.5px] leading-relaxed text-white/80 sm:text-sm">
                {article.dek}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium text-white/75">
                <span className="font-semibold text-white">{article.authorName}</span>
                <span className="opacity-40">•</span>
                <span>{formatDate(article.publishedAt, 'long')}</span>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {article.readingTime} mnt
                </span>
              </div>
            </div>
          </div>
        </Link>
        <div className="absolute right-3 top-3 z-10 flex gap-2">
          <SaveButton slug={article.slug} overlay />
        </div>
      </article>
    );
  }

  if (variant === 'feature' || variant === 'wide') {
    const isWide = variant === 'wide';
    return (
      <article
        className={`group ${isWide ? 'grid gap-3 sm:grid-cols-[160px_1fr] sm:gap-4' : ''} ${className}`}
      >
        <Link
          to={`/artikel/${article.slug}`}
          className="relative block overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5"
        >
          <div className={isWide ? 'aspect-[4/3] sm:h-full' : 'aspect-[16/10]'}>
            <img
              src={article.cover}
              alt={article.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          </div>
          {article.breaking && (
            <span className="badge absolute left-2 top-2 bg-brand-600">Breaking</span>
          )}
        </Link>
        <div className={isWide ? 'min-w-0 self-center' : 'mt-3'}>
          <div className="flex items-center gap-2">
            <CategoryBadge article={article} />
            <span className="text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
              {timeAgo(article.publishedAt)}
            </span>
          </div>
          <h3
            className={`mt-2 font-extrabold leading-snug tracking-tight text-slate-900 transition group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400 ${
              isWide ? 'text-[15px] sm:text-base' : 'text-[15px] sm:text-[17px]'
            }`}
          >
            <Link to={`/artikel/${article.slug}`} className={isWide ? 'line-clamp-3' : 'line-clamp-2'}>
              {article.title}
            </Link>
          </h3>
          {showDek && article.dek && (
            <p className="mt-1.5 line-clamp-2 font-serif text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              {article.dek}
            </p>
          )}
          <div className="mt-2">
            <Meta article={article} />
          </div>
        </div>
      </article>
    );
  }

  // standard
  return (
    <article className={`group flex flex-col ${className}`}>
      <div className="relative">
        <Link to={`/artikel/${article.slug}`} className="block overflow-hidden rounded-xl bg-slate-100 dark:bg-white/5">
          <div className="aspect-[16/10]">
            <img
              src={article.cover}
              alt={article.title}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          </div>
        </Link>
        <div className="absolute right-2 top-2">
          <SaveButton slug={article.slug} overlay />
        </div>
        {article.breaking && <span className="badge absolute left-2 top-2 bg-brand-600">Breaking</span>}
      </div>
      <div className="mt-3 flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: article.categoryAccent }}>
            {article.categoryName}
          </span>
          <span className="text-[10.5px] text-slate-400">•</span>
          <span className="text-[10.5px] text-slate-500 dark:text-slate-400">{timeAgo(article.publishedAt)}</span>
        </div>
        <h3 className="mt-1.5 text-[15px] font-extrabold leading-snug tracking-tight text-slate-900 transition group-hover:text-brand-600 dark:text-white dark:group-hover:text-brand-400 sm:text-base">
          <Link to={`/artikel/${article.slug}`} className="line-clamp-2">
            {article.title}
          </Link>
        </h3>
        {showDek && article.dek && (
          <p className="mt-1.5 line-clamp-2 font-serif text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {article.dek}
          </p>
        )}
        <div className="mt-auto pt-2.5">
          <Meta article={article} />
        </div>
      </div>
    </article>
  );
}

export function CommentCount({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <MessageSquare className="h-3 w-3" /> {count}
    </span>
  );
}
