"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  HIGHLIGHT_COLORS,
  NOTE_VIBES,
  highlightFill,
  makeAnnotId,
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
  onDeleteHighlight: (id: string) => void;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function measureVisiblePages(host: HTMLElement): PageBox[] {
  const hostRect = host.getBoundingClientRect();
  const pages = host.querySelectorAll<HTMLElement>(".book-page[data-page]");
  const boxes: PageBox[] = [];
  pages.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    // Visible if overlapping the host meaningfully
    const overlapW =
      Math.min(rect.right, hostRect.right) - Math.max(rect.left, hostRect.left);
    const overlapH =
      Math.min(rect.bottom, hostRect.bottom) - Math.max(rect.top, hostRect.top);
    if (overlapW < 40 || overlapH < 40) return;
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const dragRef = useRef<{
    page: number;
    x0: number;
    y0: number;
    box: PageBox;
  } | null>(null);

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
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => refreshBoxes()) : null;
    ro?.observe(host);
    const id = window.setInterval(refreshBoxes, active ? 400 : 800);
    window.addEventListener("resize", refreshBoxes);
    return () => {
      ro?.disconnect();
      window.clearInterval(id);
      window.removeEventListener("resize", refreshBoxes);
    };
  }, [active, pageIndex, isNarrow, refreshBoxes, hostRef]);

  const visiblePages = useMemo(() => new Set(boxes.map((b) => b.page)), [boxes]);

  const visibleHighlights = highlights.filter((h) => visiblePages.has(h.page));
  const visibleNotes = notes.filter((n) => visiblePages.has(n.page));

  const localPoint = (clientX: number, clientY: number) => {
    const layer = layerRef.current;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const pt = localPoint(e.clientX, e.clientY);
    if (!pt) return;
    const hit = hitPage(boxes, pt.x, pt.y);
    if (!hit) return;

    if (tool === "note") {
      const id = makeAnnotId("note");
      onAddNote({
        id,
        page: hit.box.page,
        x: hit.rx,
        y: hit.ry,
        text: "",
        vibe,
      });
      setEditingNoteId(id);
      return;
    }

    // highlight drag
    dragRef.current = {
      page: hit.box.page,
      x0: hit.rx,
      y0: hit.ry,
      box: hit.box,
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
    const drag = dragRef.current;
    if (!drag) return;
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
    const drag = dragRef.current;
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
    const x = Math.min(draft.x0, draft.x1);
    const y = Math.min(draft.y0, draft.y1);
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);
    setDraft(null);
    if (w < 0.02 || h < 0.015) return;
    onAddHighlight({
      id: makeAnnotId("hl"),
      page: drag.page,
      x,
      y,
      w,
      h,
      color,
    });
  };

  if (!active) {
    // Still paint existing marks lightly when flipping? User asked for annotations in annotate mode primarily.
    // Show persisted marks always so you can see them while reading.
  }

  const showInteractive = active;

  return (
    <div
      ref={layerRef}
      className={`annotation-layer ${showInteractive ? "is-active" : "is-passive"}`}
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
            .map((h) => (
              <button
                key={h.id}
                type="button"
                className="annotation-highlight"
                style={{
                  left: `${h.x * 100}%`,
                  top: `${h.y * 100}%`,
                  width: `${h.w * 100}%`,
                  height: `${h.h * 100}%`,
                  background: highlightFill(h.color),
                }}
                title={showInteractive ? "Tap to clear mark" : "marked ✨"}
                onClick={(e) => {
                  e.stopPropagation();
                  if (showInteractive) onDeleteHighlight(h.id);
                }}
                tabIndex={showInteractive ? 0 : -1}
              />
            ))}

          {visibleNotes
            .filter((n) => n.page === box.page)
            .map((n) => (
              <div
                key={n.id}
                className={`annotation-sticky vibe-${n.vibe.replace(/\s+/g, "-")}`}
                style={{
                  left: `${n.x * 100}%`,
                  top: `${n.y * 100}%`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="annotation-sticky-head">
                  <span>{n.vibe === "tea" ? "tea ☕" : n.vibe}</span>
                  {showInteractive ? (
                    <button
                      type="button"
                      aria-label="Delete note"
                      onClick={() => onDeleteNote(n.id)}
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                {showInteractive && (editingNoteId === n.id || !n.text) ? (
                  <textarea
                    autoFocus={editingNoteId === n.id}
                    value={n.text}
                    placeholder="quick thought…"
                    rows={3}
                    onChange={(e) => onUpdateNote(n.id, e.target.value.slice(0, 160))}
                    onBlur={() => setEditingNoteId(null)}
                    onFocus={() => setEditingNoteId(n.id)}
                  />
                ) : (
                  <button
                    type="button"
                    className="annotation-sticky-body"
                    onClick={() => {
                      if (showInteractive) setEditingNoteId(n.id);
                    }}
                  >
                    {n.text || "…"}
                  </button>
                )}
              </div>
            ))}

          {draft && draft.page === box.page ? (
            <div
              className="annotation-highlight is-draft"
              style={{
                left: `${Math.min(draft.x0, draft.x1) * 100}%`,
                top: `${Math.min(draft.y0, draft.y1) * 100}%`,
                width: `${Math.abs(draft.x1 - draft.x0) * 100}%`,
                height: `${Math.abs(draft.y1 - draft.y0) * 100}%`,
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
  onTool,
  onColor,
  onVibe,
}: {
  tool: Tool;
  color: HighlightColor;
  vibe: NoteVibe;
  onTool: (t: Tool) => void;
  onColor: (c: HighlightColor) => void;
  onVibe: (v: NoteVibe) => void;
}) {
  return (
    <div className="annotation-toolbar">
      <button
        type="button"
        className={tool === "highlight" ? "is-on" : ""}
        onClick={() => onTool("highlight")}
      >
        Highlight
      </button>
      <button
        type="button"
        className={tool === "note" ? "is-on" : ""}
        onClick={() => onTool("note")}
      >
        Sticky
      </button>
      {tool === "highlight" ? (
        <div className="annotation-swatches" role="group" aria-label="Highlighter color">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`swatch swatch-${c.id} ${color === c.id ? "is-on" : ""}`}
              aria-label={c.label}
              onClick={() => onColor(c.id)}
            />
          ))}
        </div>
      ) : (
        <label className="annotation-vibe">
          <span className="sr-only">Note vibe</span>
          <select value={vibe} onChange={(e) => onVibe(e.target.value as NoteVibe)}>
            {NOTE_VIBES.map((v) => (
              <option key={v} value={v}>
                {v === "tea" ? "tea ☕" : v}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="annotation-hint">
        {tool === "highlight" ? "Drag to mark ✨" : "Tap page · keep it short"}
      </p>
    </div>
  );
}
