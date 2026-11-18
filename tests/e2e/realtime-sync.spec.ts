import { RealtimeClient } from "@supabase/realtime-js";
import { jwtVerify } from "jose";
import type { WebSocketRoute } from "@playwright/test";
import { test, expect } from "./library-sync-fixture";
import { initialState } from "../../src/modules/library/initial-state";

test.skip(
  !process.env.TEST_DATABASE_URL,
  "Requer um banco de teste descartável",
);

test("a private Realtime notice fetches only the missing revision, and duplicate notices are ignored", async ({
  createAccount,
  browser,
}) => {
  test.skip(
    !process.env.TEST_REALTIME,
    "Requer a configuração de Realtime local",
  );
  const account = await createAccount();
  const context = await account.browser(browser);
  let socket: WebSocketRoute | undefined;
  let authorization: string | undefined;
  let privateChannel = false;
  await context.routeWebSocket(/\/realtime\/v1\/websocket/, (connection) => {
    connection.onMessage((message) => {
      if (typeof message !== "string") return;
      const [join, ref, topic, event, payload] = JSON.parse(message);
      if (event === "phx_join") {
        expect(topic).toBe(`realtime:library:${account.id}`);
        authorization = payload.access_token;
        privateChannel = payload.config.private;
        socket = connection;
      }
      if (event === "phx_join" || event === "heartbeat")
        connection.send(
          JSON.stringify([
            join,
            ref,
            topic,
            "phx_reply",
            { status: "ok", response: {} },
          ]),
        );
    });
  });
  try {
    const page = await context.newPage();
    await page.goto("/collections");
    await expect.poll(() => authorization).toBeTruthy();
    expect(privateChannel).toBe(true);
    const claims = await jwtVerify(
      authorization!,
      new TextEncoder().encode(process.env.SUPABASE_REALTIME_LOCAL_JWT_SECRET!),
    );
    expect(claims.payload).toMatchObject({
      sub: account.id,
      role: "authenticated",
      reader_realtime: true,
    });
    expect(claims.payload.exp! - claims.payload.iat!).toBe(600);
    const pulls: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/library/sync") pulls.push(url.search);
    });
    const changed = await account.write({
      baseRevision: 0,
      operationId: crypto.randomUUID(),
      changes: [
        {
          kind: "collections",
          id: "shared",
          value: { id: "shared", name: "Coleção ao vivo", color: "#456789" },
        },
      ],
    });
    expect(changed.status()).toBe(200);
    const notice = JSON.stringify([
      null,
      null,
      `realtime:library:${account.id}`,
      "broadcast",
      { type: "broadcast", event: "revision", payload: { revision: 1 } },
    ]);
    socket!.send(notice);
    await expect(
      page.getByText("Coleção ao vivo", { exact: true }),
    ).toBeVisible();
    expect(pulls.filter((query) => query === "?since=0")).toHaveLength(1);
    await page.clock.install();
    const previous = pulls.length;
    socket!.send(notice);
    await page.clock.runFor(400);
    expect(pulls).toHaveLength(previous);
  } finally {
    await context.close();
  }
});

test("Postgres publishes revisions after commits and permits only the matching channel", async ({
  createAccount,
  libraryDb,
}) => {
  test.skip(!process.env.TEST_REALTIME, "Requer Supabase Realtime ativo");
  const owner = await createAccount();
  const observer = await createAccount();
  await owner.seed({
    ...initialState(),
    collections: [{ id: "first", name: "Primeira", color: "#333333" }],
  });
  const readMessages = (subject: string, claim: boolean) =>
    libraryDb.$transaction(async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
      await tx.$queryRaw`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: subject, reader_realtime: claim })}, true)`;
      await tx.$queryRaw`SELECT set_config('realtime.topic', ${`library:${owner.id}`}, true)`;
      return tx.$queryRaw<
        Array<{ payload: unknown }>
      >`SELECT payload - 'id' AS payload FROM realtime.messages WHERE topic = ${`library:${owner.id}`}`;
    });
  expect(await readMessages(owner.id, true)).toEqual([
    { payload: { revision: 1 } },
  ]);
  expect(await readMessages(owner.id, false)).toEqual([]);
  expect(await readMessages(observer.id, true)).toEqual([]);
});

test("official Realtime rejects subscriptions to another account's private channel", async ({
  createAccount,
  request,
}) => {
  test.skip(!process.env.TEST_REALTIME, "Requer Supabase Realtime ativo");
  const owner = await createAccount();
  const other = await createAccount();
  const response = await request.post("/api/library/realtime", {
    headers: owner.headers,
  });
  expect(response.status()).toBe(200);
  const { token } = await response.json();
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apikey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const realtime = new RealtimeClient(`${endpoint}/realtime/v1`, {
    params: { apikey },
    accessToken: async () => token,
  });
  try {
    await realtime.setAuth();
    const join = (id: string) =>
      new Promise<string>((resolve) =>
        realtime
          .channel(`library:${id}`, { config: { private: true } })
          .on("broadcast", { event: "revision" }, () => {})
          .subscribe(resolve),
      );
    await expect(join(owner.id)).resolves.toBe("SUBSCRIBED");
    await expect(join(other.id)).resolves.toBe("CHANNEL_ERROR");
  } finally {
    realtime.disconnect();
    void realtime.removeAllChannels();
  }
});
