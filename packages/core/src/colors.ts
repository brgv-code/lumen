// Highlight colours: ten named colours plus any custom "#rrggbb".
// Everything that draws a highlight goes through colorRgb, so a new colour needs no new CSS.

export interface NamedColor { id: string; name: string; rgb: [number, number, number]; swatch: string }

export const HIGHLIGHT_PALETTE = [
  { id: "sun", name: "Sun", rgb: [255, 196, 0], swatch: "#ffd34d" },
  { id: "peach", name: "Peach", rgb: [255, 110, 80], swatch: "#ff8a6b" },
  { id: "rose", name: "Rose", rgb: [255, 72, 140], swatch: "#ff6fa5" },
  { id: "grape", name: "Grape", rgb: [180, 90, 255], swatch: "#bb7bff" },
  { id: "iris", name: "Iris", rgb: [125, 105, 255], swatch: "#8a7bff" },
  { id: "sky", name: "Sky", rgb: [60, 135, 255], swatch: "#5b9bff" },
  { id: "teal", name: "Teal", rgb: [0, 185, 200], swatch: "#2cc6d4" },
  { id: "mint", name: "Mint", rgb: [30, 200, 130], swatch: "#3fd39a" },
  { id: "lime", name: "Lime", rgb: [140, 210, 30], swatch: "#a6dc4a" },
  { id: "slate", name: "Slate", rgb: [120, 132, 155], swatch: "#9aa4b8" },
] as const satisfies readonly NamedColor[];

export type NamedHighlightColor = (typeof HIGHLIGHT_PALETTE)[number]["id"];
/** A named colour or a custom "#rrggbb". */
export type HighlightColor = NamedHighlightColor | `#${string}`;

export const HIGHLIGHT_COLORS = HIGHLIGHT_PALETTE.map((c) => c.id) as NamedHighlightColor[];
/** Collections keep the original five: their tiles are styled per colour. */
export const COLLECTION_COLORS = ["sun", "mint", "iris", "peach", "sky"] as const;

const BY_ID: Record<string, NamedColor> = Object.fromEntries(HIGHLIGHT_PALETTE.map((c) => [c.id, c]));

/** A valid stored colour, or null. Accepts names, "#rgb", "#rrggbb" and "rrggbb". */
export function normalizeColor(v: unknown): HighlightColor | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (BY_ID[s]) return s as NamedHighlightColor;
  // a bare 6 digit code is fine to paste; shorthand needs the "#" so words like "bad" stay words
  const m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/) ?? s.match(/^([0-9a-f]{6})$/);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((ch) => ch + ch).join("") : m[1];
  return `#${h}`;
}

export function isCustomColor(c: string): boolean { return c.startsWith("#"); }

export function colorRgb(c: string | null | undefined): [number, number, number] {
  if (c && BY_ID[c]) return BY_ID[c].rgb;
  const n = c ? normalizeColor(c) : null;
  if (n && n.startsWith("#")) return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
  return BY_ID.sun.rgb;
}

/** "r g b" for CSS: rgb(var(--hl) / .4) */
export function colorVar(c: string | null | undefined): string { return colorRgb(c).join(" "); }

/** Solid swatch for pickers and dots. */
export function colorSwatch(c: string | null | undefined): string {
  if (c && BY_ID[c]) return BY_ID[c].swatch;
  const n = c ? normalizeColor(c) : null;
  return n ?? BY_ID.sun.swatch;
}

export function colorName(c: string | null | undefined): string {
  if (c && BY_ID[c]) return BY_ID[c].name;
  return c ? c.toUpperCase() : "Sun";
}

/** HSV (h 0..360, s and v 0..1) to "#rrggbb", for the colour wheel. */
export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return "#" + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
}

/** "#rrggbb" to HSV, so the wheel can show where a colour sits. */
export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = colorRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}
