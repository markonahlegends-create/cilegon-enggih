/**
 * TAUTAN & AKSI BAGIKAN PRODUK — satu sumber kebenaran.
 *
 * KENAPA MODUL INI ADA
 * Sebelumnya tombol "Bagikan" memakai `window.location.href` apa adanya.
 * Akibatnya tautan yang dibagikan sering membawa "sampah": `?utm=…`,
 * `#galeri`, atau domain preview Vercel. Crawler WhatsApp tidak menemukan
 * kartu OG untuk URL semacam itu, lalu menampilkan gambar default toko —
 * persis keluhan "thumbnail share tidak sesuai".
 *
 * Aturan di sini:
 *  - SELALU bagikan URL canonical bersih: <origin>/produk/<slug>
 *    (origin diambil dari canonical tag agar domain preview tidak bocor);
 *  - sediakan tautan eksplisit untuk WhatsApp/Facebook/Telegram/X + salin;
 *  - `navigator.share` dipakai bila ada, tetapi TIDAK dijadikan satu-satunya
 *    jalan — di desktop dan browser in-app dialog itu sering tidak muncul.
 */

/** Origin publik yang benar (bukan localhost / URL preview). */
export const shareOrigin = (): string => {
  if (typeof document === 'undefined') return '';
  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (canonical?.href) {
    try {
      const u = new URL(canonical.href);
      // Canonical selalu menunjuk domain produksi; aman dipakai sebagai basis.
      if (u.hostname && !u.hostname.includes('localhost')) return u.origin;
    } catch {
      /* jatuh ke location.origin */
    }
  }
  return window.location.origin;
};

/** URL produk yang bersih & bisa dipreview crawler. */
export const productShareUrl = (slug: string): string =>
  `${shareOrigin()}/produk/${encodeURIComponent(slug)}`;

export type ShareChannel = 'whatsapp' | 'facebook' | 'telegram' | 'x' | 'copy' | 'native';

export interface ShareTarget {
  label: string;
  channel: ShareChannel;
  /** Bangun URL tujuan; `null` berarti aksi khusus (salin / dialog sistem). */
  build?: (url: string, text: string) => string;
}

export const SHARE_TARGETS: ShareTarget[] = [
  {
    label: 'WhatsApp',
    channel: 'whatsapp',
    build: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`
  },
  {
    label: 'Facebook',
    channel: 'facebook',
    build: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  },
  {
    label: 'Telegram',
    channel: 'telegram',
    build: (url, text) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
  },
  {
    label: 'X / Twitter',
    channel: 'x',
    build: (url, text) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`
  }
];

/** Apakah perangkat punya dialog share bawaan? */
export const canNativeShare = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.share === 'function';

/**
 * Salin teks ke clipboard dengan fallback untuk browser in-app yang
 * memblokir Clipboard API (Instagram/Facebook in-app browser sering begitu).
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* lanjut ke fallback */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};

/** Buka jendela share ukuran wajar; kalau diblokir, pakai tab baru. */
export const openShareWindow = (url: string) => {
  const w = 600;
  const h = 600;
  const left = Math.max(0, (window.screen.width - w) / 2);
  const top = Math.max(0, (window.screen.height - h) / 2);
  const win = window.open(
    url,
    'bagikan',
    `width=${w},height=${h},left=${left},top=${top},noopener,noreferrer`
  );
  if (!win) window.open(url, '_blank', 'noopener,noreferrer');
};
