/**
 * Vercel Routing Middleware — Open Graph per halaman.
 *
 * MASALAH YANG DIPECAHKAN
 * Situs ini adalah SPA: `vercel.json` me-rewrite semua path non-/api ke
 * `/index.html`. Akibatnya, saat link produk dibagikan ke WhatsApp/Facebook/
 * Telegram, crawler hanya melihat HTML beranda → gambar & judul yang muncul
 * selalu sama untuk semua produk (`og:image` juga 1 MB, di atas batas ~300 KB
 * WhatsApp, sehingga preview tampil tanpa gambar sama sekali).
 *
 * SOLUSI
 * Middleware ini berjalan SEBELUM cache dan SEBELUM rewrite, membaca
 * `src/data/og-meta.json`, lalu menyunting blok <head> pada `/index.html`
 * hanya untuk request yang datang dari crawler (default) atau dari semua
 * request bila `OG_ALL_REQUESTS=1`.
 *
 * Kenapa hanya crawler secara default:
 *  - HTML yang dikirim ke browser tetap statis → cache CDN tetap efektif dan
 *    tidak ada biaya function untuk pengunjung biasa.
 *  - Crawler social media tidak menjalankan JavaScript, jadi hanya mereka yang
 *    butuh HTML berbeda per URL.
 *
 * Catatan: middleware di Vercel tidak bisa mengimpor `src/data/products.ts`
 * (berisi TSX), karena itu metadata diambil dari JSON yang digenerate build.
 */
import ogMetaJson from './src/data/og-meta.json';

/** Bentuk metadata satu halaman (dibaca dari og-meta.json hasil generate). */
interface OgMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  slug?: string;
  name?: string;
  category?: string;
  priceRange?: string;
}

interface OgMetaFile {
  domain: string;
  baseUrl: string;
  defaultImage: string;
  fallbackImage: string;
  imageWidth: number;
  imageHeight: number;
  imageType: string;
  siteName: string;
  pages: Record<string, OgMeta>;
  products: Record<string, OgMeta>;
}

const ogMeta = ogMetaJson as unknown as OgMetaFile;

const CRAWLER_PATTERN =
  /whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|embedly|pinterest|redditbot|skypeuripreview|googlebot|bingbot|applebot|vkshare|w3c_validator|line-poker|outbrain|quora link preview|nuzzel|bitlybot|mastodon|bluesky|cardyb/i;

const escapeHtml = (value: string): string =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Bangun blok meta OG pengganti. Semua tag lama akan dibuang oleh
 * `stripSocialTags` agar tidak ada duplikat (WhatsApp memakai tag terakhir,
 * beberapa platform memakai yang pertama — duplikat = hasil tak terduga).
 */
const buildMetaBlock = (meta: OgMeta): string => {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.url);
  return [
    `<title>${t}</title>`,
    `<link rel="canonical" href="${url}" />`,
    `<meta name="description" content="${d}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(ogMeta.siteName)}" />`,
    `<meta property="og:locale" content="id_ID" />`,
    `<meta property="og:title" content="${t}" />`,
    `<meta property="og:description" content="${d}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${img}" />`,
    `<meta property="og:image:secure_url" content="${img}" />`,
    `<meta property="og:image:type" content="${ogMeta.imageType}" />`,
    `<meta property="og:image:width" content="${ogMeta.imageWidth}" />`,
    `<meta property="og:image:height" content="${ogMeta.imageHeight}" />`,
    `<meta property="og:image:alt" content="${t}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${t}" />`,
    `<meta name="twitter:description" content="${d}" />`,
    `<meta name="twitter:image" content="${img}" />`
  ].join('\n    ');
};

/** Buang tag sosial lama supaya tidak duplikat dengan yang baru. */
const stripSocialTags = (html: string): string =>
  html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, '');

/** Cari metadata yang cocok untuk sebuah pathname. */
const resolveMeta = (pathname: string): OgMeta => {
  const clean = pathname.replace(/\/+$/, '') || '/';

  // Halaman produk: /produk/:slug
  const productMatch = clean.match(/^\/produk\/([^/]+)\/?$/);
  if (productMatch) {
    const key = `/produk/${decodeURIComponent(productMatch[1]).toLowerCase()}`;
    const meta = ogMeta.products[key];
    if (meta) return meta;

    /**
     * Produk baru yang ditambahkan lewat dashboard belum punya kartu OG
     * (kartu dibuat dari `src/data/products.ts`). Jangan kirim preview
     * beranda yang menyesatkan — pakai kartu toko dengan judul netral.
     */
    const readable = key
      .replace('/produk/', '')
      .split('-')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
    return {
      title: `${readable} | Cilegon Enggih`,
      description: `${readable} — merchandise resmi khas Kota Cilegon. Cek harga & ketersediaan di toko resmi Cilegon Enggih.`,
      image: ogMeta.fallbackImage,
      url: `${ogMeta.baseUrl}${clean}`
    };
  }

  if (ogMeta.pages[clean]) return ogMeta.pages[clean];

  // Default: beranda untuk path yang tidak dikenal (404 sisi klien).
  return ogMeta.pages['/'] || { title: 'Cilegon Enggih', description: '', image: ogMeta.defaultImage, url: ogMeta.baseUrl };
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // Hanya halaman HTML. Aset statis, /api, dan file ber-ekstensi dilewati.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/og/') ||
    pathname.startsWith('/products/') ||
    /\.[a-z0-9]{2,5}$/i.test(pathname)
  ) {
    return;
  }

  const ua = request.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_PATTERN.test(ua);
  const forceAll = process.env.OG_ALL_REQUESTS === '1';
  if (!isCrawler && !forceAll) return; // lanjutkan seperti biasa (dilayani dari cache)

  const meta = resolveMeta(pathname);

  const origin = url.origin;
  const res = await fetch(`${origin}/index.html`, {
    headers: { 'x-og-middleware': '1' }
  });
  if (!res.ok) return; // biarkan alur normal menangani error

  const html = await res.text();
  const injected = stripSocialTags(html).replace(
    /<\/head>/i,
    `    <!-- Open Graph per halaman (disuntikkan middleware.ts) -->\n    ${buildMetaBlock(meta)}\n  </head>`
  );

  return new Response(injected, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Cache di CDN per URL; crawler jarang datang, jadi umur pendek cukup.
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400',
      vary: 'user-agent'
    }
  });
}

/**
 * Batasi middleware ke halaman saja. Tanpa matcher, middleware ikut berjalan
 * untuk setiap aset gambar/JS — memboroskan invocation dan menambah latency.
 * Guard di dalam fungsi tetap dipertahankan sebagai jaring pengaman.
 */
export const config = {
  matcher: ['/((?!api/|assets/|og/|products/).*)']
};
