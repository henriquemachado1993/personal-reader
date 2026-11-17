import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fitImagePoints,
  moveAnnotationPoints,
  resizeAnnotationPoints,
  wrapAnnotationText,
} from "../src/modules/reader/annotation-objects";
import { snapshotSchema } from "../src/modules/library/snapshot-schema";
import { initialState } from "./reader-fixture";

test("text size survives snapshot validation used by backup and synchronization", () => {
  const snapshot = initialState();
  snapshot.annotations = [
    {
      id: "text",
      documentId: snapshot.documents[0].id,
      kind: "text",
      page: 0,
      location: { type: "PDF", pageIndex: 0 },
      text: "Texto",
      color: "#3e3830",
      fontSize: 28.5,
      createdAt: "2026-11-17T12:00:00.000Z",
      updatedAt: "2026-11-17T12:00:00.000Z",
    },
  ];
  assert.equal(snapshotSchema.parse(snapshot).annotations[0].fontSize, 28.5);
});

test("a tap inserts an image with its original aspect ratio within the page", () => {
  for (const aspect of [0.25, 1, 3, 100]) {
    const [first, last] = fitImagePoints(
      { x: 0.95, y: 0.95 },
      { x: 0.95, y: 0.95 },
      aspect,
      600,
      800,
    );
    assert.ok(
      Math.abs(
        ((last.x - first.x) * 600) / ((last.y - first.y) * 800) - aspect,
      ) < 0.0001,
    );
    assert.ok(first.x >= 0 && first.y >= 0 && last.x <= 1 && last.y <= 1);
  }
});
test("drag placement fits the image inside the requested box without stretching", () => {
  const [first, last] = fitImagePoints(
    { x: 0.7, y: 0.7 },
    { x: 0.1, y: 0.1 },
    2,
    600,
    800,
  );
  assert.equal(first.x, 0.1);
  assert.equal(first.y, 0.1);
  assert.ok(last.x <= 0.7 && last.y <= 0.7);
  assert.ok(
    Math.abs(((last.x - first.x) * 600) / ((last.y - first.y) * 800) - 2) <
      0.0001,
  );
});
test("moving and resizing an image at the page edge preserves its proportions", () => {
  const points = [
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.4 },
  ];
  const moved = moveAnnotationPoints(points, 2, 2);
  assert.ok(Math.abs(moved[1].x - moved[0].x - 0.4) < 0.0001);
  assert.ok(Math.abs(moved[1].y - moved[0].y - 0.2) < 0.0001);
  assert.equal(moved[1].x, 1);
  const resized = resizeAnnotationPoints(points, { x: 0.9, y: 1 }, 600, 800);
  assert.ok(
    Math.abs(
      (resized[1].x - resized[0].x) / (resized[1].y - resized[0].y) - 2,
    ) < 0.0001,
  );
});
test("text wrapping keeps paragraphs, Unicode characters and long words intact", () => {
  const measure = (text: string) => Array.from(text).length;
  assert.deepEqual(wrapAnnotationText("Olá mundo\n📚 teste", 9, measure), [
    "Olá mundo",
    "📚 teste",
  ]);
  assert.deepEqual(wrapAnnotationText("abcdefghijk", 4, measure), [
    "abcd",
    "efgh",
    "ijk",
  ]);
  assert.deepEqual(wrapAnnotationText("primeira\n\núltima", 20, measure), [
    "primeira",
    "",
    "última",
  ]);
});
