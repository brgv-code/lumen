// Retrieval over the reader's own library (highlights, notes, saved items) for Ask.
// Keyword scoring in the Worker keeps it simple and private; swap in Vectorize later.

const STOP = new Set("a an and are as at be but by for from has have how i if in into is it its of on or that the their this to was what when where which who why will with you your about does do can".split(" "));

export function terms(q: string): string[] {
  return [...new Set(q.toLowerCase().match(/[a-z0-9][a-z0-9'-]{2,}/g) ?? [])].filter((t) => !STOP.has(t)).slice(0, 12);
}

export interface Source { n: number; kind: "highlight" | "item"; id: string; itemId: string; title: string; url: string; quote?: string; note?: string | null; excerpt?: string | null }

function score(text: string, ts: string[]) {
  const t = text.toLowerCase();
  let s = 0;
  for (const w of ts) { const i = t.indexOf(w); if (i >= 0) s += 1 + (t.split(w).length - 2) * 0.25; }
  return s;
}

export async function retrieve(db: D1Database, userId: string, query: string, limit = 6): Promise<Source[]> {
  const ts = terms(query);
  if (!ts.length) return [];
  const likes = ts.slice(0, 6).map(() => "(h.quote LIKE ? OR h.note LIKE ? OR i.title LIKE ?)").join(" OR ");
  const hlArgs = ts.slice(0, 6).flatMap((t) => [`%${t}%`, `%${t}%`, `%${t}%`]);
  const { results: hls } = await db.prepare(`SELECT h.id, h.quote, h.note, i.id AS item_id, i.title, i.url FROM highlights h JOIN items i ON i.id = h.item_id
    WHERE h.user_id = ? AND (${likes}) LIMIT 80`).bind(userId, ...hlArgs).all<{ id: string; quote: string; note: string | null; item_id: string; title: string; url: string }>();
  const ilikes = ts.slice(0, 6).map(() => "(title LIKE ? OR excerpt LIKE ? OR content_text LIKE ?)").join(" OR ");
  const { results: items } = await db.prepare(`SELECT id, title, url, excerpt FROM items WHERE user_id = ? AND (${ilikes}) LIMIT 40`).bind(userId, ...hlArgs).all<{ id: string; title: string; url: string; excerpt: string | null }>();

  const ranked = [
    ...hls.map((h) => ({ s: score(`${h.quote} ${h.note ?? ""} ${h.title}`, ts) + (h.note ? 0.5 : 0) + 0.5, src: { kind: "highlight" as const, id: h.id, itemId: h.item_id, title: h.title, url: h.url, quote: h.quote, note: h.note } })),
    ...items.map((i) => ({ s: score(`${i.title} ${i.excerpt ?? ""}`, ts), src: { kind: "item" as const, id: i.id, itemId: i.id, title: i.title, url: i.url, excerpt: i.excerpt } })),
  ].filter((x) => x.s > 0).sort((a, b) => b.s - a.s);

  const out: Source[] = [];
  const seenItem = new Set<string>();
  for (const r of ranked) {
    if (r.src.kind === "item" && seenItem.has(r.src.itemId)) continue;
    seenItem.add(r.src.itemId);
    out.push({ n: out.length + 1, ...r.src });
    if (out.length >= limit) break;
  }
  return out;
}

export function sourcesBlock(src: Source[]) {
  if (!src.length) return "(nothing in the library matched)";
  return src.map((s) => s.kind === "highlight"
    ? `[${s.n}] Highlight from "${s.title}": "${s.quote?.slice(0, 400)}"${s.note ? ` (their note: ${s.note.slice(0, 200)})` : ""}`
    : `[${s.n}] Saved article "${s.title}"${s.excerpt ? `: ${s.excerpt.slice(0, 240)}` : ""}`).join("\n");
}
