// The page's HTML as the reader sees it, for the server to extract the article from.

const NOT_CONTENT = "script,style,noscript,iframe,svg,[data-lumen-ui]";
const SNAPSHOT_LIMIT = 2_500_000;

/** Elements hidden with display none, the way Next.js keeps the previous route in the DOM. */
export const hiddenByStyle = (element: Element) => getComputedStyle(element).display === "none";

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
