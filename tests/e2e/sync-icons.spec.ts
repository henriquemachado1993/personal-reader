import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
import { initialState } from "../reader-fixture";
import { initialState as emptyState } from "../../src/modules/library/initial-state";
import {
  diffLibrary,
  type SyncBatch,
} from "../../src/modules/library/sync-protocol";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
  await seedReaderLibrary(context, initialState(), 1);
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const value = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([
    { name: "authjs.session-token", value, url: "http://127.0.0.1:3000" },
  ]);
});

for (const width of [1440, 393]) {
  test(`cloud icons follow pending, automatic sync, offline, failure and conflict (${width}px)`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    let revision = 1;
    let changes = diffLibrary(emptyState(), initialState()).changes;
    const bootstrap = changes;
    let failed = false;
    let held: Promise<void> | undefined;
    let release: (() => void) | undefined;
    await context.route(/\/api\/library\/sync(?:\?.*)?$/, async (route) => {
      if (held) await held;
      if (failed) {
        await route.fulfill({ status: 503, body: "{}" });
        return;
      }
      if (route.request().method() === "POST") {
        const saved = route.request().postDataJSON() as SyncBatch;
        changes = saved.changes;
        await route.fulfill({ json: { revision: ++revision, changes } });
        return;
      }
      const since = Number(
        new URL(route.request().url()).searchParams.get("since"),
      );
      await route.fulfill({
        json: {
          revision,
          changes: since === revision ? [] : since === 0 ? bootstrap : changes,
        },
      });
    });
    try {
      await page.goto("/settings");
      const badge = page.locator(".sync-state");
      await expect(badge).toHaveText("Em dia");
      await expect(badge.locator(".lucide-cloud-check")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`synced-${width}.png`),
        animations: "disabled",
      });
      held = new Promise((resolve) => {
        release = resolve;
      });
      await page.getByRole("button", { name: "Escuro", exact: true }).click();
      await expect(badge).toHaveText("Pendente");
      await expect(badge.locator(".lucide-cloud-upload")).toBeVisible();
      await expect(badge).toHaveText("Em andamento");
      await expect(badge.locator(".lucide-cloud-sync")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sincronizando…", exact: true }),
      ).toBeDisabled();
      held = undefined;
      release!();
      await expect(badge).toHaveText("Em dia");
      await context.setOffline(true);
      await expect(badge).toHaveText("Sem conexão");
      await expect(badge.locator(".lucide-cloud-off")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sincronizar agora", exact: true }),
      ).toBeDisabled();
      failed = true;
      await context.setOffline(false);
      await expect(badge).toHaveText("Falha na sincronização");
      await expect(badge.locator(".lucide-cloud-alert")).toBeVisible();
      failed = false;
      await context.setOffline(true);
      await page.getByRole("button", { name: "Claro", exact: true }).click();
      changes = [
        {
          kind: "preferences",
          id: "account",
          value: { ...initialState().preferences, theme: "system" },
        },
      ];
      revision++;
      await context.setOffline(false);
      await expect(badge).toHaveText("Revisar alterações");
      await expect(badge.locator(".lucide-cloud-alert")).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`conflict-${width}.png`),
        animations: "disabled",
      });
    } finally {
      release?.();
    }
  });
}
