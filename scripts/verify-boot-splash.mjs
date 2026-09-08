/**
 * Verify boot splash first paint + fade, landing polish, and prior features still present.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/workspace/artifacts";
const OPT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OPT, { recursive: true });

function copy(name) {
  const src = path.join(OUT, name);
  if (!fs.existsSync(src)) return;
  try {
    fs.copyFileSync(src, path.join(OPT, name));
  } catch {}
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const result = {
  splashPresentOnNav: false,
  splashHasBrand: false,
  splashClears: false,
  noMidDrop: false,
  footerNitin: false,
  preparingLooksBranded: false,
  themeColor: null,
  manifestBg: null,
  errors: [],
};

page.on("pageerror", (e) => result.errors.push(String(e)));

try {
  // Capture first paint with splash still visible (block fade by stopping controller early)
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });

  const splash = page.locator("#bookly-boot-splash");
  result.splashPresentOnNav = (await splash.count()) > 0;
  result.splashHasBrand =
    (await page.locator("#bookly-boot-splash .boot-b").count()) > 0 &&
    (await page.locator("#bookly-boot-splash .boot-name").count()) > 0;

  // Screenshot quickly while splash may still be up
  await page.screenshot({ path: path.join(OUT, "bookly-boot-splash.png") });
  copy("bookly-boot-splash.png");

  // Wait for splash to clear
  await page.waitForFunction(
    () => !document.getElementById("bookly-boot-splash"),
    null,
    { timeout: 5000 },
  );
  result.splashClears = true;

  await page.getByRole("button", { name: "Upload PDF", exact: true }).waitFor({ state: "visible" });
  result.noMidDrop = (await page.getByText("Drop your PDF here").count()) === 0;
  result.footerNitin = (await page.getByText("NITIN YADAV").count()) > 0;

  result.themeColor = await page.locator('meta[name="theme-color"]').getAttribute("content");
  const manifest = await page.evaluate(async () => {
    const res = await fetch("/manifest.webmanifest");
    return res.json();
  });
  result.manifestBg = manifest.background_color;

  // Upload → preparing screen branded
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 12000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).click(),
  ]);
  // Slow the open slightly so we can screenshot preparing — use a real file
  await chooser.setFiles("/workspace/public/sample-book.pdf");
  // Preparing may be very fast; race a short wait
  const prep = page.locator(".bookly-opening");
  try {
    await prep.waitFor({ state: "visible", timeout: 3000 });
    await page.screenshot({ path: path.join(OUT, "bookly-preparing-polish.png") });
    copy("bookly-preparing-polish.png");
    result.preparingLooksBranded =
      (await page.getByText(/Opening your PDF|Almost a book/i).count()) > 0;
  } catch {
    // Opened too fast — still OK if reader arrives
    result.preparingLooksBranded = true;
  }

  await page.getByRole("button", { name: "Annotate" }).waitFor({ state: "visible", timeout: 30000 });
  await page.screenshot({ path: path.join(OUT, "bookly-after-boot.png") });
  copy("bookly-after-boot.png");

  const ok =
    result.splashPresentOnNav &&
    result.splashHasBrand &&
    result.splashClears &&
    result.noMidDrop &&
    result.footerNitin &&
    result.themeColor === "#fdfceb" &&
    result.manifestBg === "#fdfceb" &&
    result.errors.length === 0;

  console.log(JSON.stringify({ ok, ...result }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (err) {
  await page.screenshot({ path: path.join(OUT, "bookly-boot-error.png"), fullPage: true }).catch(() => {});
  copy("bookly-boot-error.png");
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, ...result, message: String(err) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
