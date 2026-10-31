import { colorRgb } from "@lumen/core";
// Share cards drawn on a canvas, in the Lumen look, at the sizes each platform wants.

export type CardFormat = "link" | "square" | "portrait" | "story";
export type CardTheme = "lamp" | "light" | "dark" | "iris";

export const FORMATS: Record<CardFormat, { w: number; h: number; label: string; hint: string }> = {
  link: { w: 1200, h: 630, label: "Link preview", hint: "X, LinkedIn, Slack, iMessage previews" },
  square: { w: 1080, h: 1080, label: "Square", hint: "Instagram and LinkedIn posts" },
  portrait: { w: 1080, h: 1350, label: "Portrait 4:5", hint: "Instagram feed, Threads, LinkedIn" },
  story: { w: 1080, h: 1920, label: "Story 9:16", hint: "Instagram, WhatsApp and TikTok stories" },
};

export interface HighlightCardData { kind: "highlight"; quote: string; note?: string | null; title: string; url: string; site?: string | null; color: string; owner: string }
export interface ProgressCardData { kind: "progress"; owner: string; streak: number; best: number; glowTotal: number; level: string; done: number; highlights: number; week: { day: string; glow: number }[] }
export interface CollectionCardData { kind: "collection"; owner: string; name: string; emoji: string; description?: string | null; items: { title: string; site?: string | null }[]; total: number }
export type CardData = HighlightCardData | ProgressCardData | CollectionCardData;


interface Palette { bg: (c: CanvasRenderingContext2D, w: number, h: number) => void; card: string; ink: string; ink2: string; ink3: string; well: string; dark: boolean }
const PALETTES: Record<CardTheme, Palette> = {
  lamp: {
    bg: (c, w, h) => mesh(c, w, h, "#ffe7b8", "#ffb38a", "#ffd27a", "#ff8f5a"),
    card: "#ffffff", ink: "#0e0e10", ink2: "#3a3a3f", ink3: "#8c8c92", well: "#f1f1ef", dark: false,
  },
  iris: {
    bg: (c, w, h) => mesh(c, w, h, "#e3dcff", "#a99cff", "#b8adff", "#7d6bff"),
    card: "#ffffff", ink: "#0e0e10", ink2: "#3a3a3f", ink3: "#8c8c92", well: "#f3f1ff", dark: false,
  },
  light: {
    bg: (c, w, h) => { c.fillStyle = "#ededec"; c.fillRect(0, 0, w, h); dots(c, w, h, "rgba(14,14,16,.10)", 0.9); },
    card: "#f8f8f7", ink: "#0e0e10", ink2: "#3a3a3f", ink3: "#8c8c92", well: "#ececea", dark: false,
  },
  dark: {
    bg: (c, w, h) => {
      c.fillStyle = "#0f0f11"; c.fillRect(0, 0, w, h);
      const g = c.createRadialGradient(w * 0.85, h * 0.95, 0, w * 0.85, h * 0.95, Math.max(w, h) * 0.7);
      g.addColorStop(0, "rgba(255,138,31,.35)"); g.addColorStop(1, "rgba(255,138,31,0)");
      c.fillStyle = g; c.fillRect(0, 0, w, h); dots(c, w, h, "rgba(255,255,255,.07)", 0.8);
    },
    card: "#1b1b1f", ink: "#f4f4f5", ink2: "#c9c9ce", ink3: "#8b8b93", well: "#26262b", dark: true,
  },
};

function mesh(c: CanvasRenderingContext2D, w: number, h: number, a: string, b: string, blobA: string, blobB: string) {
  const lin = c.createLinearGradient(0, 0, w, h); lin.addColorStop(0, a); lin.addColorStop(1, b);
  c.fillStyle = lin; c.fillRect(0, 0, w, h);
  for (const [x, y, r, col] of [[0.15, 0.2, 0.8, blobA], [0.85, 0.85, 0.7, blobB]] as const) {
    const g = c.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * r * 0.6);
    g.addColorStop(0, col); g.addColorStop(1, "rgba(255,255,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }
  dots(c, w, h, "rgba(255,255,255,.55)", 1);
}

function dots(c: CanvasRenderingContext2D, w: number, h: number, color: string, scale: number) {
  const step = Math.round(14 * scale * (w / 1200) + 6);
  c.fillStyle = color;
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
    const fade = 1 - (x / w + y / h) / 2.1; // fade toward the bottom right, like the landing panels
    if (fade <= 0.05) continue;
    c.globalAlpha = Math.min(1, fade * 1.3);
    c.beginPath(); c.arc(x, y, step * 0.11, 0, Math.PI * 2); c.fill();
  }
  c.globalAlpha = 1;
}

function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { c.beginPath(); c.roundRect(x, y, w, h, r); }

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (c.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (within bounds) whose wrapped text fits the box. */
function fit(c: CanvasRenderingContext2D, text: string, font: (px: number) => string, maxW: number, maxH: number, lh: number, max: number, min: number) {
  for (let px = max; px >= min; px -= 2) {
    c.font = font(px);
    const lines = wrap(c, text, maxW);
    if (lines.length * px * lh <= maxH) return { px, lines };
  }
  c.font = font(min);
  let lines = wrap(c, text, maxW);
  const maxLines = Math.max(1, Math.floor(maxH / (min * lh)));
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "…"; }
  return { px: min, lines };
}

function lampTile(c: CanvasRenderingContext2D, x: number, y: number, s: number) {
  const g = c.createLinearGradient(0, y, 0, y + s); g.addColorStop(0, "#ffb53d"); g.addColorStop(1, "#ff6a1a");
  c.save(); c.shadowColor = "rgba(255,106,26,.45)"; c.shadowBlur = s * 0.4; c.shadowOffsetY = s * 0.12;
  rr(c, x, y, s, s, s * 0.26); c.fillStyle = g; c.fill(); c.restore();
  const k = s / 64;
  c.fillStyle = "#fff"; c.beginPath(); c.arc(x + 32 * k, y + 27 * k, 9 * k, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#fff"; c.lineCap = "round"; c.lineWidth = 5 * k; c.beginPath(); c.moveTo(x + 20 * k, y + 44 * k); c.lineTo(x + 44 * k, y + 44 * k); c.stroke();
  c.lineWidth = 3 * k;
  for (const [x1, y1, x2, y2] of [[32, 10, 32, 13], [47, 27, 44, 27], [20, 27, 17, 27], [42.6, 16.4, 40.5, 18.5], [23.5, 18.5, 21.4, 16.4]]) { c.beginPath(); c.moveTo(x + x1 * k, y + y1 * k); c.lineTo(x + x2 * k, y + y2 * k); c.stroke(); }
}

function letterTile(c: CanvasRenderingContext2D, x: number, y: number, s: number, ch: string, color = "#2f7bff") {
  rr(c, x, y, s, s, s * 0.28); c.fillStyle = color; c.fill();
  c.fillStyle = "#fff"; c.font = `600 ${Math.round(s * 0.5)}px Geist, system-ui`; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText(ch.toUpperCase(), x + s / 2, y + s / 2 + 1); c.textAlign = "left"; c.textBaseline = "alphabetic";
}

function footer(c: CanvasRenderingContext2D, p: Palette, x: number, y: number, w: number, s: number) {
  lampTile(c, x, y - s * 0.78, s * 0.9);
  c.fillStyle = p.ink; c.font = `600 ${s * 0.62}px Geist, system-ui`; c.fillText("lumen", x + s * 1.15, y - s * 0.12);
  c.fillStyle = p.ink3; c.font = `500 ${s * 0.4}px Geist, system-ui`; c.textAlign = "right";
  // keep clear of the wordmark: drop the tagline when the card is narrow
  const room = w - s * 4.2;
  const full = "Read with Lumen  ·  lumen.brgv95.workers.dev";
  c.fillText(c.measureText(full).width <= room ? full : "lumen.brgv95.workers.dev", x + w, y - s * 0.2); c.textAlign = "left";
}

export async function ensureFonts() {
  try {
    await Promise.all(["600 40px Geist", "500 40px Geist", "400 40px Newsreader", "italic 400 40px Newsreader", "500 40px Newsreader"].map((f) => document.fonts.load(f)));
  } catch { /* fall back to system fonts */ }
}

export function renderCard(canvas: HTMLCanvasElement, data: CardData, format: CardFormat, theme: CardTheme) {
  const { w: W, h: H } = FORMATS[format];
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d")!;
  const p = PALETTES[theme];
  p.bg(c, W, H);
  const wide = format === "link";
  const tall = format === "story";
  const pad = Math.round(Math.min(W, H) * (wide ? 0.07 : 0.075));
  const cx = pad, cy = tall ? pad * 2.2 : pad, cw = W - pad * 2, ch = H - (tall ? pad * 4.4 : pad * 2);
  c.save(); c.shadowColor = p.dark ? "rgba(0,0,0,.6)" : "rgba(60,30,0,.22)"; c.shadowBlur = pad * 0.9; c.shadowOffsetY = pad * 0.25;
  rr(c, cx, cy, cw, ch, pad * 0.55); c.fillStyle = p.card; c.fill(); c.restore();
  const ip = Math.round(pad * (wide ? 0.75 : 0.8));
  const x = cx + ip, y0 = cy + ip, iw = cw - ip * 2, ih = ch - ip * 2;
  const unit = (Math.min(W, H) / 1080) * (wide ? 1.45 : 1); // scale for type; link cards are seen small in feeds
  const footH = 70 * unit * (wide ? 0.85 : 1);

  if (data.kind === "highlight") {
    const u = wide ? unit : unit * 1.2; // link cards are viewed small in feeds: larger type
    const site = data.site || hostOf(data.url);
    const tile = 54 * u * (wide ? 0.9 : 1);
    letterTile(c, x, y0, tile, site[0] ?? "L", tileColor(site));
    c.fillStyle = p.ink; c.font = `600 ${26 * u * (wide ? 0.95 : 1)}px Geist, system-ui`;
    c.fillText(ellipsize(c, data.title, iw - tile - 20 * u), x + tile + 18 * u, y0 + tile * 0.45);
    c.fillStyle = p.ink3; c.font = `500 ${21 * u}px Geist, system-ui`;
    c.fillText(site, x + tile + 18 * u, y0 + tile * 0.92);
    const noteH = data.note ? (wide ? 70 : 150) * u : 0;
    const qTop = y0 + tile + 44 * u;
    const qH = ih - (qTop - y0) - footH - noteH - 30 * u;
    const ser = (px: number) => `400 ${px}px Newsreader, Georgia, serif`;
    const quote = `“${data.quote.replace(/\s+/g, " ").trim()}”`;
    const { px, lines } = fit(c, quote, ser, iw, qH, 1.42, (tall ? 112 : wide ? 74 : 96) * u, 24 * u);
    const lh = px * 1.42;
    const block = lines.length * lh;
    let ly = qTop + Math.max(0, (qH - block) / (tall || lines.length <= 3 ? 2 : 3)) + px;
    const rgb = colorRgb(data.color).join(",");
    for (const l of lines) {
      c.font = ser(px);
      const lw = c.measureText(l).width;
      rr(c, x - 6 * u, ly - px * 0.86, lw + 12 * u, px * 1.12, 6 * u);
      c.fillStyle = `rgba(${rgb},${p.dark ? 0.24 : 0.3})`; c.fill();
      c.fillStyle = `rgba(${rgb},.9)`; c.fillRect(x - 6 * u, ly + px * 0.22, lw + 12 * u, Math.max(2, 3 * u));
      c.fillStyle = p.ink; c.fillText(l, x, ly);
      ly += lh;
    }
    if (data.note) {
      const ny = cy + ch - ip - footH - noteH + 10 * u;
      rr(c, x, ny, iw, noteH - 20 * u, 18 * u); c.fillStyle = p.well; c.fill();
      c.fillStyle = p.ink3; c.font = `600 ${17 * u}px Geist, system-ui`; c.fillText(`${data.owner.toUpperCase()}'S NOTE`, x + 22 * u, ny + 34 * u);
      const nf = (px2: number) => `italic 400 ${px2}px Newsreader, Georgia, serif`;
      const nb = fit(c, data.note, nf, iw - 44 * u, noteH - 70 * u, 1.35, 28 * u, 18 * u);
      c.fillStyle = p.ink2; c.font = nf(nb.px);
      nb.lines.forEach((l, i) => c.fillText(l, x + 22 * u, ny + 34 * u + nb.px * 1.35 * (i + 1)));
    }
  } else if (data.kind === "progress") {
    c.fillStyle = p.ink3; c.font = `600 ${20 * unit}px Geist, system-ui`; c.fillText(`${data.owner.toUpperCase()} IS READING WITH LUMEN`, x, y0 + 24 * unit);
    const flame = (tall ? 120 : wide ? 92 : 108) * unit;
    const fy = y0 + 60 * unit;
    rr(c, x, fy, flame, flame, flame * 0.26);
    const g = c.createLinearGradient(0, fy, 0, fy + flame); g.addColorStop(0, "#ffb53d"); g.addColorStop(1, "#ff6a1a"); c.fillStyle = g; c.fill();
    c.font = `${flame * 0.55}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("🔥", x + flame / 2, fy + flame / 2 + 2); c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillStyle = p.ink; c.font = `600 ${flame * 0.95}px Geist, system-ui`; c.fillText(String(data.streak), x + flame + 26 * unit, fy + flame * 0.82);
    const nw = c.measureText(String(data.streak)).width;
    c.fillStyle = p.ink2; c.font = `500 ${28 * unit}px Geist, system-ui`; c.fillText("day reading streak", x + flame + 34 * unit + nw, fy + flame * 0.5);
    c.fillStyle = p.ink3; c.font = `500 ${22 * unit}px Geist, system-ui`; c.fillText(`${data.level} · best ${data.best} days`, x + flame + 34 * unit + nw, fy + flame * 0.85);
    // week bars
    const by = fy + flame + (tall ? 120 : wide ? 40 : 70) * unit;
    const bh = (tall ? 520 : wide ? 150 : format === "portrait" ? 330 : 250) * unit;
    const max = Math.max(10, ...data.week.map((d) => d.glow));
    const gap = 14 * unit; const bw = (iw - gap * 6) / 7;
    data.week.forEach((d, i) => {
      const bx = x + i * (bw + gap);
      rr(c, bx, by, bw, bh, 14 * unit); c.fillStyle = p.well; c.fill();
      const hh = Math.max(8 * unit, (d.glow / max) * bh);
      rr(c, bx, by + bh - hh, bw, hh, 14 * unit);
      const bg2 = c.createLinearGradient(0, by + bh - hh, 0, by + bh); bg2.addColorStop(0, "#ffd27a"); bg2.addColorStop(1, "#ff6a1a"); c.fillStyle = bg2; c.fill();
      c.fillStyle = p.ink3; c.font = `500 ${18 * unit}px Geist, system-ui`; c.textAlign = "center";
      c.fillText(new Date(d.day + "T12:00:00").toLocaleDateString("en", { weekday: "narrow" }), bx + bw / 2, by + bh + 30 * unit); c.textAlign = "left";
    });
    const sy = by + bh + (wide ? 64 : 90) * unit;
    const stats: [string, string][] = [[String(data.glowTotal), "glow"], [String(data.done), "finished"], [String(data.highlights), "highlights"]];
    const sw = (iw - 2 * 16 * unit) / 3;
    if (sy + 90 * unit < cy + ch - ip - footH) stats.forEach(([v, l], i) => {
      const sx = x + i * (sw + 16 * unit);
      rr(c, sx, sy, sw, 96 * unit, 18 * unit); c.fillStyle = p.well; c.fill();
      c.fillStyle = p.ink; c.font = `600 ${38 * unit}px Geist, system-ui`; c.fillText(v, sx + 20 * unit, sy + 50 * unit);
      c.fillStyle = p.ink3; c.font = `500 ${18 * unit}px Geist, system-ui`; c.fillText(l, sx + 20 * unit, sy + 78 * unit);
    });
  } else {
    const tile = (wide ? 96 : 120) * unit;
    rr(c, x, y0, tile, tile, tile * 0.26); c.fillStyle = p.well; c.fill();
    c.font = `${tile * 0.58}px system-ui`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(data.emoji, x + tile / 2, y0 + tile / 2 + 2); c.textAlign = "left"; c.textBaseline = "alphabetic";
    c.fillStyle = p.ink3; c.font = `600 ${19 * unit}px Geist, system-ui`; c.fillText(`${data.owner.toUpperCase()}'S READING LIST · ${data.total} PIECES`, x + tile + 26 * unit, y0 + 30 * unit);
    const t = fit(c, data.name, (px) => `600 ${px}px Geist, system-ui`, iw - tile - 26 * unit, tile - 30 * unit, 1.1, 54 * unit, 28 * unit);
    c.fillStyle = p.ink; c.font = `600 ${t.px}px Geist, system-ui`;
    t.lines.forEach((l, i) => c.fillText(l, x + tile + 26 * unit, y0 + 34 * unit + t.px * 1.1 * (i + 1)));
    let ly = y0 + tile + 50 * unit;
    const rowH = (tall ? 120 : wide ? 62 : 92) * unit;
    const room = cy + ch - ip - footH - ly - 20 * unit;
    const rows = Math.max(1, Math.min(data.items.length, Math.floor(room / (rowH + 12 * unit))));
    data.items.slice(0, rows).forEach((it, i) => {
      rr(c, x, ly, iw, rowH, 18 * unit); c.fillStyle = p.well; c.fill();
      const s2 = rowH * 0.56;
      letterTile(c, x + 16 * unit, ly + (rowH - s2) / 2, s2, (it.site ?? "·")[0] ?? "·", tileColor(it.site ?? String(i)));
      c.fillStyle = p.ink; c.font = `500 ${(wide ? 22 : 27) * unit}px Geist, system-ui`;
      c.fillText(ellipsize(c, it.title, iw - s2 - 60 * unit), x + s2 + 34 * unit, ly + rowH / 2 + 9 * unit);
      ly += rowH + 12 * unit;
    });
  }
  footer(c, p, x, cy + ch - ip, iw, footH);
  if (tall) {
    c.fillStyle = p.dark ? "#f4f4f5" : "#0e0e10"; c.font = `600 ${46 * unit}px Geist, system-ui`; c.textAlign = "center";
    c.fillText(data.kind === "highlight" ? "A line worth keeping" : data.kind === "progress" ? "The lamp is on" : "On my reading list", W / 2, pad * 1.45);
    c.textAlign = "left";
  }
}

function ellipsize(c: CanvasRenderingContext2D, s: string, w: number) {
  if (c.measureText(s).width <= w) return s;
  let t = s;
  while (t.length > 1 && c.measureText(t + "…").width > w) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}
function hostOf(u: string) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } }
function tileColor(s: string) { const n = [...s].reduce((a, ch) => a + ch.charCodeAt(0), 0); return ["#ff8a1f", "#6d5bff", "#14a86f", "#2f7bff", "#f2603d"][n % 5]; }

/** Captions written for each platform's norms and length limits. */
export function captions(data: CardData, link: string): Record<"x" | "linkedin" | "threads" | "bluesky" | "whatsapp", string> {
  if (data.kind === "highlight") {
    const q = data.quote.replace(/\s+/g, " ").trim();
    const short = q.length > 170 ? q.slice(0, 167).replace(/\s+\S*$/, "") + "…" : q;
    return {
      x: `“${short}”\n\nfrom ${data.title}\n${link}`,
      linkedin: `A line I keep coming back to, from “${data.title}”:\n\n“${q}”${data.note ? `\n\nWhy it stuck with me: ${data.note}` : ""}\n\nWhat would you add?\n\n${link}`,
      threads: `“${short}”\n\n${data.note ? data.note + "\n\n" : ""}from ${data.title} ${link}`,
      bluesky: `“${q.length > 200 ? q.slice(0, 197) + "…" : q}”\n\n${link}`,
      whatsapp: `“${q}”\n— ${data.title}\n${link}`,
    };
  }
  if (data.kind === "progress") {
    return {
      x: `${data.streak} days in a row of actually reading 🔥 ${data.done} pieces finished, ${data.highlights} highlights kept.\n\nReading slowly with Lumen: ${link}`,
      linkedin: `${data.streak} days straight of deliberate reading.\n\n${data.done} articles finished and ${data.highlights} passages highlighted, all in one place instead of 40 open tabs.\n\nThe habit that made it stick: a short daily list and one note per piece.\n\n${link}`,
      threads: `${data.streak} day reading streak 🔥 ${data.highlights} highlights kept. ${link}`,
      bluesky: `${data.streak} days of reading in a row, ${data.done} pieces finished. ${link}`,
      whatsapp: `My reading streak: ${data.streak} days 🔥 ${link}`,
    };
  }
  const top = data.items.slice(0, 3).map((i) => `• ${i.title}`).join("\n");
  return {
    x: `My reading list: ${data.emoji} ${data.name} (${data.total} pieces)\n\n${top}\n\n${link}`,
    linkedin: `I put together a reading list: ${data.emoji} ${data.name}.\n\n${data.description ? data.description + "\n\n" : ""}A few highlights:\n${top}\n\nThe full list: ${link}`,
    threads: `${data.emoji} ${data.name}: ${data.total} things worth reading ${link}`,
    bluesky: `${data.emoji} ${data.name}: my reading list (${data.total} pieces) ${link}`,
    whatsapp: `${data.emoji} ${data.name}: my reading list ${link}`,
  };
}
