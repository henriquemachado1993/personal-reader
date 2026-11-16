import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { initialState } from "../reader-fixture";

for (const viewport of [
  { name: "phone", width: 393, height: 852, theme: "light" },
  { name: "ipad", width: 820, height: 1180, theme: "light" },
  { name: "ipad-landscape", width: 1180, height: 820, theme: "light" },
  { name: "ipad-dark", width: 820, height: 1180, theme: "dark" },
] as const) {
  test(`${viewport.name}: title stays opaque over scrolling text`, async ({
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
    await context.route("**/api/library", (route) =>
      route.fulfill({ status: 503, body: "{}" }),
    );
    await page.goto(`/reader/${book.id}`);
    const title = page.locator(".reader-title");
    await expect(title).toHaveText(book.title);
    await page.locator(".reader-scroll-area").evaluate((element) => {
      element.scrollTop = 500;
    });
    const geometry = await title.evaluate((element) => {
      const title = element.getBoundingClientRect();
      const page = document
        .querySelector(".reader-continuous-page")!
        .getBoundingClientRect();
      const controls = document.querySelector(".reader-header-left")!;
      return {
        background: getComputedStyle(element).backgroundColor,
        controlsBackground: getComputedStyle(controls).backgroundColor,
        titleTop: title.top,
        titleBottom: title.bottom,
        pageTop: page.top,
        pageBottom: page.bottom,
        opacity: getComputedStyle(element).opacity,
      };
    });
    expect(geometry.background).toBe(geometry.controlsBackground);
    expect(geometry.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(geometry.opacity).toBe("1");
    expect(geometry.pageTop).toBeLessThan(geometry.titleTop);
    expect(geometry.pageBottom).toBeGreaterThan(geometry.titleBottom);
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
