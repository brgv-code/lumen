// Browser side of PDFs: every check and all parsing happen here, the worker only stores.
import { PDF_MAX_BYTES, PDF_MAX_PAGES, isPdfBytes, pdfParagraphs, type Item, type PdfInfo, type PdfRun } from "@lumen/core";
import { api } from "./api";

export interface ParsedPdf {
  sha256: string;
  bytes: number;
  pageCount: number;
  pages: string[][];
  title: string | null;
}

export type PdfProblem = "not_pdf" | "too_large" | "too_many_pages" | "unreadable";
export type ParseResult = { ok: true; pdf: ParsedPdf } | { ok: false; problem: PdfProblem };

export const PROBLEM_TEXT: Record<PdfProblem, string> = {
  not_pdf: "That file is not a PDF.",
  too_large: "PDFs can be up to 25 MB.",
  too_many_pages: `PDFs can have up to ${PDF_MAX_PAGES} pages.`,
  unreadable: "This PDF could not be read.",
};

export async function parsePdf(file: ArrayBuffer): Promise<ParseResult> {
  if (file.byteLength > PDF_MAX_BYTES) return { ok: false, problem: "too_large" };
  if (!isPdfBytes(new Uint8Array(file, 0, Math.min(5, file.byteLength)))) return { ok: false, problem: "not_pdf" };
  const sha256 = await sha256Hex(file);
  // Loaded on demand: pdf.js is large and most pages never need it. Legacy build: the modern one needs Uint8Array.toHex.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { default: workerSrc } = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  // pdf.js transfers the buffer to its worker, so it gets a copy and the caller keeps the original for upload.
  const task = pdfjs.getDocument({ data: new Uint8Array(file.slice(0)) });
  try {
    const doc = await task.promise;
    if (doc.numPages > PDF_MAX_PAGES) return { ok: false, problem: "too_many_pages" };
    const runs: PdfRun[][] = [];
    for (let number = 1; number <= doc.numPages; number++) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      runs.push(content.items.flatMap((entry) => ("str" in entry ? [{ text: entry.str, y: entry.transform[5], height: entry.height || Math.abs(entry.transform[3]), endsLine: entry.hasEOL }] : [])));
      page.cleanup();
    }
    const { info } = await doc.getMetadata();
    return { ok: true, pdf: { sha256, bytes: file.byteLength, pageCount: doc.numPages, pages: pdfParagraphs(runs), title: titleFrom(info) } };
  } catch (error) {
    console.warn("pdf.js could not read the file", error);
    return { ok: false, problem: "unreadable" };
  } finally {
    await task.destroy();
  }
}

/** The PDF's own Title, when the producer filled it with something better than a file name. */
function titleFrom(info: unknown): string | null {
  if (!info || typeof info !== "object" || !("Title" in info) || typeof info.Title !== "string") return null;
  const title = info.Title.trim();
  return title && !/\.(pdf|docx?|tex)$/i.test(title) ? title : null;
}

async function sha256Hex(file: ArrayBuffer): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", file));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Diagram 3: parse, create the item with its text, then store the file. A failed upload still leaves a readable item. */
export async function addLocalPdf(file: File): Promise<{ item: Item; fileStored: boolean }> {
  const bytes = await file.arrayBuffer();
  const parsed = await parsePdf(bytes);
  if (!parsed.ok) throw new Error(PROBLEM_TEXT[parsed.problem]);
  const { sha256, pageCount, pages, title } = parsed.pdf;
  const { item, created } = await api.createPdf({ title: title ?? file.name.replace(/\.pdf$/i, ""), sha256, bytes: bytes.byteLength, pageCount, pages });
  if (!created) return { item, fileStored: true };
  try {
    await api.uploadPdfFile(item.id, bytes);
    return { item, fileStored: true };
  } catch (error) {
    console.warn("PDF text saved, file upload failed", error);
    return { item, fileStored: false };
  }
}

/** Diagram 2: a saved link's first open. The worker fetches and stores the file, the browser parses it. */
export async function parseSavedPdf(itemId: string): Promise<{ contentHtml: string | null; pdf: PdfInfo }> {
  const bytes = await api.pdfFile(itemId);
  const parsed = await parsePdf(bytes);
  if (!parsed.ok) {
    await api.savePdfText(itemId, { failed: true });
    throw new Error(PROBLEM_TEXT[parsed.problem]);
  }
  const { sha256, pageCount, pages } = parsed.pdf;
  return api.savePdfText(itemId, { sha256, pageCount, pages });
}
