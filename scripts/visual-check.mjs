import { chromium } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
const env = dotenv.parse(await readFile(".env", "utf8"));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
});
const cookieName = "authjs.session-token";
const token = await encode({
  secret: env.AUTH_SECRET,
  salt: cookieName,
  token: {
    id: "00000000-0000-4000-8000-000000000001",
    sub: "00000000-0000-4000-8000-000000000001",
    name: "Leitor de teste",
    email: "qa@example.test",
  },
});
await mkdir(".impeccable/review", { recursive: true });
const errors = [];
for (const viewport of [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
]) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: "reduce",
  });
  await context.addCookies([
    {
      name: cookieName,
      value: token,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  page.on("pageerror", (e) =>
    errors.push({ viewport: viewport.name, error: e.message }),
  );
  for (const [route, name] of [
    ["/", "home"],
    ["/library", "library"],
    ["/reader/dom-casmurro", "reader"],
    ["/knowledge", "knowledge"],
  ]) {
    await page.goto(`http://127.0.0.1:3000${route}`);
    await page.locator("h1").first().waitFor();
    await page.waitForTimeout(350);
    await page.screenshot({
      path: `.impeccable/review/${name}-${viewport.name}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    console.log(
      `${name}-${viewport.name}: ${page.url().split("/").slice(3).join("/")} overflow=${overflow.page > overflow.viewport}`,
    );
  }
  await context.close();
}
await browser.close();
await writeFile(
  ".impeccable/review/browser-errors.json",
  JSON.stringify(errors, null, 2),
);
console.log(JSON.stringify({ pageErrors: errors }));
