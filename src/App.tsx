import { lazy, Suspense } from 'react';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { AlertTriangle, CalendarDays, Home, Loader2, Search, Newspaper } from 'lucide-react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { BreakingTicker } from './components/BreakingTicker';
import { ScrollToTop } from './components/ScrollToTop';
import { SiteProvider } from './lib/site';
import { HomePage } from './pages/HomePage';
import { NewsListPage } from './pages/NewsListPage';
import { ArticlePage } from './pages/ArticlePage';
import { AgendaPage, AboutPage, ContactPage } from './pages/InfoPages';
import { SavedPage } from './pages/SavedPage';
import { AdminPage } from './pages/AdminPage';

function PageLoader() {
  return <div className="grid min-h-[45vh] place-items-center"><Loader2 className="h-7 w-7 animate-spin text-brand-600"/></div>;
}

function NotFound() {
  return <div className="container-news grid min-h-[55vh] place-items-center py-12 text-center"><div><AlertTriangle className="mx-auto h-10 w-10 text-brand-500"/><p className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-600">404 · Halaman tidak ditemukan</p><h1 className="mt-2 text-2xl font-extrabold text-navy-900 dark:text-white">Sepertinya halaman ini tersesat</h1><p className="mt-2 text-sm text-slate-500">Tautan mungkin sudah berubah atau tidak tersedia.</p><Link to="/" className="btn-primary mt-5">Kembali ke beranda</Link></div></div>;
}

function MobileNav() {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;
  const links = [
    { to: '/', label: 'Beranda', Icon: Home },
    { to: '/berita', label: 'Berita', Icon: Newspaper },
    { to: '/agenda', label: 'Agenda', Icon: CalendarDays },
  ];
  return <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 pb-1 pt-1 backdrop-blur-lg dark:border-white/10 dark:bg-navy-950/95 sm:hidden" aria-label="Navigasi cepat"><div className="mx-auto flex max-w-sm items-center justify-around">{links.map(({to,label,Icon})=><Link key={to} to={to} className={`flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[9px] font-semibold ${location.pathname===to?'text-brand-600':'text-slate-500 dark:text-slate-400'}`}><Icon className="h-[18px] w-[18px]"/>{label}</Link>)}<button type="button" onClick={()=>window.dispatchEvent(new CustomEvent('ik:search'))} className="flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[9px] font-semibold text-slate-500 dark:text-slate-400"><Search className="h-[18px] w-[18px]"/>Cari</button></div></nav>;
}

function Shell() {
  const location = useLocation();
  const admin = location.pathname.startsWith('/admin');
  return <><ScrollToTop/>{!admin&&<><Header/><BreakingTicker/></>}<div className="min-h-[55vh] pb-16 sm:pb-0"><Suspense fallback={<PageLoader/>}><Routes>
    <Route path="/" element={<HomePage/>}/>
    <Route path="/berita" element={<NewsListPage/>}/>
    <Route path="/kategori/:slug" element={<NewsListPage mode="category"/>}/>
    <Route path="/cari" element={<NewsListPage mode="search"/>}/>
    <Route path="/tag/:slug" element={<NewsListPage mode="tag"/>}/>
    <Route path="/artikel/:slug" element={<ArticlePage/>}/>
    <Route path="/agenda" element={<AgendaPage/>}/>
    <Route path="/kontak" element={<ContactPage/>}/>
    <Route path="/tentang" element={<AboutPage/>}/>
    <Route path="/redaksi" element={<AboutPage type="editorial"/>}/>
    <Route path="/pedoman-media" element={<AboutPage type="guidelines"/>}/>
    <Route path="/privasi" element={<AboutPage type="privacy"/>}/>
    <Route path="/tersimpan" element={<SavedPage/>}/>
    <Route path="/admin/*" element={<AdminPage/>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes></Suspense></div>{!admin&&<><Footer/><MobileNav/></>}</>;
}

export default function App() {
  return <BrowserRouter><SiteProvider><Shell/></SiteProvider></BrowserRouter>;
}
