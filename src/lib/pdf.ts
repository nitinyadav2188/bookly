import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from "pdfjs-dist";

GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

export type OpenedPdf = {
  id: string;
  name: string;
  data: ArrayBuffer;
  pageCount: number;
};

export function makeDocumentId(file: File): string {
  return `${file.name}::${file.size}::${file.lastModified}`;
}

export async function openPdfFromFile(file: File): Promise<OpenedPdf> {
  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data: data.slice(0) }).promise;
  const pageCount = pdf.numPages;
  await pdf.cleanup();
  return {
    id: makeDocumentId(file),
    name: file.name,
    data,
    pageCount,
  };
}

export async function loadPdfDocument(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  return getDocument({ data: data.slice(0) }).promise;
}

export async function renderPdfPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  target: HTMLCanvasElement,
  maxEdge = 1400,
): Promise<void> {
  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(maxEdge / base.width, maxEdge / base.height, 2.2);
  const viewport = page.getViewport({ scale });
  const context = target.getContext("2d", { alpha: false });
  if (!context) return;

  target.width = Math.floor(viewport.width);
  target.height = Math.floor(viewport.height);

  context.fillStyle = "#fffcf7";
  context.fillRect(0, 0, target.width, target.height);

  await page.render({
    canvasContext: context,
    viewport,
    canvas: target,
  }).promise;
}
