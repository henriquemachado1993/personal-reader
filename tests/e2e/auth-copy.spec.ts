import { test, expect } from "@playwright/test";

test("recovery names the next step without revealing whether an account exists", async ({
  page,
}) => {
  await page.route("**/api/auth/recovery", (route) =>
    route.fulfill({
      json: {
        message:
          "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
      },
    }),
  );
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail", { exact: true }).fill("reader@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confira seu e-mail" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Se este e-mail estiver cadastrado",
  );
  await expect(page.getByRole("status")).toContainText("pasta de spam");
  await expect(
    page.getByRole("link", { name: "Voltar ao login" }),
  ).toHaveAttribute("href", "/login");
});

test("network failures give a recovery action instead of browser error text", async ({
  page,
}) => {
  await page.route("**/api/auth/recovery", (route) => route.abort("failed"));
  await page.goto("/forgot-password");
  await page.getByLabel("E-mail", { exact: true }).fill("reader@example.test");
  await page
    .getByRole("button", { name: "Enviar link de recuperação" })
    .click();
  await expect(page.locator(".auth-form").getByRole("alert")).toContainText(
    "Verifique sua conexão e tente novamente.",
  );
  await expect(
    page.getByRole("button", { name: "Enviar link de recuperação" }),
  ).toBeEnabled();
});

test("reset states explain requirements, success and the next login", async ({
  page,
}) => {
  await page.route("**/api/auth/reset-password", (route) =>
    route.fulfill({ json: { ok: true } }),
  );
  await page.goto(`/reset-password#${"a".repeat(64)}`);
  const password = page.getByLabel("Nova senha", { exact: true });
  await expect(password).toHaveAccessibleDescription(
    "Use de 10 a 128 caracteres.",
  );
  await password.fill("new-password-123");
  await page.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(
    page.getByRole("heading", { name: "Senha atualizada" }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "Entre com sua nova senha.",
  );
  await expect(password).toHaveCount(0);
});

test("an absent reset link offers a fresh recovery request", async ({
  page,
}) => {
  await page.goto("/reset-password");
  await expect(page.locator(".auth-form").getByRole("alert")).toContainText(
    "Solicite um novo",
  );
  await expect(
    page.getByRole("link", { name: "Solicitar novo link" }),
  ).toHaveAttribute("href", "/forgot-password");
  await expect(page.getByLabel("Nova senha", { exact: true })).toHaveCount(0);
});
