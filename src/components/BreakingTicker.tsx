import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useSite } from '../lib/site';

export function BreakingTicker() {
  const { data } = useSite();
  const items = data?.breaking?.length ? data.breaking : data?.headlines?.slice(0, 3) || [];
  if (!items.length) return null;

  const loop = [...items, ...items];

  return (
    <div className="ticker-wrap border-b border-brand-800/30 bg-brand-600 text-white">
      <div className="container-news flex items-stretch gap-3">
        <div className="flex shrink-0 items-center gap-1.5 py-2 pr-3 text-[10.5px] font-extrabold uppercase tracking-widest">
          <Zap className="h-3.5 w-3.5 fill-current" />
          <span className="hidden sm:inline">Terkini</span>
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="ticker-track items-center gap-8 py-2">
            {loop.map((article, index) => (
              <Link
                key={`${article.id}-${index}`}
                to={`/artikel/${article.slug}`}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[12px] font-medium text-white/95 transition hover:text-white hover:underline"
              >
                <span className="h-1 w-1 rounded-full bg-white/70" />
                {article.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
