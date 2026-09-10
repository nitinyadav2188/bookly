/**
 * Verify annotate undo/redo + Adobe Acrobat–style Comment toolbar.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/workspace/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

const results = {
  openReader: false,
  undoDisabledInitially: false,
  redoDisabledInitially: false,
  highlightAdded: false,
  highlightLooksSoft: false,
  undoEnabledAfter: false,
  undoRemovesHighlight: false,
  redoRestoresHighlight: false,
  noteAdded: false,
  noteToolActive: false,
  notePinOnly: false,
  emptyNoteDiscarded: false,
  errors,
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
  results.openReader = await page.getByRole("button", { name: /Enter annotate mode|Annotate/i }).isVisible();

  await page.getByRole("button", { name: /Enter annotate mode|Annotate/i }).click();
  await page.getByText(/Drag to highlight text/i).waitFor({ state: "visible", timeout: 5000 });

  const undoBtn = page.getByRole("button", { name: "Undo annotation" });
  const redoBtn = page.getByRole("button", { name: "Redo annotation" });
  results.undoDisabledInitially = await undoBtn.isDisabled();
  results.redoDisabledInitially = await redoBtn.isDisabled();

  const host = page.locator(".reader-book-host");
  const box = await host.boundingBox();
  if (!box) throw new Error("No book host");

  const x0 = box.x + box.width * 0.35;
  const y0 = box.y + box.height * 0.38;
  const x1 = box.x + box.width * 0.55;
  const y1 = box.y + box.height * 0.4;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(350);

  results.highlightAdded = (await page.locator(".annotation-highlight").count()) > 0;
  results.highlightLooksSoft = await page.evaluate(() => {
    const el = document.querySelector(".annotation-highlight");
    if (!el) return false;
    const cs = getComputedStyle(el);
    return cs.borderWidth === "0px" || cs.borderStyle === "none";
  });
  results.undoEnabledAfter = !(await undoBtn.isDisabled());

  await undoBtn.click();
  await page.waitForTimeout(250);
  results.undoRemovesHighlight = (await page.locator(".annotation-highlight").count()) === 0;
  const redoEnabled = !(await redoBtn.isDisabled());

  await redoBtn.click();
  await page.waitForTimeout(250);
  results.redoRestoresHighlight = redoEnabled && (await page.locator(".annotation-highlight").count()) > 0;

  await page.getByRole("button", { name: /Sticky note/i }).click();
  results.noteToolActive = await page.locator(".adobe-tool-note.is-on").isVisible().catch(() => false);

  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.55);
  await page.waitForTimeout(350);
  results.noteAdded = (await page.locator(".annotation-note").count()) > 0;
  results.notePinOnly = (await page.locator(".adobe-sticky-pin").count()) > 0;

  // Empty note should remain while focused; discard after blur with no text.
  await page.locator(".adobe-comment-popup textarea").first().waitFor({ state: "visible", timeout: 5000 });
  const before = await page.locator(".annotation-note").count();
  await page.locator(".adobe-comment-popup textarea").first().blur();
  await page.waitForTimeout(350);
  const after = await page.locator(".annotation-note").count();
  results.emptyNoteDiscarded = after < before;

  await page.screenshot({ path: path.join(OUT, "annot-professional.png") });

  const ok = Object.entries(results)
    .filter(([k]) => k !== "errors")
    .every(([, v]) => v === true);

  console.log(JSON.stringify({ ok, ...results }, null, 2));
  if (!ok || errors.length) process.exitCode = 1;
} catch (err) {
  await page.screenshot({ path: path.join(OUT, "annot-professional-error.png") }).catch(() => {});
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, ...results, message: String(err) }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
