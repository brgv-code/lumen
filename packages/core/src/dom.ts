// DOM side of anchoring: turn selections into TextQuote selectors and back.
import type { TextQuote } from "./types.ts";
import { matchQuote, quoteFromText } from "./text.ts";

interface TextIndex { text: string; nodes: { node: Text; start: number }[] }

const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT"]);

export function buildTextIndex(root: Node): TextIndex {
  const doc = root.ownerDocument || (root as Document);
  const walker = doc.createTreeWalker(root, 4 /* NodeFilter.SHOW_TEXT */, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p || SKIP.has(p.tagName) || p.closest("[data-lumen-ui]")) return 2; // FILTER_REJECT
      return 1;
    },
  });
  const nodes: TextIndex["nodes"] = [];
  let text = "";
  let n: Node | null;
  while ((n = walker.nextNode())) {
    nodes.push({ node: n as Text, start: text.length });
    text += (n as Text).data;
  }
  return { text, nodes };
}

function offsetOf(index: TextIndex, node: Node, offset: number): number {
  if (node.nodeType === 3) {
    const hit = index.nodes.find((t) => t.node === node);
    if (hit) return hit.start + offset;
  }
  // Element boundary (or a skipped text node): first indexed text at or after the point.
  const doc = node.ownerDocument!;
  const probe = doc.createRange();
  probe.setStart(node, offset);
  probe.collapse(true);
  for (const t of index.nodes) {
    if (probe.comparePoint(t.node, 0) >= 0) return t.start;
  }
  return index.text.length;
}

export function describeRange(root: Node, range: Range): TextQuote | null {
  const index = buildTextIndex(root);
  const start = offsetOf(index, range.startContainer, range.startOffset);
  const end = offsetOf(index, range.endContainer, range.endOffset);
  if (end <= start) return null;
  const sel = quoteFromText(index.text, start, end);
  if (!sel.quote.trim()) return null;
  return sel;
}

export function anchorToRange(root: Node, sel: TextQuote): Range | null {
  const index = buildTextIndex(root);
  const hit = matchQuote(index.text, sel);
  if (!hit) return null;
  const [s, e] = hit;
  const doc = root.ownerDocument || (root as Document);
  const range = doc.createRange();
  const startNode = locate(index, s, false);
  const endNode = locate(index, e, true);
  if (!startNode || !endNode) return null;
  range.setStart(startNode.node, startNode.offset);
  range.setEnd(endNode.node, endNode.offset);
  return range;
}

function locate(index: TextIndex, pos: number, isEnd: boolean) {
  for (let i = 0; i < index.nodes.length; i++) {
    const t = index.nodes[i];
    const len = t.node.data.length;
    if (pos < t.start + len || (isEnd && pos === t.start + len)) {
      return { node: t.node, offset: pos - t.start };
    }
  }
  const last = index.nodes[index.nodes.length - 1];
  return last ? { node: last.node, offset: last.node.data.length } : null;
}

/** Wrap a range in <mark> elements (one per text node). Returns the marks. */
export function wrapRange(range: Range, attrs: Record<string, string>): HTMLElement[] {
  const doc = range.startContainer.ownerDocument!;
  const root = range.commonAncestorContainer;
  const texts: Text[] = [];
  if (root.nodeType === 3) texts.push(root as Text);
  else {
    const w = doc.createTreeWalker(root, 4);
    let n: Node | null;
    while ((n = w.nextNode())) if (range.intersectsNode(n)) texts.push(n as Text);
  }
  const marks: HTMLElement[] = [];
  for (let t of texts) {
    let start = t === range.startContainer ? range.startOffset : 0;
    let end = t === range.endContainer ? range.endOffset : t.data.length;
    if (end <= start || !t.data.slice(start, end).trim()) continue;
    if (start > 0) { t = t.splitText(start); end -= start; start = 0; }
    if (end < t.data.length) t.splitText(end);
    const mark = doc.createElement("mark");
    for (const [k, v] of Object.entries(attrs)) mark.setAttribute(k, v);
    t.parentNode!.insertBefore(mark, t);
    mark.appendChild(t);
    marks.push(mark);
  }
  return marks;
}

export function unwrapMarks(root: ParentNode, selector: string) {
  root.querySelectorAll(selector).forEach((m) => {
    const parent = m.parentNode!;
    while (m.firstChild) parent.insertBefore(m.firstChild, m);
    parent.removeChild(m);
    (parent as Element).normalize?.();
  });
}
