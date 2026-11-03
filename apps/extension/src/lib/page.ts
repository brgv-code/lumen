// Read the active page for Ask. Uses the content script when it is there, and falls back to
// injecting a one off reader (tabs opened before the extension loaded have no content script).

const VIEWER_PAGE = "/pdf.html";

/** Lumen's PDF viewer for a PDF address; the address rides in the query so it survives a reload. */
export function pdfViewerUrl(file: string): string {
  return `${chrome.runtime.getURL(VIEWER_PAGE)}?file=${encodeURIComponent(file)}`;
}

/** The PDF a viewer tab shows, or null when the tab is anything else. */
export function viewedPdf(tabUrl: string | undefined): string | null {
  if (!tabUrl?.startsWith(chrome.runtime.getURL(VIEWER_PAGE))) return null;
  return new URL(tabUrl).searchParams.get("file");
}

/** A viewer tab stands for its PDF, so the popup and panel treat it like the page it shows. */
export function asPage(tab: chrome.tabs.Tab): chrome.tabs.Tab {
  const file = viewedPdf(tab.url);
  return file ? { ...tab, url: file } : tab;
}

export interface PageContext { title: string; url: string; text: string; selection: string; via: "script" | "inject" }

function extract() {
  const pick = (document.querySelector("article") || document.querySelector("main") || document.querySelector("[role=main]") || document.body) as HTMLElement;
  const clone = pick.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script,style,noscript,svg,nav,footer,header,aside,form,button,[aria-hidden=true],lumen-ui").forEach((n) => n.remove());
  const text = (clone.innerText || clone.textContent || "").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return { title: document.title, text: text.slice(0, 14000), selection: (getSelection()?.toString() || "").trim().slice(0, 4000) };
}

export async function readPage(tab: chrome.tabs.Tab | undefined): Promise<PageContext | null> {
  if (!tab?.id || !tab.url?.startsWith("http")) return null;
  const viaScript = await chrome.tabs.sendMessage(tab.id, { type: "GET_TEXT" }).catch(() => null) as { selection: string; text: string; title: string } | null;
  if (viaScript?.text) return { ...viaScript, url: tab.url, via: "script" };
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: extract });
    const v = r?.result as { title: string; text: string; selection: string } | undefined;
    if (v?.text) return { ...v, url: tab.url, via: "inject" };
  } catch { /* chrome:// pages, the web store, PDFs in the built in viewer */ }
  return null;
}
