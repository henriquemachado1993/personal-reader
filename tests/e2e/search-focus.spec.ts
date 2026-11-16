import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("search focus keeps a single surface color", async ({ page }) => {
  await page.setContent(`<style>:root { --selection: #eaeaea; } input { background: transparent; }</style>
    <div class="books-search"><input aria-label="Busca"></div>
    <div class="global-search"><input aria-label="Busca global"></div>
    <div class="reader-search"><input aria-label="Busca no livro"></div>`);
  await page.addStyleTag({
    content: await readFile("src/components/ui/controls.css", "utf8"),
  });
  for (const input of await page.locator("input").all()) {
    await input.focus();
    await expect(input).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(input).toHaveCSS("outline-style", "none");
  }
});
