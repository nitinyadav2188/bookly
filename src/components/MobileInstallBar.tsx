"use client";

import { useEffect, useState } from "react";
import { isStandaloneDisplay } from "@/lib/install";

type MobileInstallBarProps = {
  onInstall: () => void;
};

const DISMISS_KEY = "bookly-install-bar-dismissed";

export function MobileInstallBar({ onInstall }: MobileInstallBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandaloneDisplay()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // ignore
    }
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setVisible(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="mobile-install-bar fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-black bg-lime px-3 py-3 shadow-[0_-4px_0_#000] sm:hidden"
      role="region"
      aria-label="Install Página on your phone"
    >
      <div className="mx-auto flex max-w-lg items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm leading-none text-black">Get the app</p>
          <p className="mt-1 font-mono-label text-[9px] font-bold text-black/65">
            Install on phone · or use in browser
          </p>
        </div>
        <button
          type="button"
          onClick={onInstall}
          className="nb-btn nb-btn-blue shrink-0 px-3 py-2.5 text-xs"
        >
          Install
        </button>
        <button
          type="button"
          aria-label="Dismiss install bar"
          className="shrink-0 border-[3px] border-black bg-white px-2.5 py-2 font-display text-xs shadow-[3px_3px_0_#000]"
          onClick={() => {
            try {
              sessionStorage.setItem(DISMISS_KEY, "1");
            } catch {
              // ignore
            }
            setVisible(false);
          }}
        >
          X
        </button>
      </div>
    </div>
  );
}
