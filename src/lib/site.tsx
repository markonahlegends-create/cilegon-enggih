import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Bootstrap } from './api';

interface SiteContextValue {
  data: Bootstrap | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

const SiteContext = createContext<SiteContextValue>({
  data: null,
  loading: true,
  error: null,
  reload: () => {},
});

export function SiteProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch('/api/bootstrap')
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || 'Gagal memuat data situs.');
        return body as Bootstrap;
      })
      .then((body) => {
        if (!alive) return;
        setData(body);
        setError(null);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  const reload = useCallback(() => setTick((value) => value + 1), []);

  return (
    <SiteContext.Provider value={{ data, loading, error, reload }}>{children}</SiteContext.Provider>
  );
}

export function useSite() {
  return useContext(SiteContext);
}
