import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

/** Freshly opened docs — BookReader takes ownership and must destroy. */
const pendingDocs = new Map<string, PDFDocumentProxy>();

let workerWarmStarted = false;

export type OpenedPdf = {
  id: string;
  name: string;
  data: ArrayBuffer;
  pageCount: number;
};

export class PdfOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfOpenError";
  }
}

export function makeDocumentId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
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

    const id = makeDocumentId(file);
    // Drop any prior pending doc for this id so we don't leak workers/proxies.
    const prior = pendingDocs.get(id);
    if (prior) {
      pendingDocs.delete(id);
      void prior.destroy();
    }
    pendingDocs.set(id, pdf);

    return {
      id,
      name: file.name,
      data: owned,
      pageCount,
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
