import { Link } from 'react-router-dom';
import { ArrowUp, Facebook, Instagram, Mail, MapPin, Phone, Twitter, Youtube } from 'lucide-react';
import { Logo } from './Logo';
import { useSite } from '../lib/site';
import { todayLabel } from '../lib/format';

export function Footer() {
  const { data } = useSite();
  const settings = data?.settings;
  const cats = data?.categories || [];
  const socials = settings?.socials || {};
  return (
    <footer className="mt-12 bg-navy-950 text-white">
      <div className="container-news py-9 sm:py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:gap-10">
          <div>
            <div className="inline-flex rounded-xl bg-white p-2"><Logo /></div>
            <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/65">
              {settings?.description || 'Portal informasi untuk warga di seluruh kelurahan Kota Cilegon.'}
            </p>
            <div className="mt-4 flex items-center gap-2">
              {[
                { href: socials.instagram, label: 'Instagram', Icon: Instagram },
                { href: socials.facebook, label: 'Facebook', Icon: Facebook },
                { href: socials.x, label: 'X', Icon: Twitter },
                { href: socials.youtube, label: 'YouTube', Icon: Youtube },
              ].filter((item) => item.href).map(({ href, label, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 text-white/65 transition hover:border-white/30 hover:bg-white/10 hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[.15em] text-white/90">Kanal</h3>
            <ul className="mt-4 space-y-2.5">
              {cats.slice(0, 7).map((category) => (
                <li key={category.id}><Link to={`/kategori/${category.slug}`} className="text-[12.5px] text-white/60 transition hover:text-white">{category.name}</Link></li>
              ))}
              <li><Link to="/berita" className="text-[12.5px] text-white/60 transition hover:text-white">Semua berita</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[.15em] text-white/90">Informasi</h3>
            <ul className="mt-4 space-y-2.5">
              {[
                ['/tentang', 'Tentang Kami'],
                ['/redaksi', 'Redaksi'],
                ['/pedoman-media', 'Pedoman Media Siber'],
                ['/privasi', 'Kebijakan Privasi'],
                ['/kontak', 'Kontak & Aduan'],
                ['/agenda', 'Agenda Warga'],
              ].map(([to, label]) => (
                <li key={to}><Link to={to} className="text-[12.5px] text-white/60 transition hover:text-white">{label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-[.15em] text-white/90">Hubungi Kami</h3>
            <ul className="mt-4 space-y-3 text-[12.5px] text-white/65">
              <li className="flex gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-400" /><span>{settings?.address || 'Jl. Jerang Barat No. 12, RT 004/001'}, {settings?.village}, {settings?.city}</span></li>
              <li className="flex gap-2.5"><Mail className="h-4 w-4 shrink-0 text-brand-400" /><a href={`mailto:${settings?.email || 'redaksi@infokelurahan.id'}`} className="hover:text-white">{settings?.email || 'redaksi@infokelurahan.id'}</a></li>
              <li className="flex gap-2.5"><Phone className="h-4 w-4 shrink-0 text-brand-400" /><a href={`tel:${settings?.phone || '+62254400000'}`} className="hover:text-white">{settings?.phone || '(0254) 400 000'}</a></li>
            </ul>
            <p className="mt-4 text-[10.5px] leading-relaxed text-white/40">{settings?.officeHours || 'Senin–Jumat, 08.00–16.00 WIB'}</p>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-white/10 pt-5 text-[11px] text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Info Kelurahan. Hak cipta dilindungi.</p>
          <p>
            Didesain dengan cermat oleh{' '}
            <a href={settings?.credit?.url || 'https://fadil-labs.vercel.app/'} target="_blank" rel="noreferrer" className="font-bold text-white/75 transition hover:text-white">
              {settings?.credit?.name || 'Fadil Labs'}
            </a>
          </p>
          <p className="hidden lg:block">{todayLabel()} · <a className="hover:text-white" href="/rss.xml">RSS</a></p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-20 right-4 z-30 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-float transition hover:-translate-y-0.5 hover:text-brand-600 dark:border-white/10 dark:bg-navy-900 dark:text-slate-300 sm:bottom-6"
        aria-label="Kembali ke atas"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </footer>
  );
}
