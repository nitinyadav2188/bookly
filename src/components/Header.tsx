"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { UserMenu } from "@/components/UserMenu";

type HeaderProps = {
  onUpload: () => void;
  onInstall: () => void;
};

export function Header({ onUpload, onInstall }: HeaderProps) {
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const signedIn = Boolean(session?.user);
  const authLoading = status === "loading";

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

          {!authLoading && !signedIn ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Link
                href="/login"
                className="font-mono-label text-[11px] font-semibold text-black/70 underline-offset-4 hover:text-black hover:underline"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="border-[3px] border-black bg-white px-2.5 py-1.5 font-mono-label text-[10px] font-bold shadow-[3px_3px_0_#000] hover:bg-lime"
              >
                Create account
              </Link>
            </div>
          ) : null}

          {signedIn || authLoading ? <div className="hidden sm:block"><UserMenu /></div> : null}

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

          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center border-[3px] border-black bg-white shadow-[3px_3px_0_#000] sm:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <span className="font-display text-lg leading-none" aria-hidden>
              {mobileOpen ? "×" : "☰"}
            </span>
          </button>
        </nav>
      </div>

      {mobileOpen ? (
        <div className="border-t-[3px] border-black bg-cream px-4 py-3 sm:hidden">
          <div className="bookly-container flex flex-col gap-2">
            <a
              href="#how-it-works"
              className="font-mono-label text-[11px] font-bold text-black"
              onClick={() => setMobileOpen(false)}
            >
              How it works
            </a>
            {signedIn ? (
              <div onClick={() => setMobileOpen(false)}>
                <UserMenu />
              </div>
            ) : (
              <>
                <Link
                  href="/login"
                  className="font-mono-label text-[11px] font-bold text-black"
                  onClick={() => setMobileOpen(false)}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="nb-btn nb-btn-white w-full py-2 text-xs"
                  onClick={() => setMobileOpen(false)}
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
