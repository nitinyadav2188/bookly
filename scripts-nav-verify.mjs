/**
 * Verify device-adaptive page navigation in Página reader.
 * Desktop: Prev/Next buttons + keyboard. Mobile: swipe + tap zones.
 */
import { chromium, devices } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/workspace/artifacts";
const OPT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OPT, { recursive: true });

const NODE = process.execPath;
console.log("node", NODE);

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

async function waitReady(page, { expectNavButtons }) {
  for (let i = 0; i < 50; i += 1) {
    await page.mouse.move(120 + i, 160 + (i % 5));
    const pageLabel = page.locator("text=/\\d+ \\/ \\d+/").first();
    if (await pageLabel.isVisible().catch(() => false)) {
      if (!expectNavButtons) {
        const nextHidden =
          (await page.getByRole("button", { name: "Next →" }).count()) === 0 ||
          !(await page.getByRole("button", { name: "Next →" }).first().isVisible().catch(() => false));
        if (nextHidden) return;
      } else {
        const next = page.getByRole("button", { name: "Next →" }).first();
        if (await next.isVisible().catch(() => false)) return;
      }
    }
    await page.waitForTimeout(400);
  }
  throw new Error("Reader did not become ready");
}

async function pageLabelText(page) {
  await page.mouse.move(200, 200);
  await page.waitForTimeout(80);
  return page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
}

async function swipe(page, fromX, fromY, toX, toY) {
  // Gesture layer listens to PointerEvents (Playwright touchscreen has no swipe API)
  await page.evaluate(
    async ([fx, fy, tx, ty]) => {
      const el = document.elementFromPoint(fx, fy);
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
      fire("pointerdown", fx, fy);
      const steps = 8;
      for (let i = 1; i <= steps; i += 1) {
        fire("pointermove", fx + ((tx - fx) * i) / steps, fy + ((ty - fy) * i) / steps);
        await sleep(12);
      }
      fire("pointerup", tx, ty);
    },
    [fromX, fromY, toX, toY],
  );
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

const results = { desktop: {}, mobile: {}, errors: [] };

const browser = await chromium.launch({ headless: true });

try {
  // ——— Desktop ———
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push("desktop: " + String(e)));

    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor({ state: "visible" });
    await uploadSample(page);
    await waitReady(page, { expectNavButtons: true });

    const before = await pageLabelText(page);

    // Keyboard first (while not at end of landscape spread)
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(1100);
    const afterKey = await pageLabelText(page);

    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(1100);
    const afterBack = await pageLabelText(page);

    await page.getByRole("button", { name: "Next →" }).first().click();
    await page.waitForTimeout(1100);
    const afterBtn = await pageLabelText(page);

    await page.screenshot({ path: path.join(OUT, "nav-desktop-buttons.png") });
    try { copy("nav-desktop-buttons.png"); } catch { /* ignore */ }

    const edgeNext = page.locator(".reader-edge-next");
    const edgeVisible = await edgeNext.isVisible().catch(() => false);
    let afterEdge = afterBtn;
    if (edgeVisible && afterBtn.startsWith("1 ")) {
      await edgeNext.click();
      await page.waitForTimeout(1100);
      afterEdge = await pageLabelText(page);
    }

    results.desktop = {
      before,
      afterKey,
      afterBack,
      afterBtn,
      afterEdge,
      buttonFlip: before !== afterBtn || afterBack !== afterBtn,
      keyboardFlip: before !== afterKey,
      keyboardBack: afterKey !== afterBack,
      edgeVisible,
      hasChromeNext: (await page.getByRole("button", { name: "Next →" }).count()) >= 1,
      isDesktopShell: await page.locator(".reader-shell.is-desktop").count(),
    };

    await context.close();
  }

  // ——— Mobile (touch) ———
  {
    const iPhone = devices["iPhone 13"];
    const context = await browser.newContext({
      ...iPhone,
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => results.errors.push("mobile: " + String(e)));

    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor({ state: "visible" });
    await uploadSample(page);
    await waitReady(page, { expectNavButtons: false });

    await page.screenshot({ path: path.join(OUT, "nav-mobile-reader.png") });
    copy("nav-mobile-reader.png");

    const before = await pageLabelText(page);
    const nextCount = await page.getByRole("button", { name: "Next →" }).count();
    const gesture = page.locator(".reader-gesture-layer");
    await gesture.waitFor({ state: "visible", timeout: 10000 });

    // Tap right half → next
    const box = await gesture.boundingBox();
    if (!box) throw new Error("No gesture layer box");
    await tapPoint(page, box.x + box.width * 0.75, box.y + box.height * 0.5);
    await page.waitForTimeout(1100);
    const afterTap = await pageLabelText(page);

    // Swipe right→left → next
    const y = box.y + box.height * 0.55;
    await swipe(page, box.x + box.width * 0.85, y, box.x + box.width * 0.15, y);
    await page.waitForTimeout(1100);
    const afterSwipe = await pageLabelText(page);

    // Tap left half → previous
    await tapPoint(page, box.x + box.width * 0.25, box.y + box.height * 0.5);
    await page.waitForTimeout(1100);
    const afterTapPrev = await pageLabelText(page);

    await page.screenshot({ path: path.join(OUT, "nav-mobile-after-gestures.png") });
    copy("nav-mobile-after-gestures.png");

    results.mobile = {
      before,
      afterTap,
      afterSwipe,
      afterTapPrev,
      nextButtonCount: nextCount,
      tapFlip: before !== afterTap,
      swipeFlip: afterTap !== afterSwipe,
      tapPrev: afterSwipe !== afterTapPrev,
      hasGestureLayer: (await gesture.count()) === 1,
      isTouchShell: await page.locator(".reader-shell.is-touch").count(),
    };

    await context.close();
  }

  const ok =
    results.desktop.buttonFlip &&
    results.desktop.keyboardFlip &&
    results.desktop.keyboardBack &&
    results.mobile.tapFlip &&
    results.mobile.swipeFlip &&
    results.mobile.tapPrev &&
    results.mobile.hasGestureLayer &&
    results.mobile.nextButtonCount === 0 &&
    results.errors.length === 0;

  console.log(JSON.stringify({ ok, ...results }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (err) {
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, results, message: String(err) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
