// Lumen in the page: a selection toolbar that never takes over copy and paste,
// highlights that come back when you return, and margin answers in a side card.
import { HIGHLIGHT_COLORS, citeForClipboard, type Highlight, type TextQuote } from "@lumen/core";
import { anchorToRange, describeRange, unwrapMarks, wrapRange } from "@lumen/core/dom";
import { UI_CSS, MARK_CSS } from "./styles";
import { ICON, LABEL, LAMP } from "./icons";
import { DEFAULT_SETTINGS, type Settings } from "../../lib/types";
import { resolveTheme } from "../../lib/theme";

const SWATCH: Record<string, string> = { sun: "#ffd34d", mint: "#3fd39a", iris: "#8a7bff", peach: "#ff8a6b", sky: "#5b9bff" };

export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const v = chrome.runtime.getManifest().version;
    if ((window as any).__lumen === v) return;
    document.querySelectorAll("lumen-ui").forEach((n) => n.remove());
    (window as any).__lumen = v;
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
  settings: Settings = DEFAULT_SETTINGS;
  helperEl!: HTMLElement;
  helperMenu = false;
  panelEl: HTMLElement | null = null;
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
    this.root.innerHTML = `<style>${UI_CSS}</style><div class="bar" hidden></div><div class="card" hidden></div><div class="toast" hidden></div><div class="helper" hidden></div>`;
    this.bar = this.root.querySelector(".bar")!;
    this.card = this.root.querySelector(".card")!;
    this.toastEl = this.root.querySelector(".toast")!;
    this.helperEl = this.root.querySelector(".helper")!;
    document.documentElement.appendChild(this.host);

    document.addEventListener("mouseup", (e) => this.onSelect(e), true);
    document.addEventListener("keyup", (e) => { if (e.shiftKey || e.key === "Shift") this.onSelect(e); }, true);
    document.addEventListener("mousedown", (e) => { if (!e.composedPath().includes(this.host)) this.hideBar(); }, true);
    document.addEventListener("click", (e) => this.onMarkClick(e), true);
    document.addEventListener("scroll", () => this.hideBar(), { passive: true, capture: true });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { this.hideBar(); this.hideCard(); this.hidePanel(); } });

    send<{ settings: Settings }>({ type: "GET_SETTINGS" }).then((r) => { if (r?.settings) { this.settings = r.settings; this.applySettings(); } }).catch(() => {});
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.lumen_settings_v2?.newValue) { this.settings = { ...DEFAULT_SETTINGS, ...ch.lumen_settings_v2.newValue }; this.applySettings(); }
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.applySettings());
    this.applySettings();

    chrome.runtime.onMessage.addListener((m, _s, reply) => {
      if (m?.type === "GET_HTML") { reply(pageHtml()); return; }
      if (m?.type === "SHOW_PANEL") { this.showPanel(m.prompt); reply({ ok: true }); return; }
      if (m?.type === "TOGGLE_PANEL") { this.togglePanel(); reply({ ok: true }); return; }
      if (m?.type === "PANEL_CLOSE") { this.hidePanel(); reply({ ok: true }); return; }
      if (m?.type === "SCROLL_TO") {
        const el = document.querySelector(`mark.lumen-mark[data-lumen-id="${CSS.escape(m.id)}"]`) as HTMLElement | null;
        if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.animate([{ filter: "brightness(1)" }, { filter: "brightness(.8)" }, { filter: "brightness(1)" }], { duration: 700 }); }
        reply({ ok: Boolean(el) });
        return;
      }
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
    this.renderHelper();
    // late rendering pages: try again once content settles
    if (st.highlights.length) setTimeout(() => this.paint(), 2500);
  }

  applySettings() {
    this.host.classList.toggle("dark", resolveTheme(this.settings.theme ?? "system") === "dark");
    this.renderHelper();
    this.adaptMarks();
  }

  paint() {
    unwrapMarks(document.body, "mark.lumen-mark");
    for (const h of [...this.highlights].sort((a, b) => b.position - a.position)) {
      const r = anchorToRange(document.body, h);
      if (r) wrapRange(r, { class: `lumen-mark lumen-${h.color}`, "data-lumen-id": h.id, title: h.note ? `Note: ${h.note}` : "Lumen highlight" });
    }
    this.adaptMarks();
  }

  /** Light text means a dark page: switch that mark to a tint plus underline so it stays readable. */
  adaptMarks() {
    const style = this.settings.markStyle ?? "auto";
    document.querySelectorAll<HTMLElement>("mark.lumen-mark").forEach((m) => {
      m.classList.remove("lumen-dark", "lumen-ul");
      if (style === "underline") { m.classList.add("lumen-ul"); return; }
      if (style === "fill") return;
      const c = getComputedStyle(m.parentElement ?? m).color.match(/\d+(\.\d+)?/g)?.map(Number) ?? [0, 0, 0];
      const lum = (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
      if (lum > 0.6) m.classList.add("lumen-dark");
    });
  }

  /** The paragraph (or nearby blocks) around the current selection, so short phrases are read in context. */
  contextFor(text: string): string | undefined {
    const sel = window.getSelection();
    const node = sel && sel.rangeCount ? sel.getRangeAt(0).commonAncestorContainer : null;
    let el = (node && (node.nodeType === 1 ? node : node.parentElement)) as HTMLElement | null;
    while (el && el !== document.body && (el.innerText || "").length < 280) el = el.parentElement;
    const ctx = (el?.innerText || "").replace(/\s+/g, " ").trim();
    return ctx && ctx !== text ? ctx.slice(0, 1500) : undefined;
  }

  /* ---------- floating panel (over the page, never resizing it) ---------- */
  showPanel(prompt?: string) {
    if (this.settings.panel === "docked") { send({ type: "OPEN_PANEL", prompt }).catch(() => {}); return; }
    this.hideBar();
    if (!this.panelEl) {
      this.panelEl = document.createElement("div");
      this.panelEl.className = "fpanel";
      this.root.appendChild(this.panelEl);
    }
    const src = chrome.runtime.getURL(`sidepanel.html?mode=float${prompt ? `&prompt=${encodeURIComponent(prompt)}` : ""}`);
    const frame = this.panelEl.querySelector("iframe");
    if (!frame || prompt) this.panelEl.innerHTML = `<iframe src="${src}" title="Lumen" allow="clipboard-write"></iframe>`;
    requestAnimationFrame(() => { this.panelEl!.classList.add("open"); this.host.classList.add("panel-open"); });
  }

  hidePanel() {
    this.panelEl?.classList.remove("open");
    this.host.classList.remove("panel-open");
  }

  togglePanel() {
    if (this.panelEl?.classList.contains("open")) this.hidePanel();
    else this.showPanel();
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
      const t = this.settings.toolbar;
      if (!t.enabled || t.disabledSites.includes(location.hostname)) return;
      this.showBar();
    }, 10);
  }

  showBar() {
    if (!this.pending) return;
    const { rect } = this.pending;
    const t = this.settings.toolbar;
    const acts = t.actions.length ? t.actions : DEFAULT_SETTINGS.toolbar.actions;
    const btn = (a: string) => a === "highlight"
      ? `<span class="hl-group"><button data-color="sun" class="act" title="Highlight">${ICON.highlight}${t.labels ? `<span>${LABEL[a]}</span>` : ""}</button><span class="flyout">${HIGHLIGHT_COLORS.map((c) => `<button class="sw" data-color="${c}" style="background:${SWATCH[c]}" title="Highlight ${c}"></button>`).join("")}</span></span>`
      : `<button class="act" data-act="${a}" title="${LABEL[a]}">${ICON[a as keyof typeof ICON]}${t.labels ? `<span>${LABEL[a]}</span>` : ""}</button>`;
    this.bar.className = `bar${t.labels ? " labels" : ""}`;
    this.bar.innerHTML = acts.map(btn).join("") + `<span class="sep"></span><button class="act more" data-act="more" title="Toolbar settings">${ICON.more}</button>`;
    this.bar.hidden = false;
    const w = this.bar.offsetWidth || 260;
    const x = Math.min(Math.max(rect.left + rect.width / 2 - w / 2 + scrollX, scrollX + 8), scrollX + innerWidth - w - 8);
    const y = rect.top + scrollY - 46 < scrollY + 4 ? rect.bottom + scrollY + 10 : rect.top + scrollY - 46;
    this.bar.style.left = `${x}px`;
    this.bar.style.top = `${y}px`;
    this.bar.onmousedown = (ev) => ev.preventDefault(); // keep the page selection alive
    this.bar.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.color) return this.highlight(b.dataset.color);
      const q = this.pending!.quote.quote;
      switch (b.dataset.act) {
        case "note": return this.highlight("sun", true);
        case "copy": return this.copy();
        case "save": return this.highlight("mint");
        case "ask": return this.openPanel(`What does this mean: “${q.slice(0, 400)}”`, q);
        case "more": return this.moreMenu();
        default: return this.ai(b.dataset.act as "explain" | "define" | "summarize" | "expand", q);
      }
    };
  }

  moreMenu() {
    this.hideBar();
    const host = location.hostname;
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile">${ICON.settings}</span><b>Toolbar</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>
      <div class="menu">
        <button data-act="off-site">${ICON.eyeOff}<span>Turn off on ${host}</span></button>
        <button data-act="settings">${ICON.settings}<span>Customise actions…</span></button>
        <button data-act="panel">${ICON.panel}<span>Open the Lumen panel</span></button>
      </div>`;
    this.card.onclick = async (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      if (b.dataset.act === "close") return this.hideCard();
      if (b.dataset.act === "off-site") { await send({ type: "SET_TOOLBAR_SITE", host, on: false }); this.hideCard(); return this.toast(`Toolbar off on ${host}. Turn it back on in settings.`); }
      if (b.dataset.act === "settings") { send({ type: "OPEN_OPTIONS" }).catch(() => {}); return this.hideCard(); }
      if (b.dataset.act === "panel") { this.hideCard(); return this.openPanel(); }
    };
  }

  async openPanel(prompt?: string, _fallbackText?: string) {
    this.showPanel(prompt);
  }

  /* ---------- the page helper ---------- */
  helperOn() {
    const h = this.settings.helper;
    const host = location.hostname;
    if (h.mode === "off") return false;
    if (h.mode === "everywhere") return !h.hiddenOn.includes(host);
    return h.sites.includes(host);
  }

  renderHelper() {
    if (!this.helperEl) return;
    const on = this.helperOn() && window.top === window;
    this.host.classList.toggle("has-helper", on);
    this.host.classList.toggle("helper-left", this.settings.helper.side === "left");
    if (!on) { this.helperEl.hidden = true; return; }
    const h = this.settings.helper;
    const count = this.highlights.length;
    this.helperEl.hidden = false;
    this.helperEl.className = `helper ${h.side}`;
    this.helperEl.innerHTML = `
      ${this.helperMenu ? `<div class="hmenu">
        <div class="hhead"><b>Hi, I'm ${esc(h.name)}</b><span class="muted">${count ? `${count} highlight${count === 1 ? "" : "s"} here` : "Select any text to start"}</span></div>
        <button data-h="save">${ICON.save}<span>Save this page</span></button>
        <button data-h="summary">${ICON.summarize}<span>Summarise this page</span></button>
        <button data-h="ask">${ICON.ask}<span>Ask about this page</span></button>
        <button data-h="panel">${ICON.panel}<span>Open the panel</span></button>
        <button data-h="follow">${ICON.save}<span>Follow this blog</span></button>
        <div class="hsep"></div>
        <button data-h="hide">${ICON.eyeOff}<span>Hide on ${location.hostname}</span></button>
      </div>` : ""}
      <button class="orb" data-h="toggle" title="${esc(h.name)}">${LAMP}${count ? `<span class="badge">${count}</span>` : ""}</button>
      <span class="hname">${esc(h.name)}</span>`;
    this.helperEl.onclick = async (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (!b) return;
      const act = b.dataset.h;
      if (act === "toggle") { this.helperMenu = !this.helperMenu; return this.renderHelper(); }
      this.helperMenu = false; this.renderHelper();
      if (act === "save") return this.savePage();
      if (act === "summary") { const main = (document.querySelector("article, main, [role=main]") as HTMLElement | null) ?? document.body; return this.ai("summarize", (main.innerText || "").slice(0, 8000)); }
      if (act === "ask") return this.openPanel("Summarise this page and connect it to what I have saved before.", document.title);
      if (act === "panel") return this.openPanel();
      if (act === "follow") {
        type FollowResult = { ok: boolean; feed?: { title: string }; created?: boolean; error?: string };
        const r: FollowResult = await send<FollowResult>({ type: "FOLLOW_SITE", url: location.href }).catch((e): FollowResult => ({ ok: false, error: String(e) }));
        return this.toast(r.ok && r.feed ? (r.created ? `Following ${r.feed.title}. You'll hear when it publishes.` : `Already following ${r.feed.title}`) : r.error ?? "No feed found on this site", r.ok ? "ok" : "err");
      }
      if (act === "hide") { await send({ type: "SET_HELPER_SITE", host: location.hostname, on: false }); this.toast(`${h.name} hidden here. Bring it back from the popup or right click.`); }
    };
  }

  hideBar() { this.bar.hidden = true; }
  hideCard() { this.card.hidden = true; this.card.innerHTML = ""; }

  async highlight(color: string, withNote = false, collectionId?: string) {
    if (!this.pending) return;
    const quote = this.pending.quote;
    this.hideBar();
    window.getSelection()?.removeAllRanges();
    type AddResult = { ok: boolean; highlight?: Highlight; error?: string; local?: boolean };
    const r: AddResult = await send<AddResult>({
      type: "ADD_HIGHLIGHT", url: location.href, title: document.title, html: pageHtml(), quote, color, collectionId,
    }).catch((e): AddResult => ({ ok: false, error: String(e) }));
    if (!r.ok || !r.highlight) return this.toast(r.error ?? "Could not save the highlight", "err");
    this.highlights.push(r.highlight);
    this.paint();
    this.toast(r.local ? "Highlighted (saved in this browser)" : color === "mint" ? "Saved to your Lumen bank · +2 glow" : "Highlighted · +2 glow");
    this.renderHelper();
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

  async ai(action: "explain" | "define" | "summarize" | "expand" | "ask", text: string, question?: string) {
    this.hideBar();
    this.aiText = "";
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile iris">✦</span><b>${action === "ask" ? "Answer" : action[0].toUpperCase() + action.slice(1)}</b><span class="sp"></span><span class="chip" data-prov></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q">${esc((question ?? text).slice(0, 300))}</blockquote>
      <div class="answer streaming"></div>
      <div class="row"><button class="key ghost" data-act="copy-answer">Copy answer</button><button class="key ghost" data-act="keep">Save to Lumen</button><button class="key ghost" data-act="more-panel">Ask more</button></div>`;
    this.card.onclick = async (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "close") this.hideCard();
      if (b?.dataset.act === "copy-answer") { await navigator.clipboard.writeText(this.aiText); this.toast("Answer copied"); }
      if (b?.dataset.act === "more-panel") { this.hideCard(); this.openPanel(`Tell me more about: “${text.slice(0, 300)}”`); }
      if (b?.dataset.act === "keep" && this.pending && this.aiText) {
        await this.highlight("iris");
        const h = this.highlights[this.highlights.length - 1];
        if (h) await send({ type: "UPDATE_HIGHLIGHT", id: h.id, url: location.href, note: `${action[0].toUpperCase()}${action.slice(1)}: ${this.aiText.slice(0, 1500)}` });
        this.toast("Saved the passage with this answer as its note");
      }
    };
    const r = await send<{ provider: string }>({ type: "AI_REQUEST", action, text, question, title: document.title, context: this.contextFor(text) }).catch(() => null);
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
      if (m.cmd === "save") this.savePage((m as { collectionId?: string }).collectionId);
      if (m.cmd === "send-selection") {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const quote = describeRange(document.body, sel.getRangeAt(0));
          if (quote) { this.pending = { quote, rect: sel.getRangeAt(0).getBoundingClientRect() }; this.highlight("sun", false, (m as { collectionId?: string }).collectionId); }
        }
      }
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

  async savePage(collectionId?: string) {
    const r = collectionId
      ? await send<{ ok: boolean; error?: string }>({ type: "SAVE_PAGE_TO", url: location.href, title: document.title, html: pageHtml(), collectionId })
      : await send<{ ok: boolean; error?: string }>({ type: "SAVE_PAGE", url: location.href, title: document.title, html: pageHtml() });
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
