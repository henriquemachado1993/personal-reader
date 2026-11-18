import { test, expect, testBook } from "./library-sync-fixture";
import { initialState } from "../../src/modules/library/initial-state";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requer um banco de teste descartável",
);

test("idle views issue no periodic library requests", async ({
  browser,
  createAccount,
}) => {
  const account = await createAccount();
  await account.seed({
    ...initialState(),
    documents: [{ ...testBook("PDF"), demo: true }],
  });
  const context = await account.browser(browser);
  try {
    const page = await context.newPage();
    await page.goto("/settings");
    await expect(
      page.getByText("Biblioteca sincronizada.", { exact: true }),
    ).toBeVisible();
    await page.clock.install();
    let count = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/api/library/sync") count++;
    });
    await page.clock.runFor(32_000);
    expect(count).toBe(0);
  } finally {
    await context.close();
  }
});

test("a note created offline reaches a second open device and a missed notification is recovered on reconnect", async ({
  browser,
  createAccount,
}) => {
  const account = await createAccount();
  await account.seed({
    ...initialState(),
    documents: [{ ...testBook("PDF"), demo: true }],
  });
  const local = await account.browser(browser);
  const remote = await account.browser(browser);
  try {
    const a = await local.newPage();
    const b = await remote.newPage();
    await Promise.all([a.goto("/knowledge"), b.goto("/knowledge")]);
    await expect(
      a.getByRole("button", { name: "Nova anotação" }),
    ).toBeEnabled();
    await expect(
      b.getByRole("button", { name: "Nova anotação" }),
    ).toBeEnabled();
    await local.setOffline(true);
    await a.getByRole("button", { name: "Nova anotação" }).click();
    await a.getByLabel("Sua anotação", { exact: true }).fill("Criada offline");
    await a.getByRole("button", { name: "Salvar anotação" }).click();
    await expect(a.locator(".knowledge-entry")).toContainText("Criada offline");
    expect((await account.state()).annotations).toEqual([]);
    await local.setOffline(false);
    await expect
      .poll(async () =>
        (await account.state()).annotations.map((note) => note.text),
      )
      .toEqual(["Criada offline"]);
    if (!process.env.TEST_REALTIME)
      await b.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(b.locator(".knowledge-entry")).toContainText("Criada offline");

    await remote.setOffline(true);
    await a.getByRole("button", { name: "Remover anotação" }).click();
    await expect
      .poll(async () => (await account.state()).annotations)
      .toEqual([]);
    await remote.setOffline(false);
    await expect(b.locator(".knowledge-entry")).toHaveCount(0);
  } finally {
    await local.close();
    await remote.close();
  }
});

test("a stale edit can be reconciled manually while retaining a portable backup", async ({
  browser,
  createAccount,
}) => {
  const account = await createAccount();
  await account.seed({
    ...initialState(),
    documents: [{ ...testBook("PDF"), demo: true }],
  });
  const context = await account.browser(browser);
  try {
    const page = await context.newPage();
    await page.goto("/settings");
    await expect(
      page.getByText("Biblioteca sincronizada.", { exact: true }),
    ).toBeVisible();
    await context.setOffline(true);
    await page.getByRole("button", { name: "Escuro", exact: true }).click();
    const revision = (await account.read()).revision;
    const changed = await account.write({
      operationId: crypto.randomUUID(),
      baseRevision: revision,
      changes: [
        {
          kind: "preferences",
          id: "account",
          value: { ...initialState().preferences, theme: "system" },
        },
      ],
    });
    expect(changed.status()).toBe(200);
    await context.setOffline(false);
    await expect(page.getByText(/Conflito de sincronização/)).toBeVisible();
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Manter deste dispositivo" })
      .click();
    expect((await download).suggestedFilename()).toBe(
      "personal-reader-backup.json",
    );
    await expect
      .poll(async () => (await account.state()).preferences.theme)
      .toBe("dark");
  } finally {
    await context.close();
  }
});

test("passive reading time stays local and rides the next position write", async ({
  browser,
  createAccount,
}) => {
  const account = await createAccount();
  const book = { ...testBook("PDF"), demo: true };
  await account.seed({ ...initialState(), documents: [book] });
  const context = await account.browser(browser);
  try {
    const page = await context.newPage();
    await page.clock.install();
    await page.goto(`/reader/${book.id}`);
    await expect
      .poll(async () => (await account.state()).documents[0].status)
      .toBe("reading");
    let writes = 0;
    page.on("request", (request) => {
      if (
        new URL(request.url()).pathname === "/api/library/sync" &&
        request.method() === "POST"
      )
        writes++;
    });
    await page.clock.runFor(25_000);
    expect(writes).toBe(0);
    expect((await account.state()).readingSeconds).toBe(0);
    const field = page.getByRole("spinbutton", { name: "Número da página" });
    await field.fill("2");
    await field.blur();
    await page.clock.runFor(1000);
    await expect
      .poll(async () => (await account.state()).readingSeconds)
      .toBeGreaterThanOrEqual(20);
    expect((await account.state()).documents[0].page).toBe(1);
    expect(writes).toBe(1);
  } finally {
    await context.close();
  }
});
