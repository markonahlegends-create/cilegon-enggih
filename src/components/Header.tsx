import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  ChevronRight,
  Facebook,
  Instagram,
  LayoutGrid,
  Mail,
  Menu,
  Moon,
  Search,
  Sun,
  Twitter,
  X,
  Youtube,
} from 'lucide-react';
import { Logo } from './Logo';
import { SearchOverlay } from './SearchOverlay';
import { useTheme, useScrolled, useBookmarks } from '../lib/hooks';
import { useSite } from '../lib/site';
import { todayLabel } from '../lib/format';

function TopBar() {
  const { data } = useSite();
  const socials = data?.settings.socials || {};
  return (
    <div className="hidden bg-navy-950 text-white/80 lg:block">
      <div className="container-news flex h-9 items-center justify-between text-[11.5px]">
        <div className="flex items-center gap-4">
          <span className="font-medium text-white/90">{todayLabel()}</span>
          <span className="h-3 w-px bg-white/15" />
          <span>{data?.settings.village || 'Kelurahan Karang Asem'}, {data?.settings.city || 'Cilegon'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {socials.instagram && (
            <a href={socials.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-white/10 hover:text-white">
              <Instagram className="h-3.5 w-3.5" />
            </a>
          )}
          {socials.facebook && (
            <a href={socials.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-white/10 hover:text-white">
              <Facebook className="h-3.5 w-3.5" />
            </a>
          )}
          {socials.x && (
            <a href={socials.x} target="_blank" rel="noreferrer" aria-label="X" className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-white/10 hover:text-white">
              <Twitter className="h-3.5 w-3.5" />
            </a>
          )}
          {socials.youtube && (
            <a href={socials.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className="grid h-6 w-6 place-items-center rounded-md transition hover:bg-white/10 hover:text-white">
              <Youtube className="h-3.5 w-3.5" />
            </a>
          )}
          <span className="mx-1 h-3 w-px bg-white/15" />
          <Link to="/kontak" className="hidden items-center gap-1.5 transition hover:text-white xl:flex">
            <Mail className="h-3 w-3" /> {data?.settings.email || 'redaksi@infokelurahan.id'}
          </Link>
          <Link
            to="/redaksi"
            className="ml-2 rounded-md bg-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-white transition hover:bg-white/20"
          >
            Tentang Redaksi
          </Link>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const { dark, toggle } = useTheme();
  const { slugs } = useBookmarks();
  const scrolled = useScrolled(6);
  const { data } = useSite();

  useEffect(() => {
    const openSearchHandler = () => setSearchOpen(true);
    const keyHandler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('ik:search', openSearchHandler);
    window.addEventListener('keydown', keyHandler);
    return () => {
      window.removeEventListener('ik:search', openSearchHandler);
      window.removeEventListener('keydown', keyHandler);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const categories = data?.categories || [];

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    navigate(`/cari?q=${encodeURIComponent(query.trim())}`);
    setQuery('');
  };

  return (
    <>
      <TopBar />

      <header
        className={`sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md transition-shadow dark:border-white/10 dark:bg-navy-950/95 ${
          scrolled ? 'shadow-sm' : ''
        }`}
      >
        <div className="container-news">
          <div className="flex h-[58px] items-center gap-2 sm:h-[66px] sm:gap-4">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Logo />

            <form onSubmit={submitSearch} className="ml-auto hidden max-w-xs flex-1 lg:ml-6 lg:block xl:max-w-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari berita…"
                  aria-label="Cari berita"
                  className="h-9 w-full rounded-full border border-slate-200 bg-slate-50 pl-9 pr-14 text-[13px] text-slate-700 outline-none transition focus:border-brand-300 focus:bg-white focus:ring-2 focus:ring-brand-500/15 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                />
                <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:border-white/10 dark:bg-navy-900 xl:block">
                  ⌘K
                </kbd>
              </div>
            </form>

            <div className="ml-auto flex items-center gap-1 lg:ml-0">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 lg:hidden"
                aria-label="Cari"
              >
                <Search className="h-[18px] w-[18px]" />
              </button>

              <Link
                to="/tersimpan"
                className="relative hidden h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10 sm:grid"
                aria-label="Berita tersimpan"
              >
                <Bookmark className="h-[18px] w-[18px]" />
                {slugs.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[9px] font-bold text-white">
                    {slugs.length}
                  </span>
                )}
              </Link>

              <button
                type="button"
                onClick={toggle}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label={dark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              >
                {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
              </button>

              <Link to="/kontak" className="btn-primary ml-1 hidden !rounded-full !px-4 !py-2 text-[12.5px] sm:inline-flex">
                Kirim Aduan
              </Link>
            </div>
          </div>
        </div>

        {/* Navigasi kategori desktop */}
        <nav className="hidden border-t border-slate-100 dark:border-white/5 lg:block" aria-label="Kategori berita">
          <div className="container-news flex items-center gap-0.5 overflow-x-auto no-scrollbar">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `relative shrink-0 px-3 py-2.5 text-[12.5px] font-bold transition ${
                  isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-white'
                }`
              }
            >
              Beranda
            </NavLink>
            {categories.map((category) => (
              <NavLink
                key={category.id}
                to={`/kategori/${category.slug}`}
                className={({ isActive }) =>
                  `relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[12.5px] font-semibold transition ${
                    isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-white'
                  }`
                }
              >
                {category.name}
              </NavLink>
            ))}
            <div className="ml-auto flex shrink-0 items-center gap-3 pl-3">
              <Link to="/agenda" className="text-[12px] font-semibold text-slate-500 transition hover:text-brand-600 dark:text-slate-400">
                Agenda
              </Link>
              <Link to="/berita" className="inline-flex items-center gap-1 text-[12px] font-bold text-brand-600 dark:text-brand-400">
                <LayoutGrid className="h-3.5 w-3.5" /> Semua Berita
              </Link>
            </div>
          </div>
        </nav>

        {/* Kategori scroll untuk mobile */}
        <div className="border-t border-slate-100 dark:border-white/5 lg:hidden">
          <div className="flex items-center gap-1.5 overflow-x-auto px-4 py-2 no-scrollbar">
            <Link to="/berita" className="chip chip-active shrink-0 !px-2.5 !py-1 !text-[10.5px]">
              Terbaru
            </Link>
            {categories.map((category) => (
              <Link
                key={category.id}
                to={`/kategori/${category.slug}`}
                className="shrink-0 whitespace-nowrap rounded-full border border-slate-200 px-2.5 py-1 text-[10.5px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-white/10 dark:text-slate-300"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </header>

      {/* Drawer menu mobile */}
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative h-full w-[86%] max-w-sm overflow-y-auto bg-white p-5 shadow-float dark:bg-navy-950">
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitSearch} className="relative mt-5">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari berita…"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-brand-300 dark:border-white/10 dark:bg-white/5"
              />
            </form>

            <p className="mt-6 text-[10.5px] font-bold uppercase tracking-[0.15em] text-slate-400">Kanal Berita</p>
            <nav className="mt-2 space-y-0.5">
              {categories.map((category) => (
                <Link
                  key={category.id}
                  to={`/kategori/${category.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2 py-2.5 text-[14px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  <span className="flex items-center gap-2.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.accent }} />
                    {category.name}
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              ))}
            </nav>

            <p className="mt-6 text-[10.5px] font-bold uppercase tracking-[0.15em] text-slate-400">Lainnya</p>
            <nav className="mt-2 space-y-0.5">
              {[
                { to: '/berita', label: 'Semua Berita' },
                { to: '/agenda', label: 'Agenda Kegiatan' },
                { to: '/tersimpan', label: 'Berita Tersimpan' },
                { to: '/tentang', label: 'Tentang Kami' },
                { to: '/redaksi', label: 'Redaksi & Pedoman' },
                { to: '/kontak', label: 'Kontak & Aduan' },
              ].map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between rounded-lg px-2 py-2.5 text-[14px] font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/5"
                >
                  {item.label}
                  <ChevronRight className="h-4 w-4 text-slate-300" />
                </Link>
              ))}
            </nav>

            <Link
              to="/admin"
              onClick={() => setMenuOpen(false)}
              className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-[12px] font-semibold text-slate-500 dark:border-white/15 dark:text-slate-400"
            >
              Masuk Dashboard Redaksi
            </Link>
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
