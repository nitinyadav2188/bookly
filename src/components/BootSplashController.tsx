"use client";

import { useEffect } from "react";

const MIN_MS = 420;
const MAX_MS = 780;

/**
 * Hides the SSR boot splash once the app is hydrated / ready.
 * Splash markup lives in layout for first paint (no blank flash).
 */
export function BootSplashController() {
  useEffect(() => {
    const el = document.getElementById("bookly-boot-splash");
    if (!el) return;

    const started = performance.now();
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_MS - elapsed);
      window.setTimeout(() => {
        el.classList.add("is-done");
        const remove = () => {
          el.remove();
        };
        el.addEventListener("transitionend", remove, { once: true });
        window.setTimeout(remove, 420);
      }, wait);
    };

    const ready = () => {
      // Prefer fonts if available, but never stall past MAX_MS
      const fontsReady =
        "fonts" in document
          ? document.fonts.ready.then(() => undefined).catch(() => undefined)
          : Promise.resolve();
      void Promise.race([
        fontsReady,
        new Promise<void>((r) => window.setTimeout(r, MAX_MS - MIN_MS)),
      ]).then(finish);
    };

    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });

    // Absolute ceiling so splash never sticks
    const hard = window.setTimeout(finish, MAX_MS);
    return () => window.clearTimeout(hard);
  }, []);

  return null;
}
