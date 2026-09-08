"use client";

import { useEffect } from "react";

/** Brief brand beat — dismiss ASAP once hydrated; hard-cap under ~0.6s. */
const MIN_MS = 280;
const MAX_MS = 520;
const FONT_BUDGET_MS = 80;
/** prefers-reduced-motion: near-instant dismiss. */
const REDUCED_MIN_MS = 0;
const REDUCED_MAX_MS = 40;

/**
 * Hides the SSR boot splash once the app is hydrated.
 * Does not wait on window `load` or long `document.fonts` — those stall on
 * large assets (pdf worker) and slow first paint. Cap fonts at FONT_BUDGET_MS.
 */
export function BootSplashController() {
  useEffect(() => {
    const el = document.getElementById("bookly-boot-splash");
    if (!el) return;
    // Verification scripts may freeze the splash via data-hold.
    if (el.dataset.hold === "1") return;

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
  }, []);

  return null;
}
