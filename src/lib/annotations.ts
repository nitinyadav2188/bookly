export type HighlightColor = "yellow" | "green" | "pink" | "blue";

export type NoteVibe = "note" | "question" | "important";

export type PageHighlight = {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color: HighlightColor;
};

export type PageNote = {
  id: string;
  page: number;
  x: number;
  y: number;
  text: string;
  vibe: NoteVibe;
};

export type DocAnnotations = {
  highlights: PageHighlight[];
  notes: PageNote[];
};

const PREFIX = "bookly:annots:v1:";

const EMPTY: DocAnnotations = { highlights: [], notes: [] };

export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; css: string; solid: string }[] = [
  { id: "yellow", label: "Yellow", css: "rgba(250, 204, 21, 0.42)", solid: "#facc15" },
  { id: "green", label: "Green", css: "rgba(74, 222, 128, 0.38)", solid: "#4ade80" },
  { id: "pink", label: "Pink", css: "rgba(244, 114, 182, 0.36)", solid: "#f472b6" },
  { id: "blue", label: "Blue", css: "rgba(96, 165, 250, 0.4)", solid: "#60a5fa" },
];

export const NOTE_VIBES: { id: NoteVibe; label: string }[] = [
  { id: "note", label: "Note" },
  { id: "question", label: "Question" },
  { id: "important", label: "Important" },
];

/** Map legacy saved colors/vibes into the current palette. */
function normalizeColor(raw: unknown): HighlightColor {
  if (raw === "lime") return "green";
  if (raw === "yellow" || raw === "green" || raw === "pink" || raw === "blue") return raw;
  return "yellow";
}

function normalizeVibe(raw: unknown): NoteVibe {
  if (raw === "question" || raw === "important" || raw === "note") return raw;
  if (raw === "note to self" || raw === "brain dump" || raw === "lore" || raw === "tea") return "note";
  return "note";
}

export function highlightFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.css ?? HIGHLIGHT_COLORS[0].css;
}

export function highlightSolid(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.solid ?? HIGHLIGHT_COLORS[0].solid;
}

export function noteVibeLabel(vibe: NoteVibe): string {
  return NOTE_VIBES.find((v) => v.id === vibe)?.label ?? "Note";
}

function sanitizeAnnotations(parsed: Partial<DocAnnotations>): DocAnnotations {
  const highlights = Array.isArray(parsed.highlights)
    ? parsed.highlights
        .filter((h) => h && typeof h === "object")
        .map((h) => ({
          id: String((h as PageHighlight).id || makeAnnotId("hl")),
          page: Number((h as PageHighlight).page) || 0,
          x: Number((h as PageHighlight).x) || 0,
          y: Number((h as PageHighlight).y) || 0,
          w: Number((h as PageHighlight).w) || 0,
          h: Number((h as PageHighlight).h) || 0,
          color: normalizeColor((h as PageHighlight).color),
        }))
        .filter((h) => h.w > 0 && h.h > 0)
    : [];

  const notes = Array.isArray(parsed.notes)
    ? parsed.notes
        .filter((n) => n && typeof n === "object")
        .map((n) => ({
          id: String((n as PageNote).id || makeAnnotId("note")),
          page: Number((n as PageNote).page) || 0,
          x: Number((n as PageNote).x) || 0,
          y: Number((n as PageNote).y) || 0,
          text: String((n as PageNote).text || "").slice(0, 280),
          vibe: normalizeVibe((n as PageNote).vibe),
        }))
    : [];

  return { highlights, notes };
}

export function loadAnnotations(documentId: string): DocAnnotations {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(PREFIX + documentId);
    if (!raw) return { highlights: [], notes: [] };
    return sanitizeAnnotations(JSON.parse(raw) as Partial<DocAnnotations>);
  } catch {
    return { highlights: [], notes: [] };
  }
}

export function saveAnnotations(documentId: string, data: DocAnnotations): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + documentId, JSON.stringify(data));
  } catch {
    // quota / private mode
  }
}

export function makeAnnotId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const ANNOT_HISTORY_LIMIT = 50;

export function cloneAnnotations(data: DocAnnotations): DocAnnotations {
  return {
    highlights: data.highlights.map((h) => ({ ...h })),
    notes: data.notes.map((n) => ({ ...n })),
  };
}

/** Snapshot stack for undo / redo of annotation mutations. */
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
    /** Record current state before applying a mutation. Clears redo branch. */
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
