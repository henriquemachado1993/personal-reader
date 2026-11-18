import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { seedReaderLibrary } from "./seed-library";
test.use({ serviceWorkers: "block" });
test.beforeEach(async ({ context }) => {
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
  await context.route(/\/api\/library\/sync(?:\?.*)?$/, (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
});

for (const width of [1440, 393]) {
  test(`invitations keep creation, sharing and history clear (${width}px)`, async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1100 });
    const future = new Date(Date.now() + 48 * 3600000).toISOString();
    const past = new Date(Date.now() - 48 * 3600000).toISOString();
    let invitations = [
      {
        id: "pending",
        email:
          "um-email-muito-longo-para-conferir-a-quebra-do-conteudo@exemplo-de-dominio-longo.com",
        expiresAt: future,
        usedAt: null as string | null,
        revokedAt: null as string | null,
      },
      {
        id: "used",
        email: "used@example.test",
        expiresAt: future,
        usedAt: past,
        revokedAt: null,
      },
      {
        id: "expired",
        email: "expired@example.test",
        expiresAt: past,
        usedAt: null,
        revokedAt: null,
      },
      {
        id: "revoked",
        email: "revoked@example.test",
        expiresAt: future,
        usedAt: null,
        revokedAt: past,
      },
    ];
    let rejectCreation = false;
    let rejectRefresh = false;
    let copied = "";
    await page.exposeFunction("recordInvitationCopy", (value: string) => {
      copied = value;
    });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (value: string) => {
            if (
              (window as unknown as { rejectInvitationCopy?: boolean })
                .rejectInvitationCopy
            )
              throw new Error("Clipboard unavailable");
            await (
              window as unknown as {
                recordInvitationCopy: (value: string) => Promise<void>;
              }
            ).recordInvitationCopy(value);
          },
        },
      }),
    );
    await context.route("**/api/admin/invitations", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill(
          rejectRefresh ? { status: 503, json: {} } : { json: { invitations } },
        );
        return;
      }
      if (method === "POST") {
        if (rejectCreation) {
          await route.fulfill({
            status: 409,
            json: { error: "Este e-mail já tem uma conta." },
          });
          return;
        }
        const invitation = {
          id: "created",
          email: route.request().postDataJSON().email,
          expiresAt: future,
          usedAt: null,
          revokedAt: null,
        };
        invitations = [invitation, ...invitations];
        await route.fulfill({
          status: 201,
          json: { invitation, token: "a".repeat(64) },
        });
        return;
      }
      const { id } = route.request().postDataJSON();
      invitations = invitations.map((invite) =>
        invite.id === id
          ? { ...invite, revokedAt: new Date().toISOString() }
          : invite,
      );
      await route.fulfill({ status: 204 });
    });
    await page.goto("/settings");
    const section = page.getByRole("region", { name: "Convites", exact: true });
    await expect(
      section.getByRole("heading", { name: /Convites pendentes/ }),
    ).toBeVisible();
    await expect(
      section.locator(".invitation-management > .invitation-list li"),
    ).toHaveCount(1);
    const history = section.locator(".invitation-history");
    await expect(history).not.toHaveAttribute("open", "");
    await section.getByText("Histórico de convites", { exact: false }).click();
    await expect(history.locator("li")).toHaveCount(3);
    for (const state of ["Utilizado", "Expirado", "Revogado"])
      await expect(history.getByText(state, { exact: true })).toBeVisible();
    await section.getByText("Histórico de convites", { exact: false }).click();
    await section.evaluate((element) =>
      element.scrollIntoView({ block: "start" }),
    );
    await page.screenshot({
      path: testInfo.outputPath(`invitations-${width}.png`),
      animations: "disabled",
    });
    expect(
      await section.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    const generate = section.getByRole("button", {
      name: "Gerar convite",
      exact: true,
    });
    await expect(generate).toBeDisabled();
    await section
      .getByLabel("E-mail da pessoa convidada")
      .fill("new@example.test");
    rejectRefresh = true;
    await generate.click();
    const link = section.getByLabel("Link do convite", { exact: true });
    await expect(link).toHaveValue(
      `http://127.0.0.1:3000/register#${"a".repeat(64)}`,
    );
    await expect(section.getByRole("alert")).toContainText("atualizar a lista");
    rejectRefresh = false;
    await section.getByRole("button", { name: "Tentar novamente" }).click();
    await expect(section.getByRole("alert")).toHaveCount(0);
    await section
      .getByRole("button", { name: "Copiar link", exact: true })
      .click();
    await expect.poll(() => copied).toBe(await link.inputValue());
    await expect(section.getByRole("status")).toHaveText("Link copiado.");
    await section.locator(".invitation-link").screenshot({
      path: testInfo.outputPath(`sharing-${width}.png`),
      animations: "disabled",
    });
    await page.evaluate(() => {
      (
        window as unknown as { rejectInvitationCopy?: boolean }
      ).rejectInvitationCopy = true;
    });
    await section.getByRole("button", { name: "Copiado", exact: true }).click();
    await expect(section.getByRole("status")).toHaveText(
      "Selecione e copie o link no campo acima.",
    );
    await expect(link).toBeFocused();
    expect(
      await link.evaluate(
        (input: HTMLInputElement) =>
          input.selectionStart === 0 &&
          input.selectionEnd === input.value.length,
      ),
    ).toBe(true);
    rejectCreation = true;
    await section
      .getByLabel("E-mail da pessoa convidada")
      .fill("existing@example.test");
    await generate.click();
    await expect(section.getByRole("alert")).toHaveText(
      "Este e-mail já tem uma conta.",
    );
    await expect(link).toBeVisible();
    await section
      .getByRole("button", {
        name: "Revogar convite para new@example.test",
        exact: true,
      })
      .click();
    await expect(link).toHaveCount(0);
    await expect(section.getByRole("status")).toHaveText("Convite revogado.");
  });
}

test("invitation list failure can be retried into the empty state", async ({
  page,
  context,
}) => {
  let unavailable = true;
  await context.route("**/api/admin/invitations", (route) =>
    route.fulfill(
      unavailable ? { status: 503, json: {} } : { json: { invitations: [] } },
    ),
  );
  await page.goto("/settings");
  const section = page.getByRole("region", { name: "Convites", exact: true });
  await expect(section.getByRole("alert")).toHaveText(
    "Não foi possível carregar os convites.",
  );
  unavailable = false;
  await section.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(section.getByText("Nenhum convite pendente.")).toBeVisible();
  await expect(section.getByRole("alert")).toHaveCount(0);
  await expect(section.locator(".invitation-history")).toHaveCount(0);
});
