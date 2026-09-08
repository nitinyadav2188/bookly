export type HighlightColor = "lime" | "pink" | "blue";

export type NoteVibe = "note to self" | "brain dump" | "lore" | "tea";

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

export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; css: string }[] = [
  { id: "lime", label: "Lime", css: "rgba(200, 245, 66, 0.55)" },
  { id: "pink", label: "Pink", css: "rgba(255, 77, 154, 0.45)" },
  { id: "blue", label: "Blue", css: "rgba(59, 91, 255, 0.4)" },
];

export const NOTE_VIBES: NoteVibe[] = ["note to self", "brain dump", "lore", "tea"];

export function highlightFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.css ?? HIGHLIGHT_COLORS[0].css;
}

export function loadAnnotations(documentId: string): DocAnnotations {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(PREFIX + documentId);
    if (!raw) return { highlights: [], notes: [] };
    const parsed = JSON.parse(raw) as Partial<DocAnnotations>;
    return {
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
    };
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
