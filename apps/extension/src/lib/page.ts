// Read the active page for Ask. Uses the content script when it is there, and falls back to
// injecting a one off reader (tabs opened before the extension loaded have no content script).

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
