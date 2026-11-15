// The page's HTML as the reader sees it, for the server to extract the article from.

const NOT_CONTENT = "script,style,noscript,iframe,svg,[data-lumen-ui]";
const SNAPSHOT_LIMIT = 2_500_000;

/** Elements hidden with display none, the way Next.js keeps the previous route in the DOM. */
export const hiddenByStyle = (element: Element) => getComputedStyle(element).display === "none";

/** False when the element or any ancestor is hidden, since a hidden parent hides everything inside. */
export function isShown(element: Element, isHidden: (element: Element) => boolean): boolean {
  for (let node: Element | null = element; node; node = node.parentElement) {
    if (isHidden(node)) return false;
  }
  return true;
}

/** The first element matching `selector` that is on screen, or null. */
export function firstShown(doc: Document, selector: string, isHidden: (element: Element) => boolean): Element | null {
  return [...doc.querySelectorAll(selector)].find((element) => isShown(element, isHidden)) ?? null;
}

/** Serializes the page without the body elements `isHidden` rejects; the live page is not touched. */
export function pageSnapshot(doc: Document, isHidden: (element: Element) => boolean): string {
  const clone = doc.importNode(doc.documentElement, true);
  const liveBody = doc.body?.querySelectorAll("*") ?? [];
  const cloneBody = clone.querySelector("body")?.querySelectorAll("*") ?? [];
  // A deep clone keeps the same element order, so both lists line up index for index.
  const hidden = [...liveBody].flatMap((element, index) => (isHidden(element) ? [cloneBody[index]] : []));
  hidden.forEach((element) => element?.remove());
  clone.querySelectorAll(NOT_CONTENT).forEach((element) => element.remove());
  return "<!doctype html>" + clone.outerHTML.slice(0, SNAPSHOT_LIMIT);
}
