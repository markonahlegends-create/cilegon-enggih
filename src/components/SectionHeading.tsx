import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function SectionHeading({
  title,
  subtitle,
  to,
  linkLabel = 'Lihat semua',
  accent = 'brand',
  className = '',
}: {
  title: string;
  subtitle?: string;
  to?: string;
  linkLabel?: string;
  accent?: 'brand' | 'navy' | 'gold';
  className?: string;
}) {
  const colors = {
    brand: 'bg-brand-600',
    navy: 'bg-navy-800 dark:bg-brand-500',
    gold: 'bg-gold-500',
  };
  return (
    <div className={`mb-4 flex items-end justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10 ${className}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 h-7 w-1 shrink-0 rounded-full ${colors[accent]}`} />
        <div>
          <h2 className="text-lg font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
      </div>
      {to && (
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-bold text-brand-600 transition hover:gap-2 dark:text-brand-400 sm:text-xs">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
