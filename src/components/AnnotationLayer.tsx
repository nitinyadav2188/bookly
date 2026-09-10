"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HIGHLIGHT_COLORS,
  NOTE_VIBES,
  highlightFill,
  makeAnnotId,
  noteVibeLabel,
  type HighlightColor,
  type NoteVibe,
  type PageHighlight,
  type PageNote,
} from "@/lib/annotations";

type Tool = "highlight" | "note";

type PageBox = {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

type AnnotationLayerProps = {
  active: boolean;
  tool: Tool;
  color: HighlightColor;
  vibe: NoteVibe;
  pageIndex: number;
  isNarrow: boolean;
  hostRef: React.RefObject<HTMLDivElement | null>;
  highlights: PageHighlight[];
  notes: PageNote[];
  onAddHighlight: (h: PageHighlight) => void;
  onAddNote: (n: PageNote) => void;
  onUpdateNote: (id: string, text: string) => void;
  onDeleteNote: (id: string) => void;
  onDiscardEmptyNote: (id: string) => void;
  onDeleteHighlight: (id: string) => void;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

/** Prefer StPageFlip items that are actually painted on screen. */
function measureVisiblePages(host: HTMLElement): PageBox[] {
  const hostRect = host.getBoundingClientRect();
  const pages = host.querySelectorAll<HTMLElement>(".book-page[data-page]");
  const boxes: PageBox[] = [];

  pages.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 48 || rect.height < 48) return;

    const overlapW =
      Math.min(rect.right, hostRect.right) - Math.max(rect.left, hostRect.left);
    const overlapH =
      Math.min(rect.bottom, hostRect.bottom) - Math.max(rect.top, hostRect.top);
    if (overlapW < 48 || overlapH < 48) return;

    const page = Number(el.dataset.page);
    if (!Number.isFinite(page)) return;

    boxes.push({
      page,
      left: rect.left - hostRect.left,
      top: rect.top - hostRect.top,
      width: rect.width,
      height: rect.height,
    });
  });

  return boxes;
}

function hitPage(
  boxes: PageBox[],
  localX: number,
  localY: number,
): { box: PageBox; rx: number; ry: number } | null {
  for (const box of boxes) {
    if (
      localX >= box.left &&
      localX <= box.left + box.width &&
      localY >= box.top &&
      localY <= box.top + box.height
    ) {
      return {
        box,
        rx: clamp01((localX - box.left) / box.width),
        ry: clamp01((localY - box.top) / box.height),
      };
    }
  }
  return null;
}

/** Prefer text-line bands when the drag is shallow. */
function normalizeHighlightRect(x0: number, y0: number, x1: number, y1: number) {
  let x = Math.min(x0, x1);
  let y = Math.min(y0, y1);
  let w = Math.abs(x1 - x0);
  let h = Math.abs(y1 - y0);

  // Ignore tiny accidental taps
  if (w < 0.018 && h < 0.012) return null;

  // Line-like stroke: lock to a readable band height
  if (h < 0.028 || w / Math.max(h, 0.001) > 4.5) {
    const band = Math.max(0.018, Math.min(0.034, h < 0.01 ? 0.022 : h));
    const midY = (y0 + y1) / 2;
    y = clamp01(midY - band / 2);
    h = band;
    w = Math.max(w, 0.04);
    x = clamp01(Math.min(x0, x1));
    if (x + w > 1) w = 1 - x;
  } else {
    w = Math.max(w, 0.03);
    h = Math.max(h, 0.02);
  }

  return { x, y, w, h };
}

export function AnnotationLayer({
  active,
  tool,
  color,
  vibe,
  pageIndex,
  isNarrow,
  hostRef,
  highlights,
  notes,
  onAddHighlight,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onDiscardEmptyNote,
  onDeleteHighlight,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<PageBox[]>([]);
  const [draft, setDraft] = useState<{
    page: number;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const dragRef = useRef<{
    page: number;
    x0: number;
    y0: number;
    box: PageBox;
    pointerId: number;
  } | null>(null);
  const noteTapRef = useRef<{
    pointerId: number;
    page: number;
    x: number;
    y: number;
  } | null>(null);
  const discardTimerRef = useRef<number | null>(null);

  const refreshBoxes = useCallback(() => {
    const host = hostRef.current;
    if (!host) {
      setBoxes([]);
      return;
    }
    setBoxes(measureVisiblePages(host));
  }, [hostRef]);

  useEffect(() => {
    refreshBoxes();
    const host = hostRef.current;
    if (!host) return;
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => refreshBoxes()) : null;
    ro?.observe(host);
    const id = window.setInterval(refreshBoxes, active ? 320 : 900);
    window.addEventListener("resize", refreshBoxes);
    return () => {
      ro?.disconnect();
      window.clearInterval(id);
      window.removeEventListener("resize", refreshBoxes);
    };
  }, [active, pageIndex, isNarrow, refreshBoxes, hostRef]);

  useEffect(() => {
    if (!active) {
      setSelectedId(null);
      setOpenNoteId(null);
      setDraft(null);
      dragRef.current = null;
      noteTapRef.current = null;
      if (discardTimerRef.current != null) {
        window.clearTimeout(discardTimerRef.current);
        discardTimerRef.current = null;
      }
    }
  }, [active]);

  useEffect(() => {
    return () => {
      if (discardTimerRef.current != null) window.clearTimeout(discardTimerRef.current);
    };
  }, []);

  const visiblePages = useMemo(() => new Set(boxes.map((b) => b.page)), [boxes]);
  const visibleHighlights = highlights.filter((h) => visiblePages.has(h.page));
  const visibleNotes = notes.filter((n) => visiblePages.has(n.page));

  const localPoint = (clientX: number, clientY: number) => {
    const layer = layerRef.current;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    // Layer sits inside a CSS-scaled host — use unscaled offsetWidth for coords
    // that match getBoundingClientRect-based page boxes (also in screen space).
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const target = e.target as HTMLElement | null;
    if (target?.closest(".annotation-highlight, .annotation-note, .annotation-note-card")) {
      return;
    }

    const pt = localPoint(e.clientX, e.clientY);
    if (!pt) return;
    const hit = hitPage(boxes, pt.x, pt.y);
    if (!hit) return;

    setSelectedId(null);

    if (tool === "note") {
      // Defer create until pointerup so the same tap doesn't blur/discard an empty note.
      noteTapRef.current = {
        pointerId: e.pointerId,
        page: hit.box.page,
        x: hit.rx,
        y: hit.ry,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    noteTapRef.current = null;
    dragRef.current = {
      page: hit.box.page,
      x0: hit.rx,
      y0: hit.ry,
      box: hit.box,
      pointerId: e.pointerId,
    };
    setDraft({
      page: hit.box.page,
      x0: hit.rx,
      y0: hit.ry,
      x1: hit.rx,
      y1: hit.ry,
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const noteTap = noteTapRef.current;
    if (noteTap && noteTap.pointerId === e.pointerId) {
      // Cancel note place if the pointer drifts — treat as an aborted tap.
      const pt = localPoint(e.clientX, e.clientY);
      if (!pt) return;
      const box = boxes.find((b) => b.page === noteTap.page);
      if (!box) return;
      const rx = clamp01((pt.x - box.left) / box.width);
      const ry = clamp01((pt.y - box.top) / box.height);
      if (Math.hypot(rx - noteTap.x, ry - noteTap.y) > 0.03) {
        noteTapRef.current = null;
      }
      return;
    }

    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const pt = localPoint(e.clientX, e.clientY);
    if (!pt) return;
    const rx = clamp01((pt.x - drag.box.left) / drag.box.width);
    const ry = clamp01((pt.y - drag.box.top) / drag.box.height);
    setDraft({
      page: drag.page,
      x0: drag.x0,
      y0: drag.y0,
      x1: rx,
      y1: ry,
    });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const noteTap = noteTapRef.current;
    if (noteTap && noteTap.pointerId === e.pointerId) {
      noteTapRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const id = makeAnnotId("note");
      onAddNote({
        id,
        page: noteTap.page,
        x: noteTap.x,
        y: noteTap.y,
        text: "",
        vibe,
      });
      setOpenNoteId(id);
      setSelectedId(id);
      return;
    }

    const drag = dragRef.current;
    if (drag && drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (!drag || !draft) {
      setDraft(null);
      return;
    }
    const normalized = normalizeHighlightRect(draft.x0, draft.y0, draft.x1, draft.y1);
    setDraft(null);
    if (!normalized) return;
    onAddHighlight({
      id: makeAnnotId("hl"),
      page: drag.page,
      ...normalized,
      color,
    });
  };

  const scheduleDiscardIfEmpty = (id: string, value: string) => {
    if (discardTimerRef.current != null) {
      window.clearTimeout(discardTimerRef.current);
      discardTimerRef.current = null;
    }
    if (value.trim()) {
      setOpenNoteId(null);
      return;
    }
    discardTimerRef.current = window.setTimeout(() => {
      discardTimerRef.current = null;
      onDiscardEmptyNote(id);
      setOpenNoteId((cur) => (cur === id ? null : cur));
      setSelectedId((cur) => (cur === id ? null : cur));
    }, 160);
  };

  const showInteractive = active;
  const draftNorm = draft
    ? normalizeHighlightRect(draft.x0, draft.y0, draft.x1, draft.y1)
    : null;

  return (
    <div
      ref={layerRef}
      className={`annotation-layer ${showInteractive ? "is-active" : "is-passive"} ${
        tool === "highlight" ? "tool-highlight" : "tool-note"
      }`}
      onPointerDown={showInteractive ? onPointerDown : undefined}
      onPointerMove={showInteractive ? onPointerMove : undefined}
      onPointerUp={showInteractive ? endDrag : undefined}
      onPointerCancel={showInteractive ? endDrag : undefined}
      style={{ pointerEvents: showInteractive ? "auto" : "none" }}
      aria-hidden={!showInteractive}
    >
      {boxes.map((box) => (
        <div
          key={`box-${box.page}`}
          className="annotation-page-frame"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          }}
        >
          {visibleHighlights
            .filter((h) => h.page === box.page)
            .map((h) => {
              const selected = selectedId === h.id;
              return (
                <div
                  key={h.id}
                  role="button"
                  tabIndex={showInteractive ? 0 : -1}
                  className={`annotation-highlight ${selected ? "is-selected" : ""}`}
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    width: `${h.w * 100}%`,
                    height: `${h.h * 100}%`,
                    background: highlightFill(h.color),
                  }}
                  title={showInteractive ? "Select highlight" : "Highlight"}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!showInteractive) return;
                    setOpenNoteId(null);
                    setSelectedId((cur) => (cur === h.id ? null : h.id));
                  }}
                  onKeyDown={(e) => {
                    if (!showInteractive) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenNoteId(null);
                      setSelectedId((cur) => (cur === h.id ? null : h.id));
                    }
                    if ((e.key === "Backspace" || e.key === "Delete") && selectedId === h.id) {
                      e.preventDefault();
                      onDeleteHighlight(h.id);
                      setSelectedId(null);
                    }
                  }}
                >
                  {showInteractive && selected ? (
                    <button
                      type="button"
                      className="annotation-delete-chip"
                      aria-label="Delete highlight"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onDeleteHighlight(h.id);
                        setSelectedId(null);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              );
            })}

          {visibleNotes
            .filter((n) => n.page === box.page)
            .map((n) => {
              const open = openNoteId === n.id || (showInteractive && !n.text && selectedId === n.id);
              return (
                <div
                  key={n.id}
                  className={`annotation-note vibe-${n.vibe} ${open ? "is-open" : ""} ${
                    selectedId === n.id ? "is-selected" : ""
                  }`}
                  style={{
                    left: `${n.x * 100}%`,
                    top: `${n.y * 100}%`,
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    className="annotation-note-pin"
                    aria-label={`${noteVibeLabel(n.vibe)} note`}
                    title={n.text || noteVibeLabel(n.vibe)}
                    onClick={() => {
                      if (!showInteractive) {
                        setOpenNoteId((cur) => (cur === n.id ? null : n.id));
                        return;
                      }
                      setSelectedId(n.id);
                      setOpenNoteId(n.id);
                    }}
                  >
                    <span className="annotation-note-dot" />
                  </button>

                  {open ? (
                    <div className="annotation-note-card">
                      <div className="annotation-note-card-head">
                        <span>{noteVibeLabel(n.vibe)}</span>
                        {showInteractive ? (
                          <button
                            type="button"
                            className="annotation-note-delete"
                            aria-label="Delete note"
                            onClick={() => {
                              onDeleteNote(n.id);
                              setOpenNoteId(null);
                              setSelectedId(null);
                            }}
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="annotation-note-delete"
                            aria-label="Close note"
                            onClick={() => setOpenNoteId(null)}
                          >
                            Close
                          </button>
                        )}
                      </div>
                      {showInteractive ? (
                        <textarea
                          autoFocus={!n.text || openNoteId === n.id}
                          value={n.text}
                          placeholder="Write a note…"
                          rows={3}
                          maxLength={280}
                          onChange={(e) => onUpdateNote(n.id, e.target.value.slice(0, 280))}
                          onBlur={(e) => {
                            const related = e.relatedTarget as Node | null;
                            if (related && e.currentTarget.closest(".annotation-note")?.contains(related)) {
                              return;
                            }
                            scheduleDiscardIfEmpty(n.id, e.currentTarget.value);
                          }}
                          onFocus={() => {
                            if (discardTimerRef.current != null) {
                              window.clearTimeout(discardTimerRef.current);
                              discardTimerRef.current = null;
                            }
                            setOpenNoteId(n.id);
                            setSelectedId(n.id);
                          }}
                        />
                      ) : (
                        <p className="annotation-note-body">{n.text || "Empty note"}</p>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}

          {draft && draft.page === box.page && draftNorm ? (
            <div
              className="annotation-highlight is-draft"
              style={{
                left: `${draftNorm.x * 100}%`,
                top: `${draftNorm.y * 100}%`,
                width: `${draftNorm.w * 100}%`,
                height: `${draftNorm.h * 100}%`,
                background: highlightFill(color),
              }}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function AnnotationToolbar({
  tool,
  color,
  vibe,
  canUndo,
  canRedo,
  onTool,
  onColor,
  onVibe,
  onUndo,
  onRedo,
}: {
  tool: Tool;
  color: HighlightColor;
  vibe: NoteVibe;
  canUndo: boolean;
  canRedo: boolean;
  onTool: (t: Tool) => void;
  onColor: (c: HighlightColor) => void;
  onVibe: (v: NoteVibe) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  return (
    <div className="annotation-toolbar">
      <div className="annotation-toolbar-row" role="group" aria-label="Annotation tools">
        <button
          type="button"
          className={`annot-tool annot-tool-highlight ${tool === "highlight" ? "is-on" : ""}`}
          onClick={() => onTool("highlight")}
          aria-pressed={tool === "highlight"}
        >
          Highlight
        </button>
        <button
          type="button"
          className={`annot-tool annot-tool-note ${tool === "note" ? "is-on" : ""}`}
          onClick={() => onTool("note")}
          aria-pressed={tool === "note"}
        >
          Note
        </button>

        {tool === "highlight" ? (
          <div className="annotation-swatches" role="group" aria-label="Highlight color">
            {HIGHLIGHT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`swatch swatch-${c.id} ${color === c.id ? "is-on" : ""}`}
                aria-label={c.label}
                aria-pressed={color === c.id}
                style={{ background: c.solid }}
                onClick={() => onColor(c.id)}
              />
            ))}
          </div>
        ) : (
          <div className="annotation-vibe-pills" role="group" aria-label="Note type">
            {NOTE_VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`annot-vibe ${vibe === v.id ? "is-on" : ""}`}
                aria-pressed={vibe === v.id}
                onClick={() => onVibe(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}

        <span className="annotation-toolbar-divider" aria-hidden />
        <button
          type="button"
          className="annot-tool annot-tool-undo"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo annotation"
          title="Undo"
        >
          Undo
        </button>
        <button
          type="button"
          className="annot-tool annot-tool-redo"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo annotation"
          title="Redo"
        >
          Redo
        </button>
      </div>
      <p className="annotation-hint">
        {tool === "highlight"
          ? "Drag across the page to highlight"
          : "Tap the page to place a note"}
      </p>
    </div>
  );
}
