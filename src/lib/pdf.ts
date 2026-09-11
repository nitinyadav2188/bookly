import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** Freshly opened docs — BookReader takes ownership and must destroy. */
const pendingDocs = new Map<string, PDFDocumentProxy>();

let workerWarmStarted = false;

export type OpenedPdf = {
  /** Stable content hash (SHA-256 hex). Primary key for annotations + library. */
  id: string;
  /** Same as id — explicit alias for annotation storage. */
  hash: string;
  name: string;
  data: ArrayBuffer;
  pageCount: number;
  /** Legacy filename-based key (migration / localStorage bridge). */
  legacyId?: string;
};

export class PdfOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfOpenError";
  }
}

/** Filename-based id — kept for migrating older localStorage annotation keys. */
export function makeDocumentId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

/** Stable SHA-256 of PDF bytes (hex). Falls back to size+sample fingerprint. */
export async function computePdfHash(data: ArrayBuffer): Promise<string> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", data.slice(0));
      const bytes = new Uint8Array(digest);
      let hex = "";
      for (let i = 0; i < bytes.length; i += 1) {
        hex += bytes[i].toString(16).padStart(2, "0");
      }
      return hex;
    }
  } catch {
    // fall through
  }
  // Non-crypto fallback: length + sparse samples (still stable for same bytes).
  const view = new Uint8Array(data);
  let h = view.byteLength >>> 0;
  const step = Math.max(1, Math.floor(view.byteLength / 64));
  for (let i = 0; i < view.byteLength; i += step) {
    h = (Math.imul(h ^ view[i], 0x01000193) >>> 0);
  }
  return `fp-${h.toString(16)}-${view.byteLength.toString(16)}`;
}

export function isPdfFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return file.type === "application/pdf" || name.endsWith(".pdf");
}

/** Prefetch the pdf.js worker so the first open does not wait on a cold fetch. */
export function warmPdfWorker(): void {
  if (workerWarmStarted || typeof window === "undefined") return;
  workerWarmStarted = true;
  // Kick both HTTP cache and browser module/script cache; ignore failures.
  void fetch("/pdf.worker.min.mjs", { credentials: "same-origin", cache: "force-cache" })
    .then((res) => {
      if (!res.ok) throw new Error("worker fetch failed");
      // Drain body so the response is fully cached.
      return res.arrayBuffer();
    })
    .catch(() => {
      workerWarmStarted = false;
    });
}

function asUint8Array(data: ArrayBuffer): Uint8Array {
  return new Uint8Array(data.slice(0));
}

export async function openPdfFromFile(file: File): Promise<OpenedPdf> {
  if (!isPdfFile(file)) {
    throw new PdfOpenError("Please choose a PDF file.");
  }

  warmPdfWorker();

  let data: ArrayBuffer;
  try {
    data = await file.arrayBuffer();
  } catch {
    throw new PdfOpenError("We couldn't open this PDF.");
  }

  if (!data || data.byteLength < 5) {
    throw new PdfOpenError("We couldn't open this PDF.");
  }

  // Keep an owned copy for later re-open (pdf.js may detach the parse buffer).
  const owned = data.slice(0);

  try {
    const pdf = await getDocument({ data: new Uint8Array(data) }).promise;
    const pageCount = pdf.numPages;
    if (!pageCount || pageCount < 1) {
      await pdf.destroy();
      throw new PdfOpenError("We couldn't open this PDF.");
    }

    const legacyId = makeDocumentId(file);
    const hash = await computePdfHash(owned);
    const id = hash;
    // Drop any prior pending doc for this id so we don't leak workers/proxies.
    const prior = pendingDocs.get(id);
    if (prior) {
      pendingDocs.delete(id);
      void prior.destroy();
    }
    pendingDocs.set(id, pdf);

    return {
      id,
      hash,
      name: file.name,
      data: owned,
      pageCount,
      legacyId,
    };
  } catch (err) {
    if (err instanceof PdfOpenError) throw err;
    throw new PdfOpenError("We couldn't open this PDF.");
  }
}

/**
 * Load a PDFDocumentProxy. Prefer the document already parsed during
 * `openPdfFromFile` so the reader does not pay for a second full parse.
 */
export async function loadPdfDocument(
  data: ArrayBuffer,
  documentId?: string,
): Promise<PDFDocumentProxy> {
  if (documentId) {
    const pending = pendingDocs.get(documentId);
    if (pending) {
      pendingDocs.delete(documentId);
      return pending;
    }
  }
  return getDocument({ data: asUint8Array(data) }).promise;
}

export async function renderPdfPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  target: HTMLCanvasElement,
  maxEdge = 1600,
): Promise<void> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxEdge / base.width, maxEdge / base.height, 2.4);
  const viewport = page.getViewport({ scale });
  const context = target.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Canvas unavailable");
  }

  const width = Math.floor(viewport.width);
  const height = Math.floor(viewport.height);
  target.width = width;
  target.height = height;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);

  // pdfjs 4.x uses canvasContext + viewport
  await page.render({
    canvasContext: context,
    viewport,
  }).promise;
}
