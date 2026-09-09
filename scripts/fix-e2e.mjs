/**
 * End-to-end Bookly reliability check:
 * splash → install (no hang) → upload → ink → desktop flip → mobile gestures
 */
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

async function uploadSample(page) {
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fileChooser.setFiles("/workspace/public/sample-book.pdf");
}

async function hasInk(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".book-page canvas");
    if (!canvas) return false;
    const ctx = canvas.getContext("2d");
    const { data } = ctx.getImageData(40, 40, 160, 160);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return true;
    }
    return false;
  });
}

async function pageLabel(page) {
  await page.mouse.move(180, 180);
  await page.waitForTimeout(60);
  return page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
}

async function tapPoint(page, x, y) {
  await page.evaluate(
    ([tx, ty]) => {
      const el = document.elementFromPoint(tx, ty);
      if (!el) throw new Error("No element at tap");
      const fire = (type) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: tx,
            clientY: ty,
            pointerId: 2,
            pointerType: "touch",
            isPrimary: true,
            buttons: type === "pointerup" ? 0 : 1,
          }),
        );
      };
      fire("pointerdown");
      fire("pointerup");
    },
    [x, y],
  );
}

async function swipe(page, fx, fy, tx, ty) {
  await page.evaluate(
    async ([a, b, c, d]) => {
      const el = document.elementFromPoint(a, b);
      if (!el) throw new Error("No element at swipe start");
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const fire = (type, x, y) => {
        el.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
            pointerId: 1,
            pointerType: "touch",
            isPrimary: true,
            buttons: type === "pointerup" || type === "pointercancel" ? 0 : 1,
          }),
        );
      };
      fire("pointerdown", a, b);
      for (let i = 1; i <= 8; i += 1) {
        fire("pointermove", a + ((c - a) * i) / 8, b + ((d - b) * i) / 8);
        await sleep(12);
      }
      fire("pointerup", c, d);
    },
    [fx, fy, tx, ty],
  );
}

const results = { splash: null, install: null, desktop: null, mobile: null, errors: [] };
const browser = await chromium.launch({ headless: true });

try {
  // ——— Desktop path ———
  {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      acceptDownloads: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push("desktop:" + String(e)));

    const t0 = Date.now();
    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
    // Splash holds ~3.5s for the mage animation, then fades
    await page.waitForFunction(
      () => !document.getElementById("bookly-boot-splash") || document.getElementById("bookly-boot-splash")?.classList.contains("is-done"),
      null,
      { timeout: 10000 },
    );
    const splashMs = Date.now() - t0;
    await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor({ state: "visible", timeout: 5000 });
    results.splash = { dismissedMs: splashMs, ok: splashMs >= 3000 && splashMs <= 4500 };
    await page.screenshot({ path: path.join(OUT, "fix-landing.png"), fullPage: true });
    copy("fix-landing.png");

    // Install must not hang — APK present ⇒ download; else modal fallback
    const downloadPromise = page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
    const installStarted = Date.now();
    await page.getByRole("button", { name: "Install Bookly" }).first().click();
    const download = await downloadPromise;
    const modal = await page.locator('[role="dialog"]').isVisible().catch(() => false);
    const installMs = Date.now() - installStarted;
    if (download) await download.cancel().catch(() => {});
    results.install = {
      ms: installMs,
      downloaded: !!download,
      modal,
      ok: installMs < 3000 && (!!download || modal),
    };
    if (modal) {
      await page.locator('[role="dialog"] button[aria-label="Close"]').click().catch(() => {});
    }

    // Hero upload also opens picker
    const [heroChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10000 }),
      page.getByRole("button", { name: /Upload PDF/i }).nth(1).click(),
    ]);
    // Cancel by setting nothing — just confirm picker opened
    await heroChooser.setFiles([]);

    await uploadSample(page);
    await page.locator(".reader-shell.is-desktop").waitFor({ state: "visible", timeout: 30000 });
    await page.locator(".reader-book-host.is-ready").waitFor({ state: "visible", timeout: 45000 });
    await page.waitForTimeout(600);
    const ink = await hasInk(page);
    const before = await pageLabel(page);
    await page.getByRole("button", { name: "Next →" }).first().click();
    await page.waitForTimeout(1100);
    const after = await pageLabel(page);
    await page.screenshot({ path: path.join(OUT, "fix-desktop-reader.png") });
    copy("fix-desktop-reader.png");
    results.desktop = {
      ink,
      before,
      after,
      flipped: before !== after,
      ok: ink && before !== after,
    };
    await context.close();
  }

  // ——— Mobile path ———
  {
    const iPhone = devices["iPhone 13"];
    const context = await browser.newContext({ ...iPhone, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push("mobile:" + String(e)));

    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor({ state: "visible" });
    await uploadSample(page);
    await page.locator(".reader-shell.is-touch").waitFor({ state: "visible", timeout: 30000 });
    await page.locator(".reader-book-host.is-ready").waitFor({ state: "visible", timeout: 45000 });
    await page.locator(".reader-gesture-layer").waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(400);
    const ink = await hasInk(page);
    const before = await pageLabel(page);
    const box = await page.locator(".reader-gesture-layer").boundingBox();
    if (!box) throw new Error("No gesture box");
    await tapPoint(page, box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.waitForTimeout(1100);
    const afterTap = await pageLabel(page);
    const y = box.y + box.height * 0.55;
    await swipe(page, box.x + box.width * 0.85, y, box.x + box.width * 0.15, y);
    await page.waitForTimeout(1100);
    const afterSwipe = await pageLabel(page);
    await page.screenshot({ path: path.join(OUT, "fix-mobile-reader.png") });
    copy("fix-mobile-reader.png");
    results.mobile = {
      ink,
      before,
      afterTap,
      afterSwipe,
      tapFlip: before !== afterTap,
      swipeFlip: afterTap !== afterSwipe,
      ok: ink && before !== afterTap && afterTap !== afterSwipe,
    };
    await context.close();
  }

  const ok =
    results.splash?.ok &&
    results.install?.ok &&
    results.desktop?.ok &&
    results.mobile?.ok &&
    results.errors.length === 0;

  console.log(JSON.stringify({ ok, results }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (err) {
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, results, message: String(err) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
