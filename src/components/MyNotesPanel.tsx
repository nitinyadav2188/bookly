"use client";

import { useMemo, useState } from "react";
import {
  HIGHLIGHT_COLORS,
  buildNotesList,
  downloadTextFile,
  exportNotesMarkdown,
  exportNotesTxt,
  filterNotesList,
  type DocAnnotations,
  type HighlightColor,
  type NotesFilter,
} from "@/lib/annotations";

type MyNotesPanelProps = {
  open: boolean;
  docName: string;
  data: DocAnnotations;
  onClose: () => void;
  onNavigate: (item: { id: string; page: number; kind: string }) => void;
};

export function MyNotesPanel({ open, docName, data, onClose, onNavigate }: MyNotesPanelProps) {
  const [filter, setFilter] = useState<NotesFilter>("all");
  const [color, setColor] = useState<HighlightColor | "any">("any");
  const [importantOnly, setImportantOnly] = useState(false);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    return filterNotesList(buildNotesList(data), filter, color, importantOnly, query);
  }, [data, filter, color, importantOnly, query]);

  if (!open) return null;

  return (
    <aside className="phys-notes-panel" aria-label="My Notes">
      <div className="phys-notes-panel-head">
        <div>
          <p className="phys-notes-eyebrow">My Notes</p>
          <h2>Marks in this book</h2>
        </div>
        <button type="button" className="phys-notes-close" onClick={onClose} aria-label="Close notes">
          Close
        </button>
      </div>

      <div className="phys-notes-filters">
        {(
          [
            ["all", "All"],
            ["highlights", "Highlights"],
            ["notes", "Notes"],
            ["bookmarks", "Bookmarks"],
            ["pen", "Pen"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={filter === id ? "is-on" : ""}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="phys-notes-filters phys-notes-filters-secondary">
        <button
          type="button"
          className={color === "any" ? "is-on" : ""}
          onClick={() => setColor("any")}
        >
          Any color
        </button>
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={color === c.id ? "is-on" : ""}
            style={{ background: color === c.id ? c.solid : undefined }}
            onClick={() => setColor(c.id)}
            aria-label={c.label}
          >
            {c.label[0]}
          </button>
        ))}
        <button
          type="button"
          className={importantOnly ? "is-on" : ""}
          onClick={() => setImportantOnly((v) => !v)}
        >
          Important
        </button>
      </div>

      <input
        className="phys-notes-search"
        type="search"
        placeholder="Search notes & highlights…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="phys-notes-export">
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              exportNotesMarkdown(docName, data),
              `${docName.replace(/\.[^.]+$/, "") || "notes"}-notes.md`,
              "text/markdown",
            )
          }
        >
          Export MD
        </button>
        <button
          type="button"
          onClick={() =>
            downloadTextFile(
              exportNotesTxt(docName, data),
              `${docName.replace(/\.[^.]+$/, "") || "notes"}-notes.txt`,
            )
          }
        >
          Export TXT
        </button>
      </div>

      <ul className="phys-notes-list">
        {items.length === 0 ? (
          <li className="phys-notes-empty">
            <p>Your notes will appear here.</p>
            <p className="phys-notes-empty-help">
              Enter Annotation Mode, then highlight, sticky-note, bookmark, or ink the page.
              Everything stays on this device — the PDF is never modified.
            </p>
          </li>
        ) : (
          items.map((item) => (
            <li key={`${item.kind}-${item.id}`}>
              <button
                type="button"
                className="phys-notes-item"
                onClick={() => onNavigate(item)}
              >
                <span className="phys-notes-item-meta">
                  <span className={`phys-notes-kind kind-${item.kind}`}>{item.kind}</span>
                  <span>p.{item.page + 1}</span>
                  {item.color ? (
                    <span
                      className="phys-notes-dot"
                      style={{
                        background:
                          HIGHLIGHT_COLORS.find((c) => c.id === item.color)?.solid ?? item.color,
                      }}
                    />
                  ) : null}
                </span>
                <span className="phys-notes-item-preview">{item.preview}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
