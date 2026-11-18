import {
  test as base,
  expect,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";
import { readFile } from "node:fs/promises";
import dotenv from "dotenv";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fileKey } from "../../src/infrastructure/r2/file-key";
import { initialState } from "../../src/modules/library/initial-state";
import {
  applyDelta,
  diffLibrary,
  noDeletions,
  type LibraryDelta,
  type SyncBatch,
} from "../../src/modules/library/sync-protocol";
import type { LibraryState } from "../../src/shared/types";

const sessionCookie = "authjs.session-token";

class TestAccount {
  constructor(
    readonly id: string,
    readonly token: string,
    readonly origin: string,
    readonly request: APIRequestContext,
    readonly files = new Set<string>(),
  ) {}

  get headers() {
    return { Cookie: `${sessionCookie}=${this.token}`, Origin: this.origin };
  }

  async browser(browser: Browser) {
    const context = await browser.newContext({ serviceWorkers: "block" });
    await context.addCookies([
      {
        name: sessionCookie,
        value: this.token,
        url: this.origin,
        httpOnly: true,
      },
    ]);
    return context;
  }

  async read(since?: number): Promise<LibraryDelta> {
    const response = await this.request.get(
      since === undefined
        ? "/api/library/sync"
        : `/api/library/sync?since=${since}`,
      { headers: this.headers },
    );
    expect(response.status()).toBe(200);
    return response.json();
  }

  async state() {
    const delta = await this.read();
    return applyDelta(initialState(), noDeletions(), delta.changes).state;
  }

  write(batch: SyncBatch) {
    return this.request.post("/api/library/sync", {
      headers: this.headers,
      data: batch,
    });
  }

  async seed(snapshot: LibraryState) {
    const response = await this.write({
      ...diffLibrary(initialState(), snapshot),
      operationId: crypto.randomUUID(),
      baseRevision: 0,
    });
    expect(response.status(), await response.text()).toBe(200);
  }

  async upload(id: string, bytes: Buffer, type: string) {
    const authorized = await this.request.post(`/api/library/files/${id}`, {
      headers: this.headers,
      data: { size: bytes.length, type },
    });
    expect(authorized.status(), await authorized.text()).toBe(200);
    const { url, exists } = await authorized.json();
    this.files.add(id);
    if (exists) return;
    const uploaded = await this.request.put(url, {
      headers: { "Content-Type": type, "If-None-Match": "*" },
      data: bytes,
    });
    expect(uploaded.ok(), await uploaded.text()).toBe(true);
  }
}

export const test = base.extend<{
  libraryDb: PrismaClient;
  createAccount: () => Promise<TestAccount>;
}>({
  libraryDb: async ({}, use) => {
    const databaseUrl = process.env.TEST_DATABASE_URL;
    if (!databaseUrl)
      throw new Error(
        "Configure TEST_DATABASE_URL para um banco de teste descartável.",
      );
    const db = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      await use(db);
    } finally {
      await db.$disconnect();
    }
  },
  createAccount: async ({ request, baseURL, libraryDb }, use) => {
    const env = {
      ...dotenv.parse(await readFile(".env", "utf8").catch(() => "")),
      ...process.env,
    };
    if (!env.AUTH_SECRET)
      throw new Error(
        "AUTH_SECRET deve ser igual no servidor de teste e no Playwright.",
      );
    const accounts: TestAccount[] = [];
    await use(async () => {
      const id = crypto.randomUUID();
      const token = await encode({
        secret: env.AUTH_SECRET!,
        salt: sessionCookie,
        token: { id, sub: id, name: "QA" },
      });
      const account = new TestAccount(
        id,
        token,
        new URL(baseURL!).origin,
        request,
      );
      await libraryDb.user.create({
        data: { id, email: `${id}@example.test` },
      });
      accounts.push(account);
      return account;
    });
    for (const account of accounts) {
      if (account.files.size && env.TEST_R2) {
        const s3 = new S3Client({
          region: "auto",
          endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: env.R2_ACCESS_KEY_ID!,
            secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
          },
        });
        try {
          for (const id of account.files)
            await s3.send(
              new DeleteObjectCommand({
                Bucket: env.R2_BUCKET_NAME,
                Key: fileKey(account.id, id),
              }),
            );
        } finally {
          s3.destroy();
        }
      }
      await libraryDb.storageDeletion.deleteMany({
        where: { ownerId: account.id },
      });
      await libraryDb.user.deleteMany({ where: { id: account.id } });
    }
  },
});
export { expect };

export function testBook(format: "TXT" | "DOCX" | "PDF" | "EPUB" = "TXT") {
  return {
    id: crypto.randomUUID(),
    title: "Livro de teste",
    author: "Autoria de teste",
    format,
    cover: "",
    color: "#334455",
    status: "want" as const,
    page: 0,
    progress: 0,
    pages: 4,
    collections: [],
    addedAt: new Date().toISOString(),
    size: 200,
  };
}
