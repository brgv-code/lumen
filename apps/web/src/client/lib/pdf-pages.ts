// A PDF as its real pages in the reader: pdf.js draws pages near the screen and drops far ones, the page flows with the article.
import { pdfRuns, type PdfRun } from "@lumen/core";
import { PdfText, markLineEnds } from "@lumen/core/pdf-dom";

export interface ShownPdf {
  text: PdfText;
  destroy(): void;
}

// pdf.js page border on each side (pdf_viewer.css `--page-border`), so a page fits the column exactly.
const PAGE_BORDER = 9;

/** Draws `bytes` as pages inside `container`; `onLayer` gets each text layer once it is ready for marks. */
export async function showPdfPages(bytes: ArrayBuffer, container: HTMLDivElement, onLayer: (layer: HTMLElement) => void): Promise<ShownPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSrc } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  // The viewer module reads the core library from this global when it loads.
  Object.assign(globalThis, { pdfjsLib: pdfjs });
  const [{ EventBus, PDFPageView, RenderingStates }] = await Promise.all([import("pdfjs-dist/legacy/web/pdf_viewer.mjs"), import("pdfjs-dist/legacy/web/pdf_viewer.css")]);

  // pdf.js hands its copy of the bytes to its worker.
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)), cMapUrl: "/pdfjs/cmaps/", cMapPacked: true, standardFontDataUrl: "/pdfjs/standard_fonts/", wasmUrl: "/pdfjs/wasm/" });
  const doc = await task.promise;
  const eventBus = new EventBus();
  eventBus.on("textlayerrendered", ({ source }: { source: { textLayer: { div: HTMLElement } | null } }) => {
    if (!source.textLayer) return;
    markLineEnds(source.textLayer.div);
    onLayer(source.textLayer.div);
  });

  const pages = [];
  for (let number = 1; number <= doc.numPages; number++) pages.push(await doc.getPage(number));
  // One scale for every page: pdf.js sizes pages from a single --scale-factor on the container.
  const widest = Math.max(...pages.map((page) => page.getViewport({ scale: 1 }).width));
  const fitScale = () => (container.clientWidth - 2 * PAGE_BORDER) / (widest * pdfjs.PixelsPerInch.PDF_TO_CSS_UNITS);
  const scale = fitScale();
  const views = pages.map((page, index) => {
    const view = new PDFPageView({ container, eventBus, id: index + 1, scale, defaultViewport: page.getViewport({ scale: scale * pdfjs.PixelsPerInch.PDF_TO_CSS_UNITS }) });
    view.setPdfPage(page);
    return view;
  });
  const runs: PdfRun[][] = [];
  for (const page of pages) runs.push(pdfRuns((await page.getTextContent()).items));

  // Draw pages a screen away; drop canvases three screens away so a long paper does not fill memory.
  const nearby = new Set<InstanceType<typeof PDFPageView>>();
  const draw = (view: InstanceType<typeof PDFPageView>) => {
    if (view.renderingState !== RenderingStates.INITIAL) return;
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

  // The column narrows with the window: pages follow its width. A standalone page waits to be drawn again after update.
  let lastWidth = container.clientWidth;
  let frame = 0;
  const resized = new ResizeObserver(() => {
    cancelAnimationFrame(frame);
    // Next frame: resizing pages inside the observer's own callback loops it.
    frame = requestAnimationFrame(() => {
      if (container.clientWidth === lastWidth) return;
      lastWidth = container.clientWidth;
      const next = fitScale();
      for (const view of views) view.update({ scale: next });
      for (const view of nearby) draw(view);
    });
  });
  resized.observe(container);

  return {
    text: new PdfText(runs),
    destroy() {
      near.disconnect();
      far.disconnect();
      resized.disconnect();
      cancelAnimationFrame(frame);
      // The divs go too: a document opened after its reader left must leave nothing behind.
      for (const view of views) { view.destroy(); view.div.remove(); }
      task.destroy().catch((error: Error) => console.warn("pdf.js did not close cleanly", error));
    },
  };
}
