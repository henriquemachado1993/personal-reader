import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { initialState } from "../reader-fixture";

test.beforeEach(async ({ context }) => {
  const snapshot = initialState();
  snapshot.annotations = ["#e8bb45", "#db7f88"].map((color, index) => ({
    id: `color-note-${index}`,
    documentId: snapshot.documents[0].id,
    kind: "note",
    page: 0,
    location: { type: "EPUB", cfi: "", href: "" },
    text: `Anotação ${index + 1}`,
    color,
    createdAt: "2026-11-17T12:00:00.000Z",
    updatedAt: "2026-11-17T12:00:00.000Z",
  }));
  await seedReaderLibrary(context, snapshot);
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
  await context.route(/\/api\/library(?:\/|\?|$)/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

for (const width of [1440, 393]) {
  test(`${width}px: color swatches preserve filtering, selected labels and keyboard access`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/knowledge");
    const filter = page.getByRole("combobox", { name: "Cor", exact: true });
    const selectedDot = page.locator(
      ".knowledge-color-filter .knowledge-color-dot",
    );
    await expect(filter).toHaveValue("Todas as cores");
    await expect(selectedDot).toHaveCSS("background-image", /conic-gradient/);
    await filter.click();
    await expect(page.getByRole("option")).toHaveCount(6);
    await expect(
      page
        .getByRole("option", { name: "Todas as cores", exact: true })
        .locator(".knowledge-color-dot"),
    ).toHaveCSS("background-image", /conic-gradient/);
    await expect(
      page
        .getByRole("option", { name: "Rosa", exact: true })
        .locator(".knowledge-color-dot"),
    ).toHaveCSS("background-color", "rgb(219, 127, 136)");
    await page.screenshot({
      path: testInfo.outputPath(`color-options-${width}.png`),
    });
    await page.getByRole("option", { name: "Rosa", exact: true }).click();
    await expect(filter).toHaveValue("Rosa");
    await expect(selectedDot).toHaveCSS(
      "background-color",
      "rgb(219, 127, 136)",
    );
    await expect(page.locator(".knowledge-entry")).toHaveCount(1);
    await expect(page.locator(".knowledge-entry")).toContainText("Anotação 2");
    await filter.focus();
    await filter.press("ArrowDown");
    await expect(page.getByRole("listbox")).toBeVisible();
    await filter.press("Escape");
    await filter.click();
    await page
      .getByRole("option", { name: "Todas as cores", exact: true })
      .click();
    await expect(selectedDot).toHaveCSS("background-image", /conic-gradient/);
    await expect(page.locator(".knowledge-entry")).toHaveCount(2);
  });
}
