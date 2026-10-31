// Public share pages: /s/:id and its link preview image /s/:id/og.jpg.
import type { Env } from "../env";
import { SITE, esc, page } from "./layout";
import { notFound } from "./routes";

interface Share { id: string; kind: string; title: string; payload: string; views: number; created_at: number; owner: string }

export async function shareImage(env: Env, id: string) {
  const row = await env.DB.prepare("SELECT image FROM shares WHERE id = ?").bind(id).first<{ image: ArrayBuffer | number[] | null }>();
  if (!row?.image) return new Response("not found", { status: 404 });
  const bytes = row.image instanceof ArrayBuffer ? new Uint8Array(row.image) : new Uint8Array(row.image as number[]);
  const png = bytes[0] === 0x89;
  return new Response(bytes, { headers: { "content-type": png ? "image/png" : "image/jpeg", "cache-control": "public, max-age=86400" } });
}

export async function sharePage(env: Env, id: string, ctx: { waitUntil(p: Promise<unknown>): void }) {
  const s = await env.DB.prepare("SELECT s.id, s.kind, s.title, s.payload, s.views, s.created_at, u.name AS owner FROM shares s JOIN users u ON u.id = s.user_id WHERE s.id = ?").bind(id).first<Share>();
  if (!s) return notFound();
  ctx.waitUntil(env.DB.prepare("UPDATE shares SET views = views + 1 WHERE id = ?").bind(id).run());
  const p = JSON.parse(s.payload) as Record<string, any>;
  const owner = String(s.owner || "A reader").replace(/\s*\((demo|test)\)$/, "");
  let inner = "";
  let description = "";
  if (s.kind === "highlight") {
    description = `“${String(p.quote ?? "").slice(0, 180)}” from ${p.title ?? "an article"}`;
    inner = `<blockquote class="sh-quote"><mark class="hl-${esc(p.color ?? "sun")}">${esc(p.quote ?? "")}</mark></blockquote>
      ${p.note ? `<p class="sh-note"><b>${esc(owner)}'s note:</b> ${esc(p.note)}</p>` : ""}
      ${p.url ? `<a class="sh-source" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title ?? p.url)} <span>↗</span></a>` : ""}`;
  } else if (s.kind === "progress") {
    description = `${owner} is on a ${p.streak ?? 0} day reading streak with Lumen.`;
    inner = `<div class="sh-stats"><div><b>${esc(String(p.streak ?? 0))}</b><span>day streak</span></div><div><b>${esc(String(p.glowTotal ?? 0))}</b><span>glow</span></div><div><b>${esc(String(p.done ?? 0))}</b><span>finished</span></div><div><b>${esc(String(p.highlights ?? 0))}</b><span>highlights</span></div></div>`;
  } else {
    description = `${owner}'s reading list: ${p.name ?? "a collection"} · ${(p.items ?? []).length} pieces`;
    inner = `<h2 class="sh-col">${esc(p.emoji ?? "📚")} ${esc(p.name ?? "")}</h2>${p.description ? `<p class="sh-note">${esc(p.description)}</p>` : ""}
      <ol class="sh-list">${(p.items ?? []).slice(0, 30).map((i: { title: string; url: string; site?: string }) => `<li><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.title)}</a><span>${esc(i.site ?? "")}</span></li>`).join("")}</ol>`;
  }
  const img = `${SITE.url}/s/${s.id}/og.jpg`;
  return new Response(page({
    path: `/s/${s.id}`,
    title: `${s.title} · shared with Lumen`,
    description,
    ogImage: img,
    extraHead: `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><style>
      .sh-wrap{max-width:860px;margin:28px auto 0;display:grid;gap:18px}
      .sh-card{border-radius:26px;overflow:hidden;box-shadow:var(--shadow-card)} .sh-card img{width:100%;display:block}
      .sh-body{background:var(--surface);border-radius:26px;padding:clamp(20px,4vw,36px);display:grid;gap:14px}
      .sh-quote{margin:0;font-family:var(--font-read);font-size:clamp(20px,2.6vw,26px);line-height:1.55;color:var(--ink)}
      .sh-note{color:var(--ink-2)} .sh-source{color:var(--sky);font-weight:500} .sh-col{font-size:28px}
      .sh-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px} .sh-stats div{background:var(--raised);border-radius:16px;padding:16px;display:grid}
      .sh-stats b{font-size:32px;color:var(--ink);letter-spacing:-.04em} .sh-stats span{color:var(--ink-3);font-size:13px}
      .sh-list{margin:0;padding-left:20px;display:grid;gap:8px} .sh-list a{color:var(--ink);font-weight:500} .sh-list span{color:var(--ink-3);font-size:13px;margin-left:8px}
      .sh-by{display:flex;align-items:center;gap:10px;color:var(--ink-3);font-size:14px}
      .made-with{position:fixed;right:18px;bottom:18px;z-index:50;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px 0 6px;border-radius:999px;
        background:#121215;color:#fff;font:500 13.5px var(--font-ui);box-shadow:0 14px 30px -12px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.12);transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
      .made-with:hover{transform:translateY(-2px) scale(1.03)} .made-with .t{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;background:linear-gradient(180deg,#ffb53d,#ff6a1a)}
      @media(max-width:640px){.sh-stats{grid-template-columns:1fr 1fr}}
    </style>`,
    body: `<div class="sh-wrap">
      <div class="sh-by"><span class="tile tile--sm tile--lamp" style="--size:26px">✦</span> Shared by <b style="color:var(--ink)">${esc(owner)}</b> · ${new Date(s.created_at).toLocaleDateString("en", { month: "long", day: "numeric", year: "numeric" })}</div>
      <div class="sh-card"><img src="/s/${s.id}/og.jpg" alt="${esc(s.title)}"></div>
      <div class="sh-body">${inner}</div>
      <section class="surface gridlines cta-band" style="padding:34px 20px"><h2 class="h3" style="position:relative"><span class="lead-in">Keep what glows</span> <span class="payoff">from your own reading.</span></h2>
        <p class="muted" style="position:relative;max-width:460px">Highlight anything on the web, ask what it means, and share the good parts. Free.</p>
        <a class="key key--lamp key--lg" style="position:relative" href="/?ref=share-${s.id}">Start reading with Lumen</a></section>
    </div>
    <a class="made-with" href="/?ref=pill-${s.id}"><span class="t">${LAMP_SVG}</span>Read with Lumen</a>`,
  }), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
}

const LAMP_SVG = `<svg width="16" height="16" viewBox="0 0 64 64"><path d="M20 44h24" stroke="#fff" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="27" r="10" fill="#fff"/></svg>`;
