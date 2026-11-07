// Lumen's PDF viewer: pdf.js draws each page with its text layer, and Lumen works on that text as on a web page.
import "pdfjs-dist/legacy/web/pdf_viewer.css";
import "../../lib/ui.css";
import "./viewer.css";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { PDF_MAX_BYTES, PDF_MAX_PAGES, isPdfBytes, pdfParagraphs, pdfRuns, pdfTitle, type PdfInfo, type PdfRun } from "@lumen/core";
import { cloud, cloudApi } from "../../lib/cloud";
import { getSettings, pageKey } from "../../lib/storage";
import { applyPageTheme } from "../../lib/theme";
import type { Settings } from "../../lib/types";
import { Lumen } from "../content/lumen";
import { markLineEnds } from "@lumen/core/pdf-dom";
import { PdfSurface } from "./surface";

const file = new URLSearchParams(location.search).get("file") ?? "";
let title = fileName(file);

const titleEl = document.querySelector<HTMLElement>("[data-title]")!;
const pagesEl = document.querySelector<HTMLElement>("[data-pages]")!;
const stateEl = document.querySelector<HTMLElement>("[data-state]")!;
const zoomEl = document.querySelector<HTMLElement>("[data-zoom-level]")!;
const FIT_SCALES = ["auto", "page-fit", "page-width"];

chrome.runtime.sendMessage({ type: "GET_SETTINGS" })
  .then((reply: { settings: Settings }) => applyPageTheme(reply?.settings?.theme ?? "system"))
  .catch(() => applyPageTheme("system"));

document.querySelector<HTMLButtonElement>("[data-bypass]")!.onclick = async () => {
  if (!/^https?:/.test(file)) return;
  await chrome.runtime.sendMessage({ type: "PDF_BYPASS", url: file });
  location.replace(file);
};

open().catch((error) => {
  console.warn("Lumen could not show the PDF", error);
  showProblem();
});

function fileName(address: string): string {
  try {
    const url = new URL(address);
    return decodeURIComponent(url.pathname.split("/").pop() ?? "") || url.hostname;
  } catch {
    return "PDF";
  }
}

function showProblem() {
  stateEl.hidden = false;
  stateEl.querySelector("[data-state-title]")!.textContent = "This PDF could not be opened here.";
  stateEl.querySelector("[data-state-body]")!.textContent = "Browser viewer, at the top right, opens it the usual way.";
}

async function open() {
  titleEl.textContent = document.title = title;
  if (!/^https?:/.test(file)) return showProblem();
  // Sent with the browser's cookies, so a PDF behind a sign in opens as it did before.
  const response = await fetch(file, { credentials: "include" });
  const bytes = response.ok ? await response.arrayBuffer() : null;
  if (!bytes || !isPdfBytes(new Uint8Array(bytes, 0, Math.min(5, bytes.byteLength)))) return showProblem();

  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  // The viewer component reads the core library from this global when its module loads.
  Object.assign(globalThis, { pdfjsLib: pdfjs });
  const { EventBus, LinkTarget, PDFLinkService, PDFViewer } = await import("pdfjs-dist/legacy/web/pdf_viewer.mjs");
  const container = document.querySelector<HTMLDivElement>("#viewerContainer")!;
  const viewerEl = document.querySelector<HTMLDivElement>("#viewer")!;
  const eventBus = new EventBus();
  const linkService = new PDFLinkService({ eventBus, externalLinkTarget: LinkTarget.BLANK });
  const viewer = new PDFViewer({ container, viewer: viewerEl, eventBus, linkService });
  linkService.setViewer(viewer);

  const assets = (folder: string) => chrome.runtime.getURL(`/pdfjs/${folder}/`);
  // pdf.js hands its copy of the bytes to the worker; the original stays for the upload.
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), cMapUrl: assets("cmaps"), cMapPacked: true, standardFontDataUrl: assets("standard_fonts"), wasmUrl: assets("wasm") }).promise;
  viewer.setDocument(doc);
  linkService.setDocument(doc);
  stateEl.hidden = true;
  pagesEl.textContent = `1 / ${doc.numPages}`;
  // "auto" fills the width but caps the zoom, so a portrait page on a wide screen is not blown up.
  eventBus.on("pagesinit", () => { viewer.currentScaleValue = "auto"; });
  eventBus.on("pagechanging", ({ pageNumber }: { pageNumber: number }) => { pagesEl.textContent = `${pageNumber} / ${doc.numPages}`; });
  eventBus.on("scalechanging", ({ scale }: { scale: number }) => { zoomEl.textContent = `${Math.round(scale * 100)}%`; });
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-zoom]")) {
    button.onclick = () => { if (button.dataset.zoom === "in") viewer.increaseScale(); else viewer.decreaseScale(); };
  }
  document.querySelector<HTMLButtonElement>("[data-fit]")!.onclick = () => { viewer.currentScaleValue = "page-fit"; };
  // The viewer component does not refit on its own; the full pdf.js app does this on resize too.
  window.addEventListener("resize", () => {
    if (FIT_SCALES.includes(viewer.currentScaleValue)) viewer.currentScaleValue = viewer.currentScaleValue;
  });

  const { info } = await doc.getMetadata();
  title = pdfTitle(info) ?? title;
  titleEl.textContent = document.title = title;

  let wantsSync = false;
  const surface = new PdfSurface(viewerEl, file, () => title, () => {
    wantsSync = true;
    syncToLumen(surface, bytes).catch((error) => console.warn("Lumen could not store this PDF's text or file", error));
  });
  const lumen = new Lumen(surface);
  lumen.start();
  eventBus.on("textlayerrendered", ({ source }: { source: { textLayer: { div: HTMLElement } | null } }) => {
    if (source.textLayer) markLineEnds(source.textLayer.div);
    lumen.paint();
  });

  const runs: PdfRun[][] = [];
  for (let number = 1; number <= doc.numPages; number++) {
    const page = await doc.getPage(number);
    runs.push(pdfRuns((await page.getTextContent()).items));
  }
  surface.setText(runs);
  lumen.paint();
  if (wantsSync) syncToLumen(surface, bytes).catch((error) => console.warn("Lumen could not store this PDF's text or file", error));
}

let synced = false;

/** After the first save or highlight: give the library item this PDF's text and file, as an upload in the web app would. */
async function syncToLumen(surface: PdfSurface, bytes: ArrayBuffer) {
  if (synced || !surface.runs.length) return;
  const found = await cloudApi.lookup(pageKey(file));
  if (!found.item) return;
  synced = true;
  const itemId = found.item.id;
  const { item } = await cloud<{ item: { pdf?: PdfInfo } }>("GET", `/items/${itemId}`);
  const pdf = item.pdf;
  if (!pdf || pdf.locked) return;
  const pageCount = surface.runs.length;
  if ((pdf.text === "pending" || pdf.text === "failed") && pageCount <= PDF_MAX_PAGES) {
    await cloud("PUT", `/items/${itemId}/text`, { sha256: await sha256Hex(bytes), pageCount, pages: pdfParagraphs(surface.runs) });
  }
  if (!pdf.hasFile && bytes.byteLength <= PDF_MAX_BYTES) await uploadFile(itemId, bytes);
}

async function uploadFile(itemId: string, bytes: ArrayBuffer) {
  const settings = await getSettings();
  const response = await fetch(`${settings.apiBase}/api/v1/items/${itemId}/file`, {
    method: "PUT",
    headers: { authorization: `Bearer ${settings.token}`, "content-type": "application/pdf" },
    body: bytes,
  });
  if (!response.ok) throw new Error(`Lumen answered ${response.status} to the PDF upload`);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
