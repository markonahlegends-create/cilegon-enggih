/**
 * Pencatat event analitik sisi klien.
 *
 * PRINSIP:
 *   • Tidak mengganggu pengalaman pembeli — semua kegagalan diabaikan diam-diam.
 *   • Tidak ada data pribadi: hanya path, produk, dan nilai keranjang.
 *   • Dikirim berkelompok (batch) agar tidak membebani jaringan.
 *   • Menghormati Do Not Track dan prefers-reduced-motion? (DNT saja)
 */

const ENDPOINT = '/api/events';
const FLUSH_DELAY = 2500; // ms
const MAX_BATCH = 20;

type EventPayload = {
  type: string;
  path?: string;
  productId?: string | null;
  variantId?: string | null;
  productName?: string | null;
  cartValue?: number | null;
  cartQty?: number | null;
  zone?: string | null;
  keyword?: string | null;
};

let queue: EventPayload[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let disabled = false;

/** Hormati Do Not Track bila diaktifkan pengguna. */
const dntEnabled = (): boolean => {
  try {
    const nav = navigator as Navigator & { doNotTrack?: string; msDoNotTrack?: string };
    return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || (window as any).doNotTrack === '1';
  } catch {
    return false;
  }
};

/** Referrer & UTM dibaca sekali, saat modul dimuat. */
const referrer = (() => {
  try {
    return document.referrer || '';
  } catch {
    return '';
  }
})();

const utm = (() => {
  try {
    const p = new URLSearchParams(window.location.search);
    return (
      p.get('utm_source') ||
      p.get('src') ||
      p.get('ref') ||
      ''
    );
  } catch {
    return '';
  }
})();

const send = (events: EventPayload[]) => {
  if (!events.length) return;
  try {
    const body = JSON.stringify({ events: events.map((e) => ({ ...e, referrer, utm })) });
    // sendBeacon bertahan walau halaman langsung ditinggalkan (penting untuk
    // checkout_start). Fallback ke fetch keepalive bila tidak tersedia.
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => undefined);
  } catch {
    /* diabaikan — analitik tidak boleh mengganggu toko */
  }
};

const flush = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const pending = queue;
  queue = [];
  send(pending);
};

const enqueue = (payload: EventPayload) => {
  if (disabled || dntEnabled()) return;
  // Halaman admin tidak dicatat: trafik Anda sendiri akan mengotori data.
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return;

  queue.push(payload);
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (!timer) timer = setTimeout(flush, FLUSH_DELAY);
};

/* ------------------------------------------------------------------ */
/* API publik                                                          */
/* ------------------------------------------------------------------ */

export const trackPageView = (path: string) => enqueue({ type: 'page_view', path });

export const trackProductView = (product: {
  id?: string;
  name?: string;
  variantId?: string;
}) =>
  enqueue({
    type: 'product_view',
    path: typeof window !== 'undefined' ? window.location.pathname : '/',
    productId: product.id ?? null,
    productName: product.name ?? null,
    variantId: product.variantId ?? null
  });

export const trackAddToCart = (item: {
  productId?: string;
  productName?: string;
  variantId?: string;
}) =>
  enqueue({
    type: 'add_to_cart',
    productId: item.productId ?? null,
    productName: item.productName ?? null,
    variantId: item.variantId ?? null
  });

export const trackCheckoutStart = (cart: {
  value: number;
  qty: number;
  zone?: string | null;
}) =>
  enqueue({
    type: 'checkout_start',
    cartValue: cart.value,
    cartQty: cart.qty,
    zone: cart.zone ?? null
  });

export const trackSearch = (keyword: string) =>
  enqueue({ type: 'search', keyword: String(keyword).slice(0, 60) });

export const trackShare = (productId?: string, productName?: string) =>
  enqueue({ type: 'share', productId: productId ?? null, productName: productName ?? null });

/** Kirim sisa antrean saat halaman ditutup/disembunyikan. */
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

/** Matikan pelacakan sepenuhnya (mis. untuk halaman admin). */
export const disableTracking = () => {
  disabled = true;
  queue = [];
  if (timer) clearTimeout(timer);
  timer = null;
};
