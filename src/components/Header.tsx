"use client";

type HeaderProps = {
  onUpload: () => void;
  onInstall: () => void;
};

export function Header({ onUpload, onInstall }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-[color:var(--paper)]/85 backdrop-blur-md">
      <div className="bookly-container flex h-16 items-center justify-between gap-4">
        <a href="#top" className="font-display text-2xl tracking-tight text-ink">
          Bookly
        </a>
        <nav className="flex items-center gap-1 text-sm text-ink-soft sm:gap-2">
          <a
            href="#how-it-works"
            className="hidden rounded-md px-3 py-2 transition hover:bg-black/[0.04] hover:text-ink sm:inline-block"
          >
            How it works
          </a>
          <button
            type="button"
            onClick={onInstall}
            className="rounded-md px-3 py-2 transition hover:bg-black/[0.04] hover:text-ink"
          >
            Install App
          </button>
          <button
            type="button"
            onClick={onUpload}
            className="rounded-md bg-ink px-3.5 py-2 text-paper transition hover:bg-accent"
          >
            Upload PDF
          </button>
        </nav>
      </div>
    </header>
  );
}
