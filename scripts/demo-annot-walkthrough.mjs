/**
 * Walkthrough demo: Annotate → soft highlight → note pin → undo/redo.
 * Saves screenshots + Playwright video under /opt/cursor/artifacts/.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/workspace/artifacts";
const OPT = "/opt/cursor/artifacts";
const VIDEO_DIR = path.join(OUT, "annot-demo-video");
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OPT, { recursive: true });
fs.mkdirSync(VIDEO_DIR, { recursive: true });

function copyToOpt(src, name) {
  const dest = path.join(OPT, name);
  fs.copyFileSync(src, dest);
  return dest;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: VIDEO_DIR, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
const shot = async (name) => {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  copyToOpt(p, name);
  return p;
};

const results = {
  annotateEntered: false,
  highlightDrawn: false,
  noteWithText: false,
  undoWorked: false,
  redoWorked: false,
};

try {
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Upload PDF", exact: true }).first().waitFor({ state: "visible" });

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await chooser.setFiles("/workspace/public/sample-book.pdf");

  for (let i = 0; i < 50; i += 1) {
    await page.mouse.move(200 + i, 200);
    if (await page.getByRole("button", { name: /Annotate/i }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(400);
  }

  await page.getByRole("button", { name: /Enter annotate mode|Annotate/i }).click();
  await page.getByText(/Drag across the page to highlight/i).waitFor({ state: "visible", timeout: 5000 });
  results.annotateEntered = true;
  await shot("annot_demo_01_toolbar.png");

  const host = page.locator(".reader-book-host");
  const box = await host.boundingBox();
  if (!box) throw new Error("No book host");

  const x0 = box.x + box.width * 0.32;
  const y0 = box.y + box.height * 0.36;
  const x1 = box.x + box.width * 0.58;
  const y1 = box.y + box.height * 0.39;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(400);
  results.highlightDrawn = (await page.locator(".annotation-highlight").count()) > 0;
  await shot("annot_demo_02_soft_highlight.png");

  await page.getByRole("button", { name: "Note", exact: true }).click();
  await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.52);
  await page.waitForTimeout(400);
  const noteArea = page.locator(".annotation-note-card textarea").first();
  await noteArea.waitFor({ state: "visible", timeout: 5000 });
  await noteArea.fill("Key insight from this passage");
  await page.waitForTimeout(300);
  results.noteWithText = (await page.locator(".annotation-note-pin").count()) > 0 &&
    (await noteArea.inputValue()) === "Key insight from this passage";
  await shot("annot_demo_03_note_pin.png");

  const undoBtn = page.getByRole("button", { name: "Undo annotation" });
  const redoBtn = page.getByRole("button", { name: "Redo annotation" });

  // Undo note, then undo highlight
  await undoBtn.click();
  await page.waitForTimeout(250);
  await undoBtn.click();
  await page.waitForTimeout(250);
  results.undoWorked = (await page.locator(".annotation-highlight").count()) === 0 &&
    (await page.locator(".annotation-note").count()) === 0;
  await shot("annot_demo_04_after_undo.png");

  await redoBtn.click();
  await page.waitForTimeout(250);
  await redoBtn.click();
  await page.waitForTimeout(250);
  results.redoWorked = (await page.locator(".annotation-highlight").count()) > 0 &&
    (await page.locator(".annotation-note").count()) > 0;
  await shot("annot_demo_05_after_redo.png");

  const pageVideo = page.video();
  await context.close();
  await browser.close();

  if (pageVideo) {
    const raw = await pageVideo.path();
    const destName = "annot_demo_highlight_note_undo_redo.webm";
    const destWorkspace = path.join(OUT, destName);
    fs.renameSync(raw, destWorkspace);
    copyToOpt(destWorkspace, destName);
    // Also keep a copy with workspace-friendly name
    console.log(JSON.stringify({ ok: Object.values(results).every(Boolean), ...results, video: destName }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: Object.values(results).every(Boolean), ...results, video: null }, null, 2));
  }

  // cleanup empty video dir
  try {
    fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
  } catch {}

  if (!Object.values(results).every(Boolean)) process.exitCode = 1;
} catch (err) {
  await page.screenshot({ path: path.join(OUT, "annot_demo_error.png") }).catch(() => {});
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, ...results, message: String(err) }, null, 2));
  await context.close().catch(() => {});
  await browser.close().catch(() => {});
  process.exitCode = 1;
}
