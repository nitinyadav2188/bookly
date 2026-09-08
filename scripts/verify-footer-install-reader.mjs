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
  } catch (err) {
    console.warn("copy failed", name, String(err));
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const results = { install: null, footer: null, reader: null, flip: null };

try {
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle", timeout: 60000 });
  // Let APK warm check finish
  await page.waitForTimeout(900);

  // Footer: NITIN YADAV + socials
  const footer = page.locator("footer.site-footer");
  await footer.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const footerText = await footer.innerText();
  const hasNitin = /NITIN YADAV/i.test(footerText);
  const linkedIn = await footer.locator('a[href*="linkedin.com/in/nitin-yadav"]').count();
  const github = await footer.locator('a[href*="github.com/nitinyadav2188"]').count();
  const xLink = await footer.locator('a[href*="x.com/nitindotdev"]').count();
  results.footer = { hasNitin, linkedIn, github, xLink };
  await page.screenshot({ path: path.join(OUT, "footer-professional.png"), fullPage: false });
  copy("footer-professional.png");

  // Scroll back up for install CTA
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);

  // Install: with APK present, should download immediately — no modal
  const downloadPromise = page.waitForEvent("download", { timeout: 8000 });
  await page.getByRole("button", { name: "Install Bookly" }).first().click();
  let downloaded = false;
  let downloadName = null;
  try {
    const download = await downloadPromise;
    downloadName = download.suggestedFilename();
    downloaded = true;
    await download.cancel().catch(() => {});
  } catch {
    downloaded = false;
  }
  const modalVisible = await page.locator('[role="dialog"]').isVisible().catch(() => false);
  results.install = { downloaded, downloadName, modalVisible };
  await page.screenshot({ path: path.join(OUT, "install-direct-click.png") });
  copy("install-direct-click.png");

  // Fallback path: force no APK via route abort, then click again
  await page.route("**/downloads/bookly.apk", (route) => route.abort());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  // Clear cached APK status by reloading the app (module state resets on full reload)
  await page.getByRole("button", { name: "Install Bookly" }).first().click();
  await page.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 8000 });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "install-fallback-modal.png") });
  copy("install-fallback-modal.png");
  const fallbackTitle = await page.locator("#install-title").innerText();
  results.install.fallbackTitle = fallbackTitle;
  await page.locator('[role="dialog"] button[aria-label="Close"]').click();
  await page.unroute("**/downloads/bookly.apk");

  // Desktop reader look
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 10000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fileChooser.setFiles("/workspace/public/sample-book.pdf");
  await page.locator(".reader-shell").waitFor({ state: "visible", timeout: 30000 });
  await page.locator(".reader-book-host.is-ready").waitFor({ state: "visible", timeout: 45000 });
  await page.waitForTimeout(800);
  // Reveal chrome
  await page.mouse.move(200, 120);
  await page.waitForTimeout(150);

  const hasFrame = await page.locator(".reader-book-frame").count();
  const edgePrev = await page.locator(".reader-edge-nav.reader-edge-prev").isVisible();
  const edgeNext = await page.locator(".reader-edge-nav.reader-edge-next").isVisible();
  const isDesktop = await page.locator(".reader-shell.is-desktop").count();
  results.reader = { hasFrame, edgePrev, edgeNext, isDesktop };

  await page.screenshot({ path: path.join(OUT, "desktop-reader-book.png") });
  copy("desktop-reader-book.png");

  // Flip via edge Next
  await page.locator(".reader-edge-nav.reader-edge-next").click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "desktop-reader-flipped.png") });
  copy("desktop-reader-flipped.png");
  const pageLabel = await page.locator("button[title='Jump to page']").innerText().catch(() => "");
  results.flip = { pageLabel };

  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));
  if (errors.length) process.exitCode = 2;
  if (!results.footer.hasNitin || !results.footer.linkedIn || !results.footer.github || !results.footer.xLink) {
    process.exitCode = 3;
  }
  if (!results.install.downloaded || results.install.modalVisible) {
    console.error("Install should download immediately when APK exists");
    process.exitCode = 4;
  }
  if (!results.reader.hasFrame || !results.reader.edgePrev || !results.reader.edgeNext) {
    console.error("Desktop reader chrome incomplete");
    process.exitCode = 5;
  }
} catch (err) {
  console.error("VERIFY FAIL", err);
  await page.screenshot({ path: path.join(OUT, "verify-fail.png") }).catch(() => {});
  copy("verify-fail.png");
  process.exitCode = 1;
} finally {
  await browser.close();
}
