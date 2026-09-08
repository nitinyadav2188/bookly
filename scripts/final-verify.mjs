import { chromium, devices } from "playwright";
import path from "path";
import fs from "fs";

fs.mkdirSync("/workspace/artifacts", { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = { desktop: null, mobile: null, errors: [] };

async function upload(page) {
  const [fc] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fc.setFiles("/workspace/public/sample-book.pdf");
}

async function ink(page) {
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

try {
  // Desktop
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => results.errors.push("d:" + String(e)));
    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor();
    await upload(page);
    await page.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
    await page.waitForTimeout(1200);
    const hasInk = await ink(page);
    const before = await page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
    await page.getByRole("button", { name: "Next →" }).first().click();
    await page.waitForTimeout(1100);
    const after = await page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
    await page.screenshot({ path: "/workspace/artifacts/final-desktop.png" });
    results.desktop = { hasInk, before, after, flip: before !== after };
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
    await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor();
    await upload(page);
    await page.locator(".reader-shell.is-touch").waitFor({ timeout: 30000 });
    await page.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
    await page.locator(".reader-gesture-layer").waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    const hasInk = await ink(page);
    const body = await page.evaluate(() => document.body.innerText.slice(0, 300));
    const before = await page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
    // tap next
    const box = await page.locator(".reader-gesture-layer").boundingBox();
    await page.evaluate(
      ([x, y]) => {
        const el = document.elementFromPoint(x, y);
        el.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: x, clientY: y, pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 1 }));
        el.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: x, clientY: y, pointerId: 2, pointerType: "touch", isPrimary: true, buttons: 0 }));
      },
      [box.x + box.width * 0.75, box.y + box.height * 0.5],
    );
    await page.waitForTimeout(1100);
    const after = await page.locator("text=/\\d+ \\/ \\d+/").first().innerText();
    await page.screenshot({ path: "/workspace/artifacts/final-mobile.png" });
    results.mobile = { hasInk, before, after, flip: before !== after, body };
    await ctx.close();
  }

  const ok =
    results.desktop?.hasInk &&
    results.desktop?.flip &&
    results.mobile?.hasInk &&
    results.mobile?.flip &&
    results.errors.length === 0;
  console.log(JSON.stringify({ ok, results }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
