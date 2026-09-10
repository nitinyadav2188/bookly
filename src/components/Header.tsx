"use client";

type HeaderProps = {
  onUpload: () => void;
  onInstall: () => void;
};

export function Header({ onUpload, onInstall }: HeaderProps) {
  return (
    <header className="site-header sticky top-0 z-30 border-b-[3px] border-black bg-cream">
      <div className="bookly-container flex h-14 items-center justify-between gap-2 sm:h-[68px] sm:gap-3">
        <a href="#top" className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center border-[3px] border-black bg-lime text-lg font-black text-black shadow-[3px_3px_0_#000]"
            aria-hidden
          >
            P
          </span>
          <span className="font-display truncate text-lg text-black sm:text-2xl">Página</span>
        </a>
        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <a
            href="#how-it-works"
            className="hidden font-mono-label text-[11px] font-semibold text-black hover:underline sm:inline"
          >
            How it works
          </a>
          <button
            type="button"
            onClick={onInstall}
            className="nb-btn nb-btn-lime min-h-11 px-3 py-2 text-[11px] sm:px-4 sm:py-2.5 sm:text-xs"
          >
            Install
          </button>
          <button
            type="button"
            onClick={onUpload}
            aria-label="Upload PDF"
            className="nb-btn nb-btn-blue min-h-11 px-3 py-2 text-[11px] sm:px-4 sm:text-sm"
          >
            <span className="sm:hidden">Upload</span>
            <span className="hidden sm:inline">Upload PDF</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
