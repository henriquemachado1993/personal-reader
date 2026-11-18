import { test, expect, type BrowserContext } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile, mkdir } from "node:fs/promises";
import dotenv from "dotenv";
import { initialState } from "../reader-fixture";
import { seedReaderLibrary } from "./seed-library";

async function prepareStatistics(
  context: BrowserContext,
  snapshot = initialState(),
) {
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
  await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
}

for (const theme of ["light", "dark"] as const) {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 1000 },
    { name: "ipad", width: 820, height: 1180 },
    { name: "iphone", width: 393, height: 852 },
    { name: "small-phone", width: 320, height: 740 },
  ]) {
    test(`${theme} ${viewport.name}: statistics separates periods and both pages are centered`, async ({
      page,
      context,
    }) => {
      await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
      const snapshot = initialState();
      snapshot.preferences.theme = theme;
      snapshot.readingSeconds = 7200;
      snapshot.readingDays = {
        "2026-11-16": 720,
        "2026-11-15": 1800,
        "2026-11-10": 60,
        "2026-11-09": 9999,
      };
      await prepareStatistics(context, snapshot);
      await page.setViewportSize(viewport);
      await page.goto("/statistics");
      await expect(
        page.getByRole("heading", { name: "Estatísticas", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".statistics-today")).toContainText("12 min");
      await expect(
        page.getByRole("progressbar", { name: "Progresso da meta diária" }),
      ).toHaveAttribute("value", "720");
      await expect(page.getByRole("progressbar")).toHaveAttribute(
        "max",
        "1200",
      );
      await expect(page.locator(".statistics-summary")).toContainText("2 h");
      await expect(page.locator(".statistics-section-heading")).toContainText(
        "43 min no período",
      );
      await expect(page.locator(".statistics-history tbody tr")).toHaveCount(7);
      const today = page.locator(".statistics-history tbody tr").first();
      await expect(today).toContainText("Hoje");
      await expect(today).toContainText("12 min");
      await mkdir(".impeccable/review/statistics", { recursive: true });
      for (const route of ["statistics", "settings"]) {
        await page.goto(`/${route}`);
        const content = page.locator(".workspace-page");
        await expect(content).toBeVisible();
        const bounds = (await content.boundingBox())!;
        expect(
          Math.abs(bounds.x - (viewport.width - bounds.x - bounds.width)),
        ).toBeLessThanOrEqual(2);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.screenshot({
          path: `.impeccable/review/statistics/${route}-${theme}-${viewport.name}.png`,
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Claro", exact: true }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    });
  }
}

test("an empty reading week explains how to start", async ({
  page,
  context,
}) => {
  await prepareStatistics(context);
  await page.goto("/statistics");
  await expect(
    page.getByText("Nenhuma leitura registrada nos últimos sete dias."),
  ).toBeVisible();
  await expect(page.locator(".statistics-history table")).toHaveCount(0);
  await page.getByRole("link", { name: "Escolher uma leitura" }).click();
  await expect(page).toHaveURL(/\/library$/);
});

test("completed goals stay bounded and update from settings", async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  const snapshot = initialState();
  snapshot.readingDays = { "2026-11-16": 1800 };
  snapshot.readingSeconds = 1800;
  snapshot.documents.push({
    ...snapshot.documents[0],
    id: "finished-original",
    demo: false,
    status: "finished",
  });
  snapshot.documents[0].status = "finished";
  await prepareStatistics(context, snapshot);
  await page.goto("/statistics");
  await expect(page.getByText("Meta atingida", { exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1200");
  await expect(
    page
      .locator(".statistics-summary > div")
      .filter({ hasText: "Documentos concluídos" })
      .locator("dd"),
  ).toHaveText("1");
  await page.getByRole("link", { name: "Ajustar meta diária" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.getByRole("combobox", { name: "Meta diária em minutos" }).click();
  await page.getByRole("option", { name: "60 minutos", exact: true }).click();
  await page.goto("/statistics");
  await expect(page.getByRole("progressbar")).toHaveAttribute("max", "3600");
  await expect(
    page.getByText("50% da meta diária", { exact: true }),
  ).toBeVisible();
});

test("the daily goal is not completed by rounding the last seconds", async ({
  page,
  context,
}) => {
  await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
  const snapshot = initialState();
  snapshot.readingDays = { "2026-11-16": 1199 };
  snapshot.readingSeconds = 1199;
  await prepareStatistics(context, snapshot);
  await page.goto("/statistics");
  await expect(
    page.getByText("99% da meta diária", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Meta atingida", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1199");
});

for (const width of [1440, 393]) {
  test(`${width}: period filters reveal reading habits and resume the latest document`, async ({
    page,
    context,
  }) => {
    await page.clock.setFixedTime(new Date("2026-11-16T12:00:00Z"));
    const snapshot = initialState();
    snapshot.readingSeconds = 4200;
    snapshot.readingDays = {
      "2026-11-16": 1200,
      "2026-11-15": 600,
      "2026-11-14": 1800,
      "2026-11-09": 600,
    };
    snapshot.documents.push({
      ...snapshot.documents[0],
      id: "latest-reading",
      format: "TXT",
      demo: false,
      title: "Leitura mais recente",
      status: "reading",
      lastReadAt: "2026-11-16T11:00:00Z",
    });
    await prepareStatistics(context, snapshot);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/statistics");
    const habits = page.locator(".statistics-habits");
    await expect(
      habits
        .locator("div")
        .filter({ hasText: "Dias com leitura" })
        .locator("dd"),
    ).toHaveText("3 de 7");
    await expect(
      habits
        .locator("div")
        .filter({ hasText: "Dias com a meta atual" })
        .locator("dd"),
    ).toHaveText("2 de 7");
    await expect(
      habits
        .locator("div")
        .filter({ hasText: "Sequência atual" })
        .locator("dd"),
    ).toHaveText("3 dias");
    await expect(page.locator(".statistics-comparison")).toContainText(
      "500% a mais",
    );
    await page.getByRole("button", { name: "30 dias", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Últimos 30 dias" }),
    ).toBeVisible();
    await expect(page.locator(".statistics-history tbody tr")).toHaveCount(30);
    await expect(
      habits
        .locator("div")
        .filter({ hasText: "Dias com leitura" })
        .locator("dd"),
    ).toHaveText("4 de 30");
    await expect(page.locator(".statistics-comparison")).toContainText(
      "Sem leitura nos 30 dias anteriores",
    );
    const history = page.getByRole("region", { name: "Histórico de leitura" });
    await history.evaluate((node) => (node.scrollTop = node.scrollHeight));
    expect(
      await history.evaluate((node) => node.scrollHeight > node.clientHeight),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `.impeccable/review/statistics/utility-30-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "7 dias", exact: true }).click();
    await expect(page.locator(".statistics-history tbody tr")).toHaveCount(7);
    await page.getByText("Como calculamos", { exact: true }).click();
    await expect(
      page.getByText(/Dias anteriores são avaliados com a meta atual/),
    ).toBeVisible();
    await page
      .getByRole("link", { name: "Retomar Leitura mais recente" })
      .click();
    await expect(page).toHaveURL(/\/reader\/latest-reading$/);
    await expect(
      page.locator('.reader-page[aria-current="page"] .prose-page'),
    ).toBeVisible();
  });
}
