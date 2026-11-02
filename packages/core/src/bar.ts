// The selection bar: one module for the extension, the web reader and the landing demo.
// It owns its shadow root and only reports what the reader chose; the host decides what that means.
import type { TextQuote } from "./types.ts";
import { describeRange } from "./dom.ts";
import { colorName, colorSwatch } from "./colors.ts";
import { ICON_FRAME, ICON_SHAPES, type IconName } from "./icons.ts";
import { BAR_LABEL, MENU_LABEL, isBarAction, menuActions, type BarAction } from "./toolbar.ts";

export interface RectLike { left: number; top: number; bottom: number; width: number; height: number }

/** Taken when the bar opens; everything after reads this, never the live selection. */
export interface BarSnapshot { quote: TextQuote; range: Range }

export interface MenuExtra { id: string; label: string; icon: IconName }

export interface BarConfig {
  actions: readonly BarAction[];
  labels: boolean;
  /** The colour the highlight button uses: the last one picked. */
  color: string;
  colors: readonly string[];
  /** Offer the any colour swatch; off where the host has no colour wheel. Defaults to on. */
  anyColour?: boolean;
  /** Host specific items under the separator in More (site settings, panel). */
  extras: readonly MenuExtra[];
}

export type BarChoice =
  | { kind: "highlight"; color: string }
  | { kind: "any-colour" }
  | { kind: "action"; action: Exclude<BarAction, "highlight"> }
  | { kind: "extra"; id: string };

export interface BarOptions {
  /** Selections count only inside this element. */
  scope: HTMLElement;
  config: () => BarConfig;
  onChoose: (choice: BarChoice, snapshot: BarSnapshot) => void;
  /** Called each time the bar opens on a new selection. */
  onOpen?: (snapshot: BarSnapshot) => void;
  /** Host veto, for example when the reader turned the bar off on this site. */
  canOpen?: () => boolean;
  mount?: HTMLElement;
}

export interface SelectionBar {
  readonly host: HTMLElement;
  show: (snapshot: BarSnapshot) => void;
  hide: () => void;
  isOpen: () => boolean;
  destroy: () => void;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SHAPE = /<(path|circle|rect)\s([^>]*?)\/>/g;
const ATTRIBUTE = /([\w-]+)="([^"]*)"/g;

/** Built node by node: pages with Trusted Types reject HTML strings, even from extensions in Safari. */
function iconElement(doc: Document, name: IconName): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, "svg");
  for (const [key, value] of Object.entries({ ...ICON_FRAME, width: "16", height: "16" })) svg.setAttribute(key, value);
  for (const [, tag, attributes] of ICON_SHAPES[name].matchAll(SHAPE)) {
    const shape = doc.createElementNS(SVG_NS, tag);
    for (const [, key, value] of attributes.matchAll(ATTRIBUTE)) shape.setAttribute(key, value);
    svg.appendChild(shape);
  }
  return svg;
}

const RISE_MS = 140;
const STAGGER_MS = 18;
const MENU_MS = 160;
const SETTLE_MS = 180;
const EASE = "cubic-bezier(.22,1,.36,1)";
const GAP = 8;
const EDGE = 8;

/** Above the first line of the selection, or below the last when there is no room. */
export function placeBar(lines: ArrayLike<RectLike>, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const visible = Array.from(lines).filter((line) => line.width > 0 && line.height > 0);
  const first = visible[0];
  const last = visible[visible.length - 1];
  if (!first || !last) return null;
  const above = first.top - size.height - GAP;
  const top = above >= EDGE / 2 ? above : last.bottom + GAP;
  const centred = first.left + first.width / 2 - size.width / 2;
  const left = Math.max(EDGE, Math.min(centred, viewport.width - size.width - EDGE));
  return { left, top };
}

/** Roving focus: where an arrow, Home or End key moves to, or null for any other key. */
export function stepIndex(current: number, key: string, count: number, forward: string, back: string): number | null {
  if (!count) return null;
  if (key === forward) return (current + 1) % count;
  if (key === back) return (current - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}

function isKeyboard(event: Event): event is KeyboardEvent {
  return "key" in event;
}

function closestButton(target: EventTarget | null): HTMLButtonElement | null {
  return target && "closest" in target && typeof target.closest === "function" ? (target as Element).closest("button") : null;
}

function sameQuote(a: TextQuote, b: TextQuote) {
  return a.quote === b.quote && a.position === b.position;
}

const HOST_STYLE: Record<string, string> = {
  position: "fixed", top: "0", left: "0", right: "auto", bottom: "auto", width: "0", height: "0",
  margin: "0", padding: "0", border: "0", background: "transparent", overflow: "visible", "z-index": "2147483646",
};

export function createSelectionBar(options: BarOptions): SelectionBar {
  const doc = options.scope.ownerDocument;
  const view = doc.defaultView;
  if (!view) throw new Error("The selection bar needs a document with a window.");
  const win: Window = view;
  const listening = new AbortController();
  const { signal } = listening;

  const host = doc.createElement("lumen-bar");
  host.setAttribute("data-lumen-ui", "");
  for (const [property, value] of Object.entries(HOST_STYLE)) host.style.setProperty(property, value);
  // The top layer keeps the bar above native dialogs and popovers, which no z-index can beat.
  const topLayer = typeof host.showPopover === "function";
  if (topLayer) host.setAttribute("popover", "manual");
  const root = host.attachShadow({ mode: "open" });
  const style = doc.createElement("style");
  style.textContent = BAR_CSS;
  const bar = doc.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "Lumen");
  bar.hidden = true;
  root.append(style, bar);
  (options.mount ?? doc.documentElement).appendChild(host);

  let snapshot: BarSnapshot | null = null;
  let menu: HTMLElement | null = null;
  let more: HTMLButtonElement | null = null;
  let animations: Animation[] = [];
  let generation = 0;
  let pointerDown = false;
  let settleTimer = 0;
  let frame = 0;

  const reducedMotion = () => win.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  function button(className: string, icon: IconName, label: string, showLabel: boolean): HTMLButtonElement {
    const element = doc.createElement("button");
    element.type = "button";
    element.className = className;
    element.title = label;
    element.setAttribute("aria-label", label);
    element.appendChild(iconElement(doc, icon));
    if (showLabel) {
      const text = doc.createElement("span");
      text.textContent = label;
      element.appendChild(text);
    }
    return element;
  }

  function highlightGroup(config: BarConfig): HTMLElement {
    const group = doc.createElement("span");
    group.className = "hl-group";
    const main = button("act rove", "highlight", BAR_LABEL.highlight, config.labels);
    main.title = `${BAR_LABEL.highlight} (${colorName(config.color)})`;
    main.dataset.color = config.color;
    main.style.setProperty("--dot", colorSwatch(config.color));
    const flyout = doc.createElement("span");
    flyout.className = "flyout";
    for (const color of config.colors) {
      const swatch = doc.createElement("button");
      swatch.type = "button";
      swatch.className = "sw";
      swatch.tabIndex = -1;
      swatch.dataset.color = color;
      swatch.title = `Highlight ${colorName(color)}`;
      swatch.setAttribute("aria-label", swatch.title);
      swatch.style.setProperty("background", colorSwatch(color));
      flyout.appendChild(swatch);
    }
    if (config.anyColour !== false) {
      const wheel = doc.createElement("button");
      wheel.type = "button";
      wheel.className = "sw wheel";
      wheel.tabIndex = -1;
      wheel.dataset.anyColour = "";
      wheel.title = "Any colour";
      wheel.setAttribute("aria-label", wheel.title);
      flyout.appendChild(wheel);
    }
    group.append(main, flyout);
    return group;
  }

  function buildMenu(config: BarConfig): HTMLElement {
    const list = doc.createElement("div");
    list.className = "menu";
    list.setAttribute("role", "menu");
    list.hidden = true;
    const items = menuActions(config.actions).map((action) => {
      const item = button("item", action, MENU_LABEL[action] ?? BAR_LABEL[action], true);
      item.dataset.act = action;
      return item;
    });
    const extras = config.extras.map((extra) => {
      const item = button("item", extra.icon, extra.label, true);
      item.dataset.extra = extra.id;
      return item;
    });
    for (const item of [...items, ...extras]) {
      item.setAttribute("role", "menuitem");
      item.tabIndex = -1;
    }
    list.append(...items);
    if (items.length && extras.length) {
      const rule = doc.createElement("div");
      rule.className = "rule";
      rule.setAttribute("role", "separator");
      list.appendChild(rule);
    }
    list.append(...extras);
    return list;
  }

  function render(config: BarConfig) {
    bar.replaceChildren();
    bar.classList.toggle("labels", config.labels);
    for (const action of config.actions) {
      if (action === "highlight") { bar.appendChild(highlightGroup(config)); continue; }
      const element = button("act rove", action, BAR_LABEL[action], config.labels);
      element.dataset.act = action;
      bar.appendChild(element);
    }
    const rule = doc.createElement("span");
    rule.className = "sep";
    more = button("act rove more", "more", "More", false);
    more.dataset.more = "";
    more.setAttribute("aria-haspopup", "menu");
    more.setAttribute("aria-expanded", "false");
    menu = buildMenu(config);
    bar.append(rule, more, menu);
    roving().forEach((element, index) => { element.tabIndex = index === 0 ? 0 : -1; });
  }

  const roving = () => Array.from(bar.querySelectorAll<HTMLButtonElement>(".rove"));
  const menuItems = () => Array.from(menu?.querySelectorAll<HTMLButtonElement>(".item") ?? []);

  function moveFocus(list: HTMLButtonElement[], key: string, forward: string, back: string): boolean {
    const focused = root.activeElement;
    const current = list.findIndex((element) => element === focused);
    const next = stepIndex(current, key, list.length, forward, back);
    const target = next === null ? undefined : list[next];
    if (!target) return false;
    for (const element of list) element.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
    return true;
  }

  function cancelAnimations() {
    for (const animation of animations) animation.cancel();
    animations = [];
  }

  function animateIn() {
    cancelAnimations();
    const reduced = reducedMotion();
    const rise = bar.animate?.(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }], { duration: RISE_MS, easing: EASE });
    if (rise) animations.push(rise);
    if (reduced) return;
    roving().forEach((element, index) => {
      const step = element.animate?.([{ opacity: 0, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: RISE_MS, delay: index * STAGGER_MS, easing: EASE, fill: "backwards" });
      if (step) animations.push(step);
    });
  }

  function position() {
    if (!snapshot || bar.hidden) return;
    const spot = placeBar(snapshot.range.getClientRects(), { width: bar.offsetWidth || 0, height: bar.offsetHeight || 0 }, { width: win.innerWidth, height: win.innerHeight });
    if (!spot) return;
    bar.style.setProperty("left", `${spot.left}px`);
    bar.style.setProperty("top", `${spot.top}px`);
  }

  function follow() {
    if (bar.hidden || frame) return;
    frame = win.requestAnimationFrame(() => { frame = 0; position(); });
  }

  function openMenu(focusFirst: boolean) {
    if (!menu || !more) return;
    menu.hidden = false;
    more.setAttribute("aria-expanded", "true");
    const roomBelow = win.innerHeight - bar.getBoundingClientRect().bottom;
    menu.classList.toggle("up", roomBelow < (menu.offsetHeight || 0) + GAP * 2);
    const reduced = reducedMotion();
    const unfold = menu.animate?.(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(-4px) scale(.98)" }, { opacity: 1, transform: "none" }], { duration: MENU_MS, easing: EASE });
    if (unfold) animations.push(unfold);
    if (focusFirst) menuItems()[0]?.focus();
  }

  function closeMenu(returnFocus: boolean) {
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    more?.setAttribute("aria-expanded", "false");
    if (returnFocus) more?.focus();
  }

  function show(next: BarSnapshot) {
    snapshot = next;
    render(options.config());
    bar.hidden = false;
    if (topLayer && !host.matches(":popover-open")) host.showPopover();
    position();
    animateIn();
    options.onOpen?.(next);
  }

  function hide() {
    closeMenu(false);
    cancelAnimations();
    bar.hidden = true;
    snapshot = null;
    if (topLayer && host.matches(":popover-open")) host.hidePopover();
  }

  function choose(choice: BarChoice) {
    const chosen = snapshot;
    hide();
    if (chosen) options.onChoose(choice, chosen);
  }

  function readSelection(): BarSnapshot | null {
    const selection = doc.getSelection?.();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const element = container.nodeType === 1 ? (container as Element) : container.parentElement;
    if (!element || !options.scope.contains(element)) return null;
    if (element.closest("input,textarea,[contenteditable=''],[contenteditable='true']")) return null;
    const quote = describeRange(options.scope, range);
    if (!quote || quote.quote.trim().length < 2) return null;
    return { quote, range: range.cloneRange() };
  }

  // The selection is only final on the next task: a double click reports the word, then the release.
  function settle() {
    const ticket = ++generation;
    win.setTimeout(() => {
      if (ticket !== generation) return;
      const next = readSelection();
      if (!next) { if (!root.activeElement) hide(); return; }
      if (options.canOpen && !options.canOpen()) return hide();
      if (snapshot && !bar.hidden && sameQuote(snapshot.quote, next.quote)) { snapshot = next; return position(); }
      show(next);
    }, 0);
  }

  const fromBar = (event: Event) => event.composedPath().includes(host);

  root.addEventListener("mousedown", (event) => event.preventDefault(), { signal });
  root.addEventListener("click", (event) => {
    const target = closestButton(event.target);
    if (!target) return;
    if (target.dataset.more !== undefined) return menu?.hidden ? openMenu(false) : closeMenu(false);
    if (target.dataset.color) return choose({ kind: "highlight", color: target.dataset.color });
    if (target.dataset.anyColour !== undefined) return choose({ kind: "any-colour" });
    const action = target.dataset.act;
    if (isBarAction(action) && action !== "highlight") return choose({ kind: "action", action });
    if (target.dataset.extra) return choose({ kind: "extra", id: target.dataset.extra });
  }, { signal });
  // Host shortcuts (YouTube k, GitHub t) must not see keys pressed inside the bar.
  for (const type of ["keyup", "keypress"]) root.addEventListener(type, (event) => event.stopPropagation(), { signal });
  root.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (!isKeyboard(event)) return;
    const inMenu = Boolean(menu && !menu.hidden && event.composedPath().includes(menu));
    if (event.key === "Escape") return menu && !menu.hidden ? closeMenu(true) : hide();
    if (inMenu) { if (moveFocus(menuItems(), event.key, "ArrowDown", "ArrowUp")) event.preventDefault(); return; }
    if (event.key === "ArrowDown" && closestButton(event.target) === more) { event.preventDefault(); return openMenu(true); }
    if (moveFocus(roving(), event.key, "ArrowRight", "ArrowLeft")) event.preventDefault();
  }, { signal });

  doc.addEventListener("mousedown", (event) => {
    if (fromBar(event)) return;
    pointerDown = true;
    hide();
  }, { capture: true, signal });
  doc.addEventListener("mouseup", (event) => {
    pointerDown = false;
    if (!fromBar(event)) settle();
  }, { capture: true, signal });
  doc.addEventListener("keyup", (event) => {
    if (!fromBar(event) && (event.shiftKey || event.key === "Shift")) settle();
  }, { capture: true, signal });
  // Touch and keyboard selections never send a mouseup.
  doc.addEventListener("selectionchange", () => {
    if (pointerDown) return;
    win.clearTimeout(settleTimer);
    settleTimer = win.setTimeout(settle, SETTLE_MS);
  }, { signal });
  doc.addEventListener("keydown", (event) => { if (event.key === "Escape" && !bar.hidden) hide(); }, { signal });
  win.addEventListener("scroll", follow, { capture: true, passive: true, signal });
  win.addEventListener("resize", follow, { signal });
  win.visualViewport?.addEventListener("resize", follow, { signal });
  win.visualViewport?.addEventListener("scroll", follow, { signal });

  return {
    host,
    show,
    hide,
    isOpen: () => !bar.hidden,
    destroy() {
      listening.abort();
      win.clearTimeout(settleTimer);
      if (frame) win.cancelAnimationFrame(frame);
      hide();
      host.remove();
    },
  };
}

export const BAR_CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
[hidden] { display: none !important; }
button { font: inherit; cursor: pointer; border: 0; margin: 0; }
.bar {
  position: fixed; display: flex; align-items: center; gap: 1px; padding: 4px; direction: ltr;
  background: rgba(18,18,21,.96); color: #fff; border-radius: 12px; white-space: nowrap; font-size: 12.5px; line-height: 1.2;
  box-shadow: 0 1px 0 rgba(255,255,255,.06) inset, 0 16px 30px -12px rgba(0,0,0,.55); backdrop-filter: blur(8px);
}
.act { position: relative; display: inline-flex; align-items: center; gap: 6px; height: 30px; min-width: 30px; justify-content: center; padding: 0 7px;
  background: transparent; color: rgba(255,255,255,.82); border-radius: 8px; font-size: 12.5px; font-weight: 500; }
.act:hover { background: rgba(255,255,255,.12); color: #fff; }
.act:focus-visible, .item:focus-visible { outline: 2px solid #ff8a1f; outline-offset: -2px; }
.act svg { flex: none; }
.bar:not(.labels) .act span { display: none; }
.more { color: rgba(255,255,255,.5); }
.more[aria-expanded="true"] { background: rgba(255,255,255,.12); color: #fff; }
.hl-group { position: relative; display: inline-flex; }
.hl-group > .act::after { content: ""; position: absolute; right: 5px; bottom: 5px; width: 6px; height: 6px; border-radius: 99px; background: var(--dot, #ffd34d); box-shadow: 0 0 0 1.5px #121215; }
.flyout { position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translateX(-50%) scale(.9); opacity: 0; pointer-events: none;
  display: grid; grid-template-columns: repeat(8, 18px); gap: 7px; padding: 8px 10px; border-radius: 16px; background: rgba(18,18,21,.96); box-shadow: 0 10px 20px -10px rgba(0,0,0,.6);
  transition: opacity 140ms ease, transform 160ms cubic-bezier(.34,1.56,.64,1); }
.hl-group:hover .flyout, .hl-group:focus-within .flyout { opacity: 1; transform: translateX(-50%) scale(1); pointer-events: auto; }
.flyout::after { content: ""; position: absolute; left: 0; right: 0; top: 100%; height: 8px; }
.sw { width: 18px; height: 18px; padding: 0; border-radius: 50%; box-shadow: inset 0 0 0 2px rgba(255,255,255,.25); transition: transform 140ms cubic-bezier(.34,1.56,.64,1); }
.sw:hover { transform: scale(1.2); }
.sw.wheel { position: relative; background: conic-gradient(#ff4d4d, #ffd34d, #3fd39a, #2cc6d4, #5b9bff, #bb7bff, #ff6fa5, #ff4d4d); }
.sw.wheel::after { content: ""; position: absolute; inset: 28%; border-radius: 99px; background: #121215; }
.sep { width: 1px; height: 16px; background: rgba(255,255,255,.14); margin: 0 3px; }
.menu { position: absolute; right: 0; top: calc(100% + 6px); min-width: 230px; display: grid; gap: 1px; padding: 5px;
  border-radius: 14px; background: rgba(18,18,21,.97); box-shadow: 0 18px 34px -12px rgba(0,0,0,.6); transform-origin: top right; }
.menu.up { top: auto; bottom: calc(100% + 6px); transform-origin: bottom right; }
.item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 9px; background: transparent;
  color: rgba(255,255,255,.86); font-size: 13px; font-weight: 500; text-align: left; }
.item:hover, .item:focus-visible { background: rgba(255,255,255,.1); color: #fff; }
.item svg { color: #ffb53d; flex: none; }
.rule { height: 1px; margin: 4px 6px; background: rgba(255,255,255,.1); }
@media (prefers-reduced-motion: reduce) { .flyout, .sw { transition-property: opacity; } .sw:hover { transform: none; } }
`;
