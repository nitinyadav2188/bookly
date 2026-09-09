import { chromium, devices } from "playwright";
import fs from "fs";
import path from "path";

const OUT = "/workspace/artifacts";
const OPT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(OPT, { recursive: true });
const PDF = "/workspace/public/sample-book.pdf";
const BASE = "http://127.0.0.1:4321";

function copy(name) {
  try { fs.copyFileSync(path.join(OUT, name), path.join(OPT, name)); } catch {}
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  copy(name);
}

function findFlipInPage() {
  return `(function(){
    const shell = document.querySelector('.reader-shell');
    if (!shell) return null;
    const fiberKey = Object.keys(shell).find(k => k.startsWith('__reactFiber'));
    let flip = null;
    const seen = new Set();
    function walk(f, d) {
      if (!f || d>100 || seen.has(f) || flip) return;
      seen.add(f);
      let hook = f.memoizedState, n=0;
      while (hook && n<120) {
        const ms = hook.memoizedState;
        if (ms && typeof ms === 'object' && 'current' in ms && ms.current && typeof ms.current.flipNext === 'function') {
          flip = ms.current; return;
        }
        hook = hook.next; n++;
      }
      walk(f.child,d+1); walk(f.sibling,d+1); walk(f.return,d+1); walk(f.alternate,d+1);
    }
    walk(shell[fiberKey], 0);
    return flip;
  })()`;
}

async function reactGesture(page, { sx, sy, ex, ey, mode }) {
  return page.evaluate(async ({ sx, sy, ex, ey, mode }) => {
    const layer = document.querySelector(".reader-gesture-layer");
    if (!layer) throw new Error("no gesture layer");
    const propsKey = Object.keys(layer).find((k) => k.startsWith("__reactProps"));
    const props = layer[propsKey];
    const base = {
      pointerId: 77,
      pointerType: "touch",
      button: 0,
      currentTarget: layer,
      target: layer,
      preventDefault() {},
      stopPropagation() {},
      setPointerCapture() {},
      releasePointerCapture() {},
    };
    const before = document.querySelector(".reader-pager")?.innerText?.trim();
    if (mode === "tap") {
      props.onPointerDown({ ...base, clientX: sx, clientY: sy, buttons: 1 });
      await new Promise((r) => setTimeout(r, 30));
      props.onPointerUp({ ...base, clientX: sx, clientY: sy, buttons: 0 });
    } else if (mode === "swipe") {
      props.onPointerDown({ ...base, clientX: sx, clientY: sy, buttons: 1 });
      const steps = 7;
      for (let i = 1; i <= steps; i++) {
        const x = sx + ((ex - sx) * i) / steps;
        props.onPointerMove({ ...base, clientX: x, clientY: sy, buttons: 1 });
        await new Promise((r) => setTimeout(r, 12));
      }
      props.onPointerUp({ ...base, clientX: ex, clientY: ey, buttons: 0 });
    } else if (mode === "drag") {
      props.onPointerDown({ ...base, clientX: sx, clientY: sy, buttons: 1 });
      await new Promise((r) => setTimeout(r, 320));
      const steps = 22;
      for (let i = 1; i <= steps; i++) {
        const x = sx + ((ex - sx) * i) / steps;
        props.onPointerMove({ ...base, clientX: x, clientY: sy, buttons: 1 });
        await new Promise((r) => setTimeout(r, 28));
      }
      props.onPointerUp({ ...base, clientX: ex, clientY: ey, buttons: 0 });
    }
    await new Promise((r) => setTimeout(r, 1100));
    const after = document.querySelector(".reader-pager")?.innerText?.trim();
    return { before, after };
  }, { sx, sy, ex, ey, mode });
}

const results = { ok: true, checks: {} };
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    ...devices["iPhone 12"],
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  // Landing
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  const sticky = page.locator(".mobile-install-bar");
  results.checks.stickyOnLanding = await sticky.isVisible();
  await shot(page, "mobile-after-landing.png");

  // Upload
  const t0 = Date.now();
  const [fc] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fc.setFiles(PDF);
  await page.locator(".reader-shell.is-touch").waitFor({ timeout: 30000 });
  await page.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
  results.checks.openMs = Date.now() - t0;

  // Sizing
  const sizes = await page.evaluate(() => {
    const host = document.querySelector(".reader-book-host");
    const frame = document.querySelector(".reader-touch-frame");
    const canvas = document.querySelector(".stf__item canvas, .book-page canvas");
    const edge = document.querySelectorAll(".reader-edge-nav").length;
    const sticky = document.querySelector(".mobile-install-bar");
    const feedback = document.querySelector(".feedback-backdrop");
    return {
      hostW: host?.clientWidth || 0,
      hostH: host?.clientHeight || 0,
      frameW: frame?.clientWidth || 0,
      frameH: frame?.clientHeight || 0,
      canvasW: canvas?.width || 0,
      canvasH: canvas?.height || 0,
      edge,
      sticky: !!sticky,
      feedback: !!feedback,
      pageLabel: document.querySelector(".reader-pager")?.innerText?.trim(),
      isTouch: document.querySelector(".reader-shell")?.classList.contains("is-touch"),
    };
  });
  results.checks.sizes = sizes;
  results.checks.sizedOk = sizes.hostW >= 80 && sizes.hostH >= 80 && sizes.canvasW > 10 && sizes.canvasH > 10;
  results.checks.noEdgeNav = sizes.edge === 0;
  results.checks.noStickyInReader = !sizes.sticky;
  await shot(page, "mobile-after-reader-ready.png");

  const g = await page.locator(".reader-gesture-layer").boundingBox();
  results.checks.gesture = g;

  // Tap right → next
  const tapNext = await reactGesture(page, {
    sx: g.x + g.width * 0.8,
    sy: g.y + g.height * 0.5,
    ex: g.x + g.width * 0.8,
    ey: g.y + g.height * 0.5,
    mode: "tap",
  });
  results.checks.tapNext = tapNext;
  await shot(page, "mobile-after-tap-next.png");

  // Tap left → prev
  const tapPrev = await reactGesture(page, {
    sx: g.x + g.width * 0.2,
    sy: g.y + g.height * 0.5,
    ex: g.x + g.width * 0.2,
    ey: g.y + g.height * 0.5,
    mode: "tap",
  });
  results.checks.tapPrev = tapPrev;

  // Swipe left → next
  const swipeNext = await reactGesture(page, {
    sx: g.x + g.width * 0.85,
    sy: g.y + g.height * 0.5,
    ex: g.x + g.width * 0.15,
    ey: g.y + g.height * 0.5,
    mode: "swipe",
  });
  results.checks.swipeNext = swipeNext;
  await shot(page, "mobile-after-swipe.png");

  // Finger-follow drag
  const drag = await reactGesture(page, {
    sx: g.x + g.width * 0.9,
    sy: g.y + g.height * 0.55,
    ex: g.x + g.width * 0.2,
    ey: g.y + g.height * 0.55,
    mode: "drag",
  });
  results.checks.drag = drag;
  await shot(page, "mobile-after-drag.png");

  // Zoom / sound / annotate / download presence
  await page.mouse.move(200, 100).catch(() => {});
  // reveal chrome via evaluate touch
  await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
  await page.waitForTimeout(200);
  const controls = await page.evaluate(() => {
    const chips = [...document.querySelectorAll(".reader-chip")].map((b) => b.textContent?.trim());
    return {
      chips,
      zoom: !!document.querySelector(".reader-zoom"),
      mark: chips.some((c) => /Mark|Done/i.test(c || "")),
      snd: chips.some((c) => /SND|MUTE/i.test(c || "")),
      dl: chips.some((c) => /DL|Download/i.test(c || "")),
      exit: chips.some((c) => /EXIT/i.test(c || "")),
      wrapRows: (() => {
        const actions = document.querySelector(".reader-actions");
        if (!actions) return null;
        const r = actions.getBoundingClientRect();
        return { h: r.height, w: r.width };
      })(),
    };
  });
  results.checks.controls = controls;

  // Zoom bump
  await page.locator('.reader-zoom-btn[aria-label="Zoom in"]').click();
  await page.waitForTimeout(200);
  const zoomLabel = await page.locator(".reader-zoom-pct").innerText();
  results.checks.zoomAfter = zoomLabel.trim();
  await shot(page, "mobile-after-zoom.png");

  // Annotate mode toggles gesture layer off
  await page.getByRole("button", { name: /Enter annotate mode|Mark/i }).click();
  await page.waitForTimeout(200);
  results.checks.annotateNoGesture = (await page.locator(".reader-gesture-layer").count()) === 0;
  await shot(page, "mobile-after-annotate.png");
  await page.getByRole("button", { name: /Exit annotate mode|Done/i }).click();
  await page.waitForTimeout(200);

  // Sound toggle
  await page.getByRole("button", { name: /Enable page sound|MUTE/i }).click();
  await page.waitForTimeout(150);
  results.checks.soundChip = (await page.locator(".reader-chip").allTextContents()).join("|");

  // Horizontal overflow
  results.checks.overflowX = await page.evaluate(() => {
    return {
      bodyScroll: document.body.scrollWidth > document.body.clientWidth + 2,
      shellScroll: document.querySelector(".reader-shell")?.scrollWidth >
        document.querySelector(".reader-shell")?.clientWidth + 2,
    };
  });

  // Feedback not up during early flips
  results.checks.feedbackDuringRead = await page.locator(".feedback-backdrop").count();

  results.checks.pageTurned =
    tapNext.before !== tapNext.after ||
    swipeNext.before !== swipeNext.after ||
    drag.before !== drag.after;

  results.checks.tapWorks = tapNext.before !== tapNext.after;
  results.checks.swipeWorks = swipeNext.before !== swipeNext.after;
  results.checks.dragWorks = drag.before !== drag.after;
  results.checks.tapPrevWorks = tapPrev.before !== tapPrev.after;

  results.errors = errors;
  results.ok =
    results.checks.sizedOk &&
    results.checks.noEdgeNav &&
    results.checks.noStickyInReader &&
    results.checks.tapWorks &&
    results.checks.swipeWorks &&
    results.checks.controls.zoom &&
    results.checks.controls.mark &&
    results.checks.controls.dl &&
    results.checks.annotateNoGesture &&
    !results.checks.overflowX.bodyScroll;

  // Desktop sanity: animateFlip still works
  await context.close();
  const desk = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const dpage = await desk.newPage();
  await dpage.goto(BASE, { waitUntil: "domcontentloaded" });
  await dpage.getByRole("button", { name: /Upload PDF/i }).first().waitFor();
  const [dfc] = await Promise.all([
    dpage.waitForEvent("filechooser"),
    dpage.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await dfc.setFiles(PDF);
  await dpage.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
  const beforeD = await dpage.locator(".reader-pager").innerText();
  await dpage.keyboard.press("ArrowRight");
  await dpage.waitForTimeout(1100);
  const afterD = await dpage.locator(".reader-pager").innerText();
  results.checks.desktopKeyFlip = { before: beforeD.trim(), after: afterD.trim() };
  results.checks.desktopOk = beforeD.trim() !== afterD.trim();
  await shot(dpage, "desktop-after-flip-sanity.png");
  if (!results.checks.desktopOk) results.ok = false;
  await desk.close();
} catch (e) {
  results.ok = false;
  results.fatal = String(e);
}

console.log(JSON.stringify(results, null, 2));
await browser.close();
process.exit(results.ok ? 0 : 1);
