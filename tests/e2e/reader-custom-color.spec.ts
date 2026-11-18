import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";

for (const device of [
  { name: "desktop", width: 1440, height: 1000, touch: false },
  { name: "iphone", width: 393, height: 852, touch: true },
  { name: "ipad", width: 820, height: 1180, touch: true },
  { name: "landscape", width: 852, height: 393, touch: true },
]) {
  test.describe(device.name, () => {
    test.use({
      viewport: device,
      hasTouch: device.touch,
      isMobile: device.touch,
    });
    test("custom color stays open through saturation and hue drags", async ({
      page,
      context,
    }) => {
      await seedReaderLibrary(context);
      const env = dotenv.parse(await readFile(".env", "utf8"));
      const name = "authjs.session-token";
      const value = await encode({
        secret: env.AUTH_SECRET,
        salt: name,
        token: { id: "00000000-0000-4000-8000-000000000001" },
      });
      await context.addCookies([
        { name, value, url: "http://127.0.0.1:3000", httpOnly: true },
      ]);
      await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
        route.fulfill({ status: 503, body: "{}" }),
      );
      await page.goto("/reader/dom-casmurro");
      await page
        .getByRole("button", { name: "Abrir ferramentas de anotação" })
        .click();
      const trigger = page.getByRole("button", {
        name: "Escolher cor personalizada",
      });
      await trigger.click();
      const hex = page.getByRole("textbox", { name: "Cor personalizada" });
      await hex.click();
      const session = device.touch ? await context.newCDPSession(page) : null;
      const drag = async (
        selector: string,
        from: { x: number; y: number },
        to: { x: number; y: number },
      ) => {
        const target = page.locator(selector).first();
        await expect(target).toBeVisible();
        const box = (await target.boundingBox())!;
        const point = (x: number, y: number) => ({
          x: box.x + box.width * x,
          y: box.y + box.height * y,
        });
        if (session)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [point(from.x, from.y)],
          });
        else {
          const start = point(from.x, from.y);
          await page.mouse.move(start.x, start.y);
          await page.mouse.down();
        }
        await expect(hex).toBeVisible();
        const startColor = await hex.inputValue();
        for (let step = 1; step <= 6; step++) {
          const next = point(
            from.x + ((to.x - from.x) * step) / 6,
            from.y + ((to.y - from.y) * step) / 6,
          );
          if (session)
            await session.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [next],
            });
          else await page.mouse.move(next.x, next.y);
          await page.evaluate(() => new Promise(requestAnimationFrame));
          await expect(target).toBeVisible();
          await expect(hex).toBeVisible();
        }
        if (session)
          await session.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
        else await page.mouse.up();
        await expect(hex).not.toHaveValue(startColor);
      };
      await drag(
        '[role="slider"][aria-valuetext]',
        { x: 0.2, y: 0.2 },
        { x: 0.8, y: 0.4 },
      );
      await drag("[data-hue]", { x: 0.1, y: 0.5 }, { x: 0.7, y: 0.5 });
      await drag("[data-hue]", { x: 0.7, y: 0.5 }, { x: 0.3, y: 0.5 });
      await expect(trigger).toHaveAttribute("aria-pressed", "true");
      const hue = page.getByRole("slider", { name: "Tonalidade", exact: true });
      const previousColor = await hex.inputValue();
      await hue.focus();
      await page.keyboard.press("ArrowRight");
      await expect(hex).not.toHaveValue(previousColor);
      await hex.fill("#306155");
      await hex.blur();
      await expect(hex).toHaveValue("#306155");
      await expect(
        page.getByRole("slider", { name: "Saturação e luminosidade" }),
      ).toHaveAttribute("aria-valuetext", "rgba(48, 97, 85, 1)");
      await expect(
        page.locator(".mantine-Popover-dropdown:visible"),
      ).toHaveCount(1);
      const bounds = (await page
        .locator(".annotation-color-popup")
        .boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(device.width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(device.height);
      await hex.fill("#12");
      await hex.blur();
      await expect(hex).toHaveValue("#306155");
      await mkdir(".impeccable/review/custom-color", { recursive: true });
      await page.screenshot({
        path: `.impeccable/review/custom-color/${device.name}.png`,
      });
      await page.keyboard.press("Escape");
      await expect(hex).toHaveCount(0);
      await expect(trigger).toBeVisible();
    });
  });
}
