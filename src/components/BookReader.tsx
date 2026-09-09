"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageFlip } from "page-flip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AnnotationLayer, AnnotationToolbar } from "@/components/AnnotationLayer";
import {
  createAnnotationHistory,
  loadAnnotations,
  saveAnnotations,
  type HighlightColor,
  type NoteVibe,
  type PageHighlight,
  type PageNote,
} from "@/lib/annotations";
import {
  downloadBookBundle,
  saveLibraryBook,
  updateLibraryProgress,
} from "@/lib/library";
import { loadPdfDocument, renderPdfPageToCanvas, type OpenedPdf } from "@/lib/pdf";
import { getSavedPage, savePage } from "@/lib/session";
import { playPageTurnSound, unlockPageSound } from "@/lib/sound";
import { emitPageFlipSignal, emitReaderClose, emitReaderOpen } from "@/lib/feedback";

const SIZE_STRETCH = "stretch" as const;
const CORNER_BOTTOM = "bottom" as const;
const SWIPE_DISTANCE = 45;
const SWIPE_TIMEOUT_MS = 280;
const DRAG_THRESHOLD = 8;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;

type BookReaderProps = {
  document: OpenedPdf;
  onExit: () => void;
};

type GesturePoint = { x: number; y: number };

/** Touch-primary (phone/tablet) vs mouse-primary (laptop/desktop). */
function useTouchPrimary(breakpoint = 768) {
  const [touchPrimary, setTouchPrimary] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches ||
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(any-pointer: coarse)").matches
    );
  });

  useEffect(() => {
    const queries = [
      window.matchMedia(`(max-width: ${breakpoint - 1}px)`),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(any-pointer: coarse)"),
    ];
    const update = () => {
      setTouchPrimary(queries.some((q) => q.matches));
    };
    update();
    for (const q of queries) q.addEventListener("change", update);
    return () => {
      for (const q of queries) q.removeEventListener("change", update);
    };
  }, [breakpoint]);

  return touchPrimary;
}

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return narrow;
}

function clientToBookPos(flip: PageFlip, clientX: number, clientY: number): GesturePoint {
  const rect = flip.getUI().getDistElement().getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/**
 * StPageFlip's flipPrev() passes x:10, which fails disableFlipByClick corner checks
 * in portrait (bounds.left is negative). Pass a real left-edge corner instead.
 */
function animateFlip(flip: PageFlip, direction: "prev" | "next") {
  if (direction === "next") {
    flip.flipNext(CORNER_BOTTOM as never);
    return;
  }
  const rect = flip.getBoundsRect();
  flip.getFlipController().flip({
    x: rect.left + 10,
    y: rect.height - 2,
  });
}

export function BookReader({ document: doc, onExit }: BookReaderProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderedRef = useRef<Set<number>>(new Set());
  const renderingRef = useRef<Set<number>>(new Set());
  const soundOnRef = useRef(false);
  const lastIndexRef = useRef(0);
  const ignoreSoundUntilRef = useRef(0);
  const zoomRef = useRef(1);
  const readyRef = useRef(false);
  const gestureRef = useRef<{
    pointerId: number;
    startClient: GesturePoint;
    startBook: GesturePoint;
    startTime: number;
    moved: boolean;
    folding: boolean;
    foldTimer: number | null;
    foldArmed: boolean;
  } | null>(null);

  const isNarrow = useIsNarrow();
  const touchPrimary = useTouchPrimary();
  const layoutKey = `${isNarrow ? "portrait" : "landscape"}-${touchPrimary ? "touch" : "mouse"}`;

  const [pageIndex, setPageIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("Opening book…");
  const [resumeHint, setResumeHint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [jumpDraft, setJumpDraft] = useState("");
  const [editingJump, setEditingJump] = useState(false);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotTool, setAnnotTool] = useState<"highlight" | "note">("highlight");
  const [annotColor, setAnnotColor] = useState<HighlightColor>("lime");
  const [annotVibe, setAnnotVibe] = useState<NoteVibe>("note to self");
  const [highlights, setHighlights] = useState<PageHighlight[]>([]);
  const [notes, setNotes] = useState<PageNote[]>([]);
  const [markedFlash, setMarkedFlash] = useState(false);
  const [annotsHydrated, setAnnotsHydrated] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [downloadFlash, setDownloadFlash] = useState<string | null>(null);
  const [libraryHint, setLibraryHint] = useState<string | null>(null);
  const historyRef = useRef(createAnnotationHistory());
  const annotsRef = useRef({ highlights, notes });
  const noteEditBatchRef = useRef<Set<string>>(new Set());
  const persistTimerRef = useRef<number | null>(null);

  soundOnRef.current = soundOn;
  zoomRef.current = zoom;
  readyRef.current = ready;
  annotsRef.current = { highlights, notes };

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const pushAnnotHistory = useCallback(() => {
    historyRef.current.push(annotsRef.current);
    noteEditBatchRef.current.clear();
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  useEffect(() => {
    let cancelled = false;
    setAnnotsHydrated(false);
    void (async () => {
      let data = loadAnnotations(doc.id);
      if (data.highlights.length === 0 && data.notes.length === 0) {
        try {
          const { getLibraryAnnotations } = await import("@/lib/library");
          const fromLib = await getLibraryAnnotations(doc.id);
          if (fromLib && (fromLib.highlights.length > 0 || fromLib.notes.length > 0)) {
            data = fromLib;
            saveAnnotations(doc.id, data);
          }
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      setHighlights(data.highlights);
      setNotes(data.notes);
      setAnnotateMode(false);
      historyRef.current.clear();
      noteEditBatchRef.current.clear();
      setCanUndo(false);
      setCanRedo(false);
      setAnnotsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  // Signal meaningful reader use for the experience-feedback popup.
  useEffect(() => {
    emitReaderOpen();
    return () => emitReaderClose();
  }, []);

  // Persist the PDF in IndexedDB for long-period resume (same browser).
  useEffect(() => {
    let cancelled = false;
    setLibraryHint(null);
    void (async () => {
      const result = await saveLibraryBook({
        id: doc.id,
        name: doc.name,
        data: doc.data,
        pageCount: doc.pageCount,
        lastPage: getSavedPage(doc.id) ?? 0,
        annotations: loadAnnotations(doc.id),
      });
      if (cancelled) return;
      if (result.ok && result.skipped) {
        setLibraryHint("Book is too large to keep for resume — download a copy to keep it.");
      } else if (!result.ok) {
        setLibraryHint(
          result.reason === "quota"
            ? "Browser storage is full — download a copy to keep this book."
            : "Couldn’t keep this book for resume — download a copy instead.",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.name, doc.data, doc.pageCount]);

  useEffect(() => {
    if (!annotsHydrated) return;
    saveAnnotations(doc.id, { highlights, notes });
    if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void updateLibraryProgress(doc.id, { annotations: { highlights, notes } });
    }, 400);
    return () => {
      if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    };
  }, [doc.id, highlights, notes, annotsHydrated]);

  const ensurePagesRendered = useCallback(
    async (centerIndex: number, radiusOverride?: number) => {
      const pdf = pdfRef.current;
      if (!pdf) return;

      const radius = radiusOverride ?? (isNarrow ? 2 : 3);
      const targets: number[] = [];
      for (let i = centerIndex - radius; i <= centerIndex + radius; i += 1) {
        if (i >= 0 && i < doc.pageCount) targets.push(i);
      }

      // Drop far-away rendered flags so memory can be recycled later if needed
      for (const idx of [...renderedRef.current]) {
        if (Math.abs(idx - centerIndex) > radius + 4) {
          renderedRef.current.delete(idx);
        }
      }

      // Paint the center page first so the book can appear ASAP, then neighbors.
      const ordered = [...targets].sort(
        (a, b) => Math.abs(a - centerIndex) - Math.abs(b - centerIndex),
      );
      const first = ordered[0];
      const rest = ordered.slice(1);

      const paint = async (index: number) => {
        if (renderedRef.current.has(index) || renderingRef.current.has(index)) return;
        renderingRef.current.add(index);
        const pageEl = window.document.querySelector(
          `.book-page[data-page="${index}"]`,
        ) as HTMLElement | null;
        const canvas = pageEl?.querySelector("canvas") as HTMLCanvasElement | null;
        if (!canvas) {
          renderingRef.current.delete(index);
          return;
        }
        try {
          await renderPdfPageToCanvas(pdf, index + 1, canvas);
          renderedRef.current.add(index);
          pageEl?.classList.remove("loading");
          pageEl?.classList.remove("render-error");
        } catch {
          pageEl?.classList.add("render-error");
          pageEl?.setAttribute(
            "data-error",
            "This page couldn't be rendered. Try reopening the document.",
          );
        } finally {
          renderingRef.current.delete(index);
        }
      };

      if (first != null) await paint(first);
      if (rest.length) await Promise.all(rest.map((index) => paint(index)));
    },
    [doc.pageCount, isNarrow],
  );

  const canAnimateFlip = useCallback(() => {
    const flip = flipRef.current;
    if (!readyRef.current || !flip) return false;
    const state = flip.getState();
    return state === "read" || state === "fold_corner";
  }, []);

  const goPrev = useCallback(() => {
    if (!canAnimateFlip() || !flipRef.current) return;
    animateFlip(flipRef.current, "prev");
  }, [canAnimateFlip]);

  const goNext = useCallback(() => {
    if (!canAnimateFlip() || !flipRef.current) return;
    animateFlip(flipRef.current, "next");
  }, [canAnimateFlip]);

  useEffect(() => {
    let cancelled = false;
    let hideTimer: number | undefined;
    let flip: PageFlip | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function setup() {
      try {
        setReady(false);
        readyRef.current = false;
        setError(null);
        setStatus("Opening book…");
        renderedRef.current = new Set();
        renderingRef.current = new Set();

        // Reuse the document already parsed during upload when available.
        const pdf = await loadPdfDocument(doc.data, doc.id);
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        pdfRef.current = pdf;

        let saved = getSavedPage(doc.id);
        if (saved == null) {
          try {
            const { getLibraryLastPage } = await import("@/lib/library");
            saved = await getLibraryLastPage(doc.id);
          } catch {
            // ignore
          }
        }
        const startPage =
          saved != null && saved >= 0 && saved < doc.pageCount ? saved : 0;
        if (saved != null && saved > 0) {
          setResumeHint(saved + 1);
          window.setTimeout(() => setResumeHint(null), 4500);
        } else {
          setResumeHint(null);
        }

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled || !hostRef.current || !pagesRef.current) return;

        const pageNodes = pagesRef.current.querySelectorAll(".book-page");
        if (pageNodes.length === 0) {
          setError("Could not prepare book pages.");
          return;
        }

        // Only block open on the landing page ±1; warm a wider radius after flipbook mounts.
        setStatus("Rendering pages…");

        const host = hostRef.current;
        const measure = () => {
          // Size PageFlip from layout box only — visual zoom is CSS scale on the host.
          let availW = Math.max(0, host.clientWidth);
          let availH = Math.max(0, host.clientHeight);
          // Fallback if a wrapper collapsed % sizing (host 0×0) — use stage box.
          if (availW < 80 || availH < 80) {
            const stage = host.closest(".reader-stage") as HTMLElement | null;
            if (stage) {
              const pad = 24;
              availW = Math.max(availW, stage.clientWidth - pad);
              availH = Math.max(availH, stage.clientHeight - pad);
            }
          }
          // Desktop: fill the open-book frame more aggressively; touch stays compact.
          const widthDivisor = isNarrow ? 1.08 : touchPrimary ? 2.15 : 2.02;
          const pageWidth = Math.min(
            touchPrimary ? 560 : 640,
            Math.max(160, Math.floor(availW / widthDivisor)),
          );
          const pageHeight = Math.min(
            Math.floor(availH * (touchPrimary ? 0.92 : 0.96)),
            Math.floor(pageWidth * 1.38),
          );
          return { pageWidth, pageHeight, availW, availH };
        };

        // Size the host while the first pages paint — don't serialize the two waits.
        // Prefer rAF (one frame) over fixed 50ms sleeps for faster readiness.
        const layoutReady = (async () => {
          for (let attempt = 0; attempt < 40; attempt += 1) {
            const m = measure();
            if (m.availW >= 80 && m.availH >= 80 && m.pageWidth >= 120 && m.pageHeight >= 140) {
              return m;
            }
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
            if (cancelled || !hostRef.current) return null;
          }
          return null;
        })();

        // Block open only on landing page ±1; neighbors warm after mount.
        await ensurePagesRendered(startPage, 1);
        if (cancelled || !hostRef.current) return;

        const sized = await layoutReady;
        if (cancelled || !hostRef.current) return;
        if (!sized) {
          setError("Could not size the book for this screen.");
          setStatus("");
          return;
        }
        const { pageWidth, pageHeight } = sized;

        ignoreSoundUntilRef.current = Date.now() + 900;

        // Touch: we drive gestures via the overlay (useMouseEvents false) so tap
        // zones don't fight native handlers. Desktop: StPageFlip mouse drag + buttons.
        flip = new PageFlip(host, {
          width: pageWidth,
          height: pageHeight,
          size: SIZE_STRETCH,
          minWidth: 220,
          maxWidth: touchPrimary ? 720 : 780,
          minHeight: 300,
          maxHeight: touchPrimary ? 1100 : 1200,
          drawShadow: true,
          maxShadowOpacity: touchPrimary ? 0.5 : 0.72,
          showCover: false,
          mobileScrollSupport: false,
          swipeDistance: SWIPE_DISTANCE,
          flippingTime: touchPrimary ? 650 : 820,
          usePortrait: true,
          autoSize: true,
          startPage,
          useMouseEvents: !touchPrimary,
          disableFlipByClick: true,
          showPageCorners: !touchPrimary,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        flip.loadFromHTML(pageNodes as NodeListOf<HTMLElement>);
        flipRef.current = flip;
        lastIndexRef.current = startPage;
        setPageIndex(startPage);
        setJumpDraft(String(startPage + 1));
        setReady(true);
        readyRef.current = true;
        setStatus("");

          flip.on("flip", (e) => {
          const index = Number(e.data);
          setPageIndex(index);
          setJumpDraft(String(index + 1));
          savePage(doc.id, index);
          void updateLibraryProgress(doc.id, { lastPage: index });
          const pageChanged = index !== lastIndexRef.current;
          const shouldSound =
            soundOnRef.current &&
            pageChanged &&
            Date.now() > ignoreSoundUntilRef.current;
          if (shouldSound) {
            playPageTurnSound(true);
          }
          if (pageChanged) {
            emitPageFlipSignal();
          }
          lastIndexRef.current = index;
          void ensurePagesRendered(index);
        });

        // Nearby pages continue loading in the background after first paint.
        void ensurePagesRendered(startPage);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            // PageFlip stretch mode adapts; keep nearby pages warm
            void ensurePagesRendered(lastIndexRef.current);
          });
          resizeObserver.observe(host);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError("We couldn't open this PDF.");
          setStatus("");
        }
      }
    }

    void setup();

    const revealChrome = () => {
      setChromeVisible(true);
      window.clearTimeout(hideTimer);
      // Keep chrome up while the book is still opening
      if (!flipRef.current) return;
      hideTimer = window.setTimeout(() => setChromeVisible(false), 2600);
    };
    window.addEventListener("mousemove", revealChrome);
    window.addEventListener("touchstart", revealChrome, { passive: true });
    // Don't auto-hide until setup has a chance to finish
    hideTimer = window.setTimeout(() => {
      if (flipRef.current) setChromeVisible(false);
    }, 5000);

    return () => {
      cancelled = true;
      window.clearTimeout(hideTimer);
      window.removeEventListener("mousemove", revealChrome);
      window.removeEventListener("touchstart", revealChrome);
      resizeObserver?.disconnect();
      flipRef.current = null;
      gestureRef.current = null;
      try {
        flip?.destroy();
      } catch {
        // ignore
      }
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [doc.id, doc.data, doc.pageCount, isNarrow, touchPrimary, layoutKey, ensurePagesRendered]);

  const jumpToPage = useCallback(
    (raw: string) => {
      const n = Number.parseInt(raw, 10);
      if (!Number.isFinite(n)) return;
      const clamped = Math.min(Math.max(n, 1), doc.pageCount);
      const index = clamped - 1;
      ignoreSoundUntilRef.current = Date.now() + 400;
      try {
        flipRef.current?.turnToPage(index);
        setPageIndex(index);
        setJumpDraft(String(clamped));
        savePage(doc.id, index);
        void updateLibraryProgress(doc.id, { lastPage: index });
        void ensurePagesRendered(index);
      } catch {
        // ignore
      }
      setEditingJump(false);
    },
    [doc.id, doc.pageCount, ensurePagesRendered],
  );

  const handleDownload = useCallback(() => {
    try {
      const bundle = downloadBookBundle(doc, { highlights, notes });
      setDownloadFlash(
        bundle.annotationsName
          ? `Saved ${bundle.pdfName} + notes`
          : `Saved ${bundle.pdfName}`,
      );
      window.setTimeout(() => setDownloadFlash(null), 3200);
    } catch (err) {
      console.error(err);
      setDownloadFlash("Download failed");
      window.setTimeout(() => setDownloadFlash(null), 3200);
    }
  }, [doc, highlights, notes]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!window.document.fullscreenElement) {
        await window.document.documentElement.requestFullscreen();
      } else {
        await window.document.exitFullscreen();
      }
    } catch {
      // unsupported — mobile already uses almost-fullscreen reader shell
    }
  }, []);

  const toggleSound = useCallback(async () => {
    if (!soundOn) {
      const ok = await unlockPageSound();
      setSoundOn(ok);
    } else {
      setSoundOn(false);
    }
  }, [soundOn]);

  const clampZoom = useCallback((value: number) => {
    const stepped = Math.round(value / ZOOM_STEP) * ZOOM_STEP;
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(stepped * 100) / 100));
  }, []);

  const bumpZoom = useCallback(
    (delta: number) => {
      setZoom((z) => clampZoom(z + delta));
    },
    [clampZoom],
  );

  const resetZoom = useCallback(() => {
    setZoom(1);
  }, []);

  const addHighlight = useCallback(
    (h: PageHighlight) => {
      pushAnnotHistory();
      setHighlights((prev) => [...prev, h]);
      setMarkedFlash(true);
      window.setTimeout(() => setMarkedFlash(false), 900);
    },
    [pushAnnotHistory],
  );

  const deleteHighlight = useCallback(
    (id: string) => {
      pushAnnotHistory();
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    },
    [pushAnnotHistory],
  );

  const addNote = useCallback(
    (n: PageNote) => {
      pushAnnotHistory();
      setNotes((prev) => [...prev, n]);
    },
    [pushAnnotHistory],
  );

  const updateNote = useCallback(
    (id: string, text: string) => {
      // Coalesce keystrokes for one sticky into a single undo step.
      if (!noteEditBatchRef.current.has(id)) {
        historyRef.current.push(annotsRef.current);
        noteEditBatchRef.current.add(id);
        syncHistoryFlags();
      }
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
    },
    [syncHistoryFlags],
  );

  const deleteNote = useCallback(
    (id: string) => {
      pushAnnotHistory();
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [pushAnnotHistory],
  );

  const undoAnnot = useCallback(() => {
    const next = historyRef.current.undo(annotsRef.current);
    if (!next) return;
    noteEditBatchRef.current.clear();
    setHighlights(next.highlights);
    setNotes(next.notes);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const redoAnnot = useCallback(() => {
    const next = historyRef.current.redo(annotsRef.current);
    if (!next) return;
    noteEditBatchRef.current.clear();
    setHighlights(next.highlights);
    setNotes(next.notes);
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  // Mobile / tablet: finger-follow drag + half-page taps via gesture layer
  const onGesturePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (annotateMode) return;
      if (!touchPrimary || !readyRef.current) return;
      const flip = flipRef.current;
      if (!flip) return;
      if (flip.getState() === "flipping") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      const startBook = clientToBookPos(flip, e.clientX, e.clientY);
      const gesture = {
        pointerId: e.pointerId,
        startClient: { x: e.clientX, y: e.clientY },
        startBook,
        startTime: Date.now(),
        moved: false,
        folding: false,
        foldTimer: null as number | null,
        foldArmed: false,
      };
      // Match StPageFlip: delay fold so a quick swipe never starts USER_FOLD
      gesture.foldTimer = window.setTimeout(() => {
        if (gestureRef.current === gesture) gesture.foldArmed = true;
      }, SWIPE_TIMEOUT_MS);
      gestureRef.current = gesture;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic / non-capturable pointers (e.g. test harness)
      }
    },
    [touchPrimary, annotateMode],
  );

  const onGesturePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (annotateMode) return;
      const gesture = gestureRef.current;
      const flip = flipRef.current;
      if (!gesture || !flip || gesture.pointerId !== e.pointerId) return;

      const dx = e.clientX - gesture.startClient.x;
      const dy = e.clientY - gesture.startClient.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= DRAG_THRESHOLD) return;

      gesture.moved = true;
      // Only finger-follow after the swipe window (or once armed)
      if (!gesture.foldArmed && Date.now() - gesture.startTime < SWIPE_TIMEOUT_MS) {
        return;
      }
      gesture.foldArmed = true;
      if (gesture.foldTimer != null) {
        window.clearTimeout(gesture.foldTimer);
        gesture.foldTimer = null;
      }

      const pos = clientToBookPos(flip, e.clientX, e.clientY);
      if (!gesture.folding) {
        flip.startUserTouch(gesture.startBook);
        gesture.folding = true;
      }
      flip.userMove(pos, true);
    },
    [annotateMode],
  );

  const endGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
      if (annotateMode) {
        const g = gestureRef.current;
        if (g?.foldTimer != null) window.clearTimeout(g.foldTimer);
        gestureRef.current = null;
        return;
      }
      const gesture = gestureRef.current;
      const flip = flipRef.current;
      if (!gesture || gesture.pointerId !== e.pointerId) return;
      gestureRef.current = null;

      if (gesture.foldTimer != null) {
        window.clearTimeout(gesture.foldTimer);
        gesture.foldTimer = null;
      }

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }

      if (!flip || cancelled) {
        if (flip && gesture.folding) {
          const pos = clientToBookPos(flip, e.clientX, e.clientY);
          flip.userStop(pos, false);
        }
        return;
      }

      const pos = clientToBookPos(flip, e.clientX, e.clientY);
      const dx = e.clientX - gesture.startClient.x;
      const dy = e.clientY - gesture.startClient.y;
      const elapsed = Date.now() - gesture.startTime;
      const isSwipe =
        Math.abs(dx) > SWIPE_DISTANCE &&
        Math.abs(dy) < SWIPE_DISTANCE * 2 &&
        elapsed < SWIPE_TIMEOUT_MS;

      if (isSwipe) {
        if (gesture.folding) flip.userStop(pos, false);
        if (flip.getState() === "flipping") return;
        animateFlip(flip, dx < 0 ? "next" : "prev");
        return;
      }

      if (gesture.folding) {
        // Finger-follow release: complete or snap back
        flip.userStop(pos, false);
        return;
      }

      // Tap: left half previous, right half next
      if (!gesture.moved && canAnimateFlip()) {
        const layer = e.currentTarget.getBoundingClientRect();
        const mid = layer.left + layer.width / 2;
        animateFlip(flip, e.clientX < mid ? "prev" : "next");
      }
    },
    [canAnimateFlip, annotateMode],
  );

  // Keyboard navigation (desktop-primary; still works on touch devices with keyboards)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!readyRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (annotateMode && (e.metaKey || e.ctrlKey)) {
        const key = e.key.toLowerCase();
        if (key === "z" && !e.shiftKey) {
          e.preventDefault();
          undoAnnot();
          return;
        }
        if (key === "y" || (key === "z" && e.shiftKey)) {
          e.preventDefault();
          redoAnnot();
          return;
        }
      }

      if (typing) return;
      if (annotateMode) return;

      if (e.key === "ArrowRight" || e.key === " " || e.code === "Space") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        if (window.document.fullscreenElement) {
          void window.document.exitFullscreen();
        }
      } else if (e.key === "+" || e.key === "=") {
        bumpZoom(0.1);
      } else if (e.key === "-" || e.key === "_") {
        bumpZoom(-0.1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, bumpZoom, annotateMode, undoAnnot, redoAnnot]);

  // Block background page scroll while the reader is open
  useEffect(() => {
    const prevOverflow = window.document.body.style.overflow;
    const prevOverscroll = window.document.documentElement.style.overscrollBehavior;
    window.document.body.style.overflow = "hidden";
    window.document.documentElement.style.overscrollBehavior = "none";
    return () => {
      window.document.body.style.overflow = prevOverflow;
      window.document.documentElement.style.overscrollBehavior = prevOverscroll;
    };
  }, []);

  // Capacitor / Android back button
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    void App.addListener("backButton", ({ canGoBack }) => {
      if (window.document.fullscreenElement) {
        void window.document.exitFullscreen();
        return;
      }
      onExit();
      if (!canGoBack) {
        // stay in app on home — do not minimize
      }
    }).then((h) => {
      handle = h;
    });
    return () => {
      void handle?.remove();
    };
  }, [onExit]);

  const pageLabel = `${pageIndex + 1} / ${doc.pageCount}`;

  return (
    <div className={`reader-shell ${touchPrimary ? "is-touch" : "is-desktop"} ${annotateMode ? "is-annotate" : ""}`}>
      <div
        className={`reader-controls reader-top-chrome absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${
          chromeVisible || annotateMode ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        <div className="reader-title-chip min-w-0 max-w-[42%] border-[3px] border-black bg-lime px-2.5 py-2 shadow-[4px_4px_0_#000] sm:max-w-none sm:px-3">
          <p className="truncate font-display text-[11px] text-black sm:text-sm">{doc.name}</p>
          {resumeHint ? (
            <p className="font-mono-label text-[9px] text-black/70">
              Continue from page {resumeHint}
            </p>
          ) : null}
          {downloadFlash ? (
            <p className="font-mono-label text-[9px] text-black/80">{downloadFlash}</p>
          ) : null}
          {libraryHint && !downloadFlash ? (
            <p className="font-mono-label text-[9px] text-black/70">{libraryHint}</p>
          ) : null}
          {markedFlash ? (
            <p className="font-mono-label text-[9px] text-black/80">marked</p>
          ) : null}
        </div>
        <div className="reader-actions flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="reader-chip reader-chip-orange"
            aria-label="Download book"
            title="Download PDF to keep"
          >
            <span className="sm:hidden">DL</span>
            <span className="hidden sm:inline">Download</span>
          </button>
          <button
            type="button"
            onClick={() => setAnnotateMode((v) => !v)}
            className={`reader-chip ${annotateMode ? "reader-chip-pink" : "reader-chip-white"}`}
            aria-pressed={annotateMode}
            aria-label={annotateMode ? "Exit annotate mode" : "Enter annotate mode"}
            title={annotateMode ? "Done annotating" : "Annotate"}
          >
            {annotateMode ? "Done" : "Mark"}
          </button>
          {!touchPrimary ? (
            <div className="reader-zoom flex items-center border-[3px] border-black bg-white shadow-[3px_3px_0_#000]">
              <button
                type="button"
                onClick={() => bumpZoom(-0.1)}
                className="border-r-[3px] border-black px-2.5 py-2 font-display text-sm"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="min-w-[3.5rem] px-2 text-center font-mono-label text-[10px] font-bold text-black">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => bumpZoom(0.1)}
                className="border-l-[3px] border-black px-2.5 py-2 font-display text-sm text-black"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleSound}
            className={`reader-chip ${soundOn ? "reader-chip-lime" : "reader-chip-white"}`}
            aria-label={soundOn ? "Mute page sound" : "Enable page sound"}
            title={soundOn ? "Sound on" : "Sound off"}
          >
            {soundOn ? "SND" : "MUTE"}
          </button>
          {!touchPrimary ? (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="reader-chip reader-chip-blue"
              aria-label="Fullscreen"
              title="Fullscreen"
            >
              FULL
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExit}
            className="reader-chip reader-chip-pink"
            aria-label="Exit reader"
            title="Exit"
          >
            EXIT
          </button>
        </div>
      </div>

      {annotateMode ? (
        <div className="annotation-toolbar-wrap absolute inset-x-0 top-[4.25rem] z-20 flex justify-center px-2 sm:top-[4.5rem] sm:px-3">
          <AnnotationToolbar
            tool={annotTool}
            color={annotColor}
            vibe={annotVibe}
            canUndo={canUndo}
            canRedo={canRedo}
            onTool={setAnnotTool}
            onColor={setAnnotColor}
            onVibe={setAnnotVibe}
            onUndo={undoAnnot}
            onRedo={redoAnnot}
          />
        </div>
      ) : null}

      <div className="reader-stage">
        {!ready && !error ? (
          <div className="pointer-events-none absolute z-10 border-[3px] border-black bg-lime px-4 py-3 font-display text-sm text-black shadow-[4px_4px_0_#000]">
            {status || "Opening book…"}
          </div>
        ) : null}
        {error ? (
          <p className="pointer-events-none absolute z-10 border-[3px] border-black bg-pink px-3 py-2 font-display text-sm text-white shadow-[4px_4px_0_#000]">
            {error}
          </p>
        ) : null}

        {!touchPrimary && ready && !annotateMode ? (
          <button
            type="button"
            onClick={goPrev}
            disabled={pageIndex <= 0}
            className="reader-edge-nav reader-edge-prev"
            aria-label="Previous page"
          >
            Prev
          </button>
        ) : null}

        {/*
          Desktop wraps in .reader-book-frame for the cradle chrome.
          Touch must NOT use an unsized wrapper — a bare <div> collapses
          percentage width/height to 0 and PageFlip fails with "Could not size".
        */}
        <div className={touchPrimary ? "reader-touch-frame" : "reader-book-frame"}>
          <div
            className={`reader-book-host ${ready ? "is-ready" : ""}`}
            style={{
              visibility: ready ? "visible" : "hidden",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <div key={layoutKey} ref={hostRef} className="h-full w-full" />

            {ready ? (
              <AnnotationLayer
                active={annotateMode}
                tool={annotTool}
                color={annotColor}
                vibe={annotVibe}
                pageIndex={pageIndex}
                isNarrow={isNarrow}
                hostRef={hostRef}
                highlights={highlights}
                notes={notes}
                onAddHighlight={addHighlight}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onDeleteHighlight={deleteHighlight}
              />
            ) : null}

            {touchPrimary && ready && !annotateMode ? (
              <div
                className="reader-gesture-layer"
                onPointerDown={onGesturePointerDown}
                onPointerMove={onGesturePointerMove}
                onPointerUp={(e) => endGesture(e, false)}
                onPointerCancel={(e) => endGesture(e, true)}
                role="presentation"
              >
                <div className="reader-tap-zone reader-tap-prev" aria-hidden />
                <div className="reader-tap-zone reader-tap-next" aria-hidden />
              </div>
            ) : null}
          </div>
        </div>

        {!touchPrimary && ready && !annotateMode ? (
          <button
            type="button"
            onClick={goNext}
            disabled={pageIndex >= doc.pageCount - 1}
            className="reader-edge-nav reader-edge-next"
            aria-label="Next page"
          >
            Next
          </button>
        ) : null}

        <div
          key={`${doc.id}-${layoutKey}`}
          ref={pagesRef}
          className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden"
          aria-hidden
        >
          {Array.from({ length: doc.pageCount }, (_, index) => (
            <div
              key={index}
              className="book-page loading"
              data-page={index}
              data-density="soft"
            >
              <canvas />
            </div>
          ))}
        </div>
      </div>

      <div
        className={`reader-controls reader-bottom-chrome absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-3 py-3 sm:px-4 sm:py-4 ${
          chromeVisible || annotateMode ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        {touchPrimary && !annotateMode ? (
          <p className="reader-swipe-hint font-mono-label text-[9px] font-bold text-white/55">
            Swipe to turn pages
          </p>
        ) : null}
        <div className="reader-pager flex items-center gap-0 border-[3px] border-black bg-cream shadow-[5px_5px_0_#c8f542]">
          {!touchPrimary && !annotateMode ? (
            <button
              type="button"
              onClick={goPrev}
              disabled={!ready || pageIndex <= 0}
              className="border-r-[3px] border-black bg-orange px-4 py-3 font-display text-xs text-black disabled:opacity-35 sm:text-sm"
            >
              ← Prev
            </button>
          ) : null}

          {editingJump ? (
            <form
              className="flex min-w-[7.5rem] items-center justify-center px-2"
              onSubmit={(e) => {
                e.preventDefault();
                jumpToPage(jumpDraft);
              }}
            >
              <input
                autoFocus
                inputMode="numeric"
                value={jumpDraft}
                onChange={(e) => setJumpDraft(e.target.value.replace(/[^\d]/g, ""))}
                onBlur={() => jumpToPage(jumpDraft)}
                className="w-14 border-[2px] border-black bg-white px-1 py-1 text-center font-mono-label text-[11px] font-bold text-black outline-none"
                aria-label="Jump to page"
              />
              <span className="pl-1 font-mono-label text-[11px] font-bold text-black">
                / {doc.pageCount}
              </span>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setJumpDraft(String(pageIndex + 1));
                setEditingJump(true);
              }}
              className="min-w-[7.5rem] px-3 py-3 text-center font-mono-label text-[11px] font-bold text-black"
              title="Jump to page"
            >
              {pageLabel}
            </button>
          )}

          {!touchPrimary && !annotateMode ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!ready || pageIndex >= doc.pageCount - 1}
              className="border-l-[3px] border-black bg-lime px-4 py-3 font-display text-xs text-black disabled:opacity-35 sm:text-sm"
            >
              Next →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
