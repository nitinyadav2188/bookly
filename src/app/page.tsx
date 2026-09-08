"use client";

import { useCallback, useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { HeroBook } from "@/components/HeroBook";
import { UploadModal } from "@/components/UploadModal";
import { InstallModal } from "@/components/InstallModal";
import { PreparingBook } from "@/components/PreparingBook";
import { BookReader } from "@/components/BookReader";
import { openPdfFromFile, type OpenedPdf } from "@/lib/pdf";
import {
  captureInstallPrompt,
  type BeforeInstallPromptEvent,
} from "@/lib/install";

type Screen = "home" | "processing" | "reader";

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [document, setDocument] = useState<OpenedPdf | null>(null);
  const [prepareName, setPrepareName] = useState<string | undefined>();
  const [prepareError, setPrepareError] = useState<string | null>(null);

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

  const openUpload = useCallback(() => {
    setPrepareError(null);
    setUploadOpen(true);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setUploadOpen(false);
    setPrepareName(file.name);
    setPrepareError(null);
    setScreen("processing");

    try {
      const opened = await openPdfFromFile(file);
      // Brief pause so the preparing state is readable
      await new Promise((r) => setTimeout(r, 450));
      setDocument(opened);
      setScreen("reader");
    } catch (err) {
      console.error(err);
      setPrepareError("Could not read that PDF. Please try another file.");
      setScreen("home");
      setUploadOpen(true);
    }
  }, []);

  if (screen === "processing") {
    return <PreparingBook fileName={prepareName} />;
  }

  if (screen === "reader" && document) {
    return (
      <BookReader
        document={document}
        onExit={() => {
          setScreen("home");
        }}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen">
      <Header onUpload={openUpload} onInstall={() => setInstallOpen(true)} />

      <main>
        <section className="bookly-container grid items-center gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:py-20">
          <div className="max-w-xl">
            <p className="font-display text-5xl leading-none tracking-tight text-ink sm:text-6xl md:text-7xl">
              Bookly
            </p>
            <h1 className="mt-6 font-display text-3xl leading-tight text-ink sm:text-4xl md:text-[2.75rem]">
              Turn your PDF into a book.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-ink-soft sm:text-lg">
              Upload a PDF and read it with the feeling of turning real pages.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={openUpload}
                className="rounded-md bg-ink px-5 py-3 text-sm text-paper transition hover:bg-accent"
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setInstallOpen(true)}
                className="rounded-md border border-black/10 bg-white/40 px-5 py-3 text-sm text-ink transition hover:bg-white/70"
              >
                Install Bookly
              </button>
            </div>

            <p className="mt-4 text-sm tracking-wide text-ink-faint">
              PDF only • Simple • Private
            </p>
            {prepareError ? (
              <p className="mt-3 text-sm text-[color:var(--danger)]">{prepareError}</p>
            ) : null}
          </div>

          <div className="justify-self-center lg:justify-self-end">
            <HeroBook />
          </div>
        </section>

        <section id="how-it-works" className="border-t border-black/5 py-16">
          <div className="bookly-container">
            <h2 className="font-display text-3xl text-ink">How it works</h2>
            <p className="mt-3 max-w-xl text-ink-soft">
              Three steps. No accounts. No cloud library.
            </p>
            <ol className="mt-10 grid gap-10 sm:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Upload a PDF",
                  copy: "Choose a file from your device. It never leaves your browser.",
                },
                {
                  step: "2",
                  title: "Open as a book",
                  copy: "Bookly lays pages into a soft, paper-like spread.",
                },
                {
                  step: "3",
                  title: "Turn and read",
                  copy: "Swipe or click to flip pages — with a subtle paper sound if you like.",
                },
              ].map((item) => (
                <li key={item.step}>
                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                    Step {item.step}
                  </p>
                  <h3 className="mt-2 font-display text-2xl text-ink">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="privacy" className="border-t border-black/5 py-16">
          <div className="bookly-container max-w-2xl">
            <h2 className="font-display text-3xl text-ink">Your PDF stays private.</h2>
            <p className="mt-4 text-base leading-relaxed text-ink-soft">
              Bookly processes files locally in your browser. Nothing is uploaded to a
              server, and documents are not made publicly accessible. Close the tab and
              the file leaves with it — only your last page is remembered for this
              browser session.
            </p>
          </div>
        </section>

        <section id="install" className="border-t border-black/5 py-16">
          <div className="bookly-container flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-display text-3xl text-ink">Take Bookly with you</h2>
              <p className="mt-3 max-w-md text-ink-soft">
                Install on your phone for a fullscreen reading app, or keep using it in
                the browser.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInstallOpen(true)}
              className="rounded-md bg-ink px-5 py-3 text-sm text-paper transition hover:bg-accent"
            >
              Install Bookly
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 py-8">
        <div className="bookly-container flex flex-col gap-2 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>Bookly — PDF → book.</p>
          <p>Private by design. Local-only reading.</p>
        </div>
      </footer>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} onFile={handleFile} />
      <InstallModal open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
