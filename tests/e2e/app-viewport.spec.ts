import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

test("mobile form focus and pinch keep the application scale", async ({
  page,
  context,
}) => {
  await page.goto("/forgot-password");
  const field = page.getByRole("textbox", { name: "E-mail" });
  await expect(field).toBeVisible();
  expect(
    await field.evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
  ).toBeGreaterThanOrEqual(16);
  await field.tap();
  await field.fill("reader@example.test");
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  const session = await context.newCDPSession(page);
  await session.send("Input.synthesizePinchGesture", {
    x: 190,
    y: 260,
    scaleFactor: 1.8,
    relativeSpeed: 800,
    gestureSourceType: "touch",
  });
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

test("installation manifest and icons support independent app windows", async ({
  page,
  request,
}) => {
  await page.goto("/forgot-password");
  await expect(
    page.locator('meta[name="apple-mobile-web-app-capable"]'),
  ).toHaveAttribute("content", "yes");
  const path = await page.locator('link[rel="manifest"]').getAttribute("href");
  const response = await request.get(path!);
  expect(response.ok()).toBeTruthy();
  const manifest = await response.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.scope).toBe("/");
  for (const icon of manifest.icons) {
    const asset = await request.get(icon.src);
    expect(asset.ok()).toBeTruthy();
    expect(asset.headers()["content-type"]).toContain("image/png");
  }
});
