import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

/** Filter/sort/page state kept in the URL query, so every view can be linked. */
export function useQuery<T extends Record<string, string>>(defaults: T): [T, (patch: Partial<T>) => void, () => void] {
  const [params, setParams] = useSearchParams();
  const value = useMemo(() => {
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) {
      const v = params.get(k);
      if (v !== null) (out as Record<string, string>)[k] = v;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  const update = useCallback(
    (patch: Partial<T>) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(patch)) {
            if (v === undefined || v === '' || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true },
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );
  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);
  return [value, update, reset];
}

export type Theme = 'light' | 'dark' | 'system';

function storedTheme(): Theme {
  try {
    const v = localStorage.getItem('revforge-theme');
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Per-viewer convenience only; the dashboard renders correctly without storage. */
export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    };
    apply();
    try {
      if (theme === 'system') localStorage.removeItem('revforge-theme');
      else localStorage.setItem('revforge-theme', theme);
    } catch {
      /* storage unavailable: theme still applies for this visit */
    }
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [theme]);
  return [theme, setTheme];
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** Scroll to the in-page target named by the route's #fragment (e.g. /roadmap#RCG-01). */
export function useHashScroll(toId: (hash: string) => string = (h) => h) {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash.length > 1) requestAnimationFrame(() => scrollToId(toId(decodeURIComponent(hash.slice(1)))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);
}
