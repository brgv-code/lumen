import { useCallback, useEffect, useRef, useState } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const run = useCallback(() => {
    const n = ++seq.current;
    setLoading(true);
    return fn().then(
      (d) => { if (n === seq.current) { setData(d); setError(null); setLoading(false); } return d; },
      (e) => { if (n === seq.current) { setError(e); setLoading(false); } },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, error, loading, reload: run, setData };
}

/** Adds .is-in to .reveal elements as they scroll into view. */
export function useReveal(root: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    el.querySelectorAll(".reveal").forEach((n) => io.observe(n));
    return () => io.disconnect();
  });
}

export function useDebounced<T extends (...a: any[]) => void>(fn: T, ms: number) {
  const t = useRef<number>();
  const f = useRef(fn);
  f.current = fn;
  return useCallback((...a: Parameters<T>) => {
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => f.current(...a), ms);
  }, [ms]);
}

export function timeAgo(ms: number) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function hostOf(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

export function getTheme(): "light" | "dark" | "system" {
  try { const t = localStorage.getItem("lumen-theme"); return t === "light" || t === "dark" ? t : "system"; } catch { return "system"; }
}
export function setTheme(t: "light" | "dark" | "system") {
  try { if (t === "system") localStorage.removeItem("lumen-theme"); else localStorage.setItem("lumen-theme", t); } catch { /* */ }
  if (t === "system") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
}
