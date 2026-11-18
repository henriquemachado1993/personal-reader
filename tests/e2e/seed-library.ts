import type { BrowserContext } from "@playwright/test";
import { initialState } from "../reader-fixture";

// Legacy reader scenarios use explicit fixtures, never production seed data.
export async function seedReaderLibrary(
  context: BrowserContext,
  snapshot = initialState(),
  revision?: number,
) {
  await context.addInitScript(
    ({ snapshot, revision }) => {
      const request = indexedDB.open(
        "personal-reader-00000000-0000-4000-8000-000000000001",
        1,
      );
      request.onupgradeneeded = () => {
        request.result.createObjectStore("state");
        request.result.createObjectStore("files");
      };
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction("state", "readwrite");
        const store = transaction.objectStore("state");
        const existing = store.get("library");
        existing.onsuccess = () => {
          if (!existing.result) {
            store.put(snapshot, "library");
            if (revision !== undefined)
              store.put(
                {
                  revision,
                  base: snapshot,
                  deleted: { documents: [], collections: [] },
                  uploaded: snapshot.documents.map((book) => book.id),
                },
                "sync",
              );
          }
        };
        transaction.oncomplete = () => database.close();
      };
    },
    { snapshot, revision },
  );
}
