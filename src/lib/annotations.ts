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
