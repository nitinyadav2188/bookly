/**
 * Record a short walkthrough video of physical-book annotations.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/workspace/artifacts";
const OPT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OPT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();

async function reveal() {
  await page.mouse.move(180, 160);
  await page.mouse.move(640, 360);
  await page.waitForTimeout(60);
}

async function waitReader() {
  for (let i = 0; i < 60; i += 1) {
    await reveal();
    if (await page.getByRole("button", { name: "Annotate" }).isVisible().catch(() => false)) return;
    await page.waitForTimeout(300);
  }
  throw new Error("reader not ready");
}

await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser", { timeout: 15000 }),
  page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
]);
await chooser.setFiles("/workspace/public/sample-book.pdf");
await waitReader();
await reveal();
await page.getByRole("button", { name: "Annotate" }).click();
await page.waitForTimeout(500);

const host = page.locator(".reader-book-host");
const box = await host.boundingBox();
const x0 = box.x + box.width * 0.26;
const y0 = box.y + box.height * 0.4;
await page.mouse.move(x0, y0);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.58, y0, { steps: 16 });
await page.mouse.up();
await page.waitForTimeout(350);
await page.locator(".phys-sel-menu").getByRole("button", { name: "Highlight" }).click();
await page.waitForTimeout(500);

await page.getByRole("button", { name: /Note/i }).first().click();
await page.waitForTimeout(200);
await page.mouse.click(box.x + box.width * 0.72, box.y + box.height * 0.52);
await page.waitForTimeout(350);
const ta = page.locator(".phys-note-card textarea, .annotation-note-card textarea").first();
if (await ta.isVisible()) await ta.fill("Desk note");
await page.waitForTimeout(400);

await page.getByRole("button", { name: /Bookmark|Mark/i }).first().click();
await page.waitForTimeout(450);

await page.getByRole("button", { name: "Notes" }).click();
await page.waitForTimeout(900);
await page.locator(".phys-notes-close").click();
await page.waitForTimeout(400);

await page.getByRole("button", { name: "Undo" }).click();
await page.waitForTimeout(350);
await page.getByRole("button", { name: "Redo" }).click();
await page.waitForTimeout(600);

await context.close();
await browser.close();

// Find newest webm in OUT and rename/copy
const videos = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith(".webm"))
  .map((f) => ({ f, m: fs.statSync(path.join(OUT, f)).mtimeMs }))
  .sort((a, b) => b.m - a.m);
if (videos.length) {
  const src = path.join(OUT, videos[0].f);
  const destName = "phys_annot_walkthrough.webm";
  fs.copyFileSync(src, path.join(OUT, destName));
  fs.copyFileSync(src, path.join(OPT, destName));
  console.log("saved", destName);
} else {
  console.log("no video found");
  process.exit(1);
}
