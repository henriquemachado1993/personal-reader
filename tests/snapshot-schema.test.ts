import { test } from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/modules/library/demo";
import { snapshotSchema } from "../src/modules/library/snapshot-schema";
test("remote snapshot validation rejects incomplete documents and invalid preferences", () => {
  assert.equal(snapshotSchema.safeParse(initialState()).success, true);
  assert.equal(
    snapshotSchema.safeParse({
      ...initialState(),
      documents: [{ id: "broken" }],
    }).success,
    false,
  );
  const invalid = initialState();
  invalid.preferences.fontSize = -1;
  assert.equal(snapshotSchema.safeParse(invalid).success, false);
});
