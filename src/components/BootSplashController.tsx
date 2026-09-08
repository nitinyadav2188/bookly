"use client";

import { useEffect } from "react";

const MIN_MS = 420;
const MAX_MS = 780;
const REDUCED_MIN_MS = 120;
const REDUCED_MAX_MS = 280;

/**
 * Hides the SSR boot splash once the app is hydrated / ready.
 * Splash markup lives in layout for first paint (no blank flash).
 * Holds ~0.4–0.8s (or fonts-ready + min), shorter with prefers-reduced-motion.
 */
export function BootSplashController() {
  useEffect(() => {
    const el = document.getElementById("bookly-boot-splash");
    if (!el) return;

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
        window.setTimeout(remove, 420);
      }, wait);
    };

    const ready = () => {
      const fontsReady =
        "fonts" in document
          ? document.fonts.ready.then(() => undefined).catch(() => undefined)
          : Promise.resolve();
      void Promise.race([
        fontsReady,
        new Promise<void>((r) => window.setTimeout(r, Math.max(0, maxMs - minMs))),
      ]).then(finish);
    };

    if (document.readyState === "complete") ready();
    else window.addEventListener("load", ready, { once: true });

    const hard = window.setTimeout(finish, maxMs);
    return () => window.clearTimeout(hard);
  }, []);

  return null;
}
