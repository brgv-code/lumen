// The reader's rail as a margin: each card sits level with its passage, pushed down when it would overlap.
import type { TextQuote } from "@lumen/core";
import { anchorToRange } from "@lumen/core/dom";

const GAP = 10;

/** Where a card's passage starts on screen: "ai" follows the open answer, "hl:<id>" a painted highlight. */
function anchorTop(anchor: string, body: HTMLElement, aiQuote: TextQuote | null): number | null {
  if (anchor === "ai") {
    const range = aiQuote ? anchorToRange(body, aiQuote) : null;
    return range ? range.getBoundingClientRect().top : null;
  }
  const mark = body.querySelector(`mark[data-hl="${CSS.escape(anchor.replace(/^hl:/, ""))}"]`);
  return mark ? mark.getBoundingClientRect().top : null;
}

/** Aligns the margin's cards while the rail sits beside the article; below that width it stays a list. */
export function alignMargin(margin: HTMLElement, body: HTMLElement, aiQuote: TextQuote | null) {
  const cards = Array.from(margin.querySelectorAll<HTMLElement>(":scope > [data-anchor]"));
  const box = margin.getBoundingClientRect();
  const beside = box.left >= body.getBoundingClientRect().right - 1;
  margin.classList.toggle("margin--aligned", beside);
  if (!beside) {
    for (const card of cards) card.style.removeProperty("top");
    margin.style.removeProperty("height");
    return;
  }
  const placed = cards
    .map((card) => ({ card, top: anchorTop(card.dataset.anchor ?? "", body, aiQuote) }))
    .sort((a, b) => (a.top ?? Infinity) - (b.top ?? Infinity));
  let bottom = 0;
  for (const { card, top } of placed) {
    const at = Math.max(top === null ? bottom : top - box.top, bottom);
    card.style.top = `${at}px`;
    bottom = at + card.offsetHeight + GAP;
  }
  margin.style.height = `${bottom}px`;
}
