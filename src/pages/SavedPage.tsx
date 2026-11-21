import { useEffect, useState } from 'react';
import { Bookmark, BookmarkX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ArticleCard } from '../components/ArticleCard';
import { Sidebar } from '../components/Sidebar';
import { useBookmarks } from '../lib/hooks';
import type { ArticleListItem } from '../lib/api';

export function SavedPage() {
  const { slugs, clear } = useBookmarks();
  const [items, setItems] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!slugs.length) { setItems([]); return; }
    setLoading(true);
    fetch('/api/articles?limit=100&sort=latest')
      .then((r) => r.json())
      .then((data) => { if (alive) setItems((data.items || []).filter((item: ArticleListItem) => slugs.includes(item.slug))); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [slugs.join('|')]);

  return (
    <div className="container-news py-7 sm:py-9">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div><p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-600"><Bookmark className="h-4 w-4"/> Koleksi pribadi</p><h1 className="text-2xl font-extrabold text-navy-900 dark:text-white sm:text-3xl">Berita Tersimpan</h1><p className="mt-1 text-sm text-slate-500">Berita disimpan di perangkat ini.</p></div>
        {!!slugs.length && <button type="button" onClick={() => { if (confirm('Hapus semua berita tersimpan?')) clear(); }} className="btn-ghost !py-2 text-xs"><BookmarkX className="h-4 w-4"/> Hapus semua</button>}
      </div>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main>
          {loading && <p className="text-sm text-slate-500">Memuat koleksi…</p>}
          {!loading && items.length > 0 && <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <ArticleCard key={item.id} article={item} variant="feature" />)}</div>}
          {!loading && !items.length && <div className="surface px-6 py-14 text-center"><Bookmark className="mx-auto h-8 w-8 text-slate-300"/><h2 className="mt-3 font-bold text-slate-800 dark:text-white">Belum ada berita tersimpan</h2><p className="mt-1 text-sm text-slate-500">Tekan ikon bookmark pada berita untuk menyimpannya.</p><Link to="/berita" className="btn-primary mt-4">Jelajahi berita</Link></div>}
        </main>
        <Sidebar />
      </div>
    </div>
  );
}
