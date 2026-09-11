import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:4321";
const ARTIFACTS = "/opt/cursor/artifacts";
const email = `reader_${Date.now()}@pagina.test`;
const password = "pagina-demo-pass";
const name = "Demo Reader";

fs.mkdirSync(ARTIFACTS, { recursive: true });

async function waitForUserMenu(page) {
  await page.waitForSelector("header button[aria-haspopup='menu']", { timeout: 20000 });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("BROWSER_ERR", msg.text());
  });

  // Signup
  await page.goto(`${BASE}/signup`, { waitUntil: "networkidle" });
  await page.locator('input[autocomplete="name"]').fill(name);
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="new-password"]').nth(0).fill(password);
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(password);
  await page.screenshot({ path: path.join(ARTIFACTS, "auth_signup.png"), fullPage: true });
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 20000 }),
    page.getByRole("button", { name: /Create my Página account/i }).click(),
  ]);
  await waitForUserMenu(page);
  await page.locator("header button[aria-haspopup='menu']").click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(ARTIFACTS, "auth_signed_in.png") });
  console.log("SIGNED_IN_OK");
  await page.getByRole("menuitem", { name: /Sign out/i }).click();
  await page.waitForTimeout(800);

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator('input[autocomplete="email"]').fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.screenshot({ path: path.join(ARTIFACTS, "auth_login.png"), fullPage: true });
  await Promise.all([
    page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 20000 }),
    page.getByRole("button", { name: /^Sign in$/i }).click(),
  ]);
  await waitForUserMenu(page);
  console.log("LOGIN_OK");
  await page.locator("header button[aria-haspopup='menu']").click();
  await page.getByRole("menuitem", { name: /Sign out/i }).click();
  await page.waitForTimeout(700);

  // Guest reader
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.setInputFiles('input[type="file"]', path.join(process.cwd(), "public/sample-book.pdf"));
  await page.waitForSelector(".reader-shell", { timeout: 45000 });
  await page.waitForTimeout(2800);
  await page.mouse.move(640, 20);
  await page.waitForTimeout(400);
  const guestSignIn = await page.locator(".reader-top-chrome").getByText(/Sign in/i).count();
  await page.screenshot({ path: path.join(ARTIFACTS, "auth_guest_reader.png") });
  console.log("GUEST_READER_OK", { guestSignIn });

  await browser.close();
  console.log("ALL_DONE", { email });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
