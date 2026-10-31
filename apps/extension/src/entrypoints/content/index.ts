// Lumen in the page: a selection toolbar that never takes over copy and paste,
// highlights that come back when you return, and margin answers in a side card.
import { HIGHLIGHT_COLORS, citeForClipboard, type Highlight, type TextQuote } from "@lumen/core";
import { anchorToRange, describeRange, unwrapMarks, wrapRange } from "@lumen/core/dom";
import { UI_CSS, MARK_CSS } from "./styles";

const SWATCH: Record<string, string> = { sun: "#ffd34d", mint: "#3fd39a", iris: "#8a7bff", peach: "#ff8a6b", sky: "#5b9bff" };

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    if ((window as any).__lumen) return;
    (window as any).__lumen = true;
    new Lumen().start();
  },
});

function send<T = any>(msg: object): Promise<T> {
  return chrome.runtime.sendMessage(msg) as Promise<T>;
}

function pageHtml(): string {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("script,style,noscript,iframe,svg,[data-lumen-ui]").forEach((n) => n.remove());
  return "<!doctype html>" + clone.outerHTML.slice(0, 2_500_000);
}

class Lumen {
  host!: HTMLElement;
  root!: ShadowRoot;
  bar!: HTMLElement;
  card!: HTMLElement;
  toastEl!: HTMLElement;
  highlights: Highlight[] = [];
  pending: { quote: TextQuote; rect: DOMRect } | null = null;
  activeMark: string | null = null;
  aiText = "";

  start() {
    const style = document.createElement("style");
    style.textContent = MARK_CSS;
    style.setAttribute("data-lumen-ui", "");
    document.documentElement.appendChild(style);

    this.host = document.createElement("lumen-ui");
    this.host.setAttribute("data-lumen-ui", "");
    this.host.style.cssText = "all: initial; position: absolute; top: 0; left: 0; z-index: 2147483646;";
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${UI_CSS}</style><div class="bar" hidden></div><div class="card" hidden></div><div class="toast" hidden></div>`;
    this.bar = this.root.querySelector(".bar")!;
    this.card = this.root.querySelector(".card")!;
    this.toastEl = this.root.querySelector(".toast")!;
    document.documentElement.appendChild(this.host);

    document.addEventListener("mouseup", (e) => this.onSelect(e), true);
    document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Shift") this.onSelect(e); }, true);
    document.addEventListener("mousedown", (e) => { if (!e.composedPath().includes(this.host)) this.hideBar(); }, true);
    document.addEventListener("click", (e) => this.onMarkClick(e), true);
    document.addEventListener("scroll", () => this.hideBar(), { passive: true, capture: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { this.hideBar(); this.hideCard(); } });

    chrome.runtime.onMessage.addListener((m, _s, reply) => {
      if (m?.type === "GET_TEXT") {
        const sel = window.getSelection()?.toString().trim() ?? "";
        const main = (document.querySelector("article, main, [role=main]") as HTMLElement | null) ?? document.body;
        reply({ selection: sel.slice(0, 6000), text: (main.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 12000), title: document.title });
        return;
      }
      this.onMessage(m);
    });
    this.load();
  }

  async load() {
    const st = await send<{ highlights: Highlight[] }>({ type: "PAGE_STATE", url: location.href }).catch(() => null);
    if (!st) return;
    this.highlights = st.highlights;
    this.paint();
    // late rendering pages: try again once content settles
    if (st.highlights.length) setTimeout(() => this.paint(), 2500);
  }

  paint() {
    unwrapMarks(document.body, "mark.lumen-mark");
    for (const h of [...this.highlights].sort((a, b) => b.position - a.position)) {
      const r = anchorToRange(document.body, h);
      if (r) wrapRange(r, { class: `lumen-mark lumen-${h.color}`, "data-lumen-id": h.id, title: h.note ? `Note: ${h.note}` : "Lumen highlight" });
    }
  }

  onSelect(e: Event) {
    if (e.composedPath().includes(this.host)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return this.hideBar();
      const range = sel.getRangeAt(0);
      const anchor = range.commonAncestorContainer as HTMLElement;
      const el = anchor.nodeType === 1 ? anchor : anchor.parentElement;
      if (el?.closest("input,textarea,[contenteditable=''],[contenteditable='true']")) return;
      const quote = describeRange(document.body, range);
      if (!quote || quote.quote.trim().length < 2) return this.hideBar();
      this.pending = { quote, rect: range.getBoundingClientRect() };
      this.showBar();
    }, 10);
  }

  showBar() {
    if (!this.pending) return;
    const { rect } = this.pending;
    this.bar.innerHTML =
      HIGHLIGHT_COLORS.map((c) => `<button class="sw" data-color="${c}" style="background:${SWATCH[c]}" title="Highlight"></button>`).join("") +
      `<span class="sep"></span>
       <button data-act="note">Note</button>
       <button data-act="explain">Explain</button>
       <button data-act="summarize">Summarize</button>
       <button data-act="define">Define</button>
       <button data-act="ask">Ask</button>
       <button data-act="copy" title="Copy with a link back to this passage">Copy</button>`;
    this.bar.hidden = false;
    const w = this.bar.offsetWidth || 380;
    const x = Math.min(Math.max(rect.left + rect.width / 2 - w / 2 + scrollX, scrollX + 8), scrollX + innerWidth - w - 8);
    const y = rect.top + scrollY - 48 < scrollY + 4 ? rect.bottom + scrollY + 10 : rect.top + scrollY - 48;
    this.bar.style.left = `${x}px`;
    this.bar.style.top = `${y}px`;
    this.bar.onmousedown = (ev) => ev.preventDefault(); // keep the page selection alive
    this.bar.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.color) return this.highlight(b.dataset.color);
      const act = b.dataset.act!;
      if (act === "note") return this.highlight("sun", true);
      if (act === "copy") return this.copy();
      if (act === "ask") return this.askBox(this.pending!.quote.quote);
      this.ai(act as "explain" | "define" | "summarize", this.pending!.quote.quote);
    };
  }

  hideBar() { this.bar.hidden = true; }
  hideCard() { this.card.hidden = true; this.card.innerHTML = ""; }

  async highlight(color: string, withNote = false) {
    if (!this.pending) return;
    const quote = this.pending.quote;
    this.hideBar();
    window.getSelection()?.removeAllRanges();
    type AddResult = { ok: boolean; highlight?: Highlight; error?: string; local?: boolean };
    const r: AddResult = await send<AddResult>({
      type: "ADD_HIGHLIGHT", url: location.href, title: document.title, html: pageHtml(), quote, color,
    }).catch((e): AddResult => ({ ok: false, error: String(e) }));
    if (!r.ok || !r.highlight) return this.toast(r.error ?? "Could not save the highlight", "err");
    this.highlights.push(r.highlight);
    this.paint();
    this.toast(r.local ? "Highlighted (saved in this browser)" : "Highlighted · +2 glow");
    if (withNote) this.noteEditor(r.highlight);
  }

  async copy(h?: Highlight) {
    const quote = h?.quote ?? this.pending?.quote.quote ?? "";
    await navigator.clipboard.writeText(citeForClipboard({ quote, note: h?.note, title: document.title, url: location.href }));
    this.hideBar();
    this.toast("Copied with citation");
  }

  onMarkClick(e: MouseEvent) {
    const m = (e.target as HTMLElement).closest?.("mark.lumen-mark") as HTMLElement | null;
    if (!m || !window.getSelection()?.isCollapsed) return;
    const h = this.highlights.find((x) => x.id === m.dataset.lumenId);
    if (!h) return;
    this.activeMark = h.id;
    this.cardFor(h);
  }

  cardFor(h: Highlight) {
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile">✦</span><b>Highlight</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q lumen-${h.color}">${esc(h.quote)}</blockquote>
      ${h.note ? `<div class="note">✎ ${esc(h.note)}</div>` : ""}
      <div class="row">${HIGHLIGHT_COLORS.map((c) => `<button class="sw ${c === h.color ? "on" : ""}" data-color="${c}" style="background:${SWATCH[c]}"></button>`).join("")}</div>
      <div class="row">
        <button class="key" data-act="note">${h.note ? "Edit note" : "Add note"}</button>
        <button class="key ghost" data-act="copy">Copy</button>
        <button class="key ghost" data-act="explain">Explain</button>
        <span class="sp"></span>
        <button class="key ghost danger" data-act="delete">Delete</button>
      </div>`;
    this.card.onclick = async (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.color) {
        const r = await send<{ highlight: Highlight }>({ type: "UPDATE_HIGHLIGHT", id: h.id, url: location.href, color: b.dataset.color });
        this.replace(r.highlight);
        return this.cardFor(r.highlight);
      }
      switch (b.dataset.act) {
        case "close": return this.hideCard();
        case "note": return this.noteEditor(h);
        case "copy": return this.copy(h);
        case "explain": return this.ai("explain", h.quote);
        case "delete":
          await send({ type: "DELETE_HIGHLIGHT", id: h.id, url: location.href });
          this.highlights = this.highlights.filter((x) => x.id !== h.id);
          this.paint();
          this.hideCard();
          this.toast("Highlight removed");
      }
    };
  }

  replace(h: Highlight) {
    this.highlights = this.highlights.map((x) => (x.id === h.id ? { ...x, ...h } : x));
    this.paint();
  }

  noteEditor(h: Highlight) {
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile">✎</span><b>Margin note</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q lumen-${h.color}">${esc(h.quote)}</blockquote>
      <textarea placeholder="Why does this matter to you?">${esc(h.note ?? "")}</textarea>
      <div class="row"><button class="key" data-act="save">Save note</button><span class="hint">⌘↵</span></div>`;
    const ta = this.card.querySelector("textarea")!;
    ta.focus();
    const save = async () => {
      const r = await send<{ highlight: Highlight }>({ type: "UPDATE_HIGHLIGHT", id: h.id, url: location.href, note: ta.value.trim() || null });
      this.replace(r.highlight);
      this.hideCard();
      this.toast(ta.value.trim() ? "Note kept · +3 glow" : "Note removed");
    };
    ta.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save(); };
    this.card.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "save") save();
      if (b?.dataset.act === "close") this.hideCard();
    };
  }

  askBox(text: string) {
    this.hideBar();
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile iris">?</span><b>Ask about this</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q">${esc(text.slice(0, 400))}</blockquote>
      <input placeholder="What do you want to know?" />
      <div class="row"><button class="key iris" data-act="go">Ask</button></div>`;
    const input = this.card.querySelector("input")!;
    input.focus();
    const go = () => input.value.trim() && this.ai("ask", text, input.value.trim());
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") go(); };
    this.card.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "go") go();
      if (b?.dataset.act === "close") this.hideCard();
    };
  }

  async ai(action: "explain" | "define" | "summarize" | "ask", text: string, question?: string) {
    this.hideBar();
    this.aiText = "";
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile iris">✦</span><b>${action === "ask" ? "Answer" : action[0].toUpperCase() + action.slice(1)}</b><span class="sp"></span><span class="chip" data-prov></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q">${esc((question ?? text).slice(0, 300))}</blockquote>
      <div class="answer streaming"></div>
      <div class="row"><button class="key ghost" data-act="copy-answer">Copy answer</button></div>`;
    this.card.onclick = async (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "close") this.hideCard();
      if (b?.dataset.act === "copy-answer") { await navigator.clipboard.writeText(this.aiText); this.toast("Answer copied"); }
    };
    const r = await send<{ provider: string }>({ type: "AI_REQUEST", action, text, question, title: document.title }).catch(() => null);
    const chip = this.card.querySelector("[data-prov]");
    if (chip && r) chip.textContent = ({ lumen: "Lumen", ollama: "Ollama", openai: "API", claude: "Claude" } as Record<string, string>)[r.provider] ?? r.provider;
  }

  onMessage(m: { type: string; chunk?: string; error?: string; cmd?: string; text?: string; tone?: string }) {
    const ans = this.card.querySelector<HTMLElement>(".answer");
    if (m.type === "AI_CHUNK" && ans) { this.aiText += m.chunk; ans.textContent = this.aiText; }
    if (m.type === "AI_DONE" && ans) ans.classList.remove("streaming");
    if (m.type === "AI_ERROR" && ans) { ans.classList.remove("streaming"); ans.classList.add("err"); ans.textContent = m.error ?? "Something went wrong"; }
    if (m.type === "TOAST") this.toast(m.text ?? "", m.tone === "err" ? "err" : "ok");
    if (m.type === "CMD") {
      if (m.cmd === "save") this.savePage();
      if (m.cmd === "highlight" || m.cmd === "explain") {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const quote = describeRange(document.body, sel.getRangeAt(0));
          if (quote) {
            this.pending = { quote, rect: sel.getRangeAt(0).getBoundingClientRect() };
            m.cmd === "highlight" ? this.highlight("sun") : this.ai("explain", quote.quote);
          }
        }
      }
    }
  }

  async savePage() {
    const r = await send<{ ok: boolean; error?: string }>({ type: "SAVE_PAGE", url: location.href, title: document.title, html: pageHtml() });
    this.toast(r.ok ? "Saved to Lumen · +1 glow" : r.error ?? "Could not save", r.ok ? "ok" : "err");
  }

  toast(text: string, tone: "ok" | "err" = "ok") {
    this.toastEl.textContent = text;
    this.toastEl.className = `toast ${tone}`;
    this.toastEl.hidden = false;
    clearTimeout((this as any)._t);
    (this as any)._t = setTimeout(() => (this.toastEl.hidden = true), 2600);
  }
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
