import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";

test("Mantine menus, modal focus and theme stay consistent on desktop and mobile", async ({
  browser,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const name = "authjs.session-token";
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: {
      id: "00000000-0000-4000-8000-000000000001",
      sub: "00000000-0000-4000-8000-000000000001",
      name: "Leitor QA",
    },
  });
  await mkdir(".impeccable/review/mantine", { recursive: true });
  for (const [device, width, height] of [
    ["desktop", 1440, 1000],
    ["mobile", 390, 844],
  ] as const) {
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    await context.addCookies([
      { name, value: token, url: "http://127.0.0.1:3000", httpOnly: true },
    ]);
    await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
      route.fulfill({ status: 503, body: "{}" }),
    );
    const page = await context.newPage();
    try {
      await page.goto("/library");
      await page
        .getByRole("button", { name: "Importar arquivos", exact: true })
        .click();
      const modal = page.getByRole("dialog", {
        name: "Importar arquivos",
      });
      await expect(modal).toBeVisible();
      expect(
        await modal
          .locator(".mantine-Modal-body")
          .evaluate((element) =>
            parseFloat(getComputedStyle(element).paddingLeft),
          ),
      ).toBeGreaterThanOrEqual(16);
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        expect(
          await modal.evaluate((e) => e.contains(document.activeElement)),
        ).toBe(true);
      }
      await page.screenshot({
        path: `.impeccable/review/mantine/${device}-modal.png`,
        animations: "disabled",
      });
      await page.keyboard.press("Escape");
      await expect(modal).toHaveCount(0);
      await page
        .getByRole("button", { name: "Mais opções", exact: true })
        .click();
      await expect(page.getByRole("menu")).toBeVisible();
      expect(
        await page
          .getByRole("menu")
          .evaluate((element) =>
            Math.round(element.getBoundingClientRect().width),
          ),
      ).toBe(330);
      expect(
        await page
          .getByRole("menu")
          .evaluate((element) => getComputedStyle(element).borderRadius),
      ).toBe("28px");
      await page
        .getByRole("menuitem", { name: "Configurações", exact: true })
        .click();
      await expect(page).toHaveURL(/\/settings$/);
      await page.getByRole("button", { name: "Escuro", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await expect(page.locator("html")).toHaveAttribute(
        "data-mantine-color-scheme",
        "dark",
      );
      await page.reload();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
      await page
        .getByRole("button", { name: "Mais opções", exact: true })
        .click();
      await page.screenshot({
        path: `.impeccable/review/mantine/${device}-dark-menu.png`,
        animations: "disabled",
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (device === "desktop") {
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "Coleções e filtros", exact: true })
          .click();
        const title = page.getByRole("heading", {
          name: "Coleções",
          exact: true,
        });
        await expect(title).toBeVisible();
        expect(
          await title.evaluate((element) => getComputedStyle(element).fontSize),
        ).toBe("25px");
        await page.screenshot({
          path: ".impeccable/review/mantine/desktop-collections.png",
          animations: "disabled",
        });
      }
    } finally {
      await context.close();
    }
  }
});
