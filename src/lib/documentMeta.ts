import { useEffect } from 'react';
import ogMeta from '../data/og-meta.json';

/**
 * Samakan <title> dan meta description dengan URL saat ini.
 *
 * Catatan penting: ini BUKAN untuk crawler — WhatsApp/Facebook/Telegram tidak
 * menjalankan JavaScript. Bagian itu ditangani `middleware.ts` di server.
 * Hook ini hanya supaya tab browser, bookmark, dan riwayat pengguna menampilkan
 * judul yang benar ("Tote Bag Kanvas Premium | Cilegon Enggih", bukan judul
 * beranda untuk semua halaman).
 *
 * Sengaja hanya menyentuh `<title>` + description: mengganti `og:*` di klien
 * tidak ada gunanya (crawler tak membacanya) dan bisa membuat tag ganda.
 */

type MetaFile = {
  pages: Record<string, { title: string; description: string }>;
  products: Record<string, { title: string; description: string }>;
};

const META = ogMeta as unknown as MetaFile;

const resolve = (pathname: string): { title: string; description: string } | null => {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const productMatch = clean.match(/^\/produk\/([^/]+)\/?$/);
  if (productMatch) {
    const found = META.products[`/produk/${decodeURIComponent(productMatch[1]).toLowerCase()}`];
    if (found) return found;
  }
  return META.pages[clean] || null;
};

const setMetaDescription = (content: string) => {
  let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
};

export const useDocumentMeta = (pathname: string, fallbackTitle?: string) => {
  useEffect(() => {
    const meta = resolve(pathname);
    if (meta) {
      document.title = meta.title;
      setMetaDescription(meta.description);
    } else if (fallbackTitle) {
      document.title = fallbackTitle;
    }
  }, [pathname, fallbackTitle]);
};

export default useDocumentMeta;
