"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Intentional brand beat so the mage+book animation can be enjoyed (~2s). */
const MIN_MS = 2000;
const MAX_MS = 2500;
const FONT_BUDGET_MS = 80;
/** prefers-reduced-motion: short hold for accessibility (~800ms–1s). */
const REDUCED_MIN_MS = 800;
const REDUCED_MAX_MS = 1000;

const SKIP_SPLASH_PREFIXES = ["/login", "/signup", "/account"];

/**
 * Hides the SSR boot splash once the app is hydrated, after a minimum hold.
 * Does not wait on window `load` or long `document.fonts` — those stall on
 * large assets (pdf worker). Cap fonts at FONT_BUDGET_MS; only the initial
 * app-open splash is held (PDF upload path is unaffected after dismiss).
 */
export function BootSplashController() {
  const pathname = usePathname();

  useEffect(() => {
    const el = document.getElementById("bookly-boot-splash");
    if (!el) return;
    // Verification scripts may freeze the splash via data-hold.
    if (el.dataset.hold === "1") return;

    if (SKIP_SPLASH_PREFIXES.some((p) => pathname === p || pathname?.startsWith(`${p}/`))) {
      el.classList.add("is-done");
      el.remove();
      return;
    }

    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const minMs = reduced ? REDUCED_MIN_MS : MIN_MS;
    const maxMs = reduced ? REDUCED_MAX_MS : MAX_MS;

    if (reduced) el.classList.add("is-reduced");

    const started = performance.now();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      const elapsed = performance.now() - started;
      const wait = Math.max(0, minMs - elapsed);
      window.setTimeout(() => {
        el.classList.add("is-done");
        const remove = () => {
          el.remove();
        };
        el.addEventListener("transitionend", remove, { once: true });
        window.setTimeout(remove, reduced ? 180 : 380);
      }, wait);
    };

    // Soft wait on fonts only — never block splash on a slow webfont fetch.
    const fontsReady =
      "fonts" in document
        ? Promise.race([
            document.fonts.ready.then(() => undefined).catch(() => undefined),
            new Promise<void>((r) => window.setTimeout(r, FONT_BUDGET_MS)),
          ])
        : Promise.resolve();

    void fontsReady.then(finish);

    const hard = window.setTimeout(finish, maxMs);
    return () => window.clearTimeout(hard);
  }, [pathname]);

  return null;
}
