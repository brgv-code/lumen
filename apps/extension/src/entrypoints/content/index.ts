// Lumen in a web page: the whole page is the surface.
import { anchorToRange, readableParagraphs } from "@lumen/core/dom";
import { Lumen, type Surface } from "./lumen";
import { LinkPreviews } from "./link-preview";

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
    new LinkPreviews(() => lumen.settings).start();
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
    mainText: () => ((document.querySelector("article, main, [role=main]") as HTMLElement | null) ?? document.body).innerText.replace(/\n{3,}/g, "\n\n"),
    paragraphs: () => readableParagraphs(articleRoot()),
    quotesFor: (snapshot) => [snapshot.quote],
    rangeFor: (quote) => anchorToRange(root, quote),
  };
}

function pageHtml(): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script,style,noscript,iframe,svg,[data-lumen-ui]").forEach((n) => n.remove());
  return "<!doctype html>" + clone.outerHTML.slice(0, 2_500_000);
}

/** Where the article is: the page's main content, or the whole body. */
function articleRoot(): Element {
  return document.querySelector("article, main, [role=main]") ?? document.body;
}
