import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { initialState } from "../reader-fixture";

for (const viewport of [
  { name: "desktop", width: 1440, height: 1000, theme: "light" },
  { name: "phone", width: 393, height: 852, theme: "light" },
  { name: "ipad", width: 820, height: 1180, theme: "light" },
  { name: "ipad-landscape", width: 1180, height: 820, theme: "light" },
  { name: "ipad-dark", width: 820, height: 1180, theme: "dark" },
] as const) {
  test(`${viewport.name}: reader keeps the center clear and identifies the book`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize(viewport);
    const snapshot = initialState();
    snapshot.preferences.theme = viewport.theme;
    snapshot.preferences.readerTheme =
      viewport.theme === "dark" ? "night" : "white";
    const book = snapshot.documents[0];
    book.title = "Competente o Suficiente";
    book.format = "TXT";
    book.content = Array(4).fill(
      Array(20)
        .fill("Texto da leitura passando atrás do cabeçalho durante a rolagem.")
        .join("\n\n"),
    );
    book.pages = 4;
    book.page = 0;
    await seedReaderLibrary(context, snapshot);
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
    await page.goto(`/reader/${book.id}`);
    await expect(page).toHaveTitle(`${book.title} · Le-Books`);
    const header = page.getByRole("banner", { name: `Leitor: ${book.title}` });
    await expect(header).toBeVisible();
    await expect(header).not.toContainText(book.title);
    await expect(header.locator(":scope > *")).toHaveCount(2);
    await page.locator(".reader-scroll-area").evaluate((element) => {
      element.scrollTop = 500;
    });
    const geometry = await header.evaluate((element) => {
      const left = element
        .querySelector(".reader-header-left")!
        .getBoundingClientRect();
      const right = element
        .querySelector(".reader-header-right")!
        .getBoundingClientRect();
      const gap = document.elementFromPoint(
        (left.right + right.left) / 2,
        left.top + left.height / 2,
      );
      return {
        left: left.toJSON(),
        right: right.toJSON(),
        gapBlocked: element.contains(gap),
        documentWidth: document.documentElement.scrollWidth,
      };
    });
    expect(geometry.left.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right.right).toBeLessThanOrEqual(viewport.width);
    expect(
      Math.max(
        geometry.right.left - geometry.left.right,
        geometry.right.top - geometry.left.bottom,
      ),
    ).toBeGreaterThanOrEqual(8);
    expect(geometry.gapBlocked).toBe(false);
    expect(geometry.documentWidth).toBeLessThanOrEqual(viewport.width);
    await expect(
      page.getByRole("button", {
        name: "Mostrar páginas e marcadores",
        exact: true,
      }),
    ).toBeVisible();
    await mkdir(".impeccable/review/reader-title", { recursive: true });
    await page.screenshot({
      path: `.impeccable/review/reader-title/${viewport.name}.png`,
    });
  });
}
