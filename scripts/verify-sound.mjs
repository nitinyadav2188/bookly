/**
 * Verify page-turn sound: enable → flip → HTMLAudioElement.play() succeeds.
 * Usage: node scripts/verify-sound.mjs [baseUrl]
 */
import { chromium } from "playwright";
import path from "path";

const base = process.argv[2] || "http://127.0.0.1:4321";
const sample = path.resolve("public/sample-book.pdf");

const browser = await chromium.launch({
  headless: true,
  args: ["--autoplay-policy=user-gesture-required"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const result = {
  ok: false,
  soundUrlStatus: null,
  enabled: false,
  unlockPlayOk: false,
  flipPlayOk: false,
  flipPlayCount: 0,
  playedOnLoad: false,
  errors: [],
};

page.on("pageerror", (err) => result.errors.push(String(err)));

await page.addInitScript(() => {
  window.__audioPlays = [];
  const orig = HTMLAudioElement.prototype.play;
  HTMLAudioElement.prototype.play = function (...args) {
    const rec = {
      muted: this.muted,
      src: this.currentSrc || this.src,
      volume: this.volume,
      t: Date.now(),
    };
    window.__audioPlays.push(rec);
    return orig.apply(this, args).then(
      (r) => {
        rec.ok = true;
        return r;
      },
      (err) => {
        rec.ok = false;
        rec.error = String(err && err.message ? err.message : err);
        throw err;
      },
    );
  };
});

try {
  await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 60_000 });

  result.soundUrlStatus = await page.evaluate(async () => {
    const res = await fetch("/sounds/page-turn.wav");
    return { status: res.status, type: res.headers.get("content-type"), len: (await res.arrayBuffer()).byteLength };
  });
  if (result.soundUrlStatus.status !== 200 || result.soundUrlStatus.len < 1000) {
    throw new Error("page-turn.wav not reachable from origin");
  }

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser", { timeout: 15_000 }),
    page.getByRole("button", { name: "Upload PDF", exact: true }).first().click(),
  ]);
  await fileChooser.setFiles(sample);

  async function reveal() {
    await page.mouse.move(200, 200);
    await page.mouse.move(640, 400);
    await page.waitForTimeout(100);
  }

  const nextButton = () => page.getByRole("button", { name: "Next →" });
  for (let i = 0; i < 60; i += 1) {
    await reveal();
    if (await nextButton().isVisible().catch(() => false)) break;
    await page.waitForTimeout(400);
  }
  await nextButton().waitFor({ state: "visible", timeout: 60_000 });
  await reveal();

  const playsBeforeEnable = await page.evaluate(() => window.__audioPlays.length);
  result.playedOnLoad = playsBeforeEnable > 0;

  await page.evaluate(() => {
    window.__audioPlays = [];
  });

  const soundBtn = page.getByRole("button", { name: /Enable page sound|Mute page sound/i });
  await soundBtn.click();
  await page.waitForTimeout(500);

  const aria = await soundBtn.getAttribute("aria-label");
  result.enabled = aria === "Mute page sound";

  const afterEnable = await page.evaluate(() => window.__audioPlays.slice());
  result.unlockPlayOk = afterEnable.some((p) => p.ok === true);

  await reveal();
  await nextButton().click();
  await page.waitForTimeout(1400);

  const afterFlip = await page.evaluate(() => window.__audioPlays.slice());
  const unmutedOk = afterFlip.filter((p) => p.ok === true && p.muted === false);
  result.flipPlayCount = unmutedOk.length;
  result.flipPlayOk = unmutedOk.length >= 1;

  result.ok =
    result.enabled &&
    result.unlockPlayOk &&
    result.flipPlayOk &&
    !result.playedOnLoad &&
    result.soundUrlStatus.status === 200;

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
} catch (err) {
  result.errors.push(String(err));
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
