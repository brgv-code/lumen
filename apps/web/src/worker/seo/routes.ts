// Crawlable pages served by the Worker: comparisons, answers, docs, legal,
// changelog, plus sitemap.xml, robots.txt and llms.txt for search and answer engines.
import { Hono } from "hono";
import { Marked } from "marked";
import type { AppEnv } from "../env";
import { COMPARES, UPDATED } from "./compare";
import { ANSWERS } from "./answers";
import { SITE, META, crumbs, crumbsLd, ctaBand, esc, faqLd, page, GLYPH } from "./layout";
import README from "../../../../../README.md";
import PLAN from "../../../../../docs/PLAN.md";
import ARCHITECTURE from "../../../../../docs/ARCHITECTURE.md";
import STATES from "../../../../../docs/STATES.md";
import API from "../../../../../docs/API.md";
import DATA_MODEL from "../../../../../docs/DATA_MODEL.md";
import MCP from "../../../../../docs/MCP.md";
import DEPLOY from "../../../../../docs/DEPLOY.md";
import EXTENSION from "../../../../../docs/EXTENSION.md";
import AUDIT from "../../../../../docs/AUDIT.md";

export const seo = new Hono<AppEnv>();

seo.use("*", async (c, next) => {
  META.verify = c.env.GOOGLE_SITE_VERIFICATION ?? "";
  await next();
});

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300, s-maxage=3600" } });

/* ---------------- compare ---------------- */

seo.get("/compare", () => {
  const items = COMPARES.map((c) => `<a class="link-card" href="/compare/${c.slug}"><span class="chip ${c.kind === "alternative" ? "chip--peach" : "chip--iris"}" style="justify-self:start">${c.kind === "alternative" ? "Alternative" : "Comparison"}</span><h3>${esc(c.title.split(":")[0].split("(")[0])}</h3><p>${esc(c.description)}</p></a>`).join("");
  const trail: [string, string][] = [["Home", "/"], ["Compare", "/compare"]];
  return html(page({
    path: "/compare", nav: "compare",
    title: "Lumen compared: Readwise, Glasp, Obsidian Web Clipper, Pocket and more",
    description: "Honest comparisons of Lumen with other read later and web highlighting tools, and alternatives to apps that shut down.",
    jsonLd: [crumbsLd(trail)],
    body: `${crumbs(trail)}<section class="surface s-hero"><span class="label-pill">Compare</span><h1><span class="lead-in">Every tool has a best use.</span> <span class="payoff">Here is where Lumen fits.</span></h1><p class="dek">Side by side comparisons with the read later and highlighting tools people ask about most, written to help you choose, including when the other one is the better pick.</p></section><div class="cards-grid">${items}</div>${ctaBand()}`,
  }));
});

seo.get("/compare/:slug", (c) => {
  const x = COMPARES.find((k) => k.slug === c.req.param("slug"));
  if (!x) return notFound();
  const trail: [string, string][] = [["Home", "/"], ["Compare", "/compare"], [x.kind === "alternative" ? `${x.name} alternative` : `Lumen vs ${x.name}`, `/compare/${x.slug}`]];
  const table = `<div class="table-scroll"><table class="ctable"><thead><tr><th>Feature</th><th class="us">Lumen</th><th>${esc(x.name)}</th></tr></thead><tbody>${x.rows.map(([f, a, b]) => `<tr><td>${esc(f)}</td><td class="us">${esc(a)}</td><td>${esc(b)}</td></tr>`).join("")}</tbody></table></div>`;
  const others = COMPARES.filter((k) => k.slug !== x.slug).slice(0, 4).map((k) => `<li><a href="/compare/${k.slug}">${esc(k.kind === "alternative" ? `${k.name} alternative` : `Lumen vs ${k.name}`)}</a></li>`).join("");
  return html(page({
    path: `/compare/${x.slug}`, nav: "compare", title: x.title, description: x.description,
    jsonLd: [
      crumbsLd(trail),
      faqLd(x.faq),
      { "@context": "https://schema.org", "@type": "Article", headline: x.title, description: x.description, dateModified: UPDATED, author: { "@type": "Organization", name: "Lumen" }, mainEntityOfPage: SITE.url + `/compare/${x.slug}` },
      { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Lumen", applicationCategory: "ProductivityApplication", operatingSystem: "Web, Chrome", offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" } },
    ],
    body: `${crumbs(trail)}
<section class="surface s-hero"><span class="label-pill">${x.kind === "alternative" ? "Alternative" : "Comparison"} · updated ${UPDATED}</span><h1><span class="lead-in">${esc(x.lead)}</span> <span class="payoff">${esc(x.pay)}</span></h1></section>
<div class="s-grid"><div class="s-main">
  <div class="answer-box"><span class="eyebrow">The short answer</span><p>${esc(x.answer)}</p></div>
  <section class="s-panel"><h2>Side by side</h2>${table}<p class="updated">Facts about ${esc(x.name)} checked ${UPDATED}. Prices and features change; check their site before deciding.</p></section>
  <section class="s-panel"><div class="choose">
    ${x.chooseThem.length ? `<div><h2 style="font-size:18px">Choose ${esc(x.name)} if</h2><ul>${x.chooseThem.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>` : ""}
    <div><h2 style="font-size:18px">Choose Lumen if</h2><ul>${x.chooseLumen.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div>
  </div></section>
  <section class="s-panel"><h2>${x.kind === "alternative" ? `Moving from ${esc(x.name)}` : "Switching takes five minutes"}</h2><ol class="steps">${x.switchSteps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
  ${qaTabs("Questions", x.faq)}
</div>
<aside class="s-side">
  <div class="side-card"><span class="tile tile--lamp">${GLYPH.highlighter}</span><b style="color:var(--ink)">Light your first lamp</b><p class="small muted">Free plan forever, every Pro feature for your first 7 days. No card.</p><a class="key key--lamp key--sm" href="/login">Start free</a></div>
  <div class="side-card"><span class="eyebrow">More comparisons</span><ul>${others}</ul></div>
  <div class="side-card"><span class="eyebrow">Related answers</span><ul>${ANSWERS.slice(0, 4).map((a) => `<li><a href="/answers/${a.slug}">${esc(a.question)}</a></li>`).join("")}</ul></div>
</aside></div>${ctaBand()}`,
  }));
});

/** Questions as tabs: every answer sits in the same grid cell, so the box is as tall as the
 *  longest answer and switching never moves anything below or beside it. No JS needed. */
function qaTabs(title: string, faq: [string, string][]) {
  const list = faq.slice(0, 8);
  return `<section class="s-panel"><h2>${esc(title)}</h2><div class="qa">
${list.map((_, k) => `<input type="radio" name="qa" id="qa${k}" class="qa__r"${k === 0 ? " checked" : ""}>`).join("")}
<div class="qa__list">${list.map(([q], k) => `<label for="qa${k}"><span class="qa__n">${k + 1}</span><span>${esc(q)}</span></label>`).join("")}</div>
<div class="qa__panes">${list.map(([q, ans]) => `<div class="qa__pane"><span class="eyebrow">Answer</span><h3>${esc(q)}</h3><p>${esc(ans)}</p></div>`).join("")}</div>
</div></section>`;
}

/* ---------------- answers ---------------- */

const TOPIC_LABEL: Record<string, string> = { save: "Saving", highlight: "Highlighting", obsidian: "Obsidian", notion: "Notion", ai: "AI and agents", habit: "Reading habit", pdf: "PDFs" };

seo.get("/answers", () => {
  const trail: [string, string][] = [["Home", "/"], ["Answers", "/answers"]];
  const groups = Object.keys(TOPIC_LABEL).map((t) => {
    const list = ANSWERS.filter((a) => a.topic === t);
    if (!list.length) return "";
    return `<section style="margin-top:28px"><h2 class="h3" style="font-size:22px">${TOPIC_LABEL[t]}</h2><div class="cards-grid" style="margin-top:12px">${list.map((a) => `<a class="link-card" href="/answers/${a.slug}"><h3>${esc(a.question)}</h3><p>${esc(a.short.slice(0, 150))}…</p></a>`).join("")}</div></section>`;
  }).join("");
  return html(page({
    path: "/answers", nav: "answers",
    title: "Answers: saving, highlighting and reading on the web | Lumen",
    description: "Short, direct answers to common questions about read later apps, web highlights, Obsidian and Notion sync, PDFs, and using AI agents with your reading.",
    jsonLd: [crumbsLd(trail), faqLd(ANSWERS.map((a) => [a.question, a.short]))],
    body: `${crumbs(trail)}<section class="surface s-hero"><span class="label-pill">Answers</span><h1><span class="lead-in">Questions readers ask.</span> <span class="payoff">Answered in a minute.</span></h1><p class="dek">Each page starts with the answer, then the steps.</p></section>${groups}${ctaBand()}`,
  }));
});

seo.get("/answers/:slug", (c) => {
  const a = ANSWERS.find((k) => k.slug === c.req.param("slug"));
  if (!a) return notFound();
  const trail: [string, string][] = [["Home", "/"], ["Answers", "/answers"], [a.question, `/answers/${a.slug}`]];
  const related = a.related.map((s) => ANSWERS.find((x) => x.slug === s)).filter(Boolean) as typeof ANSWERS;
  const cmp = COMPARES.filter((k) => (a.topic === "obsidian" ? k.slug.includes("obsidian") || k.slug.includes("readwise") : a.topic === "save" ? k.kind === "alternative" : k.slug.includes("glasp") || k.slug.includes("readwise"))).slice(0, 3);
  return html(page({
    path: `/answers/${a.slug}`, nav: "answers", title: a.title, description: a.description,
    jsonLd: [
      crumbsLd(trail),
      faqLd([[a.question, a.short], ...a.faq]),
      { "@context": "https://schema.org", "@type": "HowTo", name: a.question, step: a.steps.map((s, k) => ({ "@type": "HowToStep", position: k + 1, text: s })) },
      { "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.description, dateModified: UPDATED, author: { "@type": "Organization", name: "Lumen" } },
    ],
    body: `${crumbs(trail)}
<section class="surface s-hero"><span class="label-pill">${TOPIC_LABEL[a.topic]}</span><h1><span class="payoff">${esc(a.question)}</span></h1></section>
<div class="s-grid"><div class="s-main">
  <div class="answer-box"><span class="eyebrow">Short answer</span><p>${esc(a.short)}</p></div>
  <section class="s-panel"><h2>Step by step</h2><ol class="steps">${a.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>
  <section class="s-panel"><h2>Good to know</h2>${a.body.map((p) => `<p>${esc(p)}</p>`).join("")}</section>
  ${qaTabs("Related questions", a.faq)}
  <p class="updated">Updated ${UPDATED}.</p>
</div>
<aside class="s-side">
  <div class="side-card"><span class="tile tile--lamp">${GLYPH.highlighter}</span><b style="color:var(--ink)">Lumen does this for free</b><p class="small muted">Save, highlight, send to your notes, ask a model. Pro free for 7 days.</p><a class="key key--lamp key--sm" href="/login">Start free</a></div>
  ${related.length ? `<div class="side-card"><span class="eyebrow">Read next</span><ul>${related.map((r) => `<li><a href="/answers/${r.slug}">${esc(r.question)}</a></li>`).join("")}</ul></div>` : ""}
  ${cmp.length ? `<div class="side-card"><span class="eyebrow">Comparisons</span><ul>${cmp.map((k) => `<li><a href="/compare/${k.slug}">${esc(k.kind === "alternative" ? `${k.name} alternative` : `Lumen vs ${k.name}`)}</a></li>`).join("")}</ul></div>` : ""}
</aside></div>${ctaBand()}`,
  }));
});


/* ---------------- pricing (in the app only) ---------------- */

seo.get("/pricing", (c) => c.redirect("/login?next=/app/upgrade", 302));

/* ---------------- docs ---------------- */

const DOCS: { slug: string; title: string; md: string; blurb: string }[] = [
  { slug: "", title: "Overview", md: README, blurb: "What Lumen is and what is in the repo" },
  { slug: "api", title: "API reference", md: API, blurb: "Every endpoint, payload and error" },
  { slug: "mcp", title: "MCP for agents", md: MCP, blurb: "Connect Claude, Cursor or any MCP client" },
  { slug: "extension", title: "Extension", md: EXTENSION, blurb: "Toolbar, shortcuts, providers, Claude helper" },
  { slug: "architecture", title: "Architecture", md: ARCHITECTURE, blurb: "System diagram, decisions, flows, security" },
  { slug: "states", title: "State diagrams", md: STATES, blurb: "Lifecycles and the delivery ledger" },
  { slug: "data-model", title: "Data model", md: DATA_MODEL, blurb: "Tables and relations" },
  { slug: "deploy", title: "Run and deploy", md: DEPLOY, blurb: "Local, Cloudflare, SSO, extension" },
  { slug: "plan", title: "Product plan", md: PLAN, blurb: "Problem, principles, scope, roadmap" },
  { slug: "audit", title: "Product audit", md: AUDIT, blurb: "What was reviewed, fixed, and what is left" },
];
const DOC_FILE: Record<string, string> = { "README.md": "", "API.md": "api", "MCP.md": "mcp", "EXTENSION.md": "extension", "ARCHITECTURE.md": "architecture", "STATES.md": "states", "DATA_MODEL.md": "data-model", "DEPLOY.md": "deploy", "PLAN.md": "plan", "AUDIT.md": "audit" };

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      if (lang === "mermaid") return `<pre class="mermaid">${esc(text)}</pre>`;
      return `<pre><code>${esc(text)}</code></pre>`;
    },
    link({ href, text }) {
      const m = href.match(/(?:^|\/)([A-Z_]+\.md)(#.*)?$/);
      const target = m && m[1] in DOC_FILE ? `/docs${DOC_FILE[m[1]] ? "/" + DOC_FILE[m[1]] : ""}${m[2] ?? ""}` : href.startsWith("docs/media/") ? `${SITE.github}/blob/main/${href}` : href;
      return `<a href="${esc(target)}">${text}</a>`;
    },
  },
});

function docPage(slug: string) {
  const d = DOCS.find((x) => x.slug === slug);
  if (!d) return notFound();
  const path = `/docs${slug ? "/" + slug : ""}`;
  const body = marked.parse(d.md) as string;
  const nav = DOCS.map((x) => `<li><a href="/docs${x.slug ? "/" + x.slug : ""}"${x.slug === slug ? ' aria-current="page"' : ""}>${esc(x.title)}</a></li>`).join("");
  const trail: [string, string][] = [["Home", "/"], ["Docs", "/docs"], ...(slug ? [[d.title, path] as [string, string]] : [])];
  return html(page({
    path, nav: "docs", title: `${d.title} | Lumen docs`, description: `Lumen documentation: ${d.blurb}.`,
    jsonLd: [crumbsLd(trail), { "@context": "https://schema.org", "@type": "TechArticle", headline: `${d.title}: Lumen`, dateModified: UPDATED }],
    extraHead: d.md.includes("```mermaid")
      ? `<script type="module">import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.esm.min.mjs";const dark=matchMedia("(prefers-color-scheme: dark)").matches&&document.documentElement.dataset.theme!=="light"||document.documentElement.dataset.theme==="dark";mermaid.initialize({startOnLoad:true,theme:dark?"dark":"neutral",fontFamily:"Geist, system-ui, sans-serif"});</script>`
      : "",
    body: `${crumbs(trail)}<div class="docs-grid"><aside class="docs-side"><div class="side-card"><span class="eyebrow">Docs</span><ul class="docs-nav">${nav}</ul></div><div class="side-card"><span class="tile tile--iris">${GLYPH.bot}</span><b style="color:var(--ink)">Connect your agent</b><p class="small muted">Claude, Cursor and any MCP client.</p><a class="key key--sm" href="/docs/mcp">MCP setup</a></div></aside><article class="prose">${body}</article></div>`,
  }));
}
seo.get("/docs", () => docPage(""));
seo.get("/docs/:slug", (c) => docPage(c.req.param("slug")));

/* ---------------- legal and changelog ---------------- */

const LEGAL: Record<string, { title: string; body: string }> = {
  privacy: {
    title: "Privacy",
    body: `<h1>Privacy</h1><p><b>Short version:</b> your reading is yours. Lumen stores what you save so it can show it back to you, never sells it, and lets you export or delete everything at any time.</p>
<h2>What we store</h2><ul><li>Your account: name, email and avatar from Google or GitHub when you sign in with them.</li><li>What you save: links, the readable text of those pages, highlights, notes, collections, tags and reading progress.</li><li>Activity used for your streak and analytics (what you did and when, in your account only).</li><li>Destination settings. Notion tokens and webhook secrets are stored encrypted at rest by our host and are never returned by the API. Your Obsidian API key never leaves your browser.</li></ul>
<h2>Readers like you</h2><p>If anonymous signals are on (the default), the fact that you saved a public URL can count toward "readers like you also saved this" for others. Only URLs saved by at least two other readers are ever shown, never who saved them, never your highlights or notes. Turn it off in Settings.</p>
<h2>AI</h2><p>When you ask Lumen's hosted model, the selected passage is sent to Cloudflare Workers AI to generate the answer. Choose Ollama or Claude in the extension to keep text on your machine or your own account.</p>
<h2>Where it lives</h2><p>Cloudflare Workers and D1 (Western Europe). No advertising or analytics trackers on the site.</p>
<h2>Your controls</h2><p>Export JSON from Settings, export collections as markdown, revoke tokens, delete your account (removes every row immediately). Demo sandboxes are deleted after three days.</p><p class="updated">Updated ${UPDATED}. Lumen is in public preview.</p>`,
  },
  terms: {
    title: "Terms",
    body: `<h1>Terms</h1><p>Lumen is in public preview, provided as is. Use it for your own reading. Do not use it to store content you have no right to keep, to scrape at scale, or to abuse the demo or the AI quota.</p><h2>Your content</h2><p>You own what you save and write. You give Lumen permission to store and process it to provide the service, and nothing more.</p><h2>Availability</h2><p>Features may change during the preview. You can export your data at any time; if the service ever shuts down you will get at least 60 days to export.</p><h2>Open source</h2><p>The code is on <a href="${SITE.github}">GitHub</a> under the AGPL-3.0: you can run your own copy, and if you modify it and offer it to others, including as a hosted service, you must publish your changes under the same license.</p><p class="updated">Updated ${UPDATED}.</p>`,
  },
  changelog: {
    title: "Changelog",
    body: `<h1>Changelog</h1>
<h2>2.2 · ${UPDATED}</h2><ul><li>Freemium: the free plan keeps reading, highlighting and syncing; every new account gets 7 days of Pro.</li><li>A guided tour for first time readers.</li><li>Extension: dark mode, create collections and notes from the popup, ask about the page, Summarize is back in the toolbar.</li><li>Licensed AGPL-3.0.</li></ul>
<h2>2.1 · ${UPDATED}</h2><ul><li><b>Connect your agent:</b> Lumen is now an MCP server. Claude Code, Claude Desktop, Cursor and other clients can search your library, read with your highlights, save links and suggest content.</li><li><b>Radar:</b> trending stories this week in the topics you read about (Hacker News, dev.to).</li><li><b>Daily and weekly reads:</b> a plan that fits your time, plus highlights worth revisiting.</li><li><b>Reminders</b> for articles you started, with snooze, in the dashboard and the extension.</li><li><b>Readers like you:</b> anonymous, aggregate suggestions from people whose libraries overlap with yours.</li><li><b>Analytics:</b> 12 week heatmap, minutes and words read, topics, sources, highlight colours, reading hours.</li><li>Docs, comparisons and answers pages; sitemap, robots and llms.txt.</li></ul>
<h2>2.0 · ${UPDATED}</h2><ul><li>Lumen becomes a web app: library, reader, highlights with notes, collections, Spark ideas, integrations, glow streak.</li><li>Destinations with a delivery ledger: Obsidian, Notion, markdown, webhooks, each highlight sent once.</li><li>Extension rebuilt: toolbar that never blocks copy, persistent highlights, target collection, four model providers including Claude.</li></ul>
<h2>1.0 · April 2026</h2><ul><li>Chrome extension: explain, summarise or define a selection with Ollama.</li></ul>`,
  },
};

for (const key of Object.keys(LEGAL)) {
  seo.get(`/${key}`, () => html(page({ path: `/${key}`, title: `${LEGAL[key].title} | Lumen`, description: `Lumen ${LEGAL[key].title.toLowerCase()}.`, body: `${crumbs([["Home", "/"], [LEGAL[key].title, `/${key}`]])}<article class="prose" style="margin-top:18px;max-width:820px">${LEGAL[key].body}</article>` })));
}

/* ---------------- machine readable ---------------- */

const urls = () => [
  "/", "/compare", "/answers", "/docs", "/changelog", "/privacy", "/terms",
  ...COMPARES.map((c) => `/compare/${c.slug}`),
  ...ANSWERS.map((a) => `/answers/${a.slug}`),
  ...DOCS.filter((d) => d.slug).map((d) => `/docs/${d.slug}`),
];

seo.get("/sitemap.xml", () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls().map((u) => `  <url><loc>${SITE.url}${u}</loc><lastmod>${UPDATED}</lastmod><changefreq>${u === "/" || u === "/changelog" ? "weekly" : "monthly"}</changefreq><priority>${u === "/" ? "1.0" : u.split("/").length === 2 ? "0.8" : "0.6"}</priority></url>`).join("\n")}\n</urlset>\n`,
  { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } },
));

seo.get("/robots.txt", () => new Response(
  `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /api/\nDisallow: /auth/\nDisallow: /mcp\n\nSitemap: ${SITE.url}/sitemap.xml\n`,
  { headers: { "content-type": "text/plain; charset=utf-8" } },
));

seo.get("/llms.txt", () => new Response(
  `# Lumen\n\n> ${SITE.description}\n\nLumen is free for personal reading and open source (${SITE.github}). Key ideas: highlighting never blocks copy and paste; each collection sends new highlights once to a chosen note (Obsidian, Notion, markdown, webhook); bring your own model (hosted, Ollama, OpenAI compatible, Claude via CLI); agents connect through MCP at ${SITE.url}/mcp.\n\n## Product\n- Free plan for reading, highlighting and syncing; every new account gets 7 days of Pro (Spark, Radar, agents, analytics, Notion)\n- [Changelog](${SITE.url}/changelog)\n\n## Docs\n${DOCS.map((d) => `- [${d.title}](${SITE.url}/docs${d.slug ? "/" + d.slug : ""}): ${d.blurb}`).join("\n")}\n\n## Comparisons\n${COMPARES.map((c) => `- [${c.title}](${SITE.url}/compare/${c.slug}): ${c.answer}`).join("\n")}\n\n## Answers\n${ANSWERS.map((a) => `- [${a.question}](${SITE.url}/answers/${a.slug}): ${a.short}`).join("\n")}\n`,
  { headers: { "content-type": "text/plain; charset=utf-8" } },
));

export function notFound() {
  return html(page({
    path: "/404", title: "Not found | Lumen", description: "This page does not exist.", noindex: true,
    body: `<section class="surface gridlines s-hero" style="text-align:center;display:grid;justify-items:center;gap:14px;margin-top:28px"><span class="tile tile--xl tile--lamp bob" style="position:relative">${GLYPH.book}</span><h1 style="position:relative"><span class="lead-in">This page wandered off.</span> <span class="payoff">The lamp is still on.</span></h1><div class="row" style="position:relative;flex-wrap:wrap;justify-content:center"><a class="key key--lamp" href="/">Home</a><a class="key key--ghost" href="/answers">Answers</a><a class="key key--ghost" href="/docs">Docs</a></div></section>`,
  }), 404);
}
