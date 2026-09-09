/**
 * Verify Download + IndexedDB Continue reading on a running Página server.
 * Usage: node scripts/verify-download-resume.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:4321";
const pdfPath = resolve("public/sample-book.pdf");
const pdfBytes = readFileSync(pdfPath);
const pdfSha = createHash("sha256").update(pdfBytes).digest("hex");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
const result = {
  ok: false,
  downloadName: null,
  downloadSha: null,
  downloadMatches: false,
  continueVisible: false,
  resumed: false,
  readerReady: false,
  errors: [],
};

page.on("pageerror", (err) => result.errors.push(String(err)));

try {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForSelector('button:has-text("Upload PDF")', { timeout: 30_000 });

  // Upload sample PDF via the hidden file input
  const input = page.locator('input[type="file"]');
  await input.setInputFiles(pdfPath);

  await page.waitForSelector(".reader-shell", { timeout: 60_000 });
  await page.waitForSelector(".reader-shell .is-ready, button:has-text(\"Download\")", {
    timeout: 90_000,
  });

  // Wait until Download is present (chrome may auto-hide; force mouse move)
  await page.mouse.move(20, 20);
  const downloadBtn = page.getByRole("button", { name: "Download book" });
  await downloadBtn.waitFor({ state: "visible", timeout: 30_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 30_000 }),
    downloadBtn.click(),
  ]);
  result.downloadName = download.suggestedFilename();
  const dlPath = await download.path();
  if (!dlPath) throw new Error("download path missing");
  const dlBytes = readFileSync(dlPath);
  result.downloadSha = createHash("sha256").update(dlBytes).digest("hex");
  result.downloadMatches = result.downloadSha === pdfSha;

  // Exit to home — Continue reading should appear after IndexedDB save
  await page.mouse.move(20, 20);
  await page.getByRole("button", { name: "Exit reader" }).click();
  await page.waitForSelector('button:has-text("Upload PDF")', { timeout: 30_000 });

  // Give IndexedDB a moment if save was in flight
  const continueBtn = page.getByRole("button", { name: /Continue reading/i });
  for (let i = 0; i < 20; i += 1) {
    if (await continueBtn.count()) break;
    await page.waitForTimeout(250);
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  result.continueVisible = (await continueBtn.count()) > 0;
  if (!result.continueVisible) throw new Error("Continue reading not shown");

  await continueBtn.first().click();
  await page.waitForSelector(".reader-shell", { timeout: 60_000 });
  result.resumed = true;
  await page.waitForFunction(
    () => !!document.querySelector(".reader-book-host.is-ready"),
    null,
    { timeout: 90_000 },
  );
  result.readerReady = true;
  result.ok =
    result.downloadMatches &&
    result.continueVisible &&
    result.resumed &&
    result.readerReady &&
    result.errors.length === 0;
} catch (err) {
  result.errors.push(String(err));
  result.ok = false;
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
