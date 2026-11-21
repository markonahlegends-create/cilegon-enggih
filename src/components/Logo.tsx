import { Link } from 'react-router-dom';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Info Kelurahan — Beranda">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-sm ring-1 ring-black/5 transition group-hover:scale-[1.03] sm:h-11 sm:w-11">
        <svg viewBox="0 0 64 64" className="h-6 w-6 text-white" fill="none" aria-hidden="true">
          <path
            d="M15 47V24l17-10 17 10v23"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M26 47V33h12v14"
            stroke="currentColor"
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-[18px] font-extrabold tracking-tight text-navy-900 dark:text-white sm:text-[21px]">
          Info <span className="text-brand-600 dark:text-brand-400">Kelurahan</span>
        </span>
        {!compact && (
          <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.17em] text-slate-500 dark:text-slate-400 sm:text-[10px]">
            Seluruh Kelurahan · Cilegon
          </span>
        )}
      </span>
    </Link>
  );
}
