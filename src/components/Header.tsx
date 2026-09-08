"use client";

type HeaderProps = {
  onUpload: () => void;
  onInstall: () => void;
};

export function Header({ onUpload, onInstall }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-black bg-cream">
      <div className="bookly-container flex h-[68px] items-center justify-between gap-3">
        <a href="#top" className="flex items-center gap-2.5">
          <span
            className="flex h-9 w-9 items-center justify-center border-[3px] border-black bg-lime text-lg font-black text-black shadow-[3px_3px_0_#000]"
            aria-hidden
          >
            B
          </span>
          <span className="font-display text-xl text-black sm:text-2xl">Bookly</span>
        </a>
        <nav className="flex items-center gap-2 sm:gap-3">
          <a
            href="#how-it-works"
            className="hidden font-mono-label text-[11px] font-semibold text-black hover:underline sm:inline"
          >
            How it works
          </a>
          <button
            type="button"
            onClick={onInstall}
            className="hidden font-mono-label text-[11px] font-semibold text-black hover:underline sm:inline"
          >
            Install App
          </button>
          <button type="button" onClick={onUpload} className="nb-btn nb-btn-blue text-xs sm:text-sm">
            Upload PDF
          </button>
        </nav>
      </div>
    </header>
  );
}
