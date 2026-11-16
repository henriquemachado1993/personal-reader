import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

test("favicon contains valid variants of the app mark for browser tabs", async () => {
  const favicon = await readFile("src/app/favicon.ico");
  const svg = await readFile("src/app/icon.svg");
  assert.equal(favicon.readUInt16LE(0), 0);
  assert.equal(favicon.readUInt16LE(2), 1);
  assert.equal(favicon.readUInt16LE(4), 3);
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16;
    assert.equal(favicon[entry], size);
    assert.equal(favicon[entry + 1], size);
    const length = favicon.readUInt32LE(entry + 8);
    const offset = favicon.readUInt32LE(entry + 12);
    assert.ok(offset >= 54 && offset + length <= favicon.length);
    const embedded = favicon.subarray(offset, offset + length);
    assert.deepEqual(
      await sharp(embedded).raw().toBuffer(),
      await sharp(svg).resize(size, size).raw().toBuffer(),
    );
  }
});
