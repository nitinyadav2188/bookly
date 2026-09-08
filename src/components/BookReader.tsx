"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageFlip } from "page-flip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { loadPdfDocument, renderPdfPageToCanvas, type OpenedPdf } from "@/lib/pdf";
import { getSavedPage, savePage } from "@/lib/session";
import { playPageTurnSound, unlockPageSound } from "@/lib/sound";

const SIZE_STRETCH = "stretch" as const;
const CORNER_BOTTOM = "bottom" as const;

type BookReaderProps = {
  document: OpenedPdf;
  onExit: () => void;
};

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

  const isNarrow = useIsNarrow();
  const layoutKey = isNarrow ? "portrait" : "landscape";

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

  soundOnRef.current = soundOn;
  zoomRef.current = zoom;

  const ensurePagesRendered = useCallback(
    async (centerIndex: number) => {
      const pdf = pdfRef.current;
      if (!pdf) return;

      const radius = isNarrow ? 2 : 3;
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

      await Promise.all(
        targets.map(async (index) => {
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
        }),
      );
    },
    [doc.pageCount, isNarrow],
  );

  useEffect(() => {
    let cancelled = false;
    let hideTimer: number | undefined;
    let flip: PageFlip | null = null;
    let resizeObserver: ResizeObserver | null = null;

    async function setup() {
      try {
        setReady(false);
        setError(null);
        setStatus("Opening book…");
        renderedRef.current = new Set();
        renderingRef.current = new Set();

        const pdf = await loadPdfDocument(doc.data);
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        pdfRef.current = pdf;

        const saved = getSavedPage(doc.id);
        const startPage =
          saved != null && saved >= 0 && saved < doc.pageCount ? saved : 0;
        if (saved != null && saved > 0) {
          setResumeHint(saved + 1);
          window.setTimeout(() => setResumeHint(null), 4500);
        } else {
          setResumeHint(null);
        }

        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled || !hostRef.current || !pagesRef.current) return;

        const pageNodes = pagesRef.current.querySelectorAll(".book-page");
        if (pageNodes.length === 0) {
          setError("Could not prepare book pages.");
          return;
        }

        setStatus("Rendering pages…");
        await ensurePagesRendered(startPage);
        if (cancelled || !hostRef.current) return;

        const host = hostRef.current;
        const measure = () => {
          const z = zoomRef.current;
          const availW = host.clientWidth / z;
          const availH = host.clientHeight / z;
          const pageWidth = Math.min(
            560,
            Math.max(240, Math.floor(availW / (isNarrow ? 1.08 : 2.15))),
          );
          const pageHeight = Math.min(
            Math.floor(availH * 0.92),
            Math.floor(pageWidth * 1.38),
          );
          return { pageWidth, pageHeight };
        };

        const { pageWidth, pageHeight } = measure();

        ignoreSoundUntilRef.current = Date.now() + 900;

        flip = new PageFlip(host, {
          width: pageWidth,
          height: pageHeight,
          size: SIZE_STRETCH,
          minWidth: 220,
          maxWidth: 720,
          minHeight: 300,
          maxHeight: 1100,
          drawShadow: true,
          maxShadowOpacity: 0.5,
          showCover: false,
          mobileScrollSupport: false,
          swipeDistance: 30,
          flippingTime: 650,
          usePortrait: true,
          autoSize: true,
          startPage,
          useMouseEvents: true,
          disableFlipByClick: false,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        flip.loadFromHTML(pageNodes as NodeListOf<HTMLElement>);
        flipRef.current = flip;
        lastIndexRef.current = startPage;
        setPageIndex(startPage);
        setJumpDraft(String(startPage + 1));
        setReady(true);
        setStatus("");

        flip.on("flip", (e) => {
          const index = Number(e.data);
          setPageIndex(index);
          setJumpDraft(String(index + 1));
          savePage(doc.id, index);
          const shouldSound =
            soundOnRef.current &&
            index !== lastIndexRef.current &&
            Date.now() > ignoreSoundUntilRef.current;
          if (shouldSound) {
            playPageTurnSound(true);
          }
          lastIndexRef.current = index;
          void ensurePagesRendered(index);
        });

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
      try {
        flip?.destroy();
      } catch {
        // ignore
      }
      void pdfRef.current?.destroy();
      pdfRef.current = null;
    };
  }, [doc.id, doc.data, doc.pageCount, isNarrow, layoutKey, ensurePagesRendered]);

  const goPrev = useCallback(() => {
    flipRef.current?.flipPrev(CORNER_BOTTOM as never);
  }, []);

  const goNext = useCallback(() => {
    flipRef.current?.flipNext(CORNER_BOTTOM as never);
  }, []);

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
        void ensurePagesRendered(index);
      } catch {
        // ignore
      }
      setEditingJump(false);
    },
    [doc.id, doc.pageCount, ensurePagesRendered],
  );

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

  const bumpZoom = useCallback((delta: number) => {
    setZoom((z) => Math.min(1.6, Math.max(0.7, Math.round((z + delta) * 100) / 100)));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

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
  }, [goNext, goPrev, bumpZoom]);

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
    <div className="reader-shell">
      <div
        className={`reader-controls absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-3 py-3 sm:px-4 ${
          chromeVisible ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        <div className="min-w-0 border-[3px] border-black bg-lime px-3 py-2 shadow-[4px_4px_0_#000]">
          <p className="truncate font-display text-xs text-black sm:text-sm">{doc.name}</p>
          {resumeHint ? (
            <p className="font-mono-label text-[9px] text-black/70">
              Continue from page {resumeHint}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center border-[3px] border-black bg-white shadow-[3px_3px_0_#000]">
            <button
              type="button"
              onClick={() => bumpZoom(-0.1)}
              className="border-r-[3px] border-black px-2.5 py-2 font-display text-sm"
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[3.5rem] px-2 text-center font-mono-label text-[10px] font-bold">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => bumpZoom(0.1)}
              className="border-l-[3px] border-black px-2.5 py-2 font-display text-sm"
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className={`border-[3px] border-black px-3 py-2 font-display text-sm shadow-[3px_3px_0_#000] ${
              soundOn ? "bg-lime text-black" : "bg-white text-black"
            }`}
            aria-label={soundOn ? "Mute page sound" : "Enable page sound"}
            title={soundOn ? "Sound on" : "Sound off"}
          >
            {soundOn ? "SND" : "MUTE"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="border-[3px] border-black bg-blue px-3 py-2 font-display text-sm text-white shadow-[3px_3px_0_#000]"
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            FULL
          </button>
          <button
            type="button"
            onClick={onExit}
            className="border-[3px] border-black bg-pink px-3 py-2 font-display text-sm text-white shadow-[3px_3px_0_#000]"
            aria-label="Exit reader"
            title="Exit"
          >
            EXIT
          </button>
        </div>
      </div>

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

        <div
          className="reader-book-host"
          style={{
            visibility: ready ? "visible" : "hidden",
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
        >
          <div ref={hostRef} className="h-full w-full" />
        </div>

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
        className={`reader-controls absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 py-4 ${
          chromeVisible ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        <div className="flex items-center gap-0 border-[3px] border-black bg-white shadow-[5px_5px_0_#c8f542]">
          <button
            type="button"
            onClick={goPrev}
            disabled={!ready || pageIndex <= 0}
            className="border-r-[3px] border-black bg-orange px-4 py-3 font-display text-xs text-black disabled:opacity-35 sm:text-sm"
          >
            ← Prev
          </button>

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
                className="w-14 border-[2px] border-black bg-cream px-1 py-1 text-center font-mono-label text-[11px] font-bold text-black outline-none"
                aria-label="Jump to page"
              />
              <span className="pl-1 font-mono-label text-[11px] font-bold">/ {doc.pageCount}</span>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setJumpDraft(String(pageIndex + 1));
                setEditingJump(true);
              }}
              className="min-w-[7.5rem] px-3 text-center font-mono-label text-[11px] font-bold text-black"
              title="Jump to page"
            >
              {pageLabel}
            </button>
          )}

          <button
            type="button"
            onClick={goNext}
            disabled={!ready || pageIndex >= doc.pageCount - 1}
            className="border-l-[3px] border-black bg-lime px-4 py-3 font-display text-xs text-black disabled:opacity-35 sm:text-sm"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
