// Link previews: what a hovered link's page says about itself, read from its metadata.

export interface LinkPreview {
  url: string;
  title: string;
  summary: string | null;
  site: string;
  image: string | null;
}

export interface PageHead {
  html: string;
  /** Where the request ended up after redirects. */
  url: string;
}

// Enough for the head and the first paragraphs of nearly every page.
const READ_LIMIT = 256_000;
const TIMEOUT_MS = 6000;

/** The page to preview for a link, or null for same page anchors and non web links. */
export function previewTarget(href: string, pageUrl: string): string | null {
  let target: URL;
  try {
    target = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return null;
  target.hash = "";
  const page = new URL(pageUrl);
  page.hash = "";
  return target.href === page.href ? null : target.href;
}

export function previewFromDocument(doc: Document, url: string): LinkPreview {
  const meta = (...selectors: string[]) => {
    for (const selector of selectors) {
      const content = squash(doc.querySelector(selector)?.getAttribute("content") ?? "");
      if (content) return content;
    }
    return null;
  };
  const host = new URL(url).hostname.replace(/^www\./, "");
  const title = meta('meta[property="og:title"]', 'meta[name="twitter:title"]') || squash(doc.title ?? "") || host;
  const summary = meta('meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]') || firstParagraph(doc);
  return {
    url,
    title: clip(title, 140),
    summary: summary ? clip(summary, 300) : null,
    site: meta('meta[property="og:site_name"]') || host,
    image: webUrl(meta('meta[property="og:image"]', 'meta[name="twitter:image"]'), url),
  };
}

/** The start of the page's HTML, fetched without the user's cookies so a hover never acts as them. */
export async function fetchPageHead(url: string): Promise<PageHead | null> {
  const res = await fetch(url, { credentials: "omit", redirect: "follow", headers: { accept: "text/html,application/xhtml+xml" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes("html") || !res.body) return null;
  const reader = res.body.getReader();
  const decoder = decoderFor(type);
  let html = "";
  while (html.length < READ_LIMIT) {
    const { done, value } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
  }
  await reader.cancel();
  return { html, url: res.url || url };
}

function decoderFor(contentType: string): TextDecoder {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset);
  } catch {
    // An unknown charset label throws; most such pages are UTF-8 anyway.
    return new TextDecoder();
  }
}

function firstParagraph(doc: Document): string | null {
  for (const paragraph of Array.from(doc.querySelectorAll("article p, main p, p"))) {
    const text = squash(paragraph.textContent ?? "");
    if (text.length >= 80) return text;
  }
  return null;
}

function webUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const resolved = new URL(value, base);
    return resolved.protocol === "https:" || resolved.protocol === "http:" ? resolved.href : null;
  } catch {
    return null;
  }
}

function squash(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
