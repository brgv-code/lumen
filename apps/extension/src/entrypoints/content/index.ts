// Lumen in a web page: the whole page is the surface.
import { anchorToRange, readableParagraphs } from "@lumen/core/dom";
import { Lumen, type Surface } from "./lumen";
import { LinkPreviews } from "./link-preview";
import { firstShown, hiddenByStyle, isShown, pageSnapshot } from "../../lib/snapshot";

const LINK_PREVIEWS_ENABLED = false;

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const v = chrome.runtime.getManifest().version;
    if ((window as any).__lumen === v) return;
    document.querySelectorAll("lumen-ui, lumen-bar, lumen-preview").forEach((n) => n.remove());
    (window as any).__lumen = v;
    const lumen = new Lumen(webPage());
    lumen.start();
    // Paused: hover cards fire on every site; bring back once they're limited to article pages.
    if (LINK_PREVIEWS_ENABLED) new LinkPreviews(() => lumen.settings).start();
  },
});

function webPage(): Surface {
  const root = document.body ?? document.documentElement;
  return {
    root,
    url: () => location.href,
    title: () => document.title,
    site: () => location.hostname,
    html: pageHtml,
    mainText: () => {
      const article = articleRoot();
      return (article instanceof HTMLElement ? article.innerText : article.textContent ?? "").replace(/\n{3,}/g, "\n\n");
    },
    paragraphs: () => readableParagraphs(articleRoot()).filter((paragraph) => isShown(paragraph.element, hiddenByStyle)),
    quotesFor: (snapshot) => [snapshot.quote],
    rangeFor: (quote) => anchorToRange(root, quote),
  };
}

function pageHtml(): string {
  return pageSnapshot(document, hiddenByStyle);
}

/** Where the article is: the page's main content, or the whole body. */
function articleRoot(): Element {
  return firstShown(document, "article, main, [role=main]", hiddenByStyle) ?? document.body;
}
