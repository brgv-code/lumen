// Server side article extraction for "save by URL". The extension extracts in the
// page instead (it sees logged in and client rendered content), then posts HTML.
import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import { wordCount, readingMinutes } from "@lumen/core";

export interface Extracted {
  title: string;
  siteName: string | null;
  author: string | null;
  excerpt: string | null;
  contentHtml: string | null;
  contentText: string | null;
  coverUrl: string | null;
  wordCount: number;
  readingMinutes: number;
  kind: "article" | "bookmark" | "pdf";
}

export async function extractFromUrl(url: string): Promise<Extracted> {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; LumenReader/1.0; +https://github.com/brgv-code/lumen)",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cf: { cacheTtl: 300 },
  } as RequestInit);
  const type = res.headers.get("content-type") || "";
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (type.includes("pdf")) {
    return blank(decodeURIComponent(url.split("/").pop() || host), host, "pdf");
  }
  if (!res.ok || !type.includes("html")) return blank(host, host, "bookmark");
  const html = (await res.text()).slice(0, 2_000_000);
  return extractFromHtml(html, url);
}

export function extractFromHtml(html: string, url: string): Extracted {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const { document } = parseHTML(html);
  const meta = (sel: string) => document.querySelector(sel)?.getAttribute("content")?.trim() || null;
  const ogTitle = meta('meta[property="og:title"]');
  const cover = meta('meta[property="og:image"]');
  const site = meta('meta[property="og:site_name"]') || host;
  let article: ReturnType<Readability["parse"]> = null;
  try {
    article = new Readability(document as any, { charThreshold: 300 }).parse();
  } catch {
    article = null;
  }
  const title = article?.title || ogTitle || document.title || host;
  if (!article?.content) {
    const b = blank(title, site, "bookmark");
    b.excerpt = meta('meta[name="description"]') || meta('meta[property="og:description"]');
    b.coverUrl = absolute(cover, url);
    return b;
  }
  const text = (article.textContent || "").trim();
  const words = wordCount(text);
  return {
    title: title.slice(0, 300),
    siteName: article.siteName || site,
    author: article.byline || null,
    excerpt: (article.excerpt || text.slice(0, 200)).slice(0, 300),
    contentHtml: article.content.slice(0, 1_500_000),
    contentText: text.slice(0, 1_000_000),
    coverUrl: absolute(cover, url),
    wordCount: words,
    readingMinutes: readingMinutes(words),
    kind: "article",
  };
}

function blank(title: string, site: string | null, kind: Extracted["kind"]): Extracted {
  return { title, siteName: site, author: null, excerpt: null, contentHtml: null, contentText: null, coverUrl: null, wordCount: 0, readingMinutes: 1, kind };
}

function absolute(u: string | null, base: string) {
  if (!u) return null;
  try { return new URL(u, base).toString(); } catch { return null; }
}
