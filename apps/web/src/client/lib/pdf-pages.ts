// A PDF as its real pages in the reader: pdf.js draws pages near the screen and drops far ones, the page flows with the article.
import { pdfRuns, type PdfRun } from "@lumen/core";
import { PdfText, markLineEnds } from "@lumen/core/pdf-dom";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export interface ShownPdf {
  /** Every page's text, read after the first pages are drawn. */
  text: Promise<PdfText>;
  destroy(): void;
}

// pdf.js page border on each side (pdf_viewer.css `--page-border`), so a page fits the column exactly.
const PAGE_BORDER = 9;

/** Draws the PDF at `url` as pages inside `container`, page 1 first; `onLayer` gets each text layer once it is ready for marks. */
export async function showPdfPages(url: string, container: HTMLDivElement, onLayer: (layer: HTMLElement) => void): Promise<ShownPdf> {
  // Our own worker, started now so it downloads alongside the core library instead of after it.
  const port = new Worker(workerSrc, { type: "module" });
  try {
    return await openPdf(url, port, container, onLayer);
  } catch (error) {
    port.terminate();
    throw error;
  }
}

async function openPdf(url: string, port: Worker, container: HTMLDivElement, onLayer: (layer: HTMLElement) => void): Promise<ShownPdf> {
  const styles = import("pdfjs-dist/legacy/web/pdf_viewer.css");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = pdfjs.PDFWorker.create({ port });
  // By URL, so pdf.js asks for the ranges page 1 needs first and streams the rest of the file behind them.
  const task = pdfjs.getDocument({ url, worker, httpHeaders: { "x-lumen": "1" }, cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
  // The viewer module reads the core library from this global when it loads; it downloads while the file opens.
  Object.assign(globalThis, { pdfjsLib: pdfjs });
  const [doc, { EventBus, PDFPageView, RenderingStates }] = await Promise.all([task.promise, import("pdfjs-dist/legacy/web/pdf_viewer.mjs"), styles]);
  const eventBus = new EventBus();
  eventBus.on("textlayerrendered", ({ source }: { source: { textLayer: { div: HTMLElement } | null } }) => {
    if (!source.textLayer) return;
    markLineEnds(source.textLayer.div);
    onLayer(source.textLayer.div);
  });

  const first = await doc.getPage(1);
  const widthOf = (page: typeof first) => page.getViewport({ scale: 1 }).width;
  // One scale for every page: pdf.js sizes pages from a single --scale-factor on the container.
  let widest = widthOf(first);
  const fitScale = () => (container.clientWidth - 2 * PAGE_BORDER) / (widest * pdfjs.PixelsPerInch.PDF_TO_CSS_UNITS);
  const scale = fitScale();
  // Every slot starts at page 1's size, so page 1 draws without waiting for the others to load.
  const defaultViewport = first.getViewport({ scale: scale * pdfjs.PixelsPerInch.PDF_TO_CSS_UNITS });
  const views: InstanceType<typeof PDFPageView>[] = [];
  for (let number = 1; number <= doc.numPages; number++) views.push(new PDFPageView({ container, eventBus, id: number, scale, defaultViewport }));
  views[0].setPdfPage(first);

  // Draw pages a screen away; drop canvases three screens away so a long paper does not fill memory.
  const nearby = new Set<InstanceType<typeof PDFPageView>>();
  const draw = (view: InstanceType<typeof PDFPageView>) => {
    if (view.renderingState !== RenderingStates.INITIAL || !view.pdfPage) return;
    view.draw().catch((error: Error) => { if (error.name !== "RenderingCancelledException") console.warn("pdf.js could not draw a page", error); });
  };
  const viewOf = (target: Element) => views[Number((target as HTMLElement).dataset.pageNumber) - 1];
  const near = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const view = viewOf(entry.target);
      if (!view) continue;
      if (entry.isIntersecting) { nearby.add(view); draw(view); } else nearby.delete(view);
    }
  }, { rootMargin: "100% 0px" });
  const far = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const view = viewOf(entry.target);
      if (!entry.isIntersecting && view && view.renderingState !== RenderingStates.INITIAL) view.reset();
    }
  }, { rootMargin: "300% 0px" });
  for (const view of views) { near.observe(view.div); far.observe(view.div); }

  // A standalone page waits to be drawn again after update.
  const rescale = () => {
    const next = fitScale();
    for (const view of views) view.update({ scale: next });
    for (const view of nearby) draw(view);
  };
  // The column narrows with the window: pages follow its width.
  let lastWidth = container.clientWidth;
  let frame = 0;
  const resized = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    // Next frame: resizing pages inside the observer's own callback loops it.
    frame = requestAnimationFrame(() => {
      if (container.clientWidth === lastWidth) return;
      lastWidth = container.clientWidth;
      rescale();
    });
  });
  resized.observe(container);

  // The other pages and every page's text load after page 1 is on screen; neither is needed for the first pixel.
  let closed = false;
  const text = (async () => {
    const pages = [first];
    for (let number = 2; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const view = views[number - 1];
      view.setPdfPage(page);
      if (nearby.has(view)) draw(view);
      pages.push(page);
    }
    const widestPage = Math.max(...pages.map(widthOf));
    if (widestPage > widest) { widest = widestPage; rescale(); }
    const runs: PdfRun[][] = [];
    for (const page of pages) runs.push(pdfRuns((await page.getTextContent()).items));
    return new PdfText(runs);
  })().catch((error: Error) => {
    // A document closed mid-read never delivers its text, rather than failing a reader that already left.
    if (closed) return new Promise<PdfText>(() => {});
    throw error;
  });

  return {
    text,
    destroy() {
      closed = true;
      near.disconnect();
      far.disconnect();
      resized.disconnect();
      cancelAnimationFrame(frame);
      // The divs go too: a document opened after its reader left must leave nothing behind.
      for (const view of views) { view.destroy(); view.div.remove(); }
      // pdf.js leaves a worker it was handed running, so it goes once the document has closed.
      task.destroy()
        .catch((error: Error) => console.warn("pdf.js did not close cleanly", error))
        .finally(() => { worker.destroy(); port.terminate(); });
    },
  };
}
