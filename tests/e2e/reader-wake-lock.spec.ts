import { expect, test } from "@playwright/test";
import dotenv from "dotenv";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import { seedReaderLibrary } from "./seed-library";

test.use({ isMobile: true, hasTouch: true });

declare global {
  interface Window {
    testScreenWakeLock?: WakeLockType;
  }
}

test("keeps the screen awake only while the reader is visible", async ({
  page,
  context,
  baseURL,
}) => {
  await seedReaderLibrary(context);
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const name = "authjs.session-token";
  const value = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: { id: "00000000-0000-4000-8000-000000000001" },
  });
  await context.addCookies([{ name, value, url: baseURL!, httpOnly: true }]);
  await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.addInitScript(() => {
    let visible = true;
    let activeLocks = 0;
    document.addEventListener("test-toggle-visibility", () => {
      visible = !visible;
      document.dispatchEvent(new Event("visibilitychange"));
    });
    Object.defineProperty(document, "visibilityState", {
      get: () => (visible ? "visible" : "hidden"),
    });
    Object.defineProperty(navigator, "wakeLock", {
      value: {
        async request(type: WakeLockType) {
          const sentinel = {
            released: false,
            async release() {
              if (sentinel.released) return;
              sentinel.released = true;
              if (--activeLocks === 0) delete window.testScreenWakeLock;
            },
          };
          activeLocks++;
          window.testScreenWakeLock = type;
          return sentinel;
        },
      },
    });
  });

  await page.goto("/reader/dom-casmurro");
  const screenWakeLock = () => page.evaluate(() => window.testScreenWakeLock);
  const toggleVisibility = () =>
    page.evaluate(() => {
      document.dispatchEvent(new Event("test-toggle-visibility"));
    });
  await expect.poll(screenWakeLock).toBe("screen");
  await toggleVisibility();
  await expect.poll(screenWakeLock).toBeUndefined();
  await toggleVisibility();
  await expect.poll(screenWakeLock).toBe("screen");
  await page
    .getByRole("link", { name: "Voltar à biblioteca", exact: true })
    .click();
  await expect(page).toHaveURL(/\/library$/);
  await expect.poll(screenWakeLock).toBeUndefined();
  await toggleVisibility();
  await toggleVisibility();
  await expect.poll(screenWakeLock).toBeUndefined();
});
