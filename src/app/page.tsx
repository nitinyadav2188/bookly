"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Header } from "@/components/Header";
import { HeroBook } from "@/components/HeroBook";
import { UploadModal } from "@/components/UploadModal";
import { InstallModal } from "@/components/InstallModal";
import { PreparingBook } from "@/components/PreparingBook";
import { BookReader } from "@/components/BookReader";
import { openPdfFromFile, isPdfFile, PdfOpenError, type OpenedPdf } from "@/lib/pdf";
import {
  captureInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/install";

type Screen = "home" | "processing" | "reader";

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [bookDoc, setBookDoc] = useState<OpenedPdf | null>(null);
  const [prepareName, setPrepareName] = useState<string | undefined>();
  const [preparePhase, setPreparePhase] = useState<"preparing" | "rendering">("preparing");
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      captureInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // optional
      });
    }
  }, []);

  const openFilePicker = useCallback(() => {
    setPrepareError(null);
    fileInputRef.current?.click();
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
      setPreparePhase("rendering");
      await new Promise((r) => setTimeout(r, 350));
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
        }}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        onChange={onNativeFile}
        aria-hidden
        tabIndex={-1}
      />

      <Header onUpload={openFilePicker} onInstall={() => setInstallOpen(true)} />

      <main>
        <section className="border-b-[3px] border-black bg-black text-white">
          <div className="bookly-container grid items-center gap-12 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-16">
            <div className="max-w-2xl">
              <span className="nb-tag">PDF only · Simple · Private</span>
              <h1 className="mt-6 font-display text-[clamp(2.4rem,8vw,4.75rem)] leading-[0.95] text-white">
                Turn your PDF into a{" "}
                <span className="bg-lime px-1 text-black">book.</span>
              </h1>
              <p className="mt-5 max-w-md text-base leading-relaxed text-white/75 sm:text-lg">
                Upload a PDF and read it with the feeling of turning real pages.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button type="button" onClick={openFilePicker} className="nb-btn nb-btn-lime text-sm">
                  Upload PDF →
                </button>
                <button
                  type="button"
                  onClick={() => setInstallOpen(true)}
                  className="nb-btn nb-btn-blue text-sm"
                >
                  Install Bookly
                </button>
              </div>

              <button
                type="button"
                onClick={openUploadModal}
                className="mt-4 font-mono-label text-[10px] font-bold text-white/55 underline-offset-4 hover:text-white hover:underline"
              >
                Or drop a PDF here
              </button>

              {prepareError ? (
                <p className="mt-4 border-[3px] border-black bg-pink px-3 py-2 font-display text-sm text-white">
                  {prepareError}
                </p>
              ) : null}

              {bookDoc ? (
                <button
                  type="button"
                  onClick={() => setScreen("reader")}
                  className="nb-btn nb-btn-orange mt-4 text-sm"
                >
                  Resume {bookDoc.name}
                </button>
              ) : null}
            </div>

            <div className="justify-self-center lg:justify-self-end">
              <HeroBook />
            </div>
          </div>
        </section>

        <section
          className="border-b-[3px] border-black bg-cream px-4 py-10"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <div className="bookly-container">
            <button
              type="button"
              onClick={openUploadModal}
              className="flex w-full flex-col items-center justify-center border-[3px] border-dashed border-black bg-white px-6 py-10 text-center shadow-[6px_6px_0_#000]"
            >
              <span className="mb-3 flex h-12 w-12 items-center justify-center border-[3px] border-black bg-blue font-display text-2xl text-white shadow-[3px_3px_0_#000]">
                +
              </span>
              <p className="font-display text-xl text-black">Drop your PDF here</p>
              <p className="mt-2 font-mono-label text-[10px] text-black/50">or click to choose</p>
            </button>
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
                  copy: "Swipe or click to flip — with a subtle paper sound if you want it.",
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
              Bookly processes files locally in your browser. Nothing is uploaded to a server.
              Close the tab and the file leaves with it — only your last page is remembered for
              this browser session.
            </p>
          </div>
        </section>

        <section id="install" className="border-b-[3px] border-black py-16">
          <div className="bookly-container flex flex-col items-start justify-between gap-6 border-[3px] border-black bg-white p-6 shadow-[8px_8px_0_#000] sm:flex-row sm:items-end sm:p-8">
            <div>
              <p className="font-mono-label text-[11px] font-bold text-black/50">Mobile</p>
              <h2 className="mt-2 font-display text-3xl text-black">Take Bookly with you</h2>
              <p className="mt-3 max-w-md text-ink-muted">
                Install on your phone for a fullscreen reading app, or keep using it in the
                browser.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="nb-btn nb-btn-blue text-sm"
            >
              Install Bookly
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-cream py-10">
        <div className="bookly-container flex flex-col items-center gap-2 text-center">
          <p className="font-display text-lg text-black">Bookly © 2026</p>
          <p className="font-mono-label text-[10px] text-black/50">PDF → Book · Local only</p>
        </div>
      </footer>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFile={handleFile} />
      <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
