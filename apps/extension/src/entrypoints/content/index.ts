// Lumen in the page: a selection toolbar that never takes over copy and paste,
// highlights that come back when you return, and margin answers in a side card.
import { HIGHLIGHT_COLORS, answerLabel, citeForClipboard, colorName, colorSwatch, colorVar, modelLabel, normalizeColor, type AIAction, type Highlight, type HighlightAnswer } from "@lumen/core";
import { WHEEL_CSS, bindWheel, wheelHTML } from "./wheel";
import { anchorToRange, coveringQuote, describeRange, unwrapMarks, wrapRange } from "@lumen/core/dom";
import { createSelectionBar, type BarChoice, type BarConfig, type BarSnapshot, type SelectionBar } from "@lumen/core/bar";
import { UI_CSS, MARK_CSS } from "./styles";
import { ICON, LAMP } from "./icons";
import { DEFAULT_SETTINGS, type Settings } from "../../lib/types";
import { resolveTheme } from "../../lib/theme";


export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    const v = chrome.runtime.getManifest().version;
    if ((window as any).__lumen === v) return;
    document.querySelectorAll("lumen-ui, lumen-bar").forEach((n) => n.remove());
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
  selectionBar!: SelectionBar;
  card!: HTMLElement;
  toastEl!: HTMLElement;
  highlights: Highlight[] = [];
  pending: BarSnapshot | null = null;
  activeMark: string | null = null;
  aiText = "";
  aiModel: string | null = null;
  lastColor = "sun";
  recentColors: string[] = [];

  /** Palette, recent custom colours, then the wheel. `on` marks the current colour. */
  swatches(on?: string) {
    const colors = [...HIGHLIGHT_COLORS, ...this.recentColors.filter((c) => !(HIGHLIGHT_COLORS as string[]).includes(c))];
    return colors.map((c) => `<button class="sw ${c === on ? "on" : ""}" data-color="${c}" style="background:${colorSwatch(c)}" title="Highlight ${colorName(c)}"></button>`).join("")
      + `<button class="sw wheel" data-act="wheel" title="Any colour"></button>`;
  }

  useColor(c: string) {
    this.lastColor = c;
    if (c.startsWith("#")) this.recentColors = [c, ...this.recentColors.filter((x) => x !== c)].slice(0, 4);
    chrome.storage.local.set({ lumenLastColor: this.lastColor, lumenRecentColors: this.recentColors }).catch(() => {});
  }

  /** The "any colour" card: wheel, brightness, hex. */
  wheelCard(title: string, initial: string, onPick: (c: string) => void) {
    this.card.hidden = false;
    this.card.innerHTML = `<div class="head"><span class="tile">✦</span><b>${title}</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>${wheelHTML()}`;
    const get = bindWheel(this.card, initial, onPick);
    this.card.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "close") return this.hideCard();
      if (b?.dataset.act === "use-color") { const c = get(); if (c) onPick(c); }
    };
  }

  start() {
    document.querySelectorAll("style[data-lumen-ui]").forEach((n) => n.remove());
    const style = document.createElement("style");
    style.textContent = MARK_CSS;
    style.setAttribute("data-lumen-ui", "");
    document.documentElement.appendChild(style);

    this.host = document.createElement("lumen-ui");
    this.host.setAttribute("data-lumen-ui", "");
    this.host.style.cssText = "all: initial; position: absolute; top: 0; left: 0; z-index: 2147483646;";
    this.root = this.host.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${UI_CSS}${WHEEL_CSS}</style><div class="card" hidden></div><div class="toast" hidden></div><div class="helper" hidden></div>`;
    this.card = this.root.querySelector(".card")!;
    this.toastEl = this.root.querySelector(".toast")!;
    this.helperEl = this.root.querySelector(".helper")!;
    document.documentElement.appendChild(this.host);
    this.selectionBar = createSelectionBar({
      scope: document.body ?? document.documentElement,
      config: () => this.barConfig(),
      canOpen: () => this.settings.toolbar.enabled && !this.settings.toolbar.disabledSites.includes(location.hostname),
      onChoose: (choice, snapshot) => this.onChoose(choice, snapshot),
    });
    chrome.storage.local.get(["lumenLastColor", "lumenRecentColors"]).then((v) => {
      this.lastColor = normalizeColor(v.lumenLastColor) ?? "sun";
      this.recentColors = Array.isArray(v.lumenRecentColors) ? v.lumenRecentColors.filter((c: unknown) => normalizeColor(c)?.startsWith("#")).slice(0, 4) : [];
    }).catch(() => {});

    document.addEventListener("click", (e) => this.onMarkClick(e), true);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { this.hideCard(); this.hidePanel(); } });

    send<{ settings: Settings }>({ type: "GET_SETTINGS" }).then((r) => { if (r?.settings) { this.settings = r.settings; this.applySettings(); } }).catch(() => {});
    chrome.storage.onChanged.addListener((ch) => {
      if (ch.lumen_settings_v2?.newValue) { this.settings = { ...DEFAULT_SETTINGS, ...ch.lumen_settings_v2.newValue }; this.applySettings(); }
    });
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => this.applySettings());
    const mo = new MutationObserver(() => this.adaptMarks());
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    if (document.body) mo.observe(document.body, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
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
    const st = await send<{ highlights: Highlight[] }>({ type: "PAGE_STATE", url: location.href, auto: true }).catch(() => null);
    if (!st) return;
    this.highlights = st.highlights;
    this.paint();
    this.renderHelper();
    // late rendering pages: try again once content settles
    if (st.highlights.length) setTimeout(() => this.paint(), 2500);
  }

  applySettings() {
    this.host.classList.toggle("dark", resolveTheme(this.settings.theme ?? "system") === "dark");
    const [a, da] = ({ soft: [".26", ".15"], medium: [".38", ".24"], strong: [".55", ".34"] } as const)[this.settings.markStrength ?? "soft"];
    document.documentElement.style.setProperty("--lumen-a", a);
    document.documentElement.style.setProperty("--lumen-da", da);
    this.renderHelper();
    this.adaptMarks();
  }

  paint() {
    unwrapMarks(document.body, "mark.lumen-mark");
    for (const h of [...this.highlights].sort((a, b) => b.position - a.position)) {
      const r = anchorToRange(document.body, h);
      // CSSOM rather than a style attribute: strict page CSPs block inline style attributes
      if (r) for (const m of wrapRange(r, { class: "lumen-mark", "data-lumen-id": h.id, title: h.note ? `Note: ${h.note}` : "Lumen highlight" })) m.style.setProperty("--lc", colorVar(h.color));
    }
    this.adaptMarks();
  }

  /** Light text or a dark background means a dark page: that mark becomes a tint plus underline. */
  adaptMarks() {
    const style = this.settings.markStyle ?? "auto";
    document.querySelectorAll<HTMLElement>("mark.lumen-mark").forEach((m) => {
      m.classList.remove("lumen-dark", "lumen-ul");
      if (style === "underline") { m.classList.add("lumen-ul"); return; }
      if (style === "fill") return;
      if (isDarkContext(m)) m.classList.add("lumen-dark");
    });
  }

  /** The paragraph (or nearby blocks) around the current selection, so short phrases are read in context. */
  contextFor(text: string): string | undefined {
    const node = this.pending?.range.commonAncestorContainer ?? null;
    let el = (node && (node.nodeType === 1 ? node : node.parentElement)) as HTMLElement | null;
    while (el && el !== document.body && (el.innerText || "").length < 280) el = el.parentElement;
    const ctx = (el?.innerText || "").replace(/\s+/g, " ").trim();
    return ctx && ctx !== text ? ctx.slice(0, 1500) : undefined;
  }

  /* ---------- floating panel (over the page, never resizing it) ---------- */
  showPanel(prompt?: string) {
    if (this.settings.panel === "docked") { send({ type: "OPEN_PANEL", prompt }).catch(() => {}); return; }
    this.selectionBar.hide();
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

  barConfig(): BarConfig {
    const toolbar = this.settings.toolbar;
    return {
      actions: toolbar.actions.length ? toolbar.actions : DEFAULT_SETTINGS.toolbar.actions,
      labels: toolbar.labels,
      color: this.lastColor,
      colors: [...HIGHLIGHT_COLORS, ...this.recentColors.filter((c) => !(HIGHLIGHT_COLORS as string[]).includes(c))],
      extras: [
        { id: "off-site", label: `Turn off on ${location.hostname}`, icon: "eyeOff" },
        { id: "settings", label: "Customise actions…", icon: "settings" },
        { id: "panel", label: "Open the Lumen panel", icon: "panel" },
      ],
    };
  }

  onChoose(choice: BarChoice, snapshot: BarSnapshot) {
    this.pending = snapshot;
    const quote = snapshot.quote.quote;
    if (choice.kind === "highlight") return this.highlight(choice.color);
    if (choice.kind === "any-colour") return this.wheelCard("Highlight in any colour", this.lastColor, (color) => { this.pending = snapshot; this.hideCard(); this.highlight(color); });
    if (choice.kind === "extra") return this.onExtra(choice.id);
    switch (choice.action) {
      case "note": return this.highlight(this.lastColor, true);
      case "save": return this.highlight("mint");
      case "copy": return this.copyText(quote);
      case "cite": return this.copy();
      case "ask": return this.openPanel(`What does this mean: “${quote.slice(0, 400)}”`);
      case "related": return this.openPanel(`What in my library relates to this passage: “${quote.slice(0, 400)}”`);
      default: return this.ai(choice.action, quote, { passage: snapshot });
    }
  }

  async onExtra(id: string) {
    const host = location.hostname;
    if (id === "off-site") { await send({ type: "SET_TOOLBAR_SITE", host, on: false }); return this.toast(`Toolbar off on ${host}. Turn it back on in settings.`); }
    if (id === "settings") return send({ type: "OPEN_OPTIONS" }).catch(() => {});
    if (id === "panel") return this.openPanel();
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

  hideCard() { this.card.hidden = true; this.card.innerHTML = ""; }

  async highlight(color: string, withNote = false, collectionId?: string): Promise<Highlight | undefined> {
    if (!this.pending) return;
    const quote = this.pending.quote;
    this.useColor(color);
    window.getSelection()?.removeAllRanges();
    type AddResult = { ok: boolean; highlight?: Highlight; error?: string; local?: boolean };
    const r: AddResult = await send<AddResult>({
      type: "ADD_HIGHLIGHT", url: location.href, title: document.title, html: pageHtml(), quote, color, collectionId,
    }).catch((e): AddResult => ({ ok: false, error: String(e) }));
    if (!r.ok || !r.highlight) { this.toast(r.error ?? "Could not save the highlight", "err"); return; }
    this.highlights.push(r.highlight);
    this.paint();
    this.toast(r.local ? "Highlighted (saved in this browser)" : color === "mint" ? "Saved to your Lumen bank · +2 glow" : "Highlighted · +2 glow");
    this.renderHelper();
    if (withNote) this.noteEditor(r.highlight);
    return r.highlight;
  }

  async copy(h?: Highlight) {
    const quote = h?.quote ?? this.pending?.quote.quote ?? "";
    await navigator.clipboard.writeText(citeForClipboard({ quote, note: h?.note, title: document.title, url: location.href }));
    this.toast("Copied with citation");
  }

  async copyText(quote: string) {
    await navigator.clipboard.writeText(quote);
    this.toast("Copied");
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
      <blockquote class="q" style="--lc: ${colorVar(h.color)}">${esc(h.quote)}</blockquote>
      ${h.note ? `<div class="note">✎ ${esc(h.note)}</div>` : ""}
      ${(h.answers ?? []).map((kept) => `<details class="kept"><summary>✦ ${answerLabel(kept.action)}${kept.question ? `: ${esc(kept.question)}` : ""}</summary><div>${esc(kept.answer)}</div></details>`).join("")}
      <div class="row">${this.swatches(h.color)}</div>
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
      const recolor = async (color: string) => {
        if (color.startsWith("#")) this.useColor(color);
        const r = await send<{ highlight: Highlight }>({ type: "UPDATE_HIGHLIGHT", id: h.id, url: location.href, color });
        this.replace(r.highlight);
        this.cardFor(r.highlight);
      };
      if (b.dataset.color) return recolor(b.dataset.color);
      if (b.dataset.act === "wheel") return this.wheelCard("Recolour highlight", h.color, recolor);
      switch (b.dataset.act) {
        case "close": return this.hideCard();
        case "note": return this.noteEditor(h);
        case "copy": return this.copy(h);
        case "explain": this.pending = null; return this.ai("explain", h.quote, { highlight: h });
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
      <blockquote class="q" style="--lc: ${colorVar(h.color)}">${esc(h.quote)}</blockquote>
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
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile iris">?</span><b>Ask about this</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q">${esc(text.slice(0, 400))}</blockquote>
      <input placeholder="What do you want to know?" />
      <div class="row"><button class="key iris" data-act="go">Ask</button></div>`;
    const input = this.card.querySelector("input")!;
    input.focus();
    const go = () => input.value.trim() && this.ai("ask", text, { question: input.value.trim() });
    input.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") go(); };
    this.card.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "go") go();
      if (b?.dataset.act === "close") this.hideCard();
    };
  }

  /** A margin answer. Keep is offered only when the answer belongs to a passage or a highlight. */
  async ai(action: AIAction, text: string, target: { question?: string; passage?: BarSnapshot | null; highlight?: Highlight } = {}) {
    this.aiText = "";
    this.aiModel = null;
    const canKeep = Boolean(target.passage || target.highlight);
    this.card.hidden = false;
    this.card.innerHTML = `
      <div class="head"><span class="tile iris">✦</span><b>${answerLabel(action)}</b><span class="sp"></span><button class="x" data-act="close">✕</button></div>
      <blockquote class="q">${esc((target.question ?? text).slice(0, 300))}</blockquote>
      <div class="answer streaming"></div>
      <div class="row"><button class="key ghost" data-act="copy-answer">Copy answer</button>${canKeep ? `<button class="key ghost" data-act="keep">Keep</button>` : ""}<button class="key ghost" data-act="more-panel">Ask more</button></div>
      <div class="foot" data-model></div>`;
    let kept = false;
    this.card.onclick = async (ev) => {
      const b = (ev.target as HTMLElement).closest("button");
      if (b?.dataset.act === "close") this.hideCard();
      if (b?.dataset.act === "copy-answer") { await navigator.clipboard.writeText(this.aiText); this.toast("Answer copied"); }
      if (b?.dataset.act === "more-panel") { this.hideCard(); this.openPanel(`Tell me more about: “${text.slice(0, 300)}”`); }
      if (b?.dataset.act === "keep" && this.aiText && !kept) {
        kept = true;
        b.setAttribute("disabled", "");
        if (!(await this.keep(action, target))) { kept = false; b.removeAttribute("disabled"); }
      }
    };
    await send({ type: "AI_REQUEST", action, text, question: target.question, title: document.title, context: this.contextFor(text) }).catch(() => null);
  }

  /** Attach the answer to the highlight already on the passage, or highlight it first in the last colour. */
  async keep(action: AIAction, target: { question?: string; passage?: BarSnapshot | null; highlight?: Highlight }): Promise<boolean> {
    let highlight = target.highlight ?? (target.passage ? coveringQuote(document.body, target.passage.quote, this.highlights) : undefined);
    if (!highlight && target.passage) {
      this.pending = target.passage;
      highlight = await this.highlight(this.lastColor);
    }
    if (!highlight) return false;
    const owner = highlight;
    type KeepResult = { ok: boolean; answer?: HighlightAnswer; error?: string };
    const r: KeepResult = await send<KeepResult>({ type: "KEEP_ANSWER", highlightId: owner.id, url: location.href, action, question: target.question ?? null, answer: this.aiText, model: this.aiModel })
      .catch((e): KeepResult => ({ ok: false, error: String(e) }));
    const answer = r.answer;
    if (!r.ok || !answer) { this.toast(r.error ?? "Could not keep this answer", "err"); return false; }
    this.highlights = this.highlights.map((h) => (h.id === owner.id ? { ...h, answers: [...(h.answers ?? []), answer] } : h));
    this.toast("Kept with this highlight");
    return true;
  }

  onMessage(m: { type: string; chunk?: string; error?: string; cmd?: string; text?: string; tone?: string; model?: string }) {
    const ans = this.card.querySelector<HTMLElement>(".answer");
    if (m.type === "AI_CHUNK" && ans) { this.aiText += m.chunk; ans.textContent = this.aiText; }
    if (m.type === "AI_DONE" && ans) {
      ans.classList.remove("streaming");
      this.aiModel = m.model ?? null;
      const foot = this.card.querySelector<HTMLElement>("[data-model]");
      if (foot && m.model) foot.textContent = modelLabel(m.model);
    }
    if (m.type === "AI_ERROR" && ans) { ans.classList.remove("streaming"); ans.classList.add("err"); ans.textContent = m.error ?? "Something went wrong"; }
    if (m.type === "TOAST") this.toast(m.text ?? "", m.tone === "err" ? "err" : "ok");
    if (m.type === "CMD") {
      if (m.cmd === "save") this.savePage((m as { collectionId?: string }).collectionId);
      if (m.cmd === "send-selection") {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const quote = describeRange(document.body, sel.getRangeAt(0));
          if (quote) { this.pending = { quote, range: sel.getRangeAt(0).cloneRange() }; this.highlight(this.lastColor, false, (m as { collectionId?: string }).collectionId); }
        }
      }
      if (m.cmd === "highlight" || m.cmd === "explain") {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          const quote = describeRange(document.body, sel.getRangeAt(0));
          if (quote) {
            this.pending = { quote, range: sel.getRangeAt(0).cloneRange() };
            m.cmd === "highlight" ? this.highlight(this.lastColor) : this.ai("explain", quote.quote, { passage: this.pending });
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

/* ---------- colour helpers ---------- */
// getComputedStyle can return rgb(), oklch(), lab(), color(srgb …) and more. A 1x1 canvas turns
// any of them into real RGBA, so the check works on every site.
let probe: CanvasRenderingContext2D | null = null;
function toRgba(css: string): [number, number, number, number] | null {
  try {
    probe ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true });
    if (!probe) return null;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = css;
    probe.fillRect(0, 0, 1, 1);
    const d = probe.getImageData(0, 0, 1, 1).data;
    const alphaFromCss = /transparent|rgba?\([^)]*,\s*0\s*\)|\/\s*0\s*\)/.test(css) ? 0 : d[3] / 255;
    return [d[0], d[1], d[2], alphaFromCss];
  } catch { return null; }
}
const lum = ([r, g, b]: number[]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function isDarkContext(el: HTMLElement): boolean {
  const text = toRgba(getComputedStyle(el.parentElement ?? el).color);
  if (text && lum(text) > 0.62) return true;
  // walk up to the first solid background
  for (let n: HTMLElement | null = el.parentElement; n; n = n.parentElement) {
    const bg = toRgba(getComputedStyle(n).backgroundColor);
    if (bg && bg[3] > 0.5) return lum(bg) < 0.4;
  }
  const root = toRgba(getComputedStyle(document.documentElement).backgroundColor);
  if (root && root[3] > 0.5) return lum(root) < 0.4;
  return matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.style.colorScheme !== "light";
}
