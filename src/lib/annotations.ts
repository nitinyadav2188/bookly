/** Adobe Acrobat–style annotation model (Highlight Text + Sticky Note). */

export type HighlightColor = "yellow" | "green" | "blue" | "pink" | "red";

/** Sticky note paper color — mirrors Acrobat sticky appearance options. */
export type NoteVibe = "yellow" | "green" | "blue" | "pink" | "red";

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

/** Acrobat-like highlighter fills (multiply over page ink). */
export const HIGHLIGHT_COLORS: { id: HighlightColor; label: string; css: string; solid: string }[] = [
  { id: "yellow", label: "Yellow", css: "rgba(255, 230, 0, 0.45)", solid: "#ffe600" },
  { id: "green", label: "Green", css: "rgba(0, 200, 80, 0.38)", solid: "#00c850" },
  { id: "blue", label: "Blue", css: "rgba(0, 160, 255, 0.38)", solid: "#00a0ff" },
  { id: "pink", label: "Pink", css: "rgba(255, 80, 180, 0.36)", solid: "#ff50b4" },
  { id: "red", label: "Red", css: "rgba(255, 60, 60, 0.36)", solid: "#ff3c3c" },
];

export const NOTE_VIBES: { id: NoteVibe; label: string; paper: string; fold: string }[] = [
  { id: "yellow", label: "Yellow", paper: "#fff59d", fold: "#f0e06a" },
  { id: "green", label: "Green", paper: "#c8f7c5", fold: "#9ed89a" },
  { id: "blue", label: "Blue", paper: "#cfe8ff", fold: "#9ec8f0" },
  { id: "pink", label: "Pink", paper: "#ffd0ea", fold: "#f0a0c8" },
  { id: "red", label: "Red", paper: "#ffcfcf", fold: "#f0a0a0" },
];

function normalizeColor(raw: unknown): HighlightColor {
  if (raw === "lime") return "green";
  if (raw === "yellow" || raw === "green" || raw === "blue" || raw === "pink" || raw === "red") {
    return raw;
  }
  return "yellow";
}

function normalizeVibe(raw: unknown): NoteVibe {
  if (raw === "yellow" || raw === "green" || raw === "blue" || raw === "pink" || raw === "red") {
    return raw;
  }
  if (
    raw === "note" ||
    raw === "question" ||
    raw === "important" ||
    raw === "note to self" ||
    raw === "brain dump" ||
    raw === "lore" ||
    raw === "tea"
  ) {
    return "yellow";
  }
  return "yellow";
}

export function highlightFill(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.css ?? HIGHLIGHT_COLORS[0].css;
}

export function highlightSolid(color: HighlightColor): string {
  return HIGHLIGHT_COLORS.find((c) => c.id === color)?.solid ?? HIGHLIGHT_COLORS[0].solid;
}

export function noteVibeLabel(vibe: NoteVibe): string {
  return NOTE_VIBES.find((v) => v.id === vibe)?.label ?? "Yellow";
}

export function notePaper(vibe: NoteVibe): { paper: string; fold: string } {
  const found = NOTE_VIBES.find((v) => v.id === vibe);
  return { paper: found?.paper ?? "#fff59d", fold: found?.fold ?? "#f0e06a" };
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
          text: String((n as PageNote).text || "").slice(0, 500),
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
