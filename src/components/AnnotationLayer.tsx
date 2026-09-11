"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  COLOR_MEANINGS,
  HIGHLIGHT_COLORS,
  NOTE_VIBES,
  PEN_INKS,
  PEN_WIDTHS,
  defaultMeaningForColor,
  highlightFill,
  highlightSolid,
  makeAnnotId,
  notePaper,
  noteVibeLabel,
  penWidthPx,
  strokeNearPoint,
  type AnnotTool,
  type ColorMeaning,
  type HighlightColor,
  type NoteVibe,
  type PageBookmark,
  type PageHighlight,
  type PageNote,
  type PageStroke,
  type PenInk,
  type PenWidth,
  type StrokeKind,
} from "@/lib/annotations";

type PageBox = {
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

type DraftRect = {
  page: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

type SelectionMenu = {
  page: number;
  x: number;
  y: number;
  rect: { x: number; y: number; w: number; h: number };
  clientX: number;
  clientY: number;
};

type AnnotationLayerProps = {
  active: boolean;
  tool: AnnotTool;
  color: HighlightColor;
  meaning: ColorMeaning;
  vibe: NoteVibe;
  penInk: PenInk;
  penWidth: PenWidth;
  strokeKind: StrokeKind;
  pageIndex: number;
  isNarrow: boolean;
  flipping: boolean;
  hostRef: React.RefObject<HTMLDivElement | null>;
  highlights: PageHighlight[];
  notes: PageNote[];
  bookmarks: PageBookmark[];
  strokes: PageStroke[];
  focusId: string | null;
  onAddHighlight: (h: PageHighlight) => void;
  onUpdateHighlight: (id: string, patch: Partial<PageHighlight>) => void;
  onDeleteHighlight: (id: string) => void;
  onAddNote: (n: PageNote) => void;
  onUpdateNote: (id: string, patch: Partial<PageNote>) => void;
  onDeleteNote: (id: string) => void;
  onDiscardEmptyNote: (id: string) => void;
  onAddStroke: (s: PageStroke) => void;
  onEraseStrokesAt: (page: number, x: number, y: number) => void;
  onToggleBookmark: (page: number) => void;
  onJumpToPage: (page: number) => void;
  onRemoveBookmark: (id: string) => void;
};

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function StickyNotePaper({
  paper,
  fold,
  rotation = -3,
  compact = false,
}: {
  paper: string;
  fold: string;
  rotation?: number;
  compact?: boolean;
}) {
  const size = compact ? 28 : 36;
  return (
    <svg
      className="phys-sticky-icon"
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <defs>
        <filter id="stickyShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.2" dy="1.8" stdDeviation="1.2" floodOpacity="0.28" />
        </filter>
      </defs>
      <path
        d="M4 3.5h24.5L36 11v25.5H4V3.5Z"
        fill={paper}
        stroke="#6a5a3a"
        strokeWidth="1.1"
        strokeLinejoin="round"
        filter="url(#stickyShadow)"
      />
      <path d="M28.5 3.5v7.5H36" fill={fold} stroke="#6a5a3a" strokeWidth="1.1" strokeLinejoin="round" />
      <path
        d="M10 16h20M10 21.5h20M10 27h12"
        stroke="#8a7040"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

function HighlighterIcon({ color }: { color: string }) {
  return (
    <svg className="phys-hl-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M4.2 16.8 14.8 6.2a1.6 1.6 0 0 1 2.3 0l.7.7a1.6 1.6 0 0 1 0 2.3L7.2 19.8 3.5 20.5l.7-3.7Z"
        fill={color}
        stroke="#333"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <path d="M3.8 20.2h8" stroke={color} strokeWidth="3" strokeLinecap="round" opacity="0.75" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M4 18.5 15.2 7.3a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L7.5 20.5 3.5 21l.5-2.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.8 8.5 17.2 11.9" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M7 3.5h10v17l-5-3.2L7 20.5v-17Z"
        fill="currentColor"
        stroke="#111"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function measureVisiblePages(host: HTMLElement): PageBox[] {
  const hostRect = host.getBoundingClientRect();
  const pages = host.querySelectorAll<HTMLElement>(".book-page[data-page]");
  const boxes: PageBox[] = [];

  pages.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 48 || rect.height < 48) return;

    const overlapW = Math.min(rect.right, hostRect.right) - Math.max(rect.left, hostRect.left);
    const overlapH = Math.min(rect.bottom, hostRect.bottom) - Math.max(rect.top, hostRect.top);
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

function normalizeHighlightRect(x0: number, y0: number, x1: number, y1: number) {
  let x = Math.min(x0, x1);
  let y = Math.min(y0, y1);
  let w = Math.abs(x1 - x0);
  let h = Math.abs(y1 - y0);

  if (w < 0.018 && h < 0.012) return null;

  // Ink band — soft highlighter stroke across a line of text
  if (h < 0.028 || w / Math.max(h, 0.001) > 4.5) {
    const band = Math.max(0.018, Math.min(0.036, h < 0.01 ? 0.024 : h));
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

function strokePathD(points: { x: number; y: number }[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x * 100} ${points[0].y * 100}`;
  for (let i = 1; i < points.length; i += 1) {
    d += ` L ${points[i].x * 100} ${points[i].y * 100}`;
  }
  return d;
}

export function AnnotationLayer({
  active,
  tool,
  color,
  meaning,
  vibe,
  penInk,
  penWidth,
  strokeKind,
  pageIndex,
  isNarrow,
  flipping,
  hostRef,
  highlights,
  notes,
  bookmarks,
  strokes,
  focusId,
  onAddHighlight,
  onUpdateHighlight,
  onDeleteHighlight,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onDiscardEmptyNote,
  onAddStroke,
  onEraseStrokesAt,
  onToggleBookmark,
  onJumpToPage,
  onRemoveBookmark,
}: AnnotationLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<PageBox[]>([]);
  const [draft, setDraft] = useState<DraftRect | null>(null);
  const [selectionMenu, setSelectionMenu] = useState<SelectionMenu | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [openHighlightNoteId, setOpenHighlightNoteId] = useState<string | null>(null);
  const [draftStroke, setDraftStroke] = useState<PageStroke | null>(null);
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
  const noteDragRef = useRef<{
    id: string;
    pointerId: number;
    page: number;
    box: PageBox;
    ox: number;
    oy: number;
  } | null>(null);
  const penRef = useRef<{
    pointerId: number;
    page: number;
    box: PageBox;
    points: { x: number; y: number }[];
  } | null>(null);
  const discardTimerRef = useRef<number | null>(null);
  const interactive = active && !flipping;

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
    const id = window.setInterval(refreshBoxes, interactive ? 280 : 900);
    window.addEventListener("resize", refreshBoxes);
    return () => {
      ro?.disconnect();
      window.clearInterval(id);
      window.removeEventListener("resize", refreshBoxes);
    };
  }, [interactive, pageIndex, isNarrow, refreshBoxes, hostRef, flipping]);

  useEffect(() => {
    if (!active) {
      setSelectedId(null);
      setOpenNoteId(null);
      setOpenHighlightNoteId(null);
      setDraft(null);
      setSelectionMenu(null);
      setDraftStroke(null);
      dragRef.current = null;
      noteTapRef.current = null;
      penRef.current = null;
    }
  }, [active]);

  useEffect(() => {
    if (flipping) {
      setDraft(null);
      setSelectionMenu(null);
      setDraftStroke(null);
      dragRef.current = null;
      penRef.current = null;
    }
  }, [flipping]);

  useEffect(() => {
    if (!focusId) return;
    const hl = highlights.find((h) => h.id === focusId);
    const note = notes.find((n) => n.id === focusId);
    const bm = bookmarks.find((b) => b.id === focusId);
    if (hl) {
      setSelectedId(hl.id);
      if (hl.note) setOpenHighlightNoteId(hl.id);
    } else if (note) {
      setSelectedId(note.id);
      setOpenNoteId(note.id);
    } else if (bm) {
      setSelectedId(bm.id);
    }
  }, [focusId, highlights, notes, bookmarks]);

  useEffect(() => {
    return () => {
      if (discardTimerRef.current != null) window.clearTimeout(discardTimerRef.current);
    };
  }, []);

  const visiblePages = useMemo(() => new Set(boxes.map((b) => b.page)), [boxes]);
  const visibleHighlights = highlights.filter((h) => visiblePages.has(h.page));
  const visibleNotes = notes.filter((n) => visiblePages.has(n.page));
  const visibleStrokes = strokes.filter((s) => visiblePages.has(s.page));
  const visibleBookmarks = bookmarks.filter((b) => visiblePages.has(b.page));

  const localPoint = (clientX: number, clientY: number) => {
    const layer = layerRef.current;
    if (!layer) return null;
    const rect = layer.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
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

  const commitHighlightFromMenu = (withNote: boolean) => {
    if (!selectionMenu) return;
    const id = makeAnnotId("hl");
    const h: PageHighlight = {
      id,
      page: selectionMenu.page,
      ...selectionMenu.rect,
      color,
      meaning: meaning === "none" ? defaultMeaningForColor(color) : meaning,
      text: `Page ${selectionMenu.page + 1}`,
      createdAt: Date.now(),
      note: withNote ? "" : undefined,
    };
    onAddHighlight(h);
    setSelectionMenu(null);
    setSelectedId(id);
    if (withNote) setOpenHighlightNoteId(id);
  };

  const copySelection = async () => {
    if (!selectionMenu) return;
    const text = `Page ${selectionMenu.page + 1}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
    setSelectionMenu(null);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive) return;
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const target = e.target as HTMLElement | null;
    if (
      target?.closest(
        ".annotation-highlight, .annotation-note, .annotation-note-card, .phys-sel-menu, .phys-hl-note, .phys-bookmark-ribbon, .annotation-delete-chip",
      )
    ) {
      return;
    }

    setSelectionMenu(null);
    const pt = localPoint(e.clientX, e.clientY);
    if (!pt) return;
    const hit = hitPage(boxes, pt.x, pt.y);
    if (!hit) return;

    setSelectedId(null);

    if (tool === "bookmark") {
      onToggleBookmark(hit.box.page);
      return;
    }

    if (tool === "note") {
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

    if (tool === "pen" || tool === "eraser") {
      penRef.current = {
        pointerId: e.pointerId,
        page: hit.box.page,
        box: hit.box,
        points: [{ x: hit.rx, y: hit.ry }],
      };
      if (tool === "pen") {
        setDraftStroke({
          id: makeAnnotId("stroke"),
          page: hit.box.page,
          kind: strokeKind,
          color: strokeKind === "highlighter" ? color : penInk,
          width: penWidth,
          points: [{ x: hit.rx, y: hit.ry }],
          createdAt: Date.now(),
        });
      } else {
        onEraseStrokesAt(hit.box.page, hit.rx, hit.ry);
      }
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    // highlight tool — drag band, then contextual menu
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
    const noteDrag = noteDragRef.current;
    if (noteDrag && noteDrag.pointerId === e.pointerId) {
      const pt = localPoint(e.clientX, e.clientY);
      if (!pt) return;
      const rx = clamp01((pt.x - noteDrag.box.left) / noteDrag.box.width);
      const ry = clamp01((pt.y - noteDrag.box.top) / noteDrag.box.height);
      onUpdateNote(noteDrag.id, { x: rx, y: ry });
      return;
    }

    const noteTap = noteTapRef.current;
    if (noteTap && noteTap.pointerId === e.pointerId) {
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

    const pen = penRef.current;
    if (pen && pen.pointerId === e.pointerId) {
      const pt = localPoint(e.clientX, e.clientY);
      if (!pt) return;
      const rx = clamp01((pt.x - pen.box.left) / pen.box.width);
      const ry = clamp01((pt.y - pen.box.top) / pen.box.height);
      pen.points.push({ x: rx, y: ry });
      if (tool === "eraser") {
        onEraseStrokesAt(pen.page, rx, ry);
      } else {
        setDraftStroke((prev) =>
          prev
            ? { ...prev, points: [...pen.points] }
            : null,
        );
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
    if (noteDragRef.current && noteDragRef.current.pointerId === e.pointerId) {
      noteDragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      return;
    }

    const noteTap = noteTapRef.current;
    if (noteTap && noteTap.pointerId === e.pointerId) {
      noteTapRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const id = makeAnnotId("note");
      const rotation = -4 + Math.random() * 8;
      onAddNote({
        id,
        page: noteTap.page,
        x: noteTap.x,
        y: noteTap.y,
        text: "",
        vibe,
        rotation,
        createdAt: Date.now(),
      });
      setOpenNoteId(id);
      setSelectedId(id);
      return;
    }

    const pen = penRef.current;
    if (pen && pen.pointerId === e.pointerId) {
      penRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      if (tool === "pen" && draftStroke && draftStroke.points.length >= 2) {
        onAddStroke(draftStroke);
      }
      setDraftStroke(null);
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
    setSelectionMenu({
      page: drag.page,
      x: normalized.x + normalized.w / 2,
      y: normalized.y,
      rect: normalized,
      clientX: e.clientX,
      clientY: e.clientY,
    });
  };

  const draftNorm = draft ? normalizeHighlightRect(draft.x0, draft.y0, draft.x1, draft.y1) : null;
  const toolClass =
    tool === "highlight"
      ? "tool-highlight"
      : tool === "note"
        ? "tool-note"
        : tool === "pen"
          ? "tool-pen"
          : tool === "eraser"
            ? "tool-eraser"
            : "tool-bookmark";

  return (
    <div
      ref={layerRef}
      className={`annotation-layer ${interactive ? "is-active" : "is-passive"} ${toolClass}`}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      aria-hidden={!interactive}
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
          <svg
            className="annotation-stroke-layer"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {visibleStrokes
              .filter((s) => s.page === box.page)
              .map((s) => {
                const ink =
                  s.kind === "highlighter"
                    ? highlightFill(normalizeColorSafe(s.color))
                    : PEN_INKS.find((p) => p.id === s.color)?.css ?? s.color;
                const sw = penWidthPx(s.width, s.kind);
                return (
                  <path
                    key={s.id}
                    d={strokePathD(s.points)}
                    fill="none"
                    stroke={ink}
                    strokeWidth={(sw / Math.max(box.width, 1)) * 100}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={s.kind === "highlighter" ? 0.55 : 0.92}
                    vectorEffect="non-scaling-stroke"
                    style={
                      s.kind === "highlighter"
                        ? { mixBlendMode: "multiply" }
                        : undefined
                    }
                  />
                );
              })}
            {draftStroke && draftStroke.page === box.page ? (
              <path
                d={strokePathD(draftStroke.points)}
                fill="none"
                stroke={
                  draftStroke.kind === "highlighter"
                    ? highlightFill(color)
                    : PEN_INKS.find((p) => p.id === penInk)?.css ?? "#111"
                }
                strokeWidth={
                  (penWidthPx(penWidth, draftStroke.kind) / Math.max(box.width, 1)) * 100
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={draftStroke.kind === "highlighter" ? 0.5 : 0.9}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
          </svg>

          {visibleHighlights
            .filter((h) => h.page === box.page)
            .map((h) => {
              const selected = selectedId === h.id || focusId === h.id;
              return (
                <div
                  key={h.id}
                  role="button"
                  tabIndex={interactive ? 0 : -1}
                  className={`annotation-highlight ${selected ? "is-selected" : ""} ${
                    h.note ? "has-note" : ""
                  }`}
                  style={{
                    left: `${h.x * 100}%`,
                    top: `${h.y * 100}%`,
                    width: `${h.w * 100}%`,
                    height: `${h.h * 100}%`,
                    background: highlightFill(h.color),
                  }}
                  title={h.note || h.meaning || "Highlight"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (!interactive && !h.note) return;
                    setOpenNoteId(null);
                    setSelectedId((cur) => (cur === h.id ? null : h.id));
                    if (h.note != null) setOpenHighlightNoteId(h.id);
                  }}
                >
                  {h.note != null && h.note !== undefined ? (
                    <button
                      type="button"
                      className="phys-margin-tick"
                      aria-label="Open highlight note"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setOpenHighlightNoteId(h.id);
                        setSelectedId(h.id);
                      }}
                    />
                  ) : null}
                  {interactive && selected ? (
                    <div className="annotation-hl-actions" onPointerDown={(ev) => ev.stopPropagation()}>
                      <button
                        type="button"
                        className="annotation-delete-chip"
                        onClick={() => {
                          setOpenHighlightNoteId(h.id);
                        }}
                      >
                        Note
                      </button>
                      <button
                        type="button"
                        className="annotation-delete-chip"
                        onClick={() => {
                          onDeleteHighlight(h.id);
                          setSelectedId(null);
                          setOpenHighlightNoteId(null);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}

          {visibleNotes
            .filter((n) => n.page === box.page)
            .map((n) => {
              const open =
                openNoteId === n.id || (interactive && !n.text && selectedId === n.id);
              const paper = notePaper(n.vibe);
              const rot = n.rotation ?? -2;
              return (
                <div
                  key={n.id}
                  className={`annotation-note vibe-${n.vibe} ${open ? "is-open" : ""} ${
                    selectedId === n.id ? "is-selected" : ""
                  } ${n.x > 0.52 ? "popup-left" : "popup-right"} ${
                    n.y > 0.45 ? "popup-above" : "popup-below"
                  }`}
                  style={{
                    left: `${n.x * 100}%`,
                    top: `${n.y * 100}%`,
                  }}
                  onPointerDown={(ev) => {
                    if (!interactive) {
                      ev.stopPropagation();
                      return;
                    }
                    ev.stopPropagation();
                    noteDragRef.current = {
                      id: n.id,
                      pointerId: ev.pointerId,
                      page: n.page,
                      box,
                      ox: n.x,
                      oy: n.y,
                    };
                    try {
                      (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
                    } catch {
                      // ignore
                    }
                  }}
                >
                  <button
                    type="button"
                    className="phys-sticky-pin annotation-note-pin"
                    aria-label={`${noteVibeLabel(n.vibe)} sticky note`}
                    title={n.text || noteVibeLabel(n.vibe)}
                    onClick={() => {
                      setSelectedId(n.id);
                      setOpenNoteId(n.id);
                    }}
                  >
                    <StickyNotePaper paper={paper.paper} fold={paper.fold} rotation={rot} />
                  </button>

                  {open
                    ? (() => {
                        const popup = (
                          <div
                            className={`phys-note-card annotation-note-card ${
                              isNarrow ? "annotation-note-portal" : ""
                            }`}
                            style={{
                              background: paper.paper,
                              ["--sticky-fold" as string]: paper.fold,
                            }}
                            onPointerDown={(ev) => ev.stopPropagation()}
                          >
                            <div className="phys-note-card-head annotation-note-card-head">
                              <span className="phys-note-card-title">Sticky note</span>
                              {interactive ? (
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
                                  onClick={() => setOpenNoteId(null)}
                                >
                                  Close
                                </button>
                              )}
                            </div>
                            {interactive ? (
                              <textarea
                                autoFocus={!n.text || openNoteId === n.id}
                                value={n.text}
                                placeholder="Write on the sticky…"
                                rows={3}
                                maxLength={500}
                                onChange={(ev) =>
                                  onUpdateNote(n.id, { text: ev.target.value.slice(0, 500) })
                                }
                                onBlur={(ev) => {
                                  const related = ev.relatedTarget as Node | null;
                                  if (
                                    related &&
                                    (ev.currentTarget
                                      .closest(".annotation-note, .annotation-note-portal")
                                      ?.contains(related) ||
                                      document
                                        .querySelector(".annotation-note-portal")
                                        ?.contains(related))
                                  ) {
                                    return;
                                  }
                                  scheduleDiscardIfEmpty(n.id, ev.currentTarget.value);
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
                        );
                        return isNarrow && typeof document !== "undefined"
                          ? createPortal(popup, document.body)
                          : popup;
                      })()
                    : null}
                </div>
              );
            })}

          {visibleBookmarks
            .filter((b) => b.page === box.page)
            .map((b) => (
              <button
                key={b.id}
                type="button"
                className={`phys-bookmark-ribbon ${selectedId === b.id ? "is-selected" : ""}`}
                style={{ top: `${12 + (b.page % 5) * 10}%` }}
                title={`Bookmark · page ${b.page + 1}`}
                aria-label={`Bookmark page ${b.page + 1}`}
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (interactive) {
                    onRemoveBookmark(b.id);
                  } else {
                    onJumpToPage(b.page);
                  }
                }}
              >
                <span className="phys-bookmark-tail" />
              </button>
            ))}

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

          {selectionMenu && selectionMenu.page === box.page ? (
            <div
              className="phys-sel-menu"
              style={{
                left: `${selectionMenu.x * 100}%`,
                top: `${selectionMenu.y * 100}%`,
              }}
              onPointerDown={(ev) => ev.stopPropagation()}
            >
              <button type="button" onClick={() => commitHighlightFromMenu(false)}>
                Highlight
              </button>
              <button type="button" onClick={() => commitHighlightFromMenu(true)}>
                Note
              </button>
              <button type="button" onClick={() => void copySelection()}>
                Copy
              </button>
              <button type="button" className="is-muted" onClick={() => setSelectionMenu(null)}>
                ✕
              </button>
            </div>
          ) : null}
        </div>
      ))}

      {openHighlightNoteId
        ? (() => {
            const h = highlights.find((x) => x.id === openHighlightNoteId);
            if (!h) return null;
            const panel = (
              <div
                className={`phys-hl-note ${isNarrow ? "is-sheet" : "is-float"}`}
                onPointerDown={(ev) => ev.stopPropagation()}
              >
                <div className="phys-hl-note-head">
                  <span>
                    Highlight note · p.{h.page + 1}
                    {h.meaning && h.meaning !== "none" ? ` · ${h.meaning}` : ""}
                  </span>
                  <button type="button" onClick={() => setOpenHighlightNoteId(null)}>
                    Close
                  </button>
                </div>
                <div className="phys-hl-note-swatches" role="group" aria-label="Recolor">
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={h.color === c.id ? "is-on" : ""}
                      style={{ background: c.solid }}
                      aria-label={c.label}
                      onClick={() =>
                        onUpdateHighlight(h.id, {
                          color: c.id,
                          meaning: defaultMeaningForColor(c.id),
                        })
                      }
                    />
                  ))}
                </div>
                <textarea
                  value={h.note ?? ""}
                  placeholder="Attach a note to this highlight…"
                  rows={isNarrow ? 4 : 5}
                  maxLength={800}
                  autoFocus
                  onChange={(ev) =>
                    onUpdateHighlight(h.id, { note: ev.target.value.slice(0, 800) })
                  }
                />
              </div>
            );
            return typeof document !== "undefined" ? createPortal(panel, document.body) : panel;
          })()
        : null}
    </div>
  );
}

function normalizeColorSafe(raw: string): HighlightColor {
  if (raw === "yellow" || raw === "blue" || raw === "green" || raw === "pink" || raw === "orange") {
    return raw;
  }
  return "yellow";
}

export function AnnotationToolbar({
  tool,
  color,
  meaning,
  vibe,
  penInk,
  penWidth,
  strokeKind,
  canUndo,
  canRedo,
  pageBookmarked,
  onTool,
  onColor,
  onMeaning,
  onVibe,
  onPenInk,
  onPenWidth,
  onStrokeKind,
  onUndo,
  onRedo,
  onToggleBookmark,
  onOpenNotes,
  onDone,
  showDone = false,
}: {
  tool: AnnotTool;
  color: HighlightColor;
  meaning: ColorMeaning;
  vibe: NoteVibe;
  penInk: PenInk;
  penWidth: PenWidth;
  strokeKind: StrokeKind;
  canUndo: boolean;
  canRedo: boolean;
  pageBookmarked: boolean;
  onTool: (t: AnnotTool) => void;
  onColor: (c: HighlightColor) => void;
  onMeaning: (m: ColorMeaning) => void;
  onVibe: (v: NoteVibe) => void;
  onPenInk: (c: PenInk) => void;
  onPenWidth: (w: PenWidth) => void;
  onStrokeKind: (k: StrokeKind) => void;
  onUndo: () => void;
  onRedo: () => void;
  onToggleBookmark: () => void;
  onOpenNotes: () => void;
  onDone?: () => void;
  showDone?: boolean;
}) {
  return (
    <div className="annotation-toolbar phys-annot-toolbar">
      <div className="annotation-toolbar-row" role="group" aria-label="Annotation tools">
        <button
          type="button"
          className={`annot-tool ${tool === "pen" ? "is-on" : ""}`}
          onClick={() => onTool("pen")}
          aria-pressed={tool === "pen"}
          title="Pen (P)"
        >
          <PenIcon />
          <span className="annot-tool-label-full">Pen</span>
          <span className="annot-tool-label-short">Pen</span>
        </button>
        <button
          type="button"
          className={`annot-tool ${tool === "highlight" ? "is-on" : ""}`}
          onClick={() => onTool("highlight")}
          aria-pressed={tool === "highlight"}
          title="Highlight (H)"
        >
          <HighlighterIcon color={highlightSolid(color)} />
          <span className="annot-tool-label-full">Highlight</span>
          <span className="annot-tool-label-short">HL</span>
        </button>
        <button
          type="button"
          className={`annot-tool ${tool === "note" ? "is-on" : ""}`}
          onClick={() => onTool("note")}
          aria-pressed={tool === "note"}
          title="Sticky note (N)"
        >
          <StickyNotePaper
            paper={NOTE_VIBES.find((v) => v.id === vibe)?.paper ?? "#fff3a0"}
            fold={NOTE_VIBES.find((v) => v.id === vibe)?.fold ?? "#e8d56a"}
            compact
          />
          <span className="annot-tool-label-full">Note</span>
          <span className="annot-tool-label-short">Note</span>
        </button>
        <button
          type="button"
          className={`annot-tool ${pageBookmarked || tool === "bookmark" ? "is-on" : ""}`}
          onClick={() => {
            onTool("bookmark");
            onToggleBookmark();
          }}
          aria-pressed={pageBookmarked}
          title="Bookmark (B)"
        >
          <BookmarkIcon />
          <span className="annot-tool-label-full">Bookmark</span>
          <span className="annot-tool-label-short">Mark</span>
        </button>
        <button
          type="button"
          className={`annot-tool ${tool === "eraser" ? "is-on" : ""}`}
          onClick={() => onTool("eraser")}
          aria-pressed={tool === "eraser"}
          title="Eraser"
        >
          Erase
        </button>

        <span className="annotation-toolbar-divider" aria-hidden />

        {tool === "pen" ? (
          <>
            <div className="annotation-swatches" role="group" aria-label="Ink">
              {PEN_INKS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`swatch ${penInk === c.id && strokeKind === "pen" ? "is-on" : ""}`}
                  style={{ background: c.css }}
                  aria-label={c.label}
                  onClick={() => {
                    onStrokeKind("pen");
                    onPenInk(c.id);
                  }}
                />
              ))}
              {HIGHLIGHT_COLORS.slice(0, 3).map((c) => (
                <button
                  key={`hl-${c.id}`}
                  type="button"
                  className={`swatch ${strokeKind === "highlighter" && color === c.id ? "is-on" : ""}`}
                  style={{ background: c.solid }}
                  aria-label={`Freehand ${c.label}`}
                  title="Freehand highlighter"
                  onClick={() => {
                    onStrokeKind("highlighter");
                    onColor(c.id);
                  }}
                />
              ))}
            </div>
            <div className="phys-width-row" role="group" aria-label="Stroke width">
              {PEN_WIDTHS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className={`phys-width-btn ${penWidth === w.id ? "is-on" : ""}`}
                  onClick={() => onPenWidth(w.id)}
                >
                  {w.label[0]}
                </button>
              ))}
            </div>
          </>
        ) : null}

        {tool === "highlight" ? (
          <>
            <div className="annotation-swatches" role="group" aria-label="Highlight color">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`swatch swatch-${c.id} ${color === c.id ? "is-on" : ""}`}
                  aria-label={`${c.label} (${c.meaning})`}
                  title={`${c.label} · ${c.meaning}`}
                  style={{ background: c.solid }}
                  onClick={() => {
                    onColor(c.id);
                    onMeaning(c.meaning);
                  }}
                />
              ))}
            </div>
            <select
              className="phys-meaning-select"
              aria-label="Color meaning"
              value={meaning}
              onChange={(e) => onMeaning(e.target.value as ColorMeaning)}
            >
              {COLOR_MEANINGS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </>
        ) : null}

        {tool === "note" ? (
          <div className="annotation-swatches" role="group" aria-label="Sticky color">
            {NOTE_VIBES.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`swatch ${vibe === v.id ? "is-on" : ""}`}
                aria-label={v.label}
                style={{ background: v.paper }}
                onClick={() => onVibe(v.id)}
              />
            ))}
          </div>
        ) : null}

        <span className="annotation-toolbar-divider" aria-hidden />
        <button
          type="button"
          className="annot-tool"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo"
        >
          Undo
        </button>
        <button
          type="button"
          className="annot-tool"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo"
        >
          Redo
        </button>
        <button type="button" className="annot-tool" onClick={onOpenNotes} title="My Notes">
          Notes
        </button>
        {showDone && onDone ? (
          <button type="button" className="annot-tool annot-tool-done" onClick={onDone}>
            Done
          </button>
        ) : null}
      </div>
      <p className="annotation-hint">
        {tool === "highlight"
          ? "Drag across the page like a real highlighter — then Highlight, Note, or Copy"
          : tool === "note"
            ? "Tap to place a paper sticky — drag to move"
            : tool === "pen"
              ? strokeKind === "highlighter"
                ? "Draw a freehand highlighter band"
                : "Ink on the page — never writes into the PDF"
              : tool === "eraser"
                ? "Rub out pen strokes only"
                : "Bookmark this page with a ribbon"}
      </p>
    </div>
  );
}
