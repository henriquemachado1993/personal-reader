import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import ts from "typescript";

test("IndexedDB reuses connections, isolates accounts and keeps snapshot copies", async ({
  page,
}) => {
  await page.route("http://storage.test/**", (route) =>
    route.fulfill({ body: "<!doctype html>" }),
  );
  await page.goto("http://storage.test/");
  await page.addScriptTag({
    content: await readFile("node_modules/idb/build/umd.js", "utf8"),
  });
  const source = ts.transpileModule(
    await readFile("src/infrastructure/storage/local.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  await page.addScriptTag({
    content: `{ const exports = {}; const require = () => window.idb; ${source}; window.storageApi = exports; }`,
  });
  const result = await page.evaluate(async () => {
    const api = (window as any).storageApi;
    const originalOpen = indexedDB.open.bind(indexedDB);
    let opens = 0;
    indexedDB.open = (...args: Parameters<typeof originalOpen>) => {
      opens++;
      return originalOpen(...args);
    };
    api.setStorageScope("first");
    await api.writeState({ documents: [{ title: "original" }] });
    const pendingSnapshot = { documents: [{ title: "snapshot" }] };
    const pending = api.writeState(pendingSnapshot);
    // writeState deliberately takes its copy after the connection is awaited.
    await pending;
    pendingSnapshot.documents[0].title = "mutated";
    await api.saveFile("book", new Blob(["original"]));
    const first = await api.readState();
    const file = await api.readCachedFile("book");
    const firstOpens = opens;
    api.setStorageScope("second");
    const second = await api.readState();
    await api.writeSyncRecord({ revision: 2 });
    api.setStorageScope("first");
    const restored = await api.readState();
    await api.updateLibraryState(
      () => ({ documents: [{ title: "atomic" }] }),
      "first",
      { revision: 3 },
    );
    const atomicState = await api.readState("first");
    const atomicRecord = await api.readSyncRecord("first");
    let cloneFailed = false;
    try {
      await api.updateLibraryState(
        () => ({ documents: [{ title: "must not commit" }] }),
        "first",
        { invalid: () => {} },
      );
    } catch {
      cloneFailed = true;
    }
    const afterFailure = await api.readState("first");
    let applications = 0;
    const edit = () => {
      applications++;
      return { documents: [{ title: "journal" }] };
    };
    const id = `${Date.now()}-1-edit`;
    await api.updateLibraryState(edit, "first", undefined, id);
    await api.updateLibraryState(edit, "first", undefined, id);
    const scopedWrite = api.writeState(
      { documents: [{ title: "scoped" }] },
      "first",
    );
    api.setStorageScope("second");
    await scopedWrite;
    const firstScoped = await api.readState("first");
    return {
      firstOpens,
      opens,
      title: first.documents[0].title,
      restored: restored.documents[0].title,
      empty: second === undefined,
      file: await file.text(),
      atomicTitle: atomicState.documents[0].title,
      applications,
      atomicRevision: atomicRecord.revision,
      cloneFailed,
      afterFailure: afterFailure.documents[0].title,
      firstScoped: firstScoped.documents[0].title,
    };
  });
  expect(result).toEqual({
    firstOpens: 1,
    opens: 2,
    title: "snapshot",
    restored: "snapshot",
    empty: true,
    file: "original",
    atomicTitle: "atomic",
    applications: 1,
    atomicRevision: 3,
    cloneFailed: true,
    afterFailure: "atomic",
    firstScoped: "scoped",
  });
});
