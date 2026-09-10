/**
 * Verify upload CTAs, landing layout (no mid-page drop zone), annotations, footer.
 */
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const OUT = "/workspace/artifacts";
const OPT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OPT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

function copy(name) {
  const src = path.join(OUT, name);
  if (!fs.existsSync(src)) return;
  try {
    fs.copyFileSync(src, path.join(OPT, name));
  } catch {}
}

async function revealChrome() {
  await page.mouse.move(200, 200);
  await page.mouse.move(640, 400);
  await page.waitForTimeout(100);
}

async function waitReader() {
  for (let i = 0; i < 50; i += 1) {
    await revealChrome();
    if (await page.getByRole("button", { name: "Annotate" }).isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(400);
  }
  throw new Error("Reader did not become ready");
}

async function uploadVia(label) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 12000 }),
    label(),
  ]);
  await chooser.setFiles("/workspace/public/sample-book.pdf");
}

const results = {
  headerUpload: false,
  heroUpload: false,
  modalChoose: false,
  noMidDropZone: false,
  footerNitin: false,
  footerLinks: false,
  annotateHighlight: false,
  annotateNote: false,
  persistAnnot: false,
  errors,
};

try {
  await page.goto("http://127.0.0.1:4321/", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: "Upload PDF", exact: true }).first().waitFor({ state: "visible" });
  await page.waitForTimeout(800);

  // Mid-page drop zone removed
  const dropHereCount = await page.getByText("Drop your PDF here").count();
  const useItFor = page.getByText("Use it for").first();
  await useItFor.waitFor({ state: "visible" });
  // Only modal (when open) should have "Drop your PDF here" — not on landing body
  results.noMidDropZone = dropHereCount === 0;

  // Footer
  results.footerNitin = (await page.getByText("NITIN YADAV").count()) > 0;
  const linkedin = page.locator('a[href="https://www.linkedin.com/in/nitin-yadav-681850299/"]');
  const github = page.locator('a[href="https://github.com/nitinyadav2188"]');
  const xlink = page.locator('a[href="https://x.com/nitindotdev"]');
  results.footerLinks =
    (await linkedin.count()) > 0 && (await github.count()) > 0 && (await xlink.count()) > 0;

  await page.screenshot({ path: path.join(OUT, "bookly-landing-annot.png"), fullPage: true });
  copy("bookly-landing-annot.png");

  // 1) Header Upload PDF
  await uploadVia(() => page.getByRole("button", { name: "Upload PDF", exact: true }).click());
  await waitReader();
  results.headerUpload = true;
  await page.getByRole("button", { name: /Exit reader/i }).click();
  await page.getByText(/Turn your PDF into a/i).waitFor({ timeout: 10000 });

  // 2) Hero Upload PDF →
  await uploadVia(() => page.getByRole("button", { name: "Upload PDF →" }).click());
  await waitReader();
  results.heroUpload = true;
  await page.getByRole("button", { name: /Exit reader/i }).click();
  await page.getByText(/Turn your PDF into a/i).waitFor({ timeout: 10000 });

  // 3) Modal Choose PDF
  await page.getByRole("button", { name: /Or drop a PDF here/i }).click();
  await page.locator('[role="dialog"]').waitFor({ state: "visible" });
  await uploadVia(() => page.getByRole("button", { name: "Choose PDF" }).click());
  await waitReader();
  results.modalChoose = true;

  // Annotations
  await revealChrome();
  await page.getByRole("button", { name: "Annotate" }).click();
  await page.getByText(/Drag to highlight text/i).waitFor({ state: "visible", timeout: 5000 });

  // Draw a highlight on the book area
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
  await page.waitForTimeout(400);
  results.annotateHighlight = (await page.locator(".annotation-highlight").count()) > 0;

  await page.getByRole("button", { name: /Sticky note/i }).click();
  results.annotateNote = await page.locator(".adobe-tool-note.is-on").isVisible().catch(() => false);
  await page.mouse.click(box.x + box.width * 0.65, box.y + box.height * 0.55);
  await page.waitForTimeout(300);
  const note = page.locator(".adobe-comment-popup textarea").first();
  if (await note.count()) {
    await note.fill("Check this passage");
    await note.blur();
  }
  results.annotateNote =
    results.annotateNote &&
    (await page.locator(".annotation-note").count()) > 0 &&
    (await page.locator(".adobe-sticky-pin").count()) > 0;

  await page.screenshot({ path: path.join(OUT, "bookly-annotate.png") });
  copy("bookly-annotate.png");

  await page.getByRole("button", { name: /Exit annotate mode|Done/i }).first().click();
  await page.getByRole("button", { name: /Exit reader/i }).click();
  await page.getByText(/Turn your PDF into a/i).waitFor({ timeout: 10000 });

  // Re-open and check persistence
  await page.getByRole("button", { name: /Resume /i }).click();
  await waitReader();
  await page.waitForTimeout(600);
  results.persistAnnot =
    (await page.locator(".annotation-highlight").count()) > 0 ||
    (await page.locator(".annotation-sticky").count()) > 0;

  await page.screenshot({ path: path.join(OUT, "bookly-annot-persist.png") });
  copy("bookly-annot-persist.png");

  const ok = Object.entries(results)
    .filter(([k]) => k !== "errors")
    .every(([, v]) => v === true);

  console.log(JSON.stringify({ ok, ...results }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (err) {
  await page.screenshot({ path: path.join(OUT, "bookly-annot-error.png"), fullPage: true }).catch(() => {});
  copy("bookly-annot-error.png");
  console.error("FAIL", err);
  console.log(JSON.stringify({ ok: false, ...results, message: String(err) }, null, 2));
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
