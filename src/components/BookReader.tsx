"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FlipCorner, PageFlip, SizeType } from "page-flip";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdfDocument, renderPdfPageToCanvas, type OpenedPdf } from "@/lib/pdf";
import { getSavedPage, savePage } from "@/lib/session";
import { playPageTurnSound, unlockPageSound } from "@/lib/sound";

type BookReaderProps = {
  document: OpenedPdf;
  onExit: () => void;
};

function useIsNarrow(breakpoint = 768) {
  const [narrow, setNarrow] = useState(false);
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

  const isNarrow = useIsNarrow();
  const layoutKey = isNarrow ? "portrait" : "landscape";
  const [pageIndex, setPageIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [ready, setReady] = useState(false);
  const [resumeHint, setResumeHint] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  soundOnRef.current = soundOn;

  const ensurePagesRendered = useCallback(
    async (centerIndex: number) => {
      const pdf = pdfRef.current;
      if (!pdf) return;

      const radius = isNarrow ? 2 : 3;
      const targets: number[] = [];
      for (let i = centerIndex - radius; i <= centerIndex + radius; i += 1) {
        if (i >= 0 && i < doc.pageCount) targets.push(i);
      }

      await Promise.all(
        targets.map(async (index) => {
          if (renderedRef.current.has(index) || renderingRef.current.has(index)) return;
          renderingRef.current.add(index);
          const pageEl = document.querySelector(
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
          } catch {
            // keep placeholder
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

    async function setup() {
      try {
        setReady(false);
        setError(null);
        renderedRef.current = new Set();
        renderingRef.current = new Set();

        const pdf = await loadPdfDocument(doc.data);
        if (cancelled) {
          await pdf.cleanup();
          return;
        }
        pdfRef.current = pdf;

        const saved = getSavedPage(doc.id);
        const startPage =
          saved != null && saved > 0 && saved < doc.pageCount ? saved : 0;
        if (saved != null && saved > 0) {
          setResumeHint(saved + 1);
          window.setTimeout(() => setResumeHint(null), 4000);
        } else {
          setResumeHint(null);
        }

        // Wait a frame so page nodes for this layoutKey are mounted
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled || !hostRef.current || !pagesRef.current) return;

        const pageNodes = pagesRef.current.querySelectorAll(".book-page");
        if (pageNodes.length === 0) {
          setError("Could not prepare book pages.");
          return;
        }

        await ensurePagesRendered(startPage);
        if (cancelled || !hostRef.current) return;

        const host = hostRef.current;
        const pageWidth = Math.min(
          520,
          Math.max(280, Math.floor(host.clientWidth / (isNarrow ? 1.05 : 2.1))),
        );
        const pageHeight = Math.min(
          Math.floor(host.clientHeight * 0.95),
          Math.floor(pageWidth * 1.35),
        );

        flip = new PageFlip(host, {
          width: pageWidth,
          height: pageHeight,
          size: SizeType.STRETCH,
          minWidth: 280,
          maxWidth: 700,
          minHeight: 360,
          maxHeight: 1000,
          drawShadow: true,
          maxShadowOpacity: 0.45,
          showCover: false,
          mobileScrollSupport: false,
          swipeDistance: 25,
          flippingTime: 700,
          usePortrait: true,
          autoSize: true,
          startPage,
          useMouseEvents: true,
          disableFlipByClick: false,
        });

        flip.loadFromHTML(pageNodes as NodeListOf<HTMLElement>);
        flipRef.current = flip;
        lastIndexRef.current = startPage;
        setPageIndex(startPage);
        setReady(true);

        flip.on("flip", (e) => {
          const index = Number(e.data);
          setPageIndex(index);
          savePage(doc.id, index);
          if (index !== lastIndexRef.current) {
            playPageTurnSound(soundOnRef.current);
            lastIndexRef.current = index;
          }
          void ensurePagesRendered(index);
        });

        void ensurePagesRendered(startPage);
      } catch (err) {
        console.error(err);
        if (!cancelled) setError("Could not open this PDF. Try another file.");
      }
    }

    void setup();

    const onMove = () => {
      setChromeVisible(true);
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => setChromeVisible(false), 2200);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchstart", onMove, { passive: true });
    hideTimer = window.setTimeout(() => setChromeVisible(false), 2800);

    return () => {
      cancelled = true;
      window.clearTimeout(hideTimer);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchstart", onMove);
      flipRef.current = null;
      try {
        flip?.destroy();
      } catch {
        // ignore
      }
      void pdfRef.current?.cleanup();
      pdfRef.current = null;
    };
  }, [doc.id, doc.data, doc.pageCount, isNarrow, layoutKey, ensurePagesRendered]);

  const goPrev = () => flipRef.current?.flipPrev(FlipCorner.BOTTOM);
  const goNext = () => flipRef.current?.flipNext(FlipCorner.BOTTOM);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // unsupported
    }
  };

  const toggleSound = async () => {
    if (!soundOn) {
      await unlockPageSound();
      setSoundOn(true);
      playPageTurnSound(true);
    } else {
      setSoundOn(false);
    }
  };

  const pageLabel = `${pageIndex + 1} / ${doc.pageCount}`;

  return (
    <div className="reader-shell">
      <div
        className={`reader-controls absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 ${
          chromeVisible ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        <div className="min-w-0">
          <p className="truncate text-sm text-[#f5f0e8]">{doc.name}</p>
          {resumeHint ? (
            <p className="text-xs text-[#c4b8a6]">Continue from page {resumeHint}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSound}
            className="rounded-md px-3 py-2 text-lg transition hover:bg-white/10"
            aria-label={soundOn ? "Mute page sound" : "Enable page sound"}
            title={soundOn ? "Sound on" : "Sound off"}
          >
            {soundOn ? "🔊" : "🔇"}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-md px-3 py-2 text-lg transition hover:bg-white/10"
            aria-label="Fullscreen"
            title="Fullscreen"
          >
            ⛶
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-md px-3 py-2 text-lg transition hover:bg-white/10"
            aria-label="Exit reader"
            title="Exit"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="reader-stage">
        {!ready && !error ? (
          <p className="pointer-events-none absolute text-sm text-[#c4b8a6]">Opening book…</p>
        ) : null}
        {error ? (
          <p className="pointer-events-none absolute text-sm text-[#f0d0c8]">{error}</p>
        ) : null}

        <div
          ref={hostRef}
          className="reader-book-host"
          style={{ visibility: ready ? "visible" : "hidden" }}
        />

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
        className={`reader-controls absolute inset-x-0 bottom-0 z-20 flex items-center justify-center gap-3 px-4 py-4 ${
          chromeVisible ? "visible-chrome" : "hidden-chrome"
        }`}
      >
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-2 py-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={goPrev}
            disabled={pageIndex <= 0}
            className="rounded-full px-4 py-2 text-sm transition hover:bg-white/10 disabled:opacity-35"
          >
            ← Previous
          </button>
          <span className="min-w-[7.5rem] text-center text-sm tabular-nums text-[#efe6d8]">
            Page {pageLabel}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={pageIndex >= doc.pageCount - 1}
            className="rounded-full px-4 py-2 text-sm transition hover:bg-white/10 disabled:opacity-35"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
