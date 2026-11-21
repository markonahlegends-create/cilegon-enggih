import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Flame, MapPin, Newspaper, TrendingUp } from 'lucide-react';
import { ArticleCard } from './ArticleCard';
import { NewsletterForm } from './NewsletterForm';
import { SectionHeading } from './SectionHeading';
import { useSite } from '../lib/site';
import { useApi } from '../lib/hooks';
import type { AgendaItem, ArticleListItem } from '../lib/api';
import { agendaDateParts, formatCompact, formatDate } from '../lib/format';

export function PopularWidget({ items }: { items?: ArticleListItem[] }) {
  const { data } = useApi<{ items: ArticleListItem[] }>(items ? null : '/api/popular?limit=5');
  const list = items || data?.items || [];
  return (
    <section className="surface p-4 sm:p-5">
      <SectionHeading title="Paling Banyak Dibaca" accent="gold" />
      <div className="space-y-4">
        {list.slice(0, 5).map((article, i) => (
          <ArticleCard key={article.id} article={article} variant="numbered" index={i} />
        ))}
        {!list.length && <p className="text-xs text-slate-500">Belum ada berita populer.</p>}
      </div>
    </section>
  );
}

function AgendaWidget() {
  const { data: site } = useSite();
  const { data } = useApi<{ items: AgendaItem[] }>('/api/agenda');
  const items = (data?.items || site?.agenda || []).slice(0, 3);
  if (!items.length) return null;
  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeading title="Agenda Warga" accent="navy" />
      </div>
      <div className="space-y-3">
        {items.map((item) => {
          const parts = agendaDateParts(item.date);
          return (
            <div key={item.id} className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-white/5">
              <div className="flex h-[54px] w-[48px] shrink-0 flex-col items-center justify-center rounded-lg bg-white shadow-sm dark:bg-navy-800">
                <span className="text-[17px] font-extrabold leading-none text-brand-600">{parts.day}</span>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-500">{parts.month}</span>
              </div>
              <div className="min-w-0">
                <p className="line-clamp-2 text-[12.5px] font-bold leading-snug text-slate-800 dark:text-slate-100">{item.title}</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                  <MapPin className="h-3 w-3" /> {item.place}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <Link to="/agenda" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:gap-2 dark:text-brand-400">
        Semua agenda <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}

function TagWidget() {
  const { data } = useSite();
  const tags = data?.tags || [];
  if (!tags.length) return null;
  return (
    <section className="surface p-4 sm:p-5">
      <SectionHeading title="Topik Pilihan" accent="navy" />
      <div className="flex flex-wrap gap-2">
        {tags.slice(0, 12).map((tag) => (
          <Link key={tag.slug} to={`/tag/${tag.slug}`} className="chip !px-2.5 !py-1">
            #{tag.name}
            <span className="text-[10px] text-slate-400">{tag.count}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewsletterWidget() {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-900 to-[#18446f] p-5 text-white shadow-card">
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand-500/20 blur-2xl" />
      <div className="relative">
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-white/10">
          <Newspaper className="h-4.5 w-4.5" />
        </div>
        <h3 className="text-base font-extrabold">Kabar terbaru, langsung ke email</h3>
        <p className="mt-1.5 mb-4 text-xs leading-relaxed text-white/65">Dapatkan rangkuman berita warga pilihan secara gratis.</p>
        <NewsletterForm dark />
      </div>
    </section>
  );
}

export function Sidebar({ popular }: { popular?: ArticleListItem[] }) {
  return (
    <aside className="space-y-5">
      <PopularWidget items={popular} />
      <AgendaWidget />
      <TagWidget />
      <NewsletterWidget />
    </aside>
  );
}
