import { test, expect } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { initialState } from "../library-fixture";

test("remote snapshots enforce revisions, idempotency, ownership and restore across browsers", async ({
  browser,
  request,
}) => {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const ownerId = crypto.randomUUID();
  const name = "authjs.session-token";
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: name,
    token: { id: ownerId, sub: ownerId, name: "Sync QA" },
  });
  const headers = {
    Cookie: `${name}=${token}`,
    Origin: "http://127.0.0.1:3000",
  };
  const snapshot = initialState();
  snapshot.documents[0].title = "Livro sincronizado";
  const payload = { revision: 0, operationId: crypto.randomUUID(), snapshot };
  const first = await request.put("/api/library", { headers, data: payload });
  expect(first.status()).toBe(200);
  const repeated = await request.put("/api/library", {
    headers,
    data: payload,
  });
  expect((await repeated.json()).revision).toBe(1);
  const stale = await request.put("/api/library", {
    headers,
    data: { ...payload, operationId: crypto.randomUUID() },
  });
  expect(stale.status()).toBe(409);
  expect((await request.get("/api/library")).status()).toBe(401);
  const fileId = crypto.randomUUID();
  const bytes = Buffer.from("Original privado de teste");
  const uploaded = await request.put(`/api/library/files/${fileId}`, {
    headers,
    data: bytes,
  });
  expect(uploaded.status()).toBe(204);
  const downloaded = await request.get(`/api/library/files/${fileId}`, {
    headers,
  });
  expect(await downloaded.body()).toEqual(bytes);
  expect((await request.get(`/api/library/files/${fileId}`)).status()).toBe(
    401,
  );
  expect(
    (
      await request.put("/api/library", {
        headers: { ...headers, Origin: "https://evil.test" },
        data: payload,
      })
    ).status(),
  ).toBe(403);
  const context = await browser.newContext();
  await context.addCookies([
    { name, value: token, url: "http://127.0.0.1:3000", httpOnly: true },
  ]);
  const page = await context.newPage();
  await page.goto("/library");
  await expect(
    page.getByRole("link", { name: "Livro sincronizado", exact: true }),
  ).toBeVisible();
  await page.goto("/knowledge");
  await context.setOffline(true);
  await page.getByRole("button", { name: "Nova anotação" }).click();
  await page
    .getByLabel("Sua anotação", { exact: true })
    .fill("Ideia criada sem rede");
  await page.getByRole("button", { name: "Salvar anotação" }).click();
  await expect(page.locator(".knowledge-entry")).toContainText(
    "Ideia criada sem rede",
  );
  await context.setOffline(false);
  await page.goto("/settings");
  await page.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect
    .poll(async () => {
      const saved = await request.get("/api/library", { headers });
      const replica = await saved.json();
      return replica.snapshot.annotations.some(
        (note: { text: string }) => note.text === "Ideia criada sem rede",
      );
    })
    .toBe(true);
  await expect(
    page.getByText("Biblioteca sincronizada.", { exact: true }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  const current = await (await request.get("/api/library", { headers })).json();
  current.snapshot.preferences.theme = "system";
  expect(
    (
      await request.put("/api/library", {
        headers,
        data: {
          revision: current.revision,
          operationId: crypto.randomUUID(),
          snapshot: current.snapshot,
        },
      })
    ).status(),
  ).toBe(200);
  await context.setOffline(false);
  await page.getByRole("button", { name: "Sincronizar agora" }).click();
  await expect(page.getByText(/Conflito de sincronização/)).toBeVisible();
  const backup = page.waitForEvent("download");
  await page.getByRole("button", { name: "Manter esta versão" }).click();
  expect((await backup).suggestedFilename()).toBe(
    "personal-reader-backup.json",
  );
  await expect
    .poll(async () => {
      const saved = await (
        await request.get("/api/library", { headers })
      ).json();
      return saved.snapshot.preferences.theme;
    })
    .toBe("dark");
  await context.close();
});
