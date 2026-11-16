import {
  test,
  expect,
  type Browser,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { initialState } from "../library-fixture";
import type { LibraryState } from "../../src/shared/types";

test.setTimeout(90000);

async function syncDevices(
  browser: Browser,
  request: APIRequestContext,
  baseURL: string,
  snapshot: LibraryState,
  original?: Uint8Array,
) {
  const env = dotenv.parse(await readFile(".env", "utf8"));
  const db = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  const ownerId = crypto.randomUUID();
  const origin = new URL(baseURL).origin;
  const token = await encode({
    secret: env.AUTH_SECRET,
    salt: "authjs.session-token",
    token: { id: ownerId, sub: ownerId },
  });
  const headers = { Cookie: `authjs.session-token=${token}`, Origin: origin };
  await db.user.create({
    data: { id: ownerId, email: `${ownerId}@example.test` },
  });
  const saved = await request.put(`${origin}/api/library`, {
    headers,
    data: { revision: 0, operationId: crypto.randomUUID(), snapshot },
  });
  expect(saved.status()).toBe(200);
  const replica = await saved.json();
  const contexts: BrowserContext[] = [];
  const createDevice = async () => {
    const context = await browser.newContext({ serviceWorkers: "block" });
    contexts.push(context);
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: token,
        url: origin,
        httpOnly: true,
      },
    ]);
    await context.addInitScript(
      ({ ownerId, replica, original }) => {
        const request = indexedDB.open(`personal-reader-${ownerId}`, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("state");
          request.result.createObjectStore("files");
        };
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(
            ["state", "files"],
            "readwrite",
          );
          const store = transaction.objectStore("state");
          const existing = store.get("library");
          existing.onsuccess = () => {
            if (existing.result) return;
            store.put(replica.snapshot, "library");
            store.put(
              {
                revision: replica.revision,
                base: replica.snapshot,
                uploaded: replica.snapshot.documents.map(
                  (book: { id: string }) => book.id,
                ),
              },
              "sync",
            );
            if (original)
              transaction
                .objectStore("files")
                .put(
                  new Blob([new Uint8Array(original)]),
                  replica.snapshot.documents[0].id,
                );
          };
          transaction.oncomplete = () => database.close();
        };
      },
      {
        ownerId,
        replica,
        original: original ? Array.from(original) : undefined,
      },
    );
    return context.newPage();
  };
  const remote = async () =>
    (await (await request.get(`${origin}/api/library`, { headers })).json())
      .snapshot as LibraryState;
  const focus = (page: Page) =>
    page.evaluate(() => window.dispatchEvent(new Event("focus")));
  return {
    ownerId,
    headers,
    origin,
    createDevice,
    remote,
    focus,
    close: async () => {
      await Promise.allSettled(
        contexts.map(async (context) => {
          await context.unrouteAll({ behavior: "ignoreErrors" });
          await context.close();
        }),
      );
      await db.libraryEntity.deleteMany({ where: { ownerId } });
      await db.libraryReplica.deleteMany({ where: { ownerId } });
      await db.user.deleteMany({ where: { id: ownerId } });
      await db.$disconnect();
    },
  };
}

function textLibrary(format: "TXT" | "DOCX" | "PDF" = "TXT") {
  const snapshot = initialState();
  snapshot.documents = snapshot.documents.slice(0, 1);
  Object.assign(snapshot.documents[0], {
    format,
    page: 0,
    pages: 4,
    progress: 25,
    content: Array.from(
      { length: 4 },
      (_, i) =>
        `Página ${i + 1}\n\n` +
        "Texto para verificar a continuidade da leitura. ".repeat(120),
    ),
  });
  return snapshot;
}

const pageInput = (page: Page) =>
  page.getByRole("spinbutton", { name: "Número da página" });
async function goToPage(page: Page, number: number) {
  await pageInput(page).fill(String(number));
  await pageInput(page).blur();
  await expect(pageInput(page)).toHaveValue(String(number));
}

for (const format of ["TXT", "DOCX", "PDF"] as const) {
  test(`${format}: another open reader follows forward and backward reading and the last position on exit`, async ({
    browser,
    request,
    baseURL,
  }) => {
    let original: Uint8Array | undefined;
    if (format === "PDF") {
      const pdf = await PDFDocument.create();
      for (let i = 0; i < 4; i++)
        pdf.addPage([600, 800]).drawText(`Pagina ${i + 1}`);
      original = await pdf.save();
    }
    const devices = await syncDevices(
      browser,
      request,
      baseURL!,
      textLibrary(format),
      original,
    );
    try {
      const a = await devices.createDevice(),
        b = await devices.createDevice();
      await a.goto(`${devices.origin}/reader/fixture-0`);
      await b.goto(`${devices.origin}/reader/fixture-0`);
      await expect(pageInput(a)).toHaveValue("1");
      await expect(pageInput(b)).toHaveValue("1");
      if (format === "PDF")
        await expect(a.locator(".pdf-page").first()).toHaveAttribute(
          "aria-busy",
          "false",
        );
      await goToPage(a, 3);
      await expect
        .poll(async () => (await devices.remote()).documents[0].page, {
          timeout: 15000,
        })
        .toBe(2);
      await devices.focus(b);
      await expect(pageInput(b)).toHaveValue("3", { timeout: 15000 });
      await expect(b.locator('[data-reader-page="2"]')).toHaveAttribute(
        "aria-current",
        "page",
      );
      await goToPage(b, 2);
      await expect
        .poll(async () => (await devices.remote()).documents[0].page, {
          timeout: 15000,
        })
        .toBe(1);
      await devices.focus(a);
      await expect(pageInput(a)).toHaveValue("2", { timeout: 15000 });
      await goToPage(a, 4);
      await a.goto("about:blank");
      await expect
        .poll(async () => (await devices.remote()).documents[0].page, {
          timeout: 15000,
        })
        .toBe(3);
      await devices.focus(b);
      await expect(pageInput(b)).toHaveValue("4", { timeout: 15000 });
    } finally {
      await devices.close();
    }
  });
}

test("offline reading resumes synchronization on reconnection", async ({
  browser,
  request,
  baseURL,
}) => {
  const devices = await syncDevices(browser, request, baseURL!, textLibrary());
  try {
    const a = await devices.createDevice(),
      b = await devices.createDevice();
    await a.goto(`${devices.origin}/reader/fixture-0`);
    await b.goto(`${devices.origin}/reader/fixture-0`);
    await expect(pageInput(a)).toHaveValue("1");
    await expect(pageInput(b)).toHaveValue("1");
    await a.context().setOffline(true);
    await goToPage(a, 3);
    await a.waitForTimeout(1000);
    expect((await devices.remote()).documents[0].page).toBe(0);
    await a.context().setOffline(false);
    await expect
      .poll(async () => (await devices.remote()).documents[0].page, {
        timeout: 15000,
      })
      .toBe(2);
    await devices.focus(b);
    await expect(pageInput(b)).toHaveValue("3", { timeout: 15000 });
  } finally {
    await devices.close();
  }
});

test("edits during a network request preserve remote metadata and retry revision races", async ({
  browser,
  request,
  baseURL,
}) => {
  const devices = await syncDevices(browser, request, baseURL!, textLibrary());
  try {
    const a = await devices.createDevice();
    await a.goto(`${devices.origin}/reader/fixture-0`);
    await expect(pageInput(a)).toHaveValue("1");
    // The opening sync can finish while the independent remote edit is prepared.
    let remoteStatus = 409;
    for (let attempt = 0; attempt < 3 && remoteStatus === 409; attempt++) {
      const current = await (
        await request.get(`${devices.origin}/api/library`, {
          headers: devices.headers,
        })
      ).json();
      current.snapshot.documents[0].title = "Título remoto preservado";
      const changed = await request.put(`${devices.origin}/api/library`, {
        headers: devices.headers,
        data: {
          revision: current.revision,
          operationId: crypto.randomUUID(),
          snapshot: current.snapshot,
        },
      });
      remoteStatus = changed.status();
    }
    expect(remoteStatus).toBe(200);
    let release!: () => void;
    const paused = new Promise<void>((resolve) => {
      release = resolve;
    });
    let waiting!: () => void;
    const started = new Promise<void>((resolve) => {
      waiting = resolve;
    });
    let delay = true,
      rejectRevision = true;
    await a.route(
      (url) => url.pathname === "/api/library",
      async (route) => {
        if (route.request().method() === "GET" && delay) {
          delay = false;
          const response = await route.fetch();
          waiting();
          await paused;
          await route.fulfill({ response });
        } else if (route.request().method() === "PUT" && rejectRevision) {
          rejectRevision = false;
          await route.fulfill({ status: 409, json: {} });
        } else await route.continue();
      },
    );
    await devices.focus(a);
    await started;
    await goToPage(a, 3);
    release();
    await expect
      .poll(
        async () => {
          const book = (await devices.remote()).documents[0];
          return { page: book.page, title: book.title };
        },
        { timeout: 15000 },
      )
      .toEqual({ page: 2, title: "Título remoto preservado" });
    await expect(a.locator(".reader-header")).toContainText(
      "Título remoto preservado",
    );
    expect(rejectRevision).toBe(false);
  } finally {
    await devices.close();
  }
});

test("EPUB resumes the saved CFI on an already open device and after reload", async ({
  browser,
  request,
  baseURL,
}) => {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip");
  zip.file(
    "META-INF/container.xml",
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "content.opf",
    '<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="id" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Livro EPUB</dc:title><dc:identifier id="id">sync-regression</dc:identifier><dc:language>pt-BR</dc:language></metadata><manifest>' +
      [0, 1, 2]
        .map(
          (i) =>
            `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`,
        )
        .join("") +
      "</manifest><spine>" +
      [0, 1, 2].map((i) => `<itemref idref="c${i}"/>`).join("") +
      "</spine></package>",
  );
  for (let i = 0; i < 3; i++)
    zip.file(
      `c${i}.xhtml`,
      `<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo</title></head><body><h1>Capítulo ${i + 1}</h1>${"<p>Uma leitura longa para verificar o progresso em todos os dispositivos.</p>".repeat(80)}</body></html>`,
    );
  const snapshot = textLibrary();
  Object.assign(snapshot.documents[0], {
    format: "EPUB",
    pages: 3,
    progress: 0,
    content: undefined,
  });
  const devices = await syncDevices(
    browser,
    request,
    baseURL!,
    snapshot,
    await zip.generateAsync({ type: "uint8array" }),
  );
  try {
    const a = await devices.createDevice(),
      b = await devices.createDevice();
    await a.goto(`${devices.origin}/reader/fixture-0`);
    await b.goto(`${devices.origin}/reader/fixture-0`);
    await expect(
      a.frameLocator("iframe").first().locator("p").first(),
    ).toBeVisible();
    await expect(
      b.frameLocator("iframe").first().locator("p").first(),
    ).toBeVisible();
    await a.getByRole("button", { name: "Buscar no documento" }).click();
    await a.getByLabel("Buscar texto neste documento").fill("Capítulo 2");
    await a.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect
      .poll(
        async () =>
          (await devices.remote()).documents[0].location?.type === "EPUB"
            ? (
                (await devices.remote()).documents[0].location as {
                  href: string;
                }
              ).href
            : "",
        { timeout: 15000 },
      )
      .toBe("c1.xhtml");
    const expected = (await devices.remote()).documents[0];
    await devices.focus(b);
    await expect(b.locator(".reader-page-counter")).toContainText(
      `${expected.progress}%`,
      { timeout: 15000 },
    );
    const visibleChapter = () =>
      b.locator(".epub-page").evaluate((host) => {
        const viewport = host.getBoundingClientRect();
        return Array.from(host.querySelectorAll("iframe")).some((frame) => {
          const bounds = frame.getBoundingClientRect();
          return (
            bounds.top < viewport.bottom &&
            bounds.bottom > viewport.top &&
            frame.contentDocument?.querySelector("h1")?.textContent ===
              "Capítulo 2"
          );
        });
      });
    await expect.poll(visibleChapter, { timeout: 15000 }).toBe(true);
    await b.reload();
    await expect(b.locator(".reader-page-counter")).toContainText(
      `${expected.progress}%`,
      { timeout: 15000 },
    );
    await expect.poll(visibleChapter, { timeout: 15000 }).toBe(true);
    await b.waitForTimeout(1000);
    expect((await devices.remote()).documents[0].readingPositionUpdatedAt).toBe(
      expected.readingPositionUpdatedAt,
    );
  } finally {
    await devices.close();
  }
});

test("a lost response recovers after another device writes and the first browser reloads", async ({
  browser,
  request,
  baseURL,
}) => {
  const devices = await syncDevices(browser, request, baseURL!, textLibrary());
  try {
    const a = await devices.createDevice(),
      b = await devices.createDevice();
    await a.goto(`${devices.origin}/reader/fixture-0`);
    await b.goto(`${devices.origin}/reader/fixture-0`);
    await expect(pageInput(a)).toHaveValue("1");
    await expect(pageInput(b)).toHaveValue("1");
    await expect
      .poll(
        () =>
          a.evaluate(async (ownerId) => {
            const database = await new Promise<IDBDatabase>(
              (resolve, reject) => {
                const request = indexedDB.open(`personal-reader-${ownerId}`, 1);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              },
            );
            const record = await new Promise<any>((resolve) => {
              const request = database
                .transaction("state")
                .objectStore("state")
                .get("sync");
              request.onsuccess = () => resolve(request.result);
            });
            database.close();
            return Boolean(
              record?.base.documents[0].lastReadAt && !record.pending,
            );
          }, devices.ownerId),
        { timeout: 15000 },
      )
      .toBe(true);
    let interrupted = false,
      acceptedOperation = "";
    let allowRecovery = false;
    await a.route(
      (url) => url.pathname === "/api/library",
      async (route) => {
        if (route.request().method() === "PUT" && !interrupted) {
          const response = await route.fetch();
          if (response.status() !== 200) {
            await route.fulfill({ response });
            return;
          }
          interrupted = true;
          acceptedOperation = route.request().postDataJSON().operationId;
          await route.abort("failed");
        } else if (
          route.request().method() === "GET" &&
          interrupted &&
          !allowRecovery
        ) {
          await route.fulfill({ status: 503, json: {} });
        } else await route.continue();
      },
    );
    await goToPage(a, 3);
    await expect.poll(() => acceptedOperation, { timeout: 15000 }).not.toBe("");
    await expect
      .poll(async () => (await devices.remote()).documents[0].page, {
        timeout: 15000,
      })
      .toBe(2);
    await goToPage(b, 2);
    await expect
      .poll(async () => (await devices.remote()).documents[0].page, {
        timeout: 15000,
      })
      .toBe(1);
    const receiptRequested = a.waitForRequest(
      (request) =>
        new URL(request.url()).pathname === "/api/library" &&
        new URL(request.url()).searchParams.get("operationId") ===
          acceptedOperation,
      { timeout: 15000 },
    );
    allowRecovery = true;
    await a.reload();
    await receiptRequested;
    await expect(pageInput(a)).toHaveValue("2", { timeout: 15000 });
    expect((await devices.remote()).documents[0].page).toBe(1);
  } finally {
    await devices.close();
  }
});

for (const preferLocal of [true, false]) {
  test(`conflict resolution ${preferLocal ? "keeps local edits" : "uses the account"} while an automatic sync is in flight`, async ({
    browser,
    request,
    baseURL,
  }) => {
    const devices = await syncDevices(
      browser,
      request,
      baseURL!,
      textLibrary(),
    );
    let release: (() => void) | undefined;
    try {
      const page = await devices.createDevice();
      await page.goto(`${devices.origin}/settings`);
      await expect(
        page.getByText("Biblioteca sincronizada.", { exact: true }),
      ).toBeVisible();
      await page.context().setOffline(true);
      await page.getByRole("button", { name: "Escuro", exact: true }).click();
      const current = await (
        await request.get(`${devices.origin}/api/library`, {
          headers: devices.headers,
        })
      ).json();
      current.snapshot.preferences.theme = "system";
      expect(
        (
          await request.put(`${devices.origin}/api/library`, {
            headers: devices.headers,
            data: {
              revision: current.revision,
              operationId: crypto.randomUUID(),
              snapshot: current.snapshot,
            },
          })
        ).status(),
      ).toBe(200);
      await page.context().setOffline(false);
      await expect(page.getByText(/Conflito de sincronização/)).toBeVisible({
        timeout: 15000,
      });
      const paused = new Promise<void>((resolve) => {
        release = resolve;
      });
      let waiting!: () => void;
      const started = new Promise<void>((resolve) => {
        waiting = resolve;
      });
      let delay = true;
      await page.route(
        (url) => url.pathname === "/api/library",
        async (route) => {
          if (route.request().method() === "GET" && delay) {
            delay = false;
            const response = await route.fetch();
            waiting();
            await paused;
            await route.fulfill({ response });
          } else await route.continue();
        },
      );
      await devices.focus(page);
      await started;
      const backup = page.waitForEvent("download");
      await page
        .getByRole("button", {
          name: preferLocal
            ? "Manter deste dispositivo"
            : "Usar versão da conta",
          exact: true,
        })
        .click();
      expect((await backup).suggestedFilename()).toBe(
        "personal-reader-backup.json",
      );
      release!();
      await expect
        .poll(async () => (await devices.remote()).preferences.theme, {
          timeout: 15000,
        })
        .toBe(preferLocal ? "dark" : "system");
      await expect(
        page.getByText("Biblioteca sincronizada.", { exact: true }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", {
          name: preferLocal ? "Escuro" : "Sistema",
          exact: true,
        }),
      ).toHaveAttribute("aria-pressed", "true");
    } finally {
      release?.();
      await devices.close();
    }
  });
}
