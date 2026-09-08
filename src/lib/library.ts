import type { DocAnnotations } from "@/lib/annotations";
import type { OpenedPdf } from "@/lib/pdf";

const DB_NAME = "bookly-library";
const DB_VERSION = 1;
const STORE = "books";

/** Soft cap: keep at most this many books (LRU by lastOpenedAt). */
export const MAX_STORED_BOOKS = 3;

/** Soft cap per book (~80 MiB). Larger PDFs still open in-session but are not persisted. */
export const MAX_BOOK_BYTES = 80 * 1024 * 1024;

export type LibraryBookMeta = {
  id: string;
  name: string;
  pageCount: number;
  byteLength: number;
  savedAt: number;
  lastOpenedAt: number;
  lastPage: number;
};

export type LibraryBookRecord = LibraryBookMeta & {
  data: ArrayBuffer;
  annotations: DocAnnotations;
};

export type LibrarySaveResult =
  | { ok: true; skipped?: false }
  | { ok: true; skipped: true; reason: "too-large" }
  | { ok: false; reason: "quota" | "unavailable" | "unknown"; message: string };

function emptyAnnots(): DocAnnotations {
  return { highlights: [], notes: [] };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("lastOpenedAt", "lastOpenedAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open library DB"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; message?: string };
  if (e.name === "QuotaExceededError") return true;
  const msg = (e.message ?? "").toLowerCase();
  return msg.includes("quota") || msg.includes("storage");
}

async function listRecords(db: IDBDatabase): Promise<LibraryBookRecord[]> {
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);
  const rows = await reqToPromise(store.getAll());
  await txDone(tx);
  return (rows as LibraryBookRecord[]) ?? [];
}

async function deleteIds(db: IDBDatabase, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await txDone(tx);
}

/** Evict least-recently-opened books until count ≤ max (excluding keepId). */
async function evictLru(db: IDBDatabase, keepId: string, max = MAX_STORED_BOOKS): Promise<void> {
  const rows = await listRecords(db);
  const others = rows
    .filter((r) => r.id !== keepId)
    .sort((a, b) => (a.lastOpenedAt ?? 0) - (b.lastOpenedAt ?? 0));
  const overflow = Math.max(0, others.length + 1 - max);
  if (overflow <= 0) return;
  await deleteIds(
    db,
    others.slice(0, overflow).map((r) => r.id),
  );
}

function normalizeRecord(raw: Partial<LibraryBookRecord> & { id: string }): LibraryBookRecord | null {
  if (!raw.data || !(raw.data instanceof ArrayBuffer) || raw.data.byteLength < 5) return null;
  const pageCount = Number(raw.pageCount);
  if (!Number.isFinite(pageCount) || pageCount < 1) return null;
  const annots = raw.annotations;
  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name ? raw.name : "book.pdf",
    pageCount,
    byteLength: raw.data.byteLength,
    savedAt: Number(raw.savedAt) || Date.now(),
    lastOpenedAt: Number(raw.lastOpenedAt) || Date.now(),
    lastPage: Math.max(0, Number(raw.lastPage) || 0),
    data: raw.data,
    annotations: {
      highlights: Array.isArray(annots?.highlights) ? annots.highlights : [],
      notes: Array.isArray(annots?.notes) ? annots.notes : [],
    },
  };
}

export async function getLibraryBook(id: string): Promise<LibraryBookRecord | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const raw = await reqToPromise(tx.objectStore(STORE).get(id));
      await txDone(tx);
      if (!raw) return null;
      return normalizeRecord(raw as LibraryBookRecord);
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

/** Most recently opened book metadata (no PDF bytes). */
export async function getLatestLibraryMeta(): Promise<LibraryBookMeta | null> {
  try {
    const db = await openDb();
    try {
      const rows = await listRecords(db);
      if (!rows.length) return null;
      rows.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
      const top = normalizeRecord(rows[0]);
      if (!top) return null;
      const { data: _data, annotations: _a, ...meta } = top;
      return meta;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function openLibraryBook(id: string): Promise<OpenedPdf | null> {
  const record = await getLibraryBook(id);
  if (!record) return null;

  // Touch lastOpenedAt without rewriting the large blob when possible.
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const existing = (await reqToPromise(store.get(id))) as LibraryBookRecord | undefined;
      if (existing) {
        existing.lastOpenedAt = Date.now();
        store.put(existing);
      }
      await txDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // ignore touch failures
  }

  return {
    id: record.id,
    name: record.name,
    data: record.data.slice(0),
    pageCount: record.pageCount,
  };
}

export async function saveLibraryBook(input: {
  id: string;
  name: string;
  data: ArrayBuffer;
  pageCount: number;
  lastPage?: number;
  annotations?: DocAnnotations;
}): Promise<LibrarySaveResult> {
  if (input.data.byteLength > MAX_BOOK_BYTES) {
    return { ok: true, skipped: true, reason: "too-large" };
  }

  try {
    const db = await openDb();
    try {
      await evictLru(db, input.id);

      const existing = await (async () => {
        const tx = db.transaction(STORE, "readonly");
        const raw = await reqToPromise(tx.objectStore(STORE).get(input.id));
        await txDone(tx);
        return raw as LibraryBookRecord | undefined;
      })();

      const now = Date.now();
      const record: LibraryBookRecord = {
        id: input.id,
        name: input.name,
        data: input.data.slice(0),
        pageCount: input.pageCount,
        byteLength: input.data.byteLength,
        savedAt: existing?.savedAt ?? now,
        lastOpenedAt: now,
        lastPage:
          input.lastPage != null
            ? Math.max(0, input.lastPage)
            : Math.max(0, existing?.lastPage ?? 0),
        annotations: input.annotations
          ? {
              highlights: [...input.annotations.highlights],
              notes: [...input.annotations.notes],
            }
          : existing?.annotations
            ? {
                highlights: [...(existing.annotations.highlights ?? [])],
                notes: [...(existing.annotations.notes ?? [])],
              }
            : emptyAnnots(),
      };

      const write = async () => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(record);
        await txDone(tx);
      };

      try {
        await write();
      } catch (err) {
        if (!isQuotaError(err)) throw err;
        // Evict everything except this book and retry once.
        const rows = await listRecords(db);
        await deleteIds(
          db,
          rows.filter((r) => r.id !== input.id).map((r) => r.id),
        );
        try {
          await write();
        } catch (err2) {
          if (isQuotaError(err2)) {
            return {
              ok: false,
              reason: "quota",
              message: "Not enough browser storage to keep this book for resume.",
            };
          }
          throw err2;
        }
      }

      return { ok: true };
    } finally {
      db.close();
    }
  } catch (err) {
    if (isQuotaError(err)) {
      return {
        ok: false,
        reason: "quota",
        message: "Not enough browser storage to keep this book for resume.",
      };
    }
    const msg = err instanceof Error ? err.message : "Could not save book locally.";
    if (msg.toLowerCase().includes("unavailable") || typeof indexedDB === "undefined") {
      return { ok: false, reason: "unavailable", message: msg };
    }
    return { ok: false, reason: "unknown", message: msg };
  }
}

export async function updateLibraryProgress(
  id: string,
  patch: { lastPage?: number; annotations?: DocAnnotations },
): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const existing = (await reqToPromise(store.get(id))) as LibraryBookRecord | undefined;
      if (!existing) {
        await txDone(tx);
        return;
      }
      if (patch.lastPage != null) {
        existing.lastPage = Math.max(0, patch.lastPage);
      }
      if (patch.annotations) {
        existing.annotations = {
          highlights: [...patch.annotations.highlights],
          notes: [...patch.annotations.notes],
        };
      }
      existing.lastOpenedAt = Date.now();
      store.put(existing);
      await txDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // ignore — progress is best-effort
  }
}

export async function getLibraryLastPage(id: string): Promise<number | null> {
  const book = await getLibraryBook(id);
  if (!book) return null;
  return Number.isFinite(book.lastPage) && book.lastPage >= 0 ? book.lastPage : null;
}

export async function getLibraryAnnotations(id: string): Promise<DocAnnotations | null> {
  const book = await getLibraryBook(id);
  if (!book) return null;
  return book.annotations ?? emptyAnnots();
}

/** Sensible download filename from a book name. */
export function downloadFileName(name: string, ext = "pdf"): string {
  const base = name.replace(/\.[^.]+$/, "").trim() || "book";
  const safe = base.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  return `${safe}.${ext}`;
}

export function downloadArrayBuffer(data: ArrayBuffer, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export function downloadJson(value: unknown, filename: string): void {
  const json = JSON.stringify(value, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

export type BookDownloadBundle = {
  pdfName: string;
  annotationsName?: string;
};

/** Download original PDF bytes; if annotations exist, also download a sidecar JSON. */
export function downloadBookBundle(
  doc: { name: string; data: ArrayBuffer },
  annotations?: DocAnnotations | null,
): BookDownloadBundle {
  const pdfName = downloadFileName(doc.name, "pdf");
  downloadArrayBuffer(doc.data.slice(0), pdfName, "application/pdf");

  const hasAnnots =
    annotations &&
    ((annotations.highlights?.length ?? 0) > 0 || (annotations.notes?.length ?? 0) > 0);

  if (!hasAnnots || !annotations) {
    return { pdfName };
  }

  const annotationsName = downloadFileName(doc.name, "annotations.json");
  downloadJson(
    {
      book: doc.name,
      exportedAt: new Date().toISOString(),
      highlights: annotations.highlights,
      notes: annotations.notes,
    },
    annotationsName,
  );
  return { pdfName, annotationsName };
}
