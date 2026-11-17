import { test } from "node:test";
import assert from "node:assert/strict";
import {
  annotationBounds,
  glyphIsMarked,
  annotationLabels,
} from "../src/modules/reader/annotation-context";
import { annotationPreviewCrop } from "../src/modules/reader/annotation-preview";

test("previews stay within the page and their pixel budget without upscaling", () => {
  const crop = annotationPreviewCrop(
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    2000,
    3000,
  )!;
  assert.equal(crop.x, 0);
  assert.equal(crop.y, 0);
  assert.ok(crop.width * crop.scale <= 480);
  assert.ok(crop.height * crop.scale <= 240);
  const word = annotationPreviewCrop(
    [
      { x: 0.1, y: 0.2 },
      { x: 0.15, y: 0.21 },
    ],
    600,
    800,
  )!;
  assert.equal(word.scale, 1);
  assert.equal(annotationPreviewCrop([], 600, 800), null);
});

test("highlight regions use the glyph center and do not include adjacent words or lines", () => {
  const points = [
    { x: 0.2, y: 0.3 },
    { x: 0.4, y: 0.35 },
  ];
  assert.equal(
    glyphIsMarked(
      { x: 0.25, y: 0.31, width: 0.02, height: 0.03 },
      points,
      "highlight",
    ),
    true,
  );
  assert.equal(
    glyphIsMarked(
      { x: 0.39, y: 0.31, width: 0.05, height: 0.03 },
      points,
      "highlight",
    ),
    false,
  );
  assert.equal(
    glyphIsMarked(
      { x: 0.25, y: 0.36, width: 0.02, height: 0.03 },
      points,
      "highlight",
    ),
    false,
  );
});
test("multiline highlights keep independent regions and accept reverse drags", () => {
  const points = [
    { x: 0.4, y: 0.35 },
    { x: 0.2, y: 0.3 },
    { x: 0.1, y: 0.4 },
    { x: 0.3, y: 0.45 },
  ];
  assert.equal(
    glyphIsMarked(
      { x: 0.25, y: 0.41, width: 0.02, height: 0.03 },
      points,
      "highlight",
    ),
    true,
  );
  assert.equal(
    glyphIsMarked(
      { x: 0.35, y: 0.41, width: 0.02, height: 0.03 },
      points,
      "highlight",
    ),
    false,
  );
});
test("underlines read the line above the stroke without including the next line", () => {
  const points = [
    { x: 0.2, y: 0.35 },
    { x: 0.4, y: 0.351 },
  ];
  assert.equal(
    glyphIsMarked(
      { x: 0.25, y: 0.31, width: 0.02, height: 0.03 },
      points,
      "underline",
    ),
    true,
  );
  assert.equal(
    glyphIsMarked(
      { x: 0.25, y: 0.36, width: 0.02, height: 0.03 },
      points,
      "underline",
    ),
    false,
  );
  assert.equal(
    glyphIsMarked(
      { x: 0.45, y: 0.31, width: 0.02, height: 0.03 },
      points,
      "underline",
    ),
    false,
  );
});
test("visual marks do not invent quoted text and their preview includes every point", () => {
  assert.equal(
    glyphIsMarked(
      { x: 0.25, y: 0.31, width: 0.02, height: 0.03 },
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      "pen",
    ),
    false,
  );
  assert.deepEqual(
    annotationBounds([
      { x: 0.3, y: 0.2 },
      { x: 0.9, y: 0.8 },
      { x: 0.1, y: 0.4 },
    ]),
    { x: 0.1, y: 0.2, width: 0.8, height: 0.6000000000000001 },
  );
  assert.equal(annotationBounds([]), null);
  assert.equal(annotationLabels.underline, "Sublinhado");
});
