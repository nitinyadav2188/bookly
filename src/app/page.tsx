"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Header } from "@/components/Header";
import { HeroBook } from "@/components/HeroBook";
import { UploadModal } from "@/components/UploadModal";
import { InstallModal } from "@/components/InstallModal";
import { MobileInstallBar } from "@/components/MobileInstallBar";
import { PreparingBook } from "@/components/PreparingBook";
import { BookReader } from "@/components/BookReader";
import { SiteFooter } from "@/components/SiteFooter";
import { openPdfFromFile, isPdfFile, PdfOpenError, warmPdfWorker, type OpenedPdf } from "@/lib/pdf";
import {
  captureInstallPrompt,
  startInstallFlow,
  warmApkCheck,
  type BeforeInstallPromptEvent,
} from "@/lib/install";
import {
  getLatestLibraryMeta,
  getLibraryBook,
  openLibraryBook,
  type LibraryBookMeta,
} from "@/lib/library";
import { saveAnnotations } from "@/lib/annotations";
import { savePage } from "@/lib/session";

type Screen = "home" | "processing" | "reader";

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installFallback, setInstallFallback] = useState(false);
  const [bookDoc, setBookDoc] = useState<OpenedPdf | null>(null);
  const [savedBook, setSavedBook] = useState<LibraryBookMeta | null>(null);
  const [prepareName, setPrepareName] = useState<string | undefined>();
  const [preparePhase, setPreparePhase] = useState<"preparing" | "rendering">("preparing");
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshSavedBook = useCallback(async () => {
    const meta = await getLatestLibraryMeta();
    setSavedBook(meta);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      captureInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    // Warm the PDF worker immediately after hydration — do not wait on idle
    // (idle can fire late on busy main threads and delays first open).
    warmPdfWorker();
    warmApkCheck();
    void refreshSavedBook();

    // Register SW after first paint so install/activate never contends with boot.
    const registerSw = () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // optional
        });
      }
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(registerSw, { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(registerSw, 1200);
    return () => window.clearTimeout(t);
  }, [refreshSavedBook]);

  const handleInstall = useCallback(async () => {
    const result = await startInstallFlow();
    if (result === "fallback" || result === "standalone") {
      setInstallFallback(result === "fallback");
      setInstallOpen(true);
    }
    // prompted / downloaded: useful action already started — no modal.
  }, []);

  const openFilePicker = useCallback(() => {
    setPrepareError(null);
    const input = fileInputRef.current;
    if (!input) return;
    // Allow re-selecting the same file; keep input in the DOM for hydration.
    input.value = "";
    input.click();
  }, []);

  const openUploadModal = useCallback(() => {
    setPrepareError(null);
    setUploadOpen(true);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setUploadOpen(false);
    setPrepareName(file.name);
    setPrepareError(null);
    setPreparePhase("preparing");
    setScreen("processing");

    try {
      if (!isPdfFile(file)) {
        throw new PdfOpenError("Please choose a PDF file.");
      }
      const opened = await openPdfFromFile(file);
      // Open the reader as soon as page count is known — first pages render inside BookReader.
      setPreparePhase("rendering");
      setBookDoc(opened);
      setScreen("reader");
    } catch (err) {
      console.error(err);
      const message =
        err instanceof PdfOpenError
          ? err.message
          : "We couldn't open this PDF.";
      setPrepareError(message);
      setScreen("home");
      setUploadOpen(true);
    }
  }, []);

  const resumeSavedBook = useCallback(async () => {
    if (!savedBook) return;
    setPrepareName(savedBook.name);
    setPrepareError(null);
    setPreparePhase("preparing");
    setScreen("processing");

    try {
      const opened = await openLibraryBook(savedBook.id);
      if (!opened) {
        throw new Error("missing");
      }
      // Restore page + annotations into helpers used by the reader.
      savePage(opened.id, savedBook.lastPage ?? 0);
      const record = await getLibraryBook(savedBook.id);
      if (record?.annotations) {
        saveAnnotations(opened.id, record.annotations);
      }
      setPreparePhase("rendering");
      setBookDoc(opened);
      setScreen("reader");
    } catch (err) {
      console.error(err);
      setPrepareError("Couldn’t resume that book. Upload the PDF again.");
      setSavedBook(null);
      setScreen("home");
      void refreshSavedBook();
    }
  }, [savedBook, refreshSavedBook]);

  const onNativeFile = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  if (screen === "processing") {
    return <PreparingBook fileName={prepareName} phase={preparePhase} />;
  }

  if (screen === "reader" && bookDoc) {
    return (
      <BookReader
        document={bookDoc}
        onExit={() => {
          setScreen("home");
          void refreshSavedBook();
        }}
      />
    );
  }

  const continueTarget = savedBook ?? (bookDoc
    ? {
        id: bookDoc.id,
        name: bookDoc.name,
        pageCount: bookDoc.pageCount,
        lastPage: 0,
      }
    : null);

  return (
    <div id="top" className="min-h-screen">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="bookly-file-input"
        onChange={onNativeFile}
        aria-hidden
        tabIndex={-1}
      />

      <Header onUpload={openFilePicker} onInstall={() => void handleInstall()} />

      <main>
        <section
          className="landing-hero border-b-[3px] border-black bg-black text-white"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <div className="bookly-container grid items-center gap-8 py-9 sm:gap-10 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-16">
            <div className="max-w-2xl">
              <p className="landing-brand font-display text-[clamp(2.75rem,14vw,4.25rem)] leading-[0.9] text-lime">
                Página
              </p>
              <h1 className="mt-3 font-display text-[clamp(1.55rem,6.5vw,3.35rem)] leading-[0.98] text-white sm:mt-4">
                Turn your PDF into a{" "}
                <span className="bg-lime px-1 text-black">book.</span>
              </h1>
              <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-white/75 sm:mt-4 sm:text-lg">
                Upload a PDF and read it with the feeling of turning real pages.
              </p>

              <div className="landing-cta-row mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="nb-btn nb-btn-lime min-h-11 w-full text-sm sm:w-auto"
                >
                  Upload PDF →
                </button>
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  className="nb-btn nb-btn-blue min-h-11 w-full text-sm sm:w-auto"
                >
                  Install on phone
                </button>
              </div>

              <button
                type="button"
                onClick={openUploadModal}
                className="mt-3 font-mono-label text-[10px] font-bold text-white/55 underline-offset-4 hover:text-white hover:underline"
              >
                Or drop a PDF here
              </button>

              {prepareError ? (
                <p className="mt-4 border-[3px] border-black bg-pink px-3 py-2 font-display text-sm text-white">
                  {prepareError}
                </p>
              ) : null}

              {continueTarget ? (
                <button
                  type="button"
                  onClick={() => {
                    if (savedBook) {
                      void resumeSavedBook();
                    } else {
                      setScreen("reader");
                    }
                  }}
                  className="nb-btn nb-btn-orange mt-4 min-h-11 w-full text-sm sm:w-auto"
                >
                  Continue reading {continueTarget.name}
                </button>
              ) : null}
            </div>

            <div className="landing-hero-visual justify-self-center lg:justify-self-end">
              <HeroBook />
            </div>
          </div>
        </section>

        <section className="border-b-[3px] border-black">
          <div className="grid sm:grid-cols-2">
            {[
              { title: "Grocery lists", color: "bg-lime text-black", label: "Use it for" },
              { title: "Long reports", color: "bg-pink text-white", label: "Use it for" },
              { title: "Class notes", color: "bg-blue text-white", label: "Use it for" },
              { title: "Novel PDFs", color: "bg-orange text-black", label: "Use it for" },
            ].map((tile) => (
              <div
                key={tile.title}
                className={`feature-tile rounded-none border-0 border-b-[3px] border-black sm:border-r-[3px] ${tile.color}`}
              >
                <p className="eyebrow">{tile.label}</p>
                <h3>{tile.title}</h3>
              </div>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-b-[3px] border-black py-16">
          <div className="bookly-container">
            <p className="font-mono-label text-[11px] font-bold text-black/50">How it works</p>
            <h2 className="mt-2 font-display text-4xl text-black">Three steps. No fluff.</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Upload a PDF",
                  copy: "Pick a file from your device. It never leaves your browser.",
                  color: "bg-lime",
                },
                {
                  step: "02",
                  title: "Open as a book",
                  copy: "Pages land in a spread that feels like paper, not a toolbar.",
                  color: "bg-blue text-white",
                },
                {
                  step: "03",
                  title: "Turn and read",
                  copy: "Swipe or click to flip — download a copy anytime to keep reading offline.",
                  color: "bg-pink text-white",
                },
              ].map((item) => (
                <li
                  key={item.step}
                  className={`border-[3px] border-black p-5 shadow-[5px_5px_0_#000] ${item.color}`}
                >
                  <p className="font-mono-label text-[10px] font-bold opacity-70">Step {item.step}</p>
                  <h3 className="mt-3 font-display text-2xl leading-none">{item.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed opacity-90">{item.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacy" className="border-b-[3px] border-black bg-black py-16 text-white">
          <div className="bookly-container max-w-2xl">
            <span className="nb-tag">Privacy</span>
            <h2 className="mt-5 font-display text-4xl leading-none text-white">
              Your PDF stays <span className="bg-pink px-1">private.</span>
            </h2>
            <p className="mt-5 text-base leading-relaxed text-white/75">
              Página processes files locally in your browser. Nothing is uploaded to a server.
              Download saves the PDF to your device. This browser can also keep a local copy so you
              can continue reading later — still on your machine, never in the cloud.
            </p>
          </div>
        </section>

        <section id="install" className="border-b-[3px] border-black bg-blue py-12 text-white sm:py-16">
          <div className="bookly-container">
            <span className="nb-tag bg-lime text-black">Get the app</span>
            <h2 className="mt-5 font-display text-[clamp(2rem,7vw,3.5rem)] leading-[0.95] text-white">
              Install on phone.{" "}
              <span className="bg-lime px-1 text-black">Or use in browser.</span>
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/80">
              One tap installs Página as a fullscreen app when your browser supports it. Otherwise
              you get clear Add-to-Home-Screen steps — or keep reading in the tab. Same private
              reader either way.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="border-[3px] border-black bg-cream p-5 text-black shadow-[6px_6px_0_#000]">
                <p className="font-mono-label text-[10px] font-bold text-black/55">Install on phone</p>
                <h3 className="mt-2 font-display text-2xl leading-none">Home screen app</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                  Starts download or the system install prompt immediately. Falls back to short
                  Add-to-Home-Screen steps on iOS and older browsers.
                </p>
                <button
                  type="button"
                  onClick={() => void handleInstall()}
                  className="nb-btn nb-btn-lime mt-5 w-full text-sm sm:w-auto"
                >
                  Install Página
                </button>
              </div>

              <div className="border-[3px] border-black bg-pink p-5 text-white shadow-[6px_6px_0_#000]">
                <p className="font-mono-label text-[10px] font-bold text-white/70">Use in browser</p>
                <h3 className="mt-2 font-display text-2xl leading-none">No install needed</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/85">
                  Upload a PDF and start reading in this tab. Files stay on your device — nothing
                  goes to a server.
                </p>
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="nb-btn nb-btn-white mt-5 w-full text-sm sm:w-auto"
                >
                  Open in browser
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <MobileInstallBar onInstall={() => void handleInstall()} />

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFile={handleFile} />
      <InstallModal
        open={installOpen}
        fallbackOnly={installFallback}
        onClose={() => {
          setInstallOpen(false);
          setInstallFallback(false);
        }}
      />
    </div>
  );
}
