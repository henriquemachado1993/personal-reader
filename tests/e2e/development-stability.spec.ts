import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";

test("settings remains loaded while idle", async ({ page, context }) => {
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
  await context.route("**/api/library", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Configurações", exact: true }),
  ).toBeVisible();
  const documentStart = await page.evaluate(() => performance.timeOrigin);
  // Observe long enough to catch the reported repeated document reloads.
  await page.waitForTimeout(8000);
  expect(await page.evaluate(() => performance.timeOrigin)).toBe(documentStart);
});
