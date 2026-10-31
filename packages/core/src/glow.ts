// Glow: the small, quiet reward loop. Reading earns light; streaks keep the lamp on.

export const GLOW = {
  save: 1,
  highlight: 2,
  note: 3,
  finish: 10,
  idea: 2,
} as const;
export type GlowKind = keyof typeof GLOW;

export const LEVELS = [
  { name: "Spark", at: 0 },
  { name: "Candle", at: 50 },
  { name: "Lantern", at: 200 },
  { name: "Lighthouse", at: 600 },
  { name: "Aurora", at: 1500 },
  { name: "Sun", at: 4000 },
] as const;

export function levelFor(total: number) {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (total >= LEVELS[i].at) index = i;
  const cur = LEVELS[index];
  const next = LEVELS[index + 1];
  const progress = next ? (total - cur.at) / (next.at - cur.at) : 1;
  return { name: cur.name, index, progress: Math.min(1, Math.max(0, progress)), next: next ? next.at : cur.at };
}

/** days: distinct YYYY-MM-DD strings with activity. today: YYYY-MM-DD. */
export function streaks(days: string[], today: string): { current: number; best: number } {
  const set = new Set(days);
  const sorted = [...set].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  // current streak may end today or yesterday (today not read yet keeps the lamp lit)
  let cursor = set.has(today) ? today : addDays(today, -1);
  let current = 0;
  while (set.has(cursor)) { current++; cursor = addDays(cursor, -1); }
  return { current, best };
}

export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
