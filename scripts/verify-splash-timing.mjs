/**
 * Measure boot splash dismiss latency (cold load).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://127.0.0.1:4321/";
const OUT = "/workspace/artifacts";
fs.mkdirSync(OUT, { recursive: true });

async function waitForServer(url, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("server not ready: " + url);
}

async function measure(page, reducedMotion) {
  const context = page.context();
  await context.addInitScript((reduced) => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query) => {
        const reducedMatch = query.includes("prefers-reduced-motion");
        return {
          matches: reduced ? reducedMatch : false,
          media: query,
          onchange: null,
          addListener() {},
          removeListener() {},
          addEventListener() {},
          removeEventListener() {},
          dispatchEvent() {
            return false;
          },
        };
      },
    });
  }, reducedMotion);

  const tNav = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  const splashPresent = (await page.locator("#bookly-boot-splash").count()) > 0;

  await page.waitForFunction(
    () => !document.getElementById("bookly-boot-splash"),
    null,
    { timeout: 10000 },
  );
  const clearedMs = Date.now() - tNav;

  return { splashPresent, clearedMs, reducedMotion };
}

async function main() {
  await waitForServer(BASE);
  const browser = await chromium.launch({ headless: true });

  const normalPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const normal = await measure(normalPage, false);
  await normalPage.close();

  const reducedPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const reduced = await measure(reducedPage, true);
  await reducedPage.close();

  const summary = {
    normal,
    reduced,
    // Intentional hold: normal ~3–4s (min 3s, max ~4.5s wall+fade); reduced ~1s
    pass:
      normal.splashPresent &&
      reduced.splashPresent &&
      normal.clearedMs >= 3000 &&
      normal.clearedMs <= 4500 &&
      reduced.clearedMs >= 800 &&
      reduced.clearedMs <= 2000,
  };

  console.log(JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, "splash-timing.json"), JSON.stringify(summary, null, 2));

  const opt = "/opt/cursor/artifacts";
  if (fs.existsSync("/opt/cursor")) {
    fs.mkdirSync(opt, { recursive: true });
    try {
      fs.copyFileSync(path.join(OUT, "splash-timing.json"), path.join(opt, "splash-timing.json"));
    } catch {
      // ignore
    }
  }

  await browser.close();
  if (!summary.pass) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
