import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { appVersion, releaseNotes } from "../../src/shared/app-release";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await seedReaderLibrary(context);
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const value = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([
    { name: "authjs.session-token", value, url: "http://127.0.0.1:3000" },
  ]);
  await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

for (const width of [1440, 393]) {
  test(`settings show the real version and release notes (${width}px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/settings");
    await expect(page.locator(".settings-version")).toContainText(
      `Versão ${appVersion}`,
    );
    const trigger = page.getByRole("button", {
      name: "Ver novidades",
      exact: true,
    });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "O que há de novo" });
    await expect(dialog).toBeVisible();
    const current = dialog.getByRole("article", {
      name: `Versão ${appVersion}`,
      exact: true,
    });
    await expect(current.getByText("Atual", { exact: true })).toBeVisible();
    await expect(current.locator("time")).toHaveAttribute(
      "datetime",
      releaseNotes[0].date,
    );
    await expect(current.getByRole("listitem")).toHaveCount(
      releaseNotes[0].sections.reduce(
        (count, section) => count + section.items.length,
        0,
      ),
    );
    await expect(current).toContainText(releaseNotes[0].sections[0].items[0]);
    await page.screenshot({
      path: testInfo.outputPath(`release-notes-${width}.png`),
      animations: "disabled",
    });
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await dialog.getByRole("button", { name: "Concluir", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });
}
