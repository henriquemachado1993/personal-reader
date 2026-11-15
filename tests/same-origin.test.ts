import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "../src/modules/auth/same-origin";
test("origin validation respects request host and rejects cross-site writes", () => {
  assert.equal(
    isSameOrigin(
      new Request("http://localhost:3000/api/library", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
    true,
  );
  assert.equal(
    isSameOrigin(
      new Request("https://reader.test/api/library", {
        headers: { host: "reader.test", origin: "https://evil.test" },
      }),
    ),
    false,
  );
});
