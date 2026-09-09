import { chromium, devices } from "playwright";
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
const errors = [];
const results = {};

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  copy(name);
}

try {
  // --- Mobile landing: install CTA + sticky bar ---
  const mobile = await browser.newContext({
    ...devices["Pixel 7"],
    viewport: { width: 390, height: 844 },
  });
  const m = await mobile.newPage();
  m.on("pageerror", (e) => errors.push(`mobile:${e}`));
  await m.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle", timeout: 60000 });
  await m.waitForTimeout(1200);

  const heroInstall = m.getByRole("button", { name: "Install on phone" });
  const headerInstall = m.getByRole("button", { name: "Install", exact: true });
  const sticky = m.locator(".mobile-install-bar");
  results.mobileLanding = {
    heroInstall: await heroInstall.count(),
    headerInstall: await headerInstall.count(),
    stickyVisible: await sticky.isVisible(),
    stickyText: (await sticky.innerText().catch(() => "")).replace(/\s+/g, " ").trim(),
  };
  await shot(m, "mobile-landing-install-cta.png");

  await sticky.scrollIntoViewIfNeeded().catch(() => {});
  await shot(m, "mobile-sticky-install-bar.png");

  // Install without APK → A2HS fallback modal
  await heroInstall.first().click();
  await m.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 8000 });
  await m.waitForTimeout(250);
  const title = await m.locator("#install-title").innerText();
  const dialogText = await m.locator('[role="dialog"]').innerText();
  results.installFallback = {
    title,
    hasInstallOnPhone: /install on phone/i.test(dialogText),
    hasUseInBrowser: /use in browser/i.test(dialogText),
    hasA2hs: /home screen|share|install app/i.test(dialogText),
  };
  await shot(m, "mobile-install-fallback-modal.png");
  await m.locator('[role="dialog"] button[aria-label="Close"]').click();

  // Install section (scroll)
  await m.locator("#install").scrollIntoViewIfNeeded();
  await m.waitForTimeout(300);
  const installSection = await m.locator("#install").innerText();
  results.installSection = {
    hasGetTheApp: /get the app/i.test(installSection),
    hasInstallOnPhone: /install on phone/i.test(installSection),
    hasUseInBrowser: /use in browser/i.test(installSection),
  };
  await shot(m, "mobile-install-section.png");

  // Mobile reader
  await m.evaluate(() => window.scrollTo(0, 0));
  await m.waitForTimeout(200);
  const [chooser] = await Promise.all([
    m.waitForEvent("filechooser", { timeout: 10000 }),
    m.getByRole("button", { name: "Upload PDF" }).first().click(),
  ]);
  await chooser.setFiles("/workspace/public/sample-book.pdf");
  await m.locator(".reader-shell").waitFor({ state: "visible", timeout: 30000 });
  await m.locator(".reader-book-host.is-ready").waitFor({ state: "visible", timeout: 45000 });
  await m.waitForTimeout(700);
  // Reveal chrome with a tap near top
  await m.locator(".reader-shell").click({ position: { x: 40, y: 40 } }).catch(() => {});
  await m.waitForTimeout(200);
  results.mobileReader = {
    touchShell: await m.locator(".reader-shell.is-touch").count(),
    downloadChip: await m.locator(".reader-chip-orange").count(),
    swipeHint: await m.locator(".reader-swipe-hint").isVisible().catch(() => false),
  };
  await shot(m, "mobile-reader-chrome.png");

  // Annotate toolbar
  await m.getByRole("button", { name: /Enter annotate mode|Mark/i }).click();
  await m.waitForTimeout(300);
  results.mobileAnnot = {
    toolbar: await m.locator(".annotation-toolbar").isVisible(),
  };
  await shot(m, "mobile-reader-annotate.png");
  await mobile.close();

  // --- Desktop landing + reader ---
  const desk = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const d = await desk.newPage();
  d.on("pageerror", (e) => errors.push(`desk:${e}`));
  await d.goto("http://127.0.0.1:4321/", { waitUntil: "networkidle", timeout: 60000 });
  await d.waitForTimeout(900);
  await shot(d, "desktop-landing-install.png");

  const footer = d.locator("footer.site-footer");
  await footer.scrollIntoViewIfNeeded();
  const footerText = await footer.innerText();
  results.footer = {
    hasNitin: /NITIN YADAV/i.test(footerText),
    linkedIn: await footer.locator('a[href*="linkedin.com/in/nitin-yadav"]').count(),
  };
  await shot(d, "footer-nitin.png");

  await d.evaluate(() => window.scrollTo(0, 0));
  await d.getByRole("button", { name: "Install on phone" }).first().click();
  await d.locator('[role="dialog"]').waitFor({ state: "visible", timeout: 8000 });
  await shot(d, "desktop-install-modal.png");
  await d.locator('[role="dialog"] button[aria-label="Close"]').click();

  const [fc] = await Promise.all([
    d.waitForEvent("filechooser", { timeout: 10000 }),
    d.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fc.setFiles("/workspace/public/sample-book.pdf");
  await d.locator(".reader-shell.is-desktop").waitFor({ state: "visible", timeout: 30000 });
  await d.locator(".reader-book-host.is-ready").waitFor({ state: "visible", timeout: 45000 });
  await d.waitForTimeout(800);
  await d.mouse.move(200, 120);
  await d.waitForTimeout(150);
  results.desktopReader = {
    frame: await d.locator(".reader-book-frame").count(),
    edgePrev: await d.locator(".reader-edge-nav.reader-edge-prev").isVisible(),
    edgeNext: await d.locator(".reader-edge-nav.reader-edge-next").isVisible(),
  };
  await shot(d, "desktop-reader-polished.png");
  await d.locator(".reader-edge-nav.reader-edge-next").click();
  await d.waitForTimeout(900);
  await shot(d, "desktop-reader-flipped-polished.png");
  await desk.close();

  console.log(JSON.stringify({ ok: true, results, errors }, null, 2));

  if (errors.length) process.exitCode = 2;
  if (!results.mobileLanding?.heroInstall || !results.mobileLanding?.stickyVisible) {
    console.error("Mobile install CTA / sticky bar missing");
    process.exitCode = 3;
  }
  if (!results.installFallback?.hasUseInBrowser || !results.installSection?.hasInstallOnPhone) {
    console.error("Install copy incomplete");
    process.exitCode = 4;
  }
  if (!results.desktopReader?.frame || !results.desktopReader?.edgeNext) {
    console.error("Desktop reader chrome incomplete");
    process.exitCode = 5;
  }
  if (!results.footer?.hasNitin) {
    console.error("Footer missing NITIN YADAV");
    process.exitCode = 6;
  }
} catch (err) {
  console.error("VERIFY FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
