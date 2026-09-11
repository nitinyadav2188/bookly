/**
 * Página physical-book annotation model.
 * Marks feel like paper/ink; chrome stays neo-brutal.
 * Never mutates the original PDF — everything lives in IndexedDB by content hash.
 */

export type HighlightColor = "yellow" | "blue" | "green" | "pink" | "orange";

export type ColorMeaning =
  | "important"
  | "definition"
  | "example"
  | "question"
  | "review"
  | "none";

/** Sticky note paper color. */
export type NoteVibe = "yellow" | "green" | "blue" | "pink" | "orange";

export type AnnotTool = "highlight" | "note" | "pen" | "eraser" | "bookmark";

export type PenInk = "black" | "red" | "blue";
export type PenWidth = "thin" | "medium" | "thick";
export type StrokeKind = "pen" | "highlighter";

export type PageHighlight = {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: HighlightColor;
  meaning?: ColorMeaning;
  /** Optional excerpt / selection context (best-effort). */
  text?: string;
  /** Note attached to this highlight. */
  note?: string;
  createdAt: number;
  tags?: string[];
};

export type PageNote = {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  vibe: NoteVibe;
  rotation?: number;
  createdAt: number;
  tags?: string[];
};

export type PageBookmark = {
  id: string;
  page: number;
  label?: string;
  createdAt: number;
};

export type StrokePoint = { x: number; y: number };

export type PageStroke = {
  id: string;
  page: number;
  kind: StrokeKind;
  /** Pen ink or highlighter color id. */
  color: string;
  width: PenWidth;
  points: StrokePoint[];
  createdAt: number;
};

export type DocAnnotations = {
  version: 2;
  pdfHash: string;
  highlights: PageHighlight[];
  notes: PageNote[];
  bookmarks: PageBookmark[];
  strokes: PageStroke[];
};

const LS_PREFIX = "bookly:annots:v1:";
const IDB_NAME = "pagina-annotations";
const IDB_VERSION = 1;
const IDB_STORE = "byHash";

export const ANNOT_HISTORY_LIMIT = 50;

export const HIGHLIGHT_COLORS: {
  id: HighlightColor;
  label: string;
  meaning: Exclude<ColorMeaning, "none">;
  css: string;
  solid: string;
}[] = [
  {
    id: "yellow",
    label: "Yellow",
    meaning: "important",
    css: "rgba(255, 220, 60, 0.42)",
    solid: "#ffdc3c",
  },
  {
    id: "blue",
    label: "Blue",
    meaning: "definition",
    css: "rgba(90, 170, 255, 0.38)",
    solid: "#5aaaff",
  },
  {
    id: "green",
    label: "Green",
    meaning: "example",
    css: "rgba(110, 210, 120, 0.4)",
    solid: "#6ed278",
  },
  {
    id: "pink",
    label: "Pink",
    meaning: "question",
    css: "rgba(255, 130, 190, 0.38)",
    solid: "#ff82be",
  },
  {
    id: "orange",
    label: "Orange",
    meaning: "review",
    css: "rgba(255, 160, 60, 0.4)",
    solid: "#ffa03c",
  },
];

export const COLOR_MEANINGS: { id: ColorMeaning; label: string; color?: HighlightColor }[] = [
  { id: "none", label: "No meaning" },
  { id: "important", label: "Important", color: "yellow" },
  { id: "definition", label: "Definition", color: "blue" },
  { id: "example", label: "Example", color: "green" },
  { id: "question", label: "Question", color: "pink" },
  { id: "review", label: "Review", color: "orange" },
];

export const NOTE_VIBES: { id: NoteVibe; label: string; paper: string; fold: string }[] = [
  { id: "yellow", label: "Yellow", paper: "#fff3a0", fold: "#e8d56a" },
  { id: "green", label: "Green", paper: "#c8f0c0", fold: "#9ad090" },
  { id: "blue", label: "Blue", paper: "#c8e4ff", fold: "#96c0e8" },
  { id: "pink", label: "Pink", paper: "#ffd0e4", fold: "#e8a0c0" },
  { id: "orange", label: "Orange", paper: "#ffd8a8", fold: "#e8b878" },
];

export const PEN_INKS: { id: PenInk; css: string; label: string }[] = [
  { id: "black", css: "#1a1510", label: "Black" },
  { id: "red", css: "#c62828", label: "Red" },
  { id: "blue", css: "#1565c0", label: "Blue" },
];

export const PEN_WIDTHS: { id: PenWidth; px: number; label: string }[] = [
  { id: "thin", px: 1.6, label: "Thin" },
  { id: "medium", px: 2.8, label: "Medium" },
  { id: "thick", px: 4.6, label: "Thick" },
];

export function emptyAnnotations(pdfHash = ""): DocAnnotations {
  return {
    version: 2,
    pdfHash,
    highlights: [],
    notes: [],
    bookmarks: [],
    strokes: [],
  };
}

export function highlightFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.css ?? HIGHLIGHT_COLORS[0].css;
}

export function highlightSolid(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.solid ?? HIGHLIGHT_COLORS[0].solid;
}

export function defaultMeaningForColor(color: HighlightColor): ColorMeaning {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.meaning ?? "important";
}

export function noteVibeLabel(vibe: NoteVibe): string {
  return NOTE_VIBES.find((v) => v.id === vibe)?.label ?? "Yellow";
}

export function notePaper(vibe: NoteVibe): { paper: string; fold: string } {
  const found = NOTE_VIBES.find((v) => v.id === vibe);
  return { paper: found?.paper ?? "#fff3a0", fold: found?.fold ?? "#e8d56a" };
}

export function penWidthPx(width: PenWidth, kind: StrokeKind): number {
  const base = PEN_WIDTHS.find((w) => w.id === width)?.px ?? 2.8;
  return kind === "highlighter" ? base * 3.2 : base;
}

export function makeAnnotId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeColor(raw: unknown): HighlightColor {
  if (raw === "lime" || raw === "red") return raw === "red" ? "orange" : "green";
  if (
    raw === "yellow" ||
    raw === "blue" ||
    raw === "green" ||
    raw === "pink" ||
    raw === "orange"
  ) {
    return raw;
  }
  return "yellow";
}

function normalizeVibe(raw: unknown): NoteVibe {
  if (raw === "red") return "orange";
  if (
    raw === "yellow" ||
    raw === "green" ||
    raw === "blue" ||
    raw === "pink" ||
    raw === "orange"
  ) {
    return raw;
  }
  return "yellow";
}

function normalizeMeaning(raw: unknown, color: HighlightColor): ColorMeaning {
  if (
    raw === "important" ||
    raw === "definition" ||
    raw === "example" ||
    raw === "question" ||
    raw === "review" ||
    raw === "none"
  ) {
    return raw;
  }
  return defaultMeaningForColor(color);
}

export function sanitizeAnnotations(
  parsed: Partial<DocAnnotations> & { highlights?: unknown; notes?: unknown },
  pdfHash = "",
): DocAnnotations {
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .filter((h) => h && typeof h === "object")
        .map((h) => {
          const raw = h as PageHighlight;
          const color = normalizeColor(raw.color);
          return {
            id: String(raw.id || makeAnnotId("hl")),
            page: Number(raw.page) || 0,
            x: Number(raw.x) || 0,
            y: Number(raw.y) || 0,
            w: Number(raw.w) || 0,
            h: Number(raw.h) || 0,
            color,
            meaning: normalizeMeaning(raw.meaning, color),
            text: raw.text ? String(raw.text).slice(0, 500) : undefined,
            note: raw.note ? String(raw.note).slice(0, 800) : undefined,
            createdAt: Number(raw.createdAt) || Date.now(),
            tags: Array.isArray(raw.tags)
              ? raw.tags.map((t) => String(t).slice(0, 32)).slice(0, 8)
              : undefined,
          };
        })
        .filter((h) => h.w > 0 && h.h > 0)
    : [];

  const notes = Array.isArray(parsed.notes)
    ? parsed.notes
        .filter((n) => n && typeof n === "object")
        .map((n) => {
          const raw = n as PageNote;
          return {
            id: String(raw.id || makeAnnotId("note")),
            page: Number(raw.page) || 0,
            x: Number(raw.x) || 0,
            y: Number(raw.y) || 0,
            text: String(raw.text || "").slice(0, 800),
            vibe: normalizeVibe(raw.vibe),
            rotation: Number.isFinite(raw.rotation) ? Number(raw.rotation) : undefined,
            createdAt: Number(raw.createdAt) || Date.now(),
            tags: Array.isArray(raw.tags)
              ? raw.tags.map((t) => String(t).slice(0, 32)).slice(0, 8)
              : undefined,
          };
        })
    : [];

  const bookmarks = Array.isArray(parsed.bookmarks)
    ? parsed.bookmarks
        .filter((b) => b && typeof b === "object")
        .map((b) => {
          const raw = b as PageBookmark;
          return {
            id: String(raw.id || makeAnnotId("bm")),
            page: Number(raw.page) || 0,
            label: raw.label ? String(raw.label).slice(0, 80) : undefined,
            createdAt: Number(raw.createdAt) || Date.now(),
          };
        })
    : [];

  const strokes = Array.isArray(parsed.strokes)
    ? parsed.strokes
        .filter((s) => s && typeof s === "object")
        .map((s) => {
          const raw = s as PageStroke;
          const points = Array.isArray(raw.points)
            ? raw.points
                .filter((p) => p && typeof p === "object")
                .map((p) => ({
                  x: clamp01(Number((p as StrokePoint).x) || 0),
                  y: clamp01(Number((p as StrokePoint).y) || 0),
                }))
                .slice(0, 4000)
            : [];
          return {
            id: String(raw.id || makeAnnotId("stroke")),
            page: Number(raw.page) || 0,
            kind: raw.kind === "highlighter" ? ("highlighter" as const) : ("pen" as const),
            color: String(raw.color || "black").slice(0, 32),
            width:
              raw.width === "thin" || raw.width === "thick"
                ? raw.width
                : ("medium" as PenWidth),
            points,
            createdAt: Number(raw.createdAt) || Date.now(),
          };
        })
        .filter((s) => s.points.length >= 2)
    : [];

  return {
    version: 2,
    pdfHash: typeof parsed.pdfHash === "string" && parsed.pdfHash ? parsed.pdfHash : pdfHash,
    highlights,
    notes,
    bookmarks,
    strokes,
  };
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function openAnnotDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: "pdfHash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open annotations DB"));
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function idbTxDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

function loadLegacyLocal(documentId: string): DocAnnotations | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_PREFIX + documentId);
    if (!raw) return null;
    return sanitizeAnnotations(JSON.parse(raw) as Partial<DocAnnotations>);
  } catch {
    return null;
  }
}

/** Async load by stable PDF content hash; falls back to legacy localStorage keys. */
export async function loadAnnotationsByHash(
  pdfHash: string,
  legacyDocumentIds: string[] = [],
): Promise<DocAnnotations> {
  if (typeof window === "undefined") return emptyAnnotations(pdfHash);

  try {
    const db = await openAnnotDb();
    try {
      const tx = db.transaction(IDB_STORE, "readonly");
      const row = await idbReq(tx.objectStore(IDB_STORE).get(pdfHash));
      await idbTxDone(tx);
      if (row) {
        return sanitizeAnnotations(row as DocAnnotations, pdfHash);
      }
    } finally {
      db.close();
    }
  } catch {
    // fall through to legacy
  }

  for (const legacyId of legacyDocumentIds) {
    const legacy = loadLegacyLocal(legacyId);
    if (legacy && (legacy.highlights.length || legacy.notes.length)) {
      const migrated = { ...legacy, pdfHash };
      await saveAnnotationsByHash(pdfHash, migrated);
      return migrated;
    }
  }

  return emptyAnnotations(pdfHash);
}

export async function saveAnnotationsByHash(
  pdfHash: string,
  data: DocAnnotations,
): Promise<void> {
  if (typeof window === "undefined" || !pdfHash) return;
  const payload = sanitizeAnnotations({ ...data, pdfHash }, pdfHash);
  try {
    const db = await openAnnotDb();
    try {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(payload);
      await idbTxDone(tx);
    } finally {
      db.close();
    }
  } catch {
    // quota / private mode — soft fail
  }
}

/** Sync helpers kept for callers that still have a document id (library bridge). */
export function loadAnnotations(documentId: string): DocAnnotations {
  return loadLegacyLocal(documentId) ?? emptyAnnotations();
}

export function saveAnnotations(documentId: string, data: DocAnnotations): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_PREFIX + documentId, JSON.stringify(sanitizeAnnotations(data)));
  } catch {
    // ignore
  }
}

export function cloneAnnotations(data: DocAnnotations): DocAnnotations {
  return {
    version: 2,
    pdfHash: data.pdfHash,
    highlights: data.highlights.map((h) => ({ ...h, tags: h.tags ? [...h.tags] : undefined })),
    notes: data.notes.map((n) => ({ ...n, tags: n.tags ? [...n.tags] : undefined })),
    bookmarks: data.bookmarks.map((b) => ({ ...b })),
    strokes: data.strokes.map((s) => ({
      ...s,
      points: s.points.map((p) => ({ ...p })),
    })),
  };
}

export function createAnnotationHistory(limit = ANNOT_HISTORY_LIMIT) {
  let past: DocAnnotations[] = [];
  let future: DocAnnotations[] = [];

  return {
    clear() {
      past = [];
      future = [];
    },
    canUndo() {
      return past.length > 0;
    },
    canRedo() {
      return future.length > 0;
    },
    push(current: DocAnnotations) {
      past = [...past, cloneAnnotations(current)].slice(-limit);
      future = [];
    },
    undo(current: DocAnnotations): DocAnnotations | null {
      if (past.length === 0) return null;
      const prev = past[past.length - 1];
      past = past.slice(0, -1);
      future = [...future, cloneAnnotations(current)];
      return cloneAnnotations(prev);
    },
    redo(current: DocAnnotations): DocAnnotations | null {
      if (future.length === 0) return null;
      const next = future[future.length - 1];
      future = future.slice(0, -1);
      past = [...past, cloneAnnotations(current)];
      return cloneAnnotations(next);
    },
  };
}

export type AnnotationHistory = ReturnType<typeof createAnnotationHistory>;

export type NotesFilter = "all" | "highlights" | "notes" | "bookmarks" | "pen";

export type NotesListItem = {
  id: string;
  kind: "highlight" | "note" | "bookmark" | "pen";
  page: number;
  preview: string;
  color?: string;
  meaning?: ColorMeaning;
  important?: boolean;
  createdAt: number;
};

export function buildNotesList(data: DocAnnotations): NotesListItem[] {
  const items: NotesListItem[] = [];
  for (const h of data.highlights) {
    items.push({
      id: h.id,
      kind: "highlight",
      page: h.page,
      preview: (h.note || h.text || "Highlight").slice(0, 120),
      color: h.color,
      meaning: h.meaning,
      important: h.meaning === "important",
      createdAt: h.createdAt,
    });
  }
  for (const n of data.notes) {
    items.push({
      id: n.id,
      kind: "note",
      page: n.page,
      preview: (n.text || "Sticky note").slice(0, 120),
      color: n.vibe,
      createdAt: n.createdAt,
    });
  }
  for (const b of data.bookmarks) {
    items.push({
      id: b.id,
      kind: "bookmark",
      page: b.page,
      preview: b.label || `Bookmark · page ${b.page + 1}`,
      color: "orange",
      createdAt: b.createdAt,
    });
  }
  for (const s of data.strokes) {
    items.push({
      id: s.id,
      kind: "pen",
      page: s.page,
      preview: s.kind === "highlighter" ? "Highlighter stroke" : "Pen stroke",
      color: s.color,
      createdAt: s.createdAt,
    });
  }
  return items.sort((a, b) => a.page - b.page || b.createdAt - a.createdAt);
}

export function filterNotesList(
  items: NotesListItem[],
  filter: NotesFilter,
  color?: HighlightColor | "any",
  importantOnly = false,
  query = "",
): NotesListItem[] {
  const q = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "highlights" && item.kind !== "highlight") return false;
    if (filter === "notes" && item.kind !== "note") return false;
    if (filter === "bookmarks" && item.kind !== "bookmark") return false;
    if (filter === "pen" && item.kind !== "pen") return false;
    if (color && color !== "any" && item.color !== color) return false;
    if (importantOnly && !item.important) return false;
    if (q && !item.preview.toLowerCase().includes(q) && !String(item.page + 1).includes(q)) {
      return false;
    }
    return true;
  });
}

export function exportNotesMarkdown(docName: string, data: DocAnnotations): string {
  const lines: string[] = [`# Notes — ${docName}`, "", `Exported ${new Date().toLocaleString()}`, ""];
  const items = buildNotesList(data);
  if (!items.length) {
    lines.push("_No notes yet._");
    return lines.join("\n");
  }
  for (const item of items) {
    const kind = item.kind.charAt(0).toUpperCase() + item.kind.slice(1);
    lines.push(`## p.${item.page + 1} · ${kind}`);
    if (item.color) lines.push(`Color: ${item.color}`);
    if (item.meaning && item.meaning !== "none") lines.push(`Meaning: ${item.meaning}`);
    lines.push(item.preview);
    lines.push("");
  }
  return lines.join("\n");
}

export function exportNotesTxt(docName: string, data: DocAnnotations): string {
  return exportNotesMarkdown(docName, data)
    .replace(/^#+\s*/gm, "")
    .replace(/\*\*|__/g, "");
}

export function downloadTextFile(content: string, filename: string, mime = "text/plain"): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Distance from point to segment (normalized page space). */
export function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function strokeNearPoint(stroke: PageStroke, x: number, y: number, radius: number): boolean {
  const pts = stroke.points;
  for (let i = 1; i < pts.length; i += 1) {
    if (distToSegment(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) <= radius) {
      return true;
    }
  }
  return false;
}
