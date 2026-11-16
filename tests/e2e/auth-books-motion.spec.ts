import { test, expect } from "@playwright/test";

for (const route of ["/login", "/forgot-password", "/reset-password"]) {
  test(`${route}: covers open once while the form remains available`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto(route);
    const covers = page.locator(".auth-books img");
    await expect(covers).toHaveCount(3);
    await expect(covers.first()).toHaveCSS("animation-name", "auth-book-open");
    await expect(covers.last()).toHaveCSS("animation-delay", "0.16s");
    await expect(covers.first()).toHaveCSS("animation-iteration-count", "1");
    await expect(page.locator(".auth-form-section")).toBeVisible();
    const frames = await covers.first().evaluate((image) => {
      image.style.animation = "none";
      void image.getBoundingClientRect().width;
      image.style.animation = "";
      const animation = image.getAnimations()[0];
      if (!animation)
        throw new Error("Book entrance animation was not created");
      animation.pause();
      animation.currentTime = 150;
      const opening = getComputedStyle(image).transform;
      animation.finish();
      return { opening, settled: getComputedStyle(image).transform };
    });
    expect(frames.opening).not.toBe("none");
    expect(frames.settled).toBe("none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(covers.first()).toHaveCSS("animation-name", "none");
    await expect(covers.first()).toHaveCSS("transform", "none");
    await page.setViewportSize({ width: 393, height: 852 });
    await expect(page.locator(".auth-books")).toBeHidden();
    await expect(page.locator(".auth-form-section")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
