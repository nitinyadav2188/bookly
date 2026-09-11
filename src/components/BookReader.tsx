"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageFlip } from "page-flip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { AnnotationLayer, AnnotationToolbar } from "@/components/AnnotationLayer";
import { MyNotesPanel } from "@/components/MyNotesPanel";
import {
  createAnnotationHistory,
  defaultMeaningForColor,
  emptyAnnotations,
  loadAnnotationsByHash,
  makeAnnotId,
  saveAnnotationsByHash,
  strokeNearPoint,
  type AnnotTool,
  type ColorMeaning,
  type DocAnnotations,
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
import {
  downloadBookBundle,
  saveLibraryBook,
  updateLibraryProgress,
} from "@/lib/library";
import { loadPdfDocument, renderPdfPageToCanvas, type OpenedPdf } from "@/lib/pdf";
import { getSavedPage, savePage } from "@/lib/session";
import { playPageTurnSound, unlockPageSound, warmPageSound } from "@/lib/sound";
import { emitPageFlipSignal, emitReaderClose, emitReaderOpen } from "@/lib/feedback";

const SIZE_STRETCH = "stretch" as const;
const SWIPE_DISTANCE = 45;
const SWIPE_TIMEOUT_MS = 280;
const DRAG_THRESHOLD = 8;
/** 100% = full-page fit; allow slight overview zoom-out and clear zoom-in. */
const ZOOM_MIN = 0.85;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.15;

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
 * Programmatic page turns. StPageFlip's `disableFlipByClick` corner test rejects
 * many valid BACK points in portrait (visible page is the right half of a
 * virtual spread). Buttons / taps / swipes already decided the direction, so
 * we briefly clear that flag and pass hybrid coords that include `rect.top`
 * (stock flipNext omits it and no-ops when the book is vertically centered).
 */
function animateFlip(flip: PageFlip, direction: "prev" | "next") {
  const rect = flip.getBoundsRect();
  const y = rect.top + rect.height - 2;
  // Left virtual corner → BACK; right corner → FORWARD (portrait + landscape).
  const x = direction === "next" ? rect.left + rect.width - 10 : rect.left + 10;

  const settings = flip.getSettings() as { disableFlipByClick?: boolean };
  const prevFlag = settings.disableFlipByClick;
  settings.disableFlipByClick = false;
  try {
    flip.getFlipController().flip({ x, y });
  } finally {
    settings.disableFlipByClick = prevFlag;
  }
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [jumpDraft, setJumpDraft] = useState("");
  const [editingJump, setEditingJump] = useState(false);
  const [annotateMode, setAnnotateMode] = useState(false);
  const [annotTool, setAnnotTool] = useState<AnnotTool>("highlight");
  const [annotColor, setAnnotColor] = useState<HighlightColor>("yellow");
  const [annotMeaning, setAnnotMeaning] = useState<ColorMeaning>("important");
  const [annotVibe, setAnnotVibe] = useState<NoteVibe>("yellow");
  const [penInk, setPenInk] = useState<PenInk>("black");
  const [penWidth, setPenWidth] = useState<PenWidth>("medium");
  const [strokeKind, setStrokeKind] = useState<StrokeKind>("pen");
  const [highlights, setHighlights] = useState<PageHighlight[]>([]);
  const [notes, setNotes] = useState<PageNote[]>([]);
  const [bookmarks, setBookmarks] = useState<PageBookmark[]>([]);
  const [strokes, setStrokes] = useState<PageStroke[]>([]);
  const [markedFlash, setMarkedFlash] = useState(false);
  const [annotsHydrated, setAnnotsHydrated] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [downloadFlash, setDownloadFlash] = useState<string | null>(null);
  const [libraryHint, setLibraryHint] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [focusAnnotId, setFocusAnnotId] = useState<string | null>(null);
  const pdfAspectRef = useRef(1.414); // A4-ish default until first page measures
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const historyRef = useRef(createAnnotationHistory());
  const annotsRef = useRef<DocAnnotations>(emptyAnnotations(doc.hash || doc.id));
  const noteEditBatchRef = useRef<Set<string>>(new Set());
  const persistTimerRef = useRef<number | null>(null);

  soundOnRef.current = soundOn;
  readyRef.current = ready;
  const pdfHash = doc.hash || doc.id;
  annotsRef.current = {
    version: 2,
    pdfHash,
    highlights,
    notes,
    bookmarks,
    strokes,
  };

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(historyRef.current.canUndo());
    setCanRedo(historyRef.current.canRedo());
  }, []);

  const pushAnnotHistory = useCallback(() => {
    historyRef.current.push(annotsRef.current);
    noteEditBatchRef.current.clear();
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  const applyAnnotState = useCallback((data: DocAnnotations) => {
    setHighlights(data.highlights);
    setNotes(data.notes);
    setBookmarks(data.bookmarks ?? []);
    setStrokes(data.strokes ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAnnotsHydrated(false);
    void (async () => {
      const legacyIds = [doc.legacyId, doc.id].filter(Boolean) as string[];
      let data = await loadAnnotationsByHash(pdfHash, legacyIds);
      if (
        data.highlights.length === 0 &&
        data.notes.length === 0 &&
        (data.bookmarks?.length ?? 0) === 0 &&
        (data.strokes?.length ?? 0) === 0
      ) {
        try {
          const { getLibraryAnnotations } = await import("@/lib/library");
          const fromLib = await getLibraryAnnotations(doc.id);
          if (
            fromLib &&
            (fromLib.highlights.length > 0 ||
              fromLib.notes.length > 0 ||
              (fromLib.bookmarks?.length ?? 0) > 0 ||
              (fromLib.strokes?.length ?? 0) > 0)
          ) {
            data = { ...fromLib, pdfHash };
            await saveAnnotationsByHash(pdfHash, data);
          }
        } catch {
          // ignore
        }
      }
      if (cancelled) return;
      applyAnnotState(data);
      setAnnotateMode(false);
      setNotesOpen(false);
      setFocusAnnotId(null);
      historyRef.current.clear();
      noteEditBatchRef.current.clear();
      setCanUndo(false);
      setCanRedo(false);
      setAnnotsHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [doc.id, doc.legacyId, pdfHash, applyAnnotState]);

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
        lastPage: getSavedPage(doc.id) ?? getSavedPage(doc.legacyId ?? "") ?? 0,
        annotations: annotsRef.current,
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
  }, [doc.id, doc.name, doc.data, doc.pageCount, doc.legacyId]);

  useEffect(() => {
    if (!annotsHydrated) return;
    const payload = annotsRef.current;
    if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void saveAnnotationsByHash(pdfHash, payload);
      void updateLibraryProgress(doc.id, { annotations: payload });
    }, 350);
    return () => {
      if (persistTimerRef.current != null) window.clearTimeout(persistTimerRef.current);
    };
  }, [doc.id, pdfHash, highlights, notes, bookmarks, strokes, annotsHydrated]);

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
          await renderPdfPageToCanvas(pdf, index + 1, canvas, isNarrow ? 1800 : 2200);
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

        // Use real PDF page aspect so the book fills the stage (full-page fit).
        try {
          const probe = await pdf.getPage(1);
          const vp = probe.getViewport({ scale: 1 });
          if (vp.width > 0 && vp.height > 0) {
            pdfAspectRef.current = vp.height / vp.width;
          }
        } catch {
          // keep default
        }

        warmPageSound();

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
          // Size PageFlip from layout box — 100% zoom = max full-page fit.
          let availW = Math.max(0, host.clientWidth);
          let availH = Math.max(0, host.clientHeight);
          if (availW < 80 || availH < 80) {
            const stage = host.closest(".reader-stage") as HTMLElement | null;
            if (stage) {
              const pad = touchPrimary ? 8 : 20;
              availW = Math.max(availW, stage.clientWidth - pad);
              availH = Math.max(availH, stage.clientHeight - pad);
            }
          }

          const aspect = pdfAspectRef.current > 0.4 ? pdfAspectRef.current : 1.414;
          // Landscape = two pages side by side; portrait/touch = one page.
          const pagesAcross = isNarrow || touchPrimary ? 1 : 2;
          const maxPageW = pagesAcross === 1 ? availW * (touchPrimary ? 0.995 : 0.98) : availW / 2.02;
          const maxPageH = availH * (touchPrimary ? 0.995 : 0.98);

          // Contain-fit the PDF page into the available slot (full page, no crop).
          let pageWidth = Math.floor(maxPageW);
          let pageHeight = Math.floor(pageWidth * aspect);
          if (pageHeight > maxPageH) {
            pageHeight = Math.floor(maxPageH);
            pageWidth = Math.floor(pageHeight / aspect);
          }

          pageWidth = Math.min(touchPrimary || isNarrow ? 1200 : 680, Math.max(160, pageWidth));
          pageHeight = Math.min(touchPrimary || isNarrow ? 1600 : 1100, Math.max(180, pageHeight));

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
        // Phones/tablets (and narrow viewports) must stay single-page. StPageFlip
        // only enters portrait when blockWidth < minWidth*2; with the default
        // minWidth of 200, hosts ≥400px (Pro Max, landscape phone, iPad) flip
        // into a 2-page landscape spread. Inflate minWidth so portrait sticks.
        const forceSinglePage = isNarrow || touchPrimary;

        ignoreSoundUntilRef.current = Date.now() + 900;

        // Touch: we drive gestures via the overlay (useMouseEvents false) so tap
        // zones don't fight native handlers. Desktop: StPageFlip mouse drag + buttons.
        flip = new PageFlip(host, {
          width: pageWidth,
          height: pageHeight,
          size: SIZE_STRETCH,
          // 2000 ⇒ portrait while host < 4000px (all phones/tablets). CSS below
          // clears the library's matching min-width so layout doesn't overflow.
          minWidth: forceSinglePage ? 2000 : 200,
          maxWidth: forceSinglePage ? 1400 : touchPrimary ? 820 : 760,
          minHeight: 280,
          maxHeight: forceSinglePage ? 1800 : touchPrimary ? 1400 : 1280,
          drawShadow: true,
          // Richer flip shadows for a physical page-turn; keep mobile a touch softer.
          maxShadowOpacity: touchPrimary ? 0.62 : 0.88,
          showCover: false,
          mobileScrollSupport: false,
          swipeDistance: SWIPE_DISTANCE,
          // Slightly longer so BACK curls read as a real page turn.
          flippingTime: touchPrimary ? 720 : 900,
          usePortrait: true,
          autoSize: true,
          startPage,
          useMouseEvents: !touchPrimary,
          disableFlipByClick: true,
          showPageCorners: !touchPrimary,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        flip.loadFromHTML(pageNodes as NodeListOf<HTMLElement>);

        if (forceSinglePage) {
          const parent = host.querySelector(".stf__parent") as HTMLElement | null;
          if (parent) {
            parent.style.minWidth = "0px";
            parent.style.width = "100%";
            parent.style.maxWidth = "100%";
          }
          // Keep settings ahead of any later resize so orientation stays portrait.
          const settings = flip.getSettings() as { minWidth?: number };
          settings.minWidth = 2000;
        }

        flipRef.current = flip;
        lastIndexRef.current = startPage;
        setPageIndex(startPage);
        setJumpDraft(String(startPage + 1));
        setReady(true);
        readyRef.current = true;
        setStatus("");

        flip.on("changeState", (e) => {
          const state = String(e.data);
          setFlipping(state === "flipping");
          // Fire sound as the curl begins — feels tied to the gesture.
          if (state !== "flipping") return;
          if (!soundOnRef.current) return;
          if (Date.now() <= ignoreSoundUntilRef.current) return;
          playPageTurnSound(true);
        });

        flip.on("flip", (e) => {
          const index = Number(e.data);
          setPageIndex(index);
          setJumpDraft(String(index + 1));
          savePage(doc.id, index);
          void updateLibraryProgress(doc.id, { lastPage: index });
          const pageChanged = index !== lastIndexRef.current;
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
            if (forceSinglePage && flipRef.current) {
              const settings = flipRef.current.getSettings() as { minWidth?: number };
              settings.minWidth = 2000;
              const parent = host.querySelector(".stf__parent") as HTMLElement | null;
              if (parent) {
                parent.style.minWidth = "0px";
                parent.style.maxWidth = "100%";
              }
            }
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
      const bundle = downloadBookBundle(doc, annotsRef.current);
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
  }, [doc]);

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
      setZoom((z) => {
        const next = clampZoom(z + delta);
        if (next <= 1) setPan({ x: 0, y: 0 });
        return next;
      });
    },
    [clampZoom],
  );

  const resetZoom = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const onPanPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (zoom <= 1.001 || annotateMode) return;
      // When zoomed, prefer pan over page-turn on the stage chrome.
      if (e.pointerType === "mouse" && e.button !== 0) return;
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originX: pan.x,
        originY: pan.y,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    },
    [zoom, annotateMode, pan.x, pan.y],
  );

  const onPanPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const limit = 220 * Math.max(0, zoom - 1);
    setPan({
      x: Math.max(-limit, Math.min(limit, drag.originX + dx)),
      y: Math.max(-limit, Math.min(limit, drag.originY + dy)),
    });
  }, [zoom]);

  const onPanPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    panDragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
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

  const updateHighlight = useCallback(
    (id: string, patch: Partial<PageHighlight>) => {
      if (!noteEditBatchRef.current.has(id)) {
        historyRef.current.push(annotsRef.current);
        noteEditBatchRef.current.add(id);
        syncHistoryFlags();
      }
      setHighlights((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)));
    },
    [syncHistoryFlags],
  );

  const deleteHighlight = useCallback(
    (id: string) => {
      pushAnnotHistory();
      setHighlights((prev) => prev.filter((h) => h.id !== id));
    },
    [pushAnnotHistory],
  );

  const addNote = useCallback((n: PageNote) => {
    // History commits on first typed character (or explicit delete), not on pin place.
    setNotes((prev) => [...prev, n]);
  }, []);

  const discardEmptyNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    noteEditBatchRef.current.delete(id);
  }, []);

  const updateNote = useCallback(
    (id: string, patch: Partial<PageNote>) => {
      if (patch.text !== undefined) {
        if (!noteEditBatchRef.current.has(id)) {
          const existing = annotsRef.current.notes.find((n) => n.id === id);
          const snapshot =
            existing && existing.text.trim()
              ? annotsRef.current
              : {
                  ...annotsRef.current,
                  notes: annotsRef.current.notes.filter((n) => n.id !== id),
                };
          historyRef.current.push(snapshot);
          noteEditBatchRef.current.add(id);
          syncHistoryFlags();
        }
      } else if (patch.x !== undefined || patch.y !== undefined) {
        // Coalesce a drag into one undo step.
        const moveKey = `move:${id}`;
        if (!noteEditBatchRef.current.has(moveKey)) {
          historyRef.current.push(annotsRef.current);
          noteEditBatchRef.current.add(moveKey);
          syncHistoryFlags();
        }
      } else {
        pushAnnotHistory();
      }
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },
    [pushAnnotHistory, syncHistoryFlags],
  );

  const deleteNote = useCallback(
    (id: string) => {
      pushAnnotHistory();
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [pushAnnotHistory],
  );

  const addStroke = useCallback(
    (s: PageStroke) => {
      pushAnnotHistory();
      setStrokes((prev) => [...prev, s]);
    },
    [pushAnnotHistory],
  );

  const eraseStrokesAt = useCallback(
    (page: number, x: number, y: number) => {
      const radius = 0.028;
      const hit = annotsRef.current.strokes.filter(
        (s) => s.page === page && strokeNearPoint(s, x, y, radius),
      );
      if (!hit.length) return;
      pushAnnotHistory();
      const remove = new Set(hit.map((s) => s.id));
      setStrokes((prev) => prev.filter((s) => !remove.has(s.id)));
    },
    [pushAnnotHistory],
  );

  const toggleBookmark = useCallback(
    (page = pageIndex) => {
      pushAnnotHistory();
      setBookmarks((prev) => {
        const existing = prev.find((b) => b.page === page);
        if (existing) return prev.filter((b) => b.id !== existing.id);
        return [
          ...prev,
          {
            id: makeAnnotId("bm"),
            page,
            createdAt: Date.now(),
          },
        ];
      });
    },
    [pageIndex, pushAnnotHistory],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      pushAnnotHistory();
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    },
    [pushAnnotHistory],
  );

  const undoAnnot = useCallback(() => {
    const next = historyRef.current.undo(annotsRef.current);
    if (!next) return;
    noteEditBatchRef.current.clear();
    applyAnnotState(next);
    syncHistoryFlags();
  }, [applyAnnotState, syncHistoryFlags]);

  const redoAnnot = useCallback(() => {
    const next = historyRef.current.redo(annotsRef.current);
    if (!next) return;
    noteEditBatchRef.current.clear();
    applyAnnotState(next);
    syncHistoryFlags();
  }, [applyAnnotState, syncHistoryFlags]);

  const exitAnnotateMode = useCallback(() => {
    setAnnotateMode(false);
    setNotes((prev) => prev.filter((n) => n.text.trim().length > 0));
    setNotesOpen(false);
    setFocusAnnotId(null);
  }, []);

  // Mobile / tablet: finger-follow drag + half-page taps via gesture layer
  const onGesturePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (annotateMode) return;
      if (zoom > 1.001) return; // zoomed: pan on stage, not page-turn
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
    [touchPrimary, annotateMode, zoom],
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
        // Portrait PageFlip puts the spine on the visible left edge, so
        // stopMove only commits when the finger reaches x≈0. If the user
        // dragged a meaningful distance, nudge past that threshold first.
        const layerW = e.currentTarget.getBoundingClientRect().width;
        const commit = Math.abs(dx) >= Math.min(100, layerW * 0.25);
        if (commit) {
          const edgeX = dx < 0 ? -12 : layerW + 12;
          flip.userMove({ x: edgeX, y: pos.y }, true);
          flip.userStop({ x: edgeX, y: pos.y }, false);
        } else {
          flip.userStop(pos, false);
        }
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

  // Keyboard navigation + annotation shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!readyRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement | null)?.isContentEditable;

      if (annotateMode && (e.metaKey || e.ctrlKey) && !typing) {
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

      if (annotateMode) {
        const key = e.key.toLowerCase();
        if (key === "h") {
          e.preventDefault();
          setAnnotTool("highlight");
          return;
        }
        if (key === "n") {
          e.preventDefault();
          setAnnotTool("note");
          return;
        }
        if (key === "p") {
          e.preventDefault();
          setAnnotTool("pen");
          return;
        }
        if (key === "b") {
          e.preventDefault();
          setAnnotTool("bookmark");
          toggleBookmark(pageIndex);
          return;
        }
        if (key === "escape") {
          e.preventDefault();
          exitAnnotateMode();
          return;
        }
        return;
      }

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
        bumpZoom(ZOOM_STEP);
      } else if (e.key === "-" || e.key === "_") {
        bumpZoom(-ZOOM_STEP);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    goNext,
    goPrev,
    bumpZoom,
    annotateMode,
    undoAnnot,
    redoAnnot,
    toggleBookmark,
    pageIndex,
    exitAnnotateMode,
  ]);

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
  const zoomPercent = Math.round(zoom * 100);
  const canZoomOut = zoom > ZOOM_MIN + 0.001;
  const canZoomIn = zoom < ZOOM_MAX - 0.001;

  const zoomControls = (
    <div
      className={`reader-zoom flex items-center border-[3px] border-black bg-white shadow-[3px_3px_0_#000] ${
        touchPrimary ? "reader-zoom-touch" : ""
      }`}
      role="group"
      aria-label="Book zoom"
    >
      <button
        type="button"
        onClick={() => bumpZoom(-ZOOM_STEP)}
        disabled={!canZoomOut}
        className="reader-zoom-btn border-r-[3px] border-black font-display text-black disabled:opacity-35"
        aria-label="Zoom out"
        title="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={resetZoom}
        className="reader-zoom-pct text-center font-mono-label font-bold text-black"
        aria-label="Reset zoom to 100%"
        title="Reset to 100%"
      >
        {zoomPercent}%
      </button>
      <button
        type="button"
        onClick={() => bumpZoom(ZOOM_STEP)}
        disabled={!canZoomIn}
        className="reader-zoom-btn border-l-[3px] border-black font-display text-black disabled:opacity-35"
        aria-label="Zoom in"
        title="Zoom in"
      >
        +
      </button>
    </div>
  );

  return (
    <div
      className={`reader-shell ${touchPrimary ? "is-touch" : "is-desktop"} ${annotateMode ? "is-annotate" : ""} ${
        zoom !== 1 ? "is-zoomed" : ""
      }`}
    >
      <div
        className={`reader-controls reader-top-chrome absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 px-2 py-2.5 sm:gap-3 sm:px-4 sm:py-3 ${
          chromeVisible || annotateMode ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        <div className="reader-title-chip min-w-0 max-w-[34%] border-[3px] border-black bg-lime px-2 py-1.5 shadow-[4px_4px_0_#000] sm:max-w-[42%] sm:px-3 sm:py-2">
          <p className="truncate font-display text-[10px] text-black sm:text-sm">{doc.name}</p>
          {resumeHint && !touchPrimary ? (
            <p className="font-mono-label text-[9px] text-black/70">
              Continue from page {resumeHint}
            </p>
          ) : null}
          {downloadFlash ? (
            <p className="font-mono-label text-[9px] text-black/80">{downloadFlash}</p>
          ) : null}
          {libraryHint && !downloadFlash && !touchPrimary ? (
            <p className="font-mono-label text-[9px] text-black/70">{libraryHint}</p>
          ) : null}
          {markedFlash ? (
            <p className="font-mono-label text-[9px] text-black/80">highlighted</p>
          ) : null}
        </div>
        <div className="reader-actions flex flex-nowrap items-center justify-end gap-1.5 sm:gap-2">
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
            onClick={() => {
              setAnnotateMode((v) => {
                const next = !v;
                if (!next) {
                  setNotes((prev) => prev.filter((n) => n.text.trim().length > 0));
                  setNotesOpen(false);
                  setFocusAnnotId(null);
                }
                return next;
              });
            }}
            className={`reader-chip ${annotateMode ? "reader-chip-pink" : "reader-chip-white"}`}
            aria-pressed={annotateMode}
            aria-label={annotateMode ? "Exit annotate mode" : "Enter annotate mode"}
            title={annotateMode ? "Done annotating" : "Annotate"}
          >
            {annotateMode ? "Done" : touchPrimary ? "Mark" : "Annotate"}
          </button>
          {!touchPrimary ? zoomControls : null}
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

      {annotateMode && !touchPrimary ? (
        <div className="annotation-toolbar-wrap absolute inset-x-0 top-[4.25rem] z-20 flex justify-center px-2 sm:top-[4.5rem] sm:px-3">
          <AnnotationToolbar
            tool={annotTool}
            color={annotColor}
            meaning={annotMeaning}
            vibe={annotVibe}
            penInk={penInk}
            penWidth={penWidth}
            strokeKind={strokeKind}
            canUndo={canUndo}
            canRedo={canRedo}
            pageBookmarked={bookmarks.some((b) => b.page === pageIndex)}
            onTool={setAnnotTool}
            onColor={(c) => {
              setAnnotColor(c);
              setAnnotMeaning(defaultMeaningForColor(c));
            }}
            onMeaning={setAnnotMeaning}
            onVibe={setAnnotVibe}
            onPenInk={setPenInk}
            onPenWidth={setPenWidth}
            onStrokeKind={setStrokeKind}
            onUndo={undoAnnot}
            onRedo={redoAnnot}
            onToggleBookmark={() => toggleBookmark(pageIndex)}
            onOpenNotes={() => setNotesOpen(true)}
          />
        </div>
      ) : null}

      <div
        className="reader-stage"
        onPointerDown={zoom > 1.001 ? onPanPointerDown : undefined}
        onPointerMove={zoom > 1.001 ? onPanPointerMove : undefined}
        onPointerUp={zoom > 1.001 ? onPanPointerUp : undefined}
        onPointerCancel={zoom > 1.001 ? onPanPointerUp : undefined}
        style={zoom > 1.001 ? { cursor: "grab" } : undefined}
      >
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
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <div key={layoutKey} ref={hostRef} className="h-full w-full" />

            {ready ? (
              <AnnotationLayer
                active={annotateMode}
                tool={annotTool}
                color={annotColor}
                meaning={annotMeaning}
                vibe={annotVibe}
                penInk={penInk}
                penWidth={penWidth}
                strokeKind={strokeKind}
                pageIndex={pageIndex}
                isNarrow={isNarrow}
                flipping={flipping}
                hostRef={hostRef}
                highlights={highlights}
                notes={notes}
                bookmarks={bookmarks}
                strokes={strokes}
                focusId={focusAnnotId}
                onAddHighlight={addHighlight}
                onUpdateHighlight={updateHighlight}
                onDeleteHighlight={deleteHighlight}
                onAddNote={addNote}
                onUpdateNote={updateNote}
                onDeleteNote={deleteNote}
                onDiscardEmptyNote={discardEmptyNote}
                onAddStroke={addStroke}
                onEraseStrokesAt={eraseStrokesAt}
                onToggleBookmark={toggleBookmark}
                onJumpToPage={(page) => jumpToPage(String(page + 1))}
                onRemoveBookmark={removeBookmark}
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
        className={`reader-controls reader-bottom-chrome absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-1.5 px-2 py-2.5 sm:gap-2 sm:px-4 sm:py-4 ${
          chromeVisible || annotateMode ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        {touchPrimary && annotateMode ? (
          <div className="annotation-toolbar-wrap annotation-toolbar-dock w-full max-w-lg px-0.5">
            <AnnotationToolbar
              tool={annotTool}
              color={annotColor}
              meaning={annotMeaning}
              vibe={annotVibe}
              penInk={penInk}
              penWidth={penWidth}
              strokeKind={strokeKind}
              canUndo={canUndo}
              canRedo={canRedo}
              pageBookmarked={bookmarks.some((b) => b.page === pageIndex)}
              onTool={setAnnotTool}
              onColor={(c) => {
                setAnnotColor(c);
                setAnnotMeaning(defaultMeaningForColor(c));
              }}
              onMeaning={setAnnotMeaning}
              onVibe={setAnnotVibe}
              onPenInk={setPenInk}
              onPenWidth={setPenWidth}
              onStrokeKind={setStrokeKind}
              onUndo={undoAnnot}
              onRedo={redoAnnot}
              onToggleBookmark={() => toggleBookmark(pageIndex)}
              onOpenNotes={() => setNotesOpen(true)}
              showDone
              onDone={exitAnnotateMode}
            />
          </div>
        ) : null}

        <div className="reader-bottom-tools flex w-full max-w-lg flex-wrap items-center justify-center gap-2">
          {touchPrimary && !annotateMode ? (
            <div className="reader-mobile-zoom-row">{zoomControls}</div>
          ) : null}
          {!(touchPrimary && annotateMode) ? (
          <div className="reader-pager flex items-center gap-0 border-[3px] border-black bg-cream shadow-[5px_5px_0_#000]">
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
                className="flex min-w-[6.5rem] items-center justify-center px-2 sm:min-w-[7.5rem]"
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
                className="min-h-11 min-w-[6.5rem] px-3 py-2.5 text-center font-mono-label text-[11px] font-bold text-black sm:min-w-[7.5rem] sm:py-3"
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
          ) : null}
        </div>
      </div>

      <MyNotesPanel
        open={notesOpen}
        docName={doc.name}
        data={{
          version: 2,
          pdfHash,
          highlights,
          notes,
          bookmarks,
          strokes,
        }}
        onClose={() => setNotesOpen(false)}
        onNavigate={(item) => {
          setFocusAnnotId(item.id);
          jumpToPage(String(item.page + 1));
          setNotesOpen(false);
        }}
      />
    </div>
  );
}
