/**
 * Verify physical-book reader look + mobile flip + PDF ink.
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

async function upload(page) {
  const [fc] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fc.setFiles("/workspace/public/sample-book.pdf");
}

async function hasInk(page) {
  return page.evaluate(() => {
    const canvases = [...document.querySelectorAll(".book-page canvas")];
    for (const canvas of canvases) {
      if (canvas.width < 10 || canvas.height < 10) continue;
      const ctx = canvas.getContext("2d");
      const { data } = ctx.getImageData(
        Math.min(40, canvas.width - 1),
        Math.min(40, canvas.height - 1),
        Math.min(160, canvas.width),
        Math.min(160, canvas.height),
      );
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) return true;
      }
    }
    return false;
  });
}

async function desktopLook(page) {
  return page.evaluate(() => {
    const frame = document.querySelector(".reader-book-frame");
    const block = document.querySelector(".reader-book-host .stf__block");
    const stage = document.querySelector(".reader-stage");
    const shell = document.querySelector(".reader-shell");
    const host = document.querySelector(".reader-book-host.is-ready");
    const csFrame = frame ? getComputedStyle(frame) : null;
    const csBlock = block ? getComputedStyle(block) : null;
    const csStage = stage ? getComputedStyle(stage) : null;
    const shadow = csBlock?.boxShadow || "";
    const hasLimeBar =
      /c8f542/i.test(shadow) ||
      /200,\s*245,\s*66/i.test(shadow) ||
      /#c8f542/i.test(shadow);
    const paper = getComputedStyle(document.querySelector(".book-page") || document.body)
      .backgroundColor;
    return {
      isDesktop: !!shell?.classList.contains("is-desktop"),
      hasFrame: !!frame,
      hostReady: !!host,
      edgePrev: !!document.querySelector(".reader-edge-nav.reader-edge-prev"),
      edgeNext: !!document.querySelector(".reader-edge-nav.reader-edge-next"),
      frameBg: csFrame?.backgroundImage || csFrame?.backgroundColor || "",
      stageBg: csStage?.backgroundImage?.slice(0, 120) || "",
      blockShadow: shadow.slice(0, 180),
      hasLimeBar,
      paperBg: paper,
      spineOverlay: !!(host && getComputedStyle(host, "::after").content !== "none"),
    };
  });
}

const results = { desktop: null, mobile: null, errors: [] };
const browser = await chromium.launch({ headless: true });

try {
  // Desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => results.errors.push("d:" + String(e)));
    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await upload(page);
    await page.locator(".reader-shell.is-desktop").waitFor({ timeout: 30000 });
    await page.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
    await page.waitForTimeout(1000);
    await page.mouse.move(220, 140);
    await page.waitForTimeout(200);

    const look = await desktopLook(page);
    const ink = await hasInk(page);
    const before = await page.locator(".reader-pager").innerText();
    await page.locator(".reader-edge-nav.reader-edge-next").click();
    await page.waitForTimeout(1100);
    const after = await page.locator(".reader-pager").innerText();

    await page.screenshot({ path: path.join(OUT, "physical-desktop-book.png") });
    copy("physical-desktop-book.png");
    await page.screenshot({ path: path.join(OUT, "desktop-reader-polished.png") });
    copy("desktop-reader-polished.png");

    results.desktop = {
      look,
      hasInk: ink,
      before: before.trim(),
      after: after.trim(),
      flipped: before.trim() !== after.trim(),
    };
    await ctx.close();
  }

  // Mobile
  {
    const ctx = await browser.newContext({
      ...devices["iPhone 13"],
      hasTouch: true,
      isMobile: true,
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => results.errors.push("m:" + String(e)));
    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await upload(page);
    await page.locator(".reader-shell.is-touch").waitFor({ timeout: 30000 });
    await page.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
    await page.locator(".reader-gesture-layer").waitFor({ timeout: 10000 });
    await page.waitForTimeout(1200);

    const ink = await hasInk(page);
    const before = await page.locator(".reader-pager").innerText();
    const box = await page.locator(".reader-gesture-layer").boundingBox();
    if (!box) throw new Error("No gesture layer");

    // Quick swipe left → next (finger-follow path must stay intact)
    await page.evaluate(
      ([x0, y0, x1, y1]) => {
        const el = document.elementFromPoint(x0, y0);
        const opts = { bubbles: true, pointerId: 7, pointerType: "touch", isPrimary: true };
        el.dispatchEvent(
          new PointerEvent("pointerdown", { ...opts, clientX: x0, clientY: y0, buttons: 1 }),
        );
        el.dispatchEvent(
          new PointerEvent("pointermove", { ...opts, clientX: x1, clientY: y1, buttons: 1 }),
        );
        el.dispatchEvent(
          new PointerEvent("pointerup", { ...opts, clientX: x1, clientY: y1, buttons: 0 }),
        );
      },
      [box.x + box.width * 0.78, box.y + box.height * 0.5, box.x + box.width * 0.2, box.y + box.height * 0.5],
    );
    await page.waitForTimeout(1200);
    const after = await page.locator(".reader-pager").innerText();

    // Tap right half if swipe didn't commit
    let flipped = before.trim() !== after.trim();
    let afterTap = after;
    if (!flipped) {
      await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          const opts = { bubbles: true, pointerId: 8, pointerType: "touch", isPrimary: true };
          el.dispatchEvent(
            new PointerEvent("pointerdown", { ...opts, clientX: x, clientY: y, buttons: 1 }),
          );
          el.dispatchEvent(
            new PointerEvent("pointerup", { ...opts, clientX: x, clientY: y, buttons: 0 }),
          );
        },
        [box.x + box.width * 0.78, box.y + box.height * 0.55],
      );
      await page.waitForTimeout(1100);
      afterTap = await page.locator(".reader-pager").innerText();
      flipped = before.trim() !== afterTap.trim();
    }

    const noLime = await page.evaluate(() => {
      const block = document.querySelector(".reader-book-host .stf__block");
      const shadow = block ? getComputedStyle(block).boxShadow : "";
      return !/c8f542/i.test(shadow) && !/200,\s*245,\s*66/i.test(shadow);
    });

    await page.screenshot({ path: path.join(OUT, "physical-mobile-book.png") });
    copy("physical-mobile-book.png");
    await page.screenshot({ path: path.join(OUT, "final-mobile.png") });
    copy("final-mobile.png");

    results.mobile = {
      hasInk: ink,
      before: before.trim(),
      after: afterTap.trim(),
      flipped,
      noLime,
      gesturePresent: true,
    };
    await ctx.close();
  }

  const ok =
    results.desktop?.hasInk &&
    results.desktop?.flipped &&
    results.desktop?.look?.hasFrame &&
    results.desktop?.look?.isDesktop &&
    !results.desktop?.look?.hasLimeBar &&
    results.mobile?.hasInk &&
    results.mobile?.flipped &&
    results.mobile?.noLime &&
    results.errors.length === 0;

  console.log(JSON.stringify({ ok, results }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (err) {
  console.error("VERIFY FAIL", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
