export function SiteFooter() {
  return (
    <footer className="site-footer border-t-[3px] border-black bg-cream">
      <div className="bookly-container py-12 sm:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-end lg:gap-12">
          <div>
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center border-[3px] border-black bg-lime text-lg font-black text-black shadow-[3px_3px_0_#000]"
                aria-hidden
              >
                B
              </span>
              <div>
                <p className="font-display text-2xl leading-none text-black">Bookly</p>
                <p className="mt-1 font-mono-label text-[10px] font-bold text-black/50">
                  PDF → Book · Local only
                </p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-ink-muted">
              A private PDF reader that feels like turning paper. Built for people who want less
              chrome and more book.
            </p>
          </div>

          <div className="lg:justify-self-end lg:text-right">
            <p className="font-mono-label text-[10px] font-bold text-black/50">Built by</p>
            <p className="mt-2 font-display text-2xl leading-none text-black sm:text-3xl">
              NITIN YADAV
            </p>
            <p className="mt-2 text-sm text-ink-muted">
              Product &amp; engineering ·{" "}
              <a
                href="https://x.com/nitindotdev"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-black underline decoration-2 underline-offset-2 hover:bg-lime"
              >
                @nitindotdev
              </a>
            </p>
            <div className="mt-5 flex flex-wrap gap-2 lg:justify-end">
              <a
                href="https://www.linkedin.com/in/nitin-yadav-681850299/"
                target="_blank"
                rel="noopener noreferrer"
                className="nb-social-link bg-blue text-white"
              >
                LinkedIn
              </a>
              <a
                href="https://github.com/nitinyadav2188"
                target="_blank"
                rel="noopener noreferrer"
                className="nb-social-link bg-black text-white"
              >
                GitHub
              </a>
              <a
                href="https://x.com/nitindotdev"
                target="_blank"
                rel="noopener noreferrer"
                className="nb-social-link bg-lime text-black"
              >
                X
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t-[3px] border-black pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono-label text-[10px] font-bold text-black/45">
            © {new Date().getFullYear()} Bookly · All rights reserved
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 font-mono-label text-[10px] font-bold text-black/55">
            <a href="#how-it-works" className="hover:text-black hover:underline">
              How it works
            </a>
            <a href="#privacy" className="hover:text-black hover:underline">
              Privacy
            </a>
            <a href="#install" className="hover:text-black hover:underline">
              Install
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
