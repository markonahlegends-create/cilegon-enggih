import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

/* ------------------------------ Tema ------------------------------ */

const THEME_KEY = 'ik-theme';
const themeListeners = new Set<() => void>();

function readTheme(): boolean {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored === 'dark';
  } catch {
    /* ignore */
  }
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

let darkCache = typeof window !== 'undefined' ? readTheme() : false;

function applyTheme(dark: boolean) {
  darkCache = dark;
  document.documentElement.classList.toggle('dark', dark);
  try {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  } catch {
    /* ignore */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#071a33' : '#e11d2e');
  themeListeners.forEach((listener) => listener());
}

export function useTheme() {
  const dark = useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    () => darkCache,
    () => false
  );
  const toggle = useCallback(() => applyTheme(!darkCache), []);
  return { dark, toggle };
}

/* --------------------------- Bookmark --------------------------- */

const BOOKMARK_KEY = 'ik-bookmarks';
const bookmarkListeners = new Set<() => void>();

function readBookmarks(): string[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

let bookmarksCache: string[] = typeof window !== 'undefined' ? readBookmarks() : [];

function writeBookmarks(next: string[]) {
  bookmarksCache = next;
  try {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  bookmarkListeners.forEach((listener) => listener());
}

export function toggleBookmark(slug: string) {
  const exists = bookmarksCache.includes(slug);
  writeBookmarks(exists ? bookmarksCache.filter((s) => s !== slug) : [slug, ...bookmarksCache]);
  return !exists;
}

export function useBookmarks() {
  const slugs = useSyncExternalStore(
    (cb) => {
      bookmarkListeners.add(cb);
      return () => bookmarkListeners.delete(cb);
    },
    () => bookmarksCache,
    () => []
  );
  return {
    slugs,
    has: (slug: string) => slugs.includes(slug),
    toggle: toggleBookmark,
    clear: () => writeBookmarks([]),
  };
}

/* ------------------------------ API ------------------------------ */

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useApi<T>(path: string | null, deps: unknown[] = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);

    fetch(path, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || `Gagal memuat data (HTTP ${res.status}).`);
        return body as T;
      })
      .then((body) => {
        if (!alive) return;
        setData(body);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!alive || err.name === 'AbortError') return;
        setError(err.message || 'Gagal memuat data.');
        setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);

  return { data, loading, error, reload: () => setTick((value) => value + 1) };
}

/* ---------------------------- Lainnya ---------------------------- */

export function useDebounced<T>(value: T, delay = 320): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useScrollProgress(): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(100, Math.max(0, (window.scrollY / height) * 100)) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return progress;
}

export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);
  return scrolled;
}

interface MetaOptions {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'article';
  publishedAt?: string;
  author?: string;
  url?: string;
}

export function useMeta({ title, description, image, type = 'website', publishedAt, author, url }: MetaOptions) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, content?: string) => {
      if (!content) return;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const absolute = (path?: string) => {
      if (!path) return '';
      if (/^https?:\/\//i.test(path)) return path;
      return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
    };

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[property="og:image"]', 'property', 'og:image', absolute(image));
    setMeta('meta[property="og:url"]', 'property', 'og:url', url ? absolute(url) : window.location.href);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', absolute(image));
    setMeta('meta[property="article:published_time"]', 'property', 'article:published_time', publishedAt);
    setMeta('meta[property="article:author"]', 'property', 'article:author', author);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = url ? absolute(url) : window.location.href;
  }, [title, description, image, type, publishedAt, author, url]);
}

export function useCopy(timeout = 1800) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement('textarea');
        area.value = text;
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    },
    [timeout]
  );
  return { copied, copy };
}

export function openSearch() {
  window.dispatchEvent(new CustomEvent('ik:search'));
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
