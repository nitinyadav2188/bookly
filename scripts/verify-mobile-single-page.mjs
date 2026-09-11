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
  try {
    fs.copyFileSync(path.join(OUT, name), path.join(OPT, name));
  } catch {
    /* ignore */
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  copy(name);
}

function findFlip() {
  return `(function(){
    const shell = document.querySelector('.reader-shell');
    if (!shell) return null;
    const fiberKey = Object.keys(shell).find(k => k.startsWith('__reactFiber'));
    let flip = null;
    const seen = new Set();
    function walk(f, d) {
      if (!f || d > 100 || seen.has(f) || flip) return;
      seen.add(f);
      let hook = f.memoizedState, n = 0;
      while (hook && n < 120) {
        const ms = hook.memoizedState;
        if (ms && typeof ms === 'object' && 'current' in ms && ms.current && typeof ms.current.flipNext === 'function') {
          flip = ms.current; return;
        }
        hook = hook.next; n++;
      }
      walk(f.child, d + 1); walk(f.sibling, d + 1); walk(f.return, d + 1);
    }
    walk(shell[fiberKey], 0);
    return flip;
  })()`;
}

async function pageInfo(page) {
  return page.evaluate((findFlipSrc) => {
    // eslint-disable-next-line no-eval
    const flip = eval(findFlipSrc);
    const items = [...document.querySelectorAll(".stf__item")].map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        x: Math.round(r.x),
        left: r.left,
        right: r.right,
        vis: s.visibility,
        display: s.display,
        opacity: s.opacity,
        cls: el.className,
      };
    });
    const visible = items.filter(
      (i) =>
        i.w > 20 &&
        i.h > 20 &&
        i.opacity !== "0" &&
        i.vis !== "hidden" &&
        i.display !== "none" &&
        i.right > 2 &&
        i.left < window.innerWidth - 2,
    );
    const host = document.querySelector(".reader-book-host");
    const sheet = visible[0];
    const fill =
      host && sheet
        ? {
            widthRatio: sheet.w / Math.max(1, host.clientWidth),
            heightRatio: sheet.h / Math.max(1, host.clientHeight),
          }
        : null;
    return {
      orientation: flip?.getOrientation?.() ?? null,
      pageIndex: flip?.getCurrentPageIndex?.() ?? null,
      pager: document.querySelector(".reader-pager")?.innerText?.trim() ?? null,
      wrapper: document.querySelector(".stf__wrapper")?.className ?? null,
      host: host ? { w: host.clientWidth, h: host.clientHeight } : null,
      visibleCount: visible.length,
      visible: visible.map((v) => ({ w: v.w, h: v.h, x: v.x })),
      fill,
      isTouch: document.querySelector(".reader-shell")?.classList.contains("is-touch"),
    };
  }, findFlip());
}

async function reactGesture(page, { sx, sy, ex, ey, mode }) {
  return page.evaluate(
    async ({ sx, sy, ex, ey, mode }) => {
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
      }
      await new Promise((r) => setTimeout(r, 1100));
      const after = document.querySelector(".reader-pager")?.innerText?.trim();
      return { before, after };
    },
    { sx, sy, ex, ey, mode },
  );
}

async function openReader(page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByRole("button", { name: /Upload PDF/i }).first().waitFor({ timeout: 15000 });
  const [fc] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fc.setFiles(PDF);
  await page.locator(".reader-shell.is-touch").waitFor({ timeout: 30000 });
  await page.locator(".reader-book-host.is-ready").waitFor({ timeout: 45000 });
  await page.waitForTimeout(500);
}

const results = { ok: true, devices: {} };
const browser = await chromium.launch({ headless: true });

const cases = [
  {
    name: "iPhone12",
    opts: { ...devices["iPhone 12"], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    shotBefore: "mobile_single_page.png",
    shotAfter: "mobile_after_turn.png",
  },
  {
    name: "iPhone14ProMax",
    opts: {
      ...devices["iPhone 14 Pro Max"],
      viewport: { width: 430, height: 932 },
      hasTouch: true,
      isMobile: true,
    },
    shotBefore: "mobile_single_page_promax.png",
    shotAfter: "mobile_after_turn_promax.png",
  },
  {
    name: "iPadMini",
    opts: { ...devices["iPad Mini"], viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
    shotBefore: "mobile_single_page_ipad.png",
  },
  {
    name: "phoneLandscape",
    opts: {
      ...devices["iPhone 12 landscape"],
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    },
    shotBefore: "mobile_single_page_landscape.png",
  },
];

try {
  for (const c of cases) {
    const context = await browser.newContext(c.opts);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await openReader(page);
    const before = await pageInfo(page);
    if (c.shotBefore) await shot(page, c.shotBefore);

    const g = await page.locator(".reader-gesture-layer").boundingBox();
    let tapNext = null;
    let tapPrev = null;
    let swipeNext = null;
    let afterTurn = null;

    if (g) {
      tapNext = await reactGesture(page, {
        sx: g.x + g.width * 0.8,
        sy: g.y + g.height * 0.5,
        ex: g.x + g.width * 0.8,
        ey: g.y + g.height * 0.5,
        mode: "tap",
      });
      afterTurn = await pageInfo(page);
      if (c.shotAfter) await shot(page, c.shotAfter);

      tapPrev = await reactGesture(page, {
        sx: g.x + g.width * 0.2,
        sy: g.y + g.height * 0.5,
        ex: g.x + g.width * 0.2,
        ey: g.y + g.height * 0.5,
        mode: "tap",
      });

      swipeNext = await reactGesture(page, {
        sx: g.x + g.width * 0.85,
        sy: g.y + g.height * 0.5,
        ex: g.x + g.width * 0.15,
        ey: g.y + g.height * 0.5,
        mode: "swipe",
      });
    }

    // Buttons (mobile chrome)
    await page.evaluate(() => window.dispatchEvent(new Event("touchstart")));
    await page.waitForTimeout(150);
    const btnNext = page.getByRole("button", { name: /Next page/i });
    const btnPrev = page.getByRole("button", { name: /Previous page/i });
    let buttonNext = null;
    let buttonPrev = null;
    if ((await btnNext.count()) > 0) {
      const pager0 = await page.locator(".reader-pager").innerText();
      await btnNext.click();
      await page.waitForTimeout(1000);
      const pager1 = await page.locator(".reader-pager").innerText();
      buttonNext = { before: pager0.trim(), after: pager1.trim() };
      await btnPrev.click();
      await page.waitForTimeout(1000);
      const pager2 = await page.locator(".reader-pager").innerText();
      buttonPrev = { before: pager1.trim(), after: pager2.trim() };
    }

    const singleOk =
      before.orientation === "portrait" &&
      before.visibleCount === 1 &&
      before.isTouch === true;
    const advanced =
      (tapNext && tapNext.after && tapNext.before !== tapNext.after) ||
      (swipeNext && swipeNext.after && swipeNext.before !== swipeNext.after) ||
      (buttonNext && buttonNext.before !== buttonNext.after);
    const backOk =
      (tapPrev && tapPrev.after && tapPrev.before !== tapPrev.after) ||
      (buttonPrev && buttonPrev.before !== buttonPrev.after);

    const entry = {
      singleOk,
      advanced: !!advanced,
      backOk: !!backOk,
      before,
      afterTurn,
      tapNext,
      tapPrev,
      swipeNext,
      buttonNext,
      buttonPrev,
      errors,
      fillWideEnough: (before.fill?.widthRatio ?? 0) >= 0.85,
    };
    results.devices[c.name] = entry;
    if (!singleOk || !advanced || !backOk || errors.length) results.ok = false;

    await context.close();
  }
} catch (err) {
  results.ok = false;
  results.error = String(err);
  console.error(err);
} finally {
  await browser.close();
}

const outPath = path.join(OUT, "mobile-single-page-results.json");
fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
copy("mobile-single-page-results.json");
console.log(JSON.stringify(results, null, 2));
process.exit(results.ok ? 0 : 1);
