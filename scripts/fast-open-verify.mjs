/**
 * Measure upload → first visible book page latency.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "http://127.0.0.1:4321";
const PDF = "/workspace/public/sample-book.pdf";
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

async function main() {
  await waitForServer(BASE);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Warm home + pdf worker once (mirrors real users who land on home first)
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const timings = [];

  for (let run = 0; run < 3; run += 1) {
    if (run > 0) {
      await page.goto(BASE, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(200);
    }

    const t0 = Date.now();
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
    ]);
    const tPick = Date.now();
    await fileChooser.setFiles(PDF);

    // First paint of reader chrome / book stage
    await page.waitForSelector(".reader-shell", { timeout: 20000 });
    const tReader = Date.now();

    // Book visible (host ready) — pages rendered and flipbook mounted
    await page.waitForFunction(
      () => {
        const host = document.querySelector(".reader-book-host");
        if (!host) return false;
        const style = getComputedStyle(host);
        return style.visibility !== "hidden" && host.classList.contains("is-ready");
      },
      null,
      { timeout: 30000 },
    );
    const tReady = Date.now();

    // Confirm at least one canvas has pixels
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector(".stf__item canvas, .book-page canvas");
        return canvas && canvas.width > 10 && canvas.height > 10;
      },
      null,
      { timeout: 15000 },
    );
    const tCanvas = Date.now();

    const sample = {
      run: run + 1,
      pickMs: tPick - t0,
      readerShellMs: tReader - tPick,
      bookReadyMs: tReady - tPick,
      canvasMs: tCanvas - tPick,
      totalFromPickMs: tCanvas - tPick,
    };
    timings.push(sample);
    console.log(JSON.stringify(sample));

    await page.screenshot({
      path: path.join(OUT, `fast-open-run${run + 1}.png`),
      fullPage: false,
    });
  }

  const readyAvg =
    timings.reduce((s, t) => s + t.bookReadyMs, 0) / timings.length;
  const canvasAvg =
    timings.reduce((s, t) => s + t.canvasMs, 0) / timings.length;

  const summary = {
    readyAvgMs: Math.round(readyAvg),
    canvasAvgMs: Math.round(canvasAvg),
    runs: timings,
    pass: readyAvg < 2500 && canvasAvg < 3000,
  };
  console.log("SUMMARY", JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, "fast-open-summary.json"), JSON.stringify(summary, null, 2));

  // Copy screenshots to opt artifacts if present
  const opt = "/opt/cursor/artifacts";
  if (fs.existsSync("/opt/cursor")) {
    fs.mkdirSync(opt, { recursive: true });
    for (const name of fs.readdirSync(OUT)) {
      if (name.startsWith("fast-open")) {
        try {
          fs.copyFileSync(path.join(OUT, name), path.join(opt, name));
        } catch {
          // ignore
        }
      }
    }
  }

  await browser.close();
  if (!summary.pass) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
