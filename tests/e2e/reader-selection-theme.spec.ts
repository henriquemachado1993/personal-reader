import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { chooseAnnotationTool } from "./annotation-tools";

test.use({ actionTimeout: 7000 });

for (const theme of ["light", "dark"]) {
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 393, height: 852 },
  ]) {
    test(`${theme} ${viewport.width}: reader selection matches application navigation`, async ({
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
      await context.route("**/api/library", (route) =>
        route.fulfill({ status: 503, body: "{}" }),
      );
      await page.setViewportSize(viewport);
      await page.goto("/settings");
      await page
        .getByRole("button", {
          name: theme === "dark" ? "Escuro" : "Claro",
          exact: true,
        })
        .click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.goto("/library");
      const selection = await page
        .locator(".floating-navigation > a.active")
        .evaluate((node) => getComputedStyle(node).backgroundColor);
      const text = await page
        .locator("body")
        .evaluate((node) => getComputedStyle(node).color);
      for (const route of ["/library", "/knowledge", "/settings"]) {
        await page.goto(route);
        const squareIcons = await page
          .locator(".icon-button")
          .evaluateAll((elements) =>
            elements
              .filter((element) => {
                const bounds = element.getBoundingClientRect();
                if (!bounds.width || !bounds.height) return false;
                const radius = getComputedStyle(element).borderTopLeftRadius;
                return (
                  !radius.includes("%") &&
                  parseFloat(radius) < Math.min(bounds.width, bounds.height) / 2
                );
              })
              .map((element) => element.getAttribute("aria-label")),
          );
        expect(squareIcons).toEqual([]);
        if (route === "/library") {
          await page
            .getByRole("button", { name: "Importar arquivos", exact: true })
            .click();
          const close = page.locator(".mantine-Modal-close");
          await close.hover();
          await expect(close).toHaveCSS("border-radius", "50%");
          await close.click();
        }
      }
      await page.goto("/reader/dom-casmurro");
      const search = page.getByRole("button", { name: "Buscar no documento" });
      await search.hover();
      await expect(search).toHaveCSS("border-radius", "50%");
      await expect(search).toHaveCSS("background-color", selection);
      await page
        .getByRole("button", { name: "Abrir ferramentas de anotação" })
        .click();
      const brush = page.getByRole("button", {
        name: "Fechar ferramentas de anotação",
      });
      await expect(brush).toHaveCSS("background-color", selection);
      await expect(brush).toHaveCSS("color", text);
      const pen = page.getByRole("button", { name: "Caneta", exact: true });
      await pen.click();
      await expect(pen).toHaveCSS("background-color", selection);
      await expect(pen).toHaveCSS("color", text);
      await page.keyboard.press("Tab");
      await pen.focus();
      await expect(pen).toHaveCSS("outline-color", text);
      await expect(pen).toHaveCSS("outline-width", "2px");
      const more = page.getByRole("button", { name: "Mais ferramentas" });
      await more.click();
      await expect(more).toHaveCSS("background-color", selection);
      await expect(more).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(brush).toBeVisible();
      await chooseAnnotationTool(page, "Retângulo");
      await expect(
        page.getByRole("button", { name: "Retângulo", exact: true }),
      ).toHaveCSS("background-color", selection);
      await page
        .getByRole("button", { name: "Marcar página", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Remover marcador", exact: true }),
      ).toHaveCSS("background-color", selection);
      await mkdir(".impeccable/review/reader-selection", { recursive: true });
      await page.screenshot({
        path: `.impeccable/review/reader-selection/${theme}-${viewport.width}.png`,
      });
      await page.getByRole("button", { name: "Ajustar aparência" }).click();
      await expect(
        page.getByRole("button", { name: "Ajustar aparência" }),
      ).toHaveCSS("background-color", selection);
      await page.getByRole("button", { name: "Fechar aparência" }).click();
      await brush.click();
      await page
        .getByRole("button", { name: "Mostrar páginas e marcadores" })
        .click();
      await expect(
        page.getByRole("button", { name: "Mostrar páginas e marcadores" }),
      ).toHaveCSS("background-color", selection);
      await expect(
        page.locator('.page-navigation-list [aria-current="page"]'),
      ).toHaveCSS("background-color", selection);
      await page
        .getByRole("button", { name: "Fechar páginas", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Mostrar anotações", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Mostrar anotações", exact: true }),
      ).toHaveCSS("background-color", selection);
    });
  }
}
