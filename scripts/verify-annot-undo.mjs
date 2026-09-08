/**
 * Verify annotate undo/redo + toolbar controls.
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
  undoEnabledAfter: false,
  undoRemovesHighlight: false,
  redoRestoresHighlight: false,
  noteAdded: false,
  stickyToolActive: false,
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
    if (await page.getByRole("button", { name: "Annotate" }).isVisible().catch(() => false)) break;
    await page.waitForTimeout(400);
  }
  results.openReader = await page.getByRole("button", { name: "Annotate" }).isVisible();

  await page.getByRole("button", { name: "Annotate" }).click();
  await page.getByText(/Drag to mark/i).waitFor({ state: "visible", timeout: 5000 });

  const undoBtn = page.getByRole("button", { name: "Undo annotation" });
  const redoBtn = page.getByRole("button", { name: "Redo annotation" });
  results.undoDisabledInitially = await undoBtn.isDisabled();
  results.redoDisabledInitially = await redoBtn.isDisabled();

  const host = page.locator(".reader-book-host");
  const box = await host.boundingBox();
  if (!box) throw new Error("No book host");

  const x0 = box.x + box.width * 0.35;
  const y0 = box.y + box.height * 0.35;
  const x1 = box.x + box.width * 0.55;
  const y1 = box.y + box.height * 0.45;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(350);

  results.highlightAdded = (await page.locator(".annotation-highlight").count()) > 0;
  results.undoEnabledAfter = !(await undoBtn.isDisabled());

  await undoBtn.click();
  await page.waitForTimeout(250);
  results.undoRemovesHighlight = (await page.locator(".annotation-highlight").count()) === 0;
  const redoEnabled = !(await redoBtn.isDisabled());

  await redoBtn.click();
  await page.waitForTimeout(250);
  results.redoRestoresHighlight = redoEnabled && (await page.locator(".annotation-highlight").count()) > 0;

  await page.getByRole("button", { name: "Sticky" }).click();
  results.stickyToolActive = await page
    .locator(".annot-tool-note.is-on")
    .isVisible()
    .catch(() => false);
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.55);
  await page.waitForTimeout(300);
  results.noteAdded = (await page.locator(".annotation-sticky").count()) > 0;

  await page.screenshot({ path: path.join(OUT, "bookly-annot-undo.png") });

  const ok = Object.entries(results)
    .filter(([k]) => k !== "errors")
    .every(([, v]) => v === true);

  console.log(JSON.stringify({ ok, ...results }, null, 2));
  if (!ok || errors.length) process.exitCode = 1;
} catch (err) {
  await page.screenshot({ path: path.join(OUT, "bookly-annot-undo-error.png") }).catch(() => {});
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, ...results, message: String(err) }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
