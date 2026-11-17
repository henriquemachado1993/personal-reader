import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import dotenv from "dotenv";
import { readFile } from "node:fs/promises";

test("invite registration locks the intended email, clears the URL and submits the token", async ({
  page,
}) => {
  const token = "a".repeat(64);
  await page.route("**/api/auth/invitation", (route) =>
    route.fulfill({
      json: {
        email: "invited@example.test",
        expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      },
    }),
  );
  let submitted: any;
  await page.route("**/api/auth/register", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      status: 403,
      json: { error: "Este convite expirou. Peça um novo link." },
    });
  });
  await page.goto(`/register#${token}`);
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveValue(
    "invited@example.test",
  );
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveAttribute(
    "readonly",
    "",
  );
  expect(new URL(page.url()).hash).toBe("");
  await page.getByLabel("Seu nome", { exact: true }).fill("Pessoa convidada");
  await page.getByLabel("Senha", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  expect(submitted.inviteToken).toBe(token);
  expect(submitted.email).toBe("invited@example.test");
  await expect(page.locator(".auth-form").getByRole("alert")).toContainText(
    "Peça um novo link",
  );
});
test("registration without a link cannot display the signup form", async ({
  page,
}) => {
  await page.goto("/register");
  await expect(page.locator(".auth-form").getByRole("alert")).toContainText(
    "Abra o link completo",
  );
  await expect(
    page.getByRole("button", { name: "Criar conta", exact: true }),
  ).toHaveCount(0);
});

test("administrator generates and revokes an invitation while normal accounts have no invitation controls", async ({
  browser,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: crypto.randomUUID() },
  });
  const context = await browser.newContext({ serviceWorkers: "block" });
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: token,
      url: "http://127.0.0.1:3000",
      httpOnly: true,
    },
  ]);
  await context.route(
    (url) => url.pathname === "/api/library",
    (route) => route.fulfill({ status: 503, json: {} }),
  );
  let invites: any[] = [];
  const secret = "b".repeat(64);
  await context.route("**/api/admin/invitations", async (route) => {
    const method = route.request().method();
    if (method === "GET")
      await route.fulfill({ json: { invitations: invites } });
    else if (method === "POST") {
      invites = [
        {
          id: crypto.randomUUID(),
          email: route.request().postDataJSON().email,
          expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
          usedAt: null,
          revokedAt: null,
        },
      ];
      await route.fulfill({
        status: 201,
        json: { invitation: invites[0], token: secret },
      });
    } else {
      invites[0].revokedAt = new Date().toISOString();
      await route.fulfill({ status: 204 });
    }
  });
  try {
    const page = await context.newPage();
    await page.goto("/settings");
    await page
      .getByLabel("E-mail da pessoa convidada", { exact: true })
      .fill("invited@example.test");
    await page
      .getByRole("button", { name: "Gerar convite", exact: true })
      .click();
    await expect(
      page.getByLabel("Link do convite", { exact: true }),
    ).toHaveValue(`http://127.0.0.1:3000/register#${secret}`);
    await page.getByRole("button", { name: "Revogar", exact: true }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Convite revogado." }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Link do convite", { exact: true }),
    ).toHaveCount(0);
    await context.unroute("**/api/admin/invitations");
    await context.route("**/api/admin/invitations", (route) =>
      route.fulfill({ status: 403 }),
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Configurações", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Convites", exact: true }),
    ).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("invitation administration rejects unauthenticated and non-owner requests at the API", async ({
  request,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: crypto.randomUUID(), role: "admin" },
  });
  for (const headers of [
    {},
    {
      Cookie: `authjs.session-token=${token}`,
      Origin: "http://127.0.0.1:3000",
    },
  ] as Record<string, string>[]) {
    expect(
      (await request.get("/api/admin/invitations", { headers })).status(),
    ).toBe(403);
    expect(
      (
        await request.post("/api/admin/invitations", {
          headers,
          data: { email: "test@example.test" },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await request.delete("/api/admin/invitations", {
          headers,
          data: { id: crypto.randomUUID() },
        })
      ).status(),
    ).toBe(403);
  }
  expect(
    (
      await request.post("/api/auth/register", {
        headers: { Origin: "https://evil.test" },
        data: {
          name: "Test",
          email: "test@example.test",
          password: "safe-password-123",
        },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/auth/invitation", {
        headers: { Origin: "http://127.0.0.1:3000" },
        data: { token: "invalid" },
      })
    ).status(),
  ).toBe(400);
});

test("a failed automatic login after signup does not consume the invitation again", async ({
  page,
}) => {
  const token = "c".repeat(64);
  let registrations = 0;
  await page.route("**/api/auth/invitation", (route) =>
    route.fulfill({ json: { email: "invited@example.test" } }),
  );
  await page.route("**/api/auth/register", (route) => {
    registrations++;
    return route.fulfill({ status: 201, json: { ok: true } });
  });
  await page.route("**/api/auth/providers", (route) =>
    route.fulfill({
      json: {
        credentials: {
          id: "credentials",
          name: "Credentials",
          type: "credentials",
          signinUrl: "http://127.0.0.1:3000/api/auth/signin/credentials",
          callbackUrl: "http://127.0.0.1:3000/api/auth/callback/credentials",
        },
      },
    }),
  );
  await page.route("**/api/auth/csrf", (route) =>
    route.fulfill({ json: { csrfToken: "test" } }),
  );
  await page.route("**/api/auth/callback/credentials", (route) =>
    route.fulfill({
      json: { url: "http://127.0.0.1:3000/login?error=CredentialsSignin" },
    }),
  );
  await page.goto(`/register#${token}`);
  await page.getByLabel("Seu nome", { exact: true }).fill("Pessoa convidada");
  await page.getByLabel("Senha", { exact: true }).fill("safe-password-123");
  await page.getByRole("button", { name: "Criar conta", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.locator(".auth-form").getByRole("alert")).toBeVisible();
  expect(registrations).toBe(1);
});
