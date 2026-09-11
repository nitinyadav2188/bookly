/**
 * Verify physical-book annotation system on live static export.
 */
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
  } catch {}
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function revealChrome() {
  await page.mouse.move(200, 200);
  await page.mouse.move(640, 400);
  await page.waitForTimeout(80);
}

async function waitReader() {
  for (let i = 0; i < 60; i += 1) {
    await revealChrome();
    if (await page.getByRole("button", { name: "Annotate" }).isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(350);
  }
  throw new Error("Reader did not become ready");
}

const results = {
  annotateMode: false,
  highlight: false,
  sticky: false,
  bookmark: false,
  myNotes: false,
  persist: false,
  undo: false,
  pageFlipSafe: false,
  mobileAnnot: false,
  errors,
};

try {
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Upload PDF", exact: true }).first().waitFor({ state: "visible" });

  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  // Modal may open — click Choose if needed
  const choose = page.getByRole("button", { name: /choose|select|pick|browse/i }).first();
  if (await choose.isVisible().catch(() => false)) {
    // filechooser already from first click might be wrong; try again via modal
  }
  await chooser.setFiles("/workspace/public/sample-book.pdf").catch(async () => {
    const [c2] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      page.getByRole("button", { name: /choose pdf|choose file|select pdf|browse/i }).first().click(),
    ]);
    await c2.setFiles("/workspace/public/sample-book.pdf");
  });

  await waitReader();
  await revealChrome();
  await page.getByRole("button", { name: "Annotate" }).click();
  await page.waitForTimeout(400);
  results.annotateMode = await page.locator(".annotation-toolbar").isVisible();
  await page.screenshot({ path: path.join(OUT, "phys_annot_01_mode.png"), fullPage: false });
  copy("phys_annot_01_mode.png");

  // Drag highlight band across page
  const host = page.locator(".reader-book-host");
  const box = await host.boundingBox();
  if (!box) throw new Error("No book host");
  const x0 = box.x + box.width * 0.28;
  const y0 = box.y + box.height * 0.42;
  const x1 = box.x + box.width * 0.62;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y0, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const menu = page.locator(".phys-sel-menu");
  if (await menu.isVisible()) {
    await menu.getByRole("button", { name: "Highlight" }).click();
  }
  await page.waitForTimeout(300);
  results.highlight = (await page.locator(".annotation-highlight").count()) > 0;
  await page.screenshot({ path: path.join(OUT, "phys_annot_02_highlight.png"), fullPage: false });
  copy("phys_annot_02_highlight.png");

  // Sticky note
  await page.getByRole("button", { name: /Note/i }).first().click();
  await page.waitForTimeout(150);
  await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.55);
  await page.waitForTimeout(400);
  const noteArea = page.locator(".annotation-note-card textarea, .phys-note-card textarea").first();
  if (await noteArea.isVisible().catch(() => false)) {
    await noteArea.fill("Physical sticky — paper feel");
  }
  results.sticky = (await page.locator(".annotation-note").count()) > 0;
  await page.screenshot({ path: path.join(OUT, "phys_annot_03_sticky.png"), fullPage: false });
  copy("phys_annot_03_sticky.png");

  // Bookmark
  await page.getByRole("button", { name: /Bookmark|Mark/i }).first().click();
  await page.waitForTimeout(250);
  results.bookmark = (await page.locator(".phys-bookmark-ribbon").count()) > 0;

  // My Notes
  await page.getByRole("button", { name: "Notes" }).click();
  await page.waitForTimeout(300);
  results.myNotes = await page.locator(".phys-notes-panel").isVisible();
  await page.screenshot({ path: path.join(OUT, "phys_annot_04_mynotes.png"), fullPage: false });
  copy("phys_annot_04_mynotes.png");
  await page.locator(".phys-notes-close").click().catch(() => {});

  // Undo
  const before = await page.locator(".annotation-highlight, .annotation-note, .phys-bookmark-ribbon").count();
  await page.getByRole("button", { name: "Undo" }).click();
  await page.waitForTimeout(200);
  const afterUndo = await page.locator(".annotation-highlight, .annotation-note, .phys-bookmark-ribbon").count();
  results.undo = afterUndo < before || (await page.getByRole("button", { name: "Redo" }).isEnabled());

  // Flip while annotations present
  await page.getByRole("button", { name: "Done" }).click().catch(async () => {
    await page.getByRole("button", { name: /Done|Annotate/i }).first().click();
  });
  await page.waitForTimeout(200);
  // Re-enter and ensure highlight still there after next/prev
  const nextBtn = page.getByRole("button", { name: /Next/i }).first();
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click();
    await page.waitForTimeout(900);
    await page.getByRole("button", { name: /Prev/i }).first().click();
    await page.waitForTimeout(900);
  }
  await revealChrome();
  await page.getByRole("button", { name: "Annotate" }).click();
  await page.waitForTimeout(300);
  results.pageFlipSafe = (await page.locator(".annotation-highlight, .annotation-note").count()) >= 1;
  await page.screenshot({ path: path.join(OUT, "phys_annot_05_after_flip.png"), fullPage: false });
  copy("phys_annot_05_after_flip.png");

  // Persist: reload
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  // Resume or re-upload
  const resume = page.getByRole("button", { name: /Continue|Resume|Open saved/i }).first();
  if (await resume.isVisible().catch(() => false)) {
    await resume.click();
  } else {
    const [c3] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
    ]);
    await c3.setFiles("/workspace/public/sample-book.pdf").catch(async () => {
      const [c4] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 15000 }),
        page.getByRole("button", { name: /choose pdf|choose file|select pdf|browse/i }).first().click(),
      ]);
      await c4.setFiles("/workspace/public/sample-book.pdf");
    });
  }
  await waitReader();
  await revealChrome();
  await page.getByRole("button", { name: "Annotate" }).click();
  await page.waitForTimeout(500);
  results.persist =
    (await page.locator(".annotation-highlight").count()) > 0 ||
    (await page.locator(".annotation-note").count()) > 0 ||
    (await page.locator(".phys-bookmark-ribbon").count()) > 0;
  await page.screenshot({ path: path.join(OUT, "phys_annot_06_persist.png"), fullPage: false });
  copy("phys_annot_06_persist.png");

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const resume2 = page.getByRole("button", { name: /Continue|Resume|Open saved/i }).first();
  if (await resume2.isVisible().catch(() => false)) {
    await resume2.click();
  } else {
    const [c5] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 15000 }),
      page.getByRole("button", { name: /Upload|Open/i }).first().click(),
    ]);
    await c5.setFiles("/workspace/public/sample-book.pdf").catch(async () => {
      const [c6] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 15000 }),
        page.getByRole("button", { name: /choose|select|browse/i }).first().click(),
      ]);
      await c6.setFiles("/workspace/public/sample-book.pdf");
    });
  }
  // wait for Mark button on mobile
  for (let i = 0; i < 50; i += 1) {
    await page.mouse.move(40, 40);
    if (await page.getByRole("button", { name: /Mark|Annotate|Done/i }).first().isVisible().catch(() => false)) break;
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: /Mark|Annotate/i }).first().click();
  await page.waitForTimeout(400);
  results.mobileAnnot = await page.locator(".annotation-toolbar").isVisible();
  await page.screenshot({ path: path.join(OUT, "phys_annot_07_mobile.png"), fullPage: false });
  copy("phys_annot_07_mobile.png");
} catch (err) {
  results.errors.push(String(err));
  await page.screenshot({ path: path.join(OUT, "phys_annot_error.png"), fullPage: false }).catch(() => {});
  copy("phys_annot_error.png");
}

fs.writeFileSync(path.join(OUT, "phys_annot_results.json"), JSON.stringify(results, null, 2));
copy("phys_annot_results.json");
console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.errors.length && !results.annotateMode ? 1 : 0);
