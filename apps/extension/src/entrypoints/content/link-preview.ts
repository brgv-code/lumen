// Hover a link to see what its page is about without leaving this one.
import { send } from "../../lib/msg";
import { previewFromDocument, previewTarget, type LinkPreview, type PageHead } from "../../lib/preview";
import { resolveTheme } from "../../lib/theme";
import type { Settings } from "../../lib/types";
import { PREVIEW_CSS } from "./styles";

// Long enough that moving the pointer across a page of links opens nothing.
const SHOW_DELAY_MS = 500;
const HIDE_DELAY_MS = 200;
const GAP = 8;

type CardState = { kind: "loading" } | { kind: "ready"; preview: LinkPreview } | { kind: "none" };

export class LinkPreviews {
  private host!: HTMLElement;
  private card!: HTMLAnchorElement;
  private anchor: HTMLAnchorElement | null = null;
  /** The page the card is for; a fetch that finishes for any other link is ignored. */
  private target: string | null = null;
  private pointerY: number | null = null;
  private showTimer = 0;
  private hideTimer = 0;
  private previews = new Map<string, Promise<LinkPreview | null>>();

  constructor(private settings: () => Settings) {}

  start() {
    this.host = document.createElement("lumen-preview");
    this.host.setAttribute("data-lumen-ui", "");
    this.host.style.cssText = "all: initial; position: fixed; top: 0; left: 0; z-index: 2147483646;";
    const root = this.host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${PREVIEW_CSS}</style><a class="preview" hidden></a>`;
    this.card = root.querySelector<HTMLAnchorElement>(".preview")!;
    this.card.addEventListener("mouseenter", () => clearTimeout(this.hideTimer));
    this.card.addEventListener("mouseleave", () => this.scheduleHide());
    this.card.addEventListener("click", () => this.hide());
    document.documentElement.appendChild(this.host);

    document.addEventListener("mouseover", (event) => this.onOver(event), true);
    document.addEventListener("mouseout", (event) => this.onOut(event), true);
    document.addEventListener("focusin", (event) => this.onFocus(event), true);
    document.addEventListener("focusout", (event) => { if (linkAt(event.target) === this.anchor) this.scheduleHide(); }, true);
    // Clicks inside the card arrive retargeted to the host, so they keep it open until the link opens.
    document.addEventListener("mousedown", (event) => { if (event.target !== this.host) this.hide(); }, true);
    document.addEventListener("scroll", () => this.hide(), { capture: true, passive: true });
    document.addEventListener("keydown", (event) => { if (event.key === "Escape") this.hide(); });
  }

  private onOver(event: MouseEvent) {
    const anchor = linkAt(event.target);
    if (!anchor) return;
    clearTimeout(this.hideTimer);
    if (anchor === this.anchor) return;
    // A held button means a text selection is being dragged across the link.
    if (event.buttons) return;
    this.pointerY = event.clientY;
    this.queue(anchor);
  }

  private onOut(event: MouseEvent) {
    const anchor = linkAt(event.target);
    if (!anchor || anchor.contains(event.relatedTarget as Node | null)) return;
    clearTimeout(this.showTimer);
    if (this.card.hidden) this.anchor = null;
    else this.scheduleHide();
  }

  private onFocus(event: FocusEvent) {
    const anchor = linkAt(event.target);
    if (!anchor || !anchor.matches(":focus-visible") || anchor === this.anchor) return;
    this.pointerY = null;
    this.queue(anchor);
  }

  private queue(anchor: HTMLAnchorElement) {
    this.hide();
    const target = this.settings().linkPreviews ? previewTarget(anchor.href, location.href) : null;
    if (!target) return;
    this.anchor = anchor;
    this.showTimer = window.setTimeout(() => this.show(anchor, target), SHOW_DELAY_MS);
  }

  private async show(anchor: HTMLAnchorElement, target: string) {
    this.target = target;
    this.render(anchor, { kind: "loading" });
    const preview = await this.load(target);
    if (this.target !== target) return;
    this.render(anchor, preview ? { kind: "ready", preview } : { kind: "none" });
  }

  private load(target: string): Promise<LinkPreview | null> {
    let preview = this.previews.get(target);
    if (!preview) {
      preview = fetchPreview(target);
      this.previews.set(target, preview);
    }
    return preview;
  }

  private render(anchor: HTMLAnchorElement, state: CardState) {
    this.host.classList.toggle("dark", resolveTheme(this.settings().theme ?? "system") === "dark");
    const link = new URL(anchor.href);
    this.card.href = anchor.href;
    this.card.target = anchor.target;
    this.card.rel = "noopener";
    this.card.replaceChildren(...cardContent(state, link, anchor));
    this.card.hidden = false;
    this.place(anchor);
  }

  /** Below the hovered line of the link, or above it when the viewport has no room below. */
  private place(anchor: HTMLAnchorElement) {
    const rects = Array.from(anchor.getClientRects());
    const y = this.pointerY;
    const rect = rects.find((line) => y !== null && line.top <= y && y <= line.bottom) ?? rects[0] ?? anchor.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = this.card;
    const below = rect.bottom + GAP;
    const top = below + height <= innerHeight - GAP ? below : Math.max(GAP, rect.top - GAP - height);
    const left = Math.min(Math.max(GAP, rect.left), innerWidth - width - GAP);
    this.card.style.top = `${top}px`;
    this.card.style.left = `${left}px`;
  }

  private scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = window.setTimeout(() => this.hide(), HIDE_DELAY_MS);
  }

  private hide() {
    clearTimeout(this.showTimer);
    clearTimeout(this.hideTimer);
    this.anchor = null;
    this.target = null;
    this.card.hidden = true;
  }
}

function linkAt(target: EventTarget | null): HTMLAnchorElement | null {
  const link = target instanceof Element ? target.closest("a[href]") : null;
  return link instanceof HTMLAnchorElement && !link.isContentEditable ? link : null;
}

async function fetchPreview(url: string): Promise<LinkPreview | null> {
  const reply = await send<{ ok: boolean; head?: PageHead | null }>({ type: "LINK_PREVIEW", url }).catch((error: unknown) => {
    console.warn("Lumen could not preview", url, error);
    return null;
  });
  if (!reply?.head) return null;
  // A parsed document is inert: its scripts never run and its images never load.
  const doc = new DOMParser().parseFromString(reply.head.html, "text/html");
  return previewFromDocument(doc, reply.head.url);
}

// Built with textContent, never innerHTML: everything here comes from another site.
function cardContent(state: CardState, link: URL, anchor: HTMLAnchorElement): Node[] {
  const host = link.hostname.replace(/^www\./, "");
  const site = element("span", "site", state.kind === "ready" ? state.preview.site : host);
  const text = element("span", "text");
  if (state.kind === "loading") {
    text.append(element("span", "bar"), element("span", "bar"), element("span", "bar short"));
  } else if (state.kind === "none") {
    text.append(element("span", "title", anchor.textContent?.replace(/\s+/g, " ").trim() || host));
  } else {
    text.append(element("span", "title", state.preview.title));
    if (state.preview.summary) text.append(element("span", "summary", state.preview.summary));
  }
  const body = element("span", "body");
  body.append(text);
  if (state.kind === "ready" && state.preview.image) body.append(thumbnail(state.preview.image));
  const row = element("span", "link");
  row.append(element("span", "arrow", "↗"), element("span", "address", `${host}${link.pathname === "/" ? "" : link.pathname}`));
  return [site, body, row];
}

function thumbnail(src: string): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "thumb";
  image.alt = "";
  image.referrerPolicy = "no-referrer";
  // Pages whose CSP blocks the image land here too; the card reads fine without it.
  image.addEventListener("error", () => image.remove());
  image.src = src;
  return image;
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
