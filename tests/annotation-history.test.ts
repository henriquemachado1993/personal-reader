import { test } from "node:test";
import assert from "node:assert/strict";
import { AnnotationHistory } from "../src/modules/reader/annotation-history";
import type { Annotation } from "../src/shared/types";
const annotation: Annotation = {
  id: "note",
  documentId: "book",
  kind: "text",
  page: 0,
  location: { type: "PDF", pageIndex: 0 },
  text: "Anotação",
  color: "#e8bb45",
  createdAt: "2026-11-15T00:00:00Z",
  updatedAt: "2026-11-15T00:00:00Z",
  points: [
    { x: 0.1, y: 0.1 },
    { x: 0.2, y: 0.2 },
  ],
};
test("undo and redo restore creation, movement, properties and deletion in order", () => {
  const history = new AnnotationHistory();
  let current: Annotation | undefined;
  const write = (after: Annotation | undefined) => {
    history.record(current, after);
    current = after;
  };
  write(structuredClone(annotation));
  const moved = {
    ...annotation,
    points: [
      { x: 0.3, y: 0.3 },
      { x: 0.4, y: 0.4 },
    ],
  };
  write(moved);
  const styled = { ...moved, color: "#3e3830", thickness: 7 };
  write(styled);
  write(undefined);
  for (const expected of [styled, moved, annotation, undefined]) {
    const edit = history.undo(() => current)!;
    current = edit.before;
    assert.deepEqual(current, expected);
  }
  assert.equal(history.canUndo, false);
  for (const expected of [annotation, moved, styled, undefined]) {
    current = history.redo(() => current)!.after;
    assert.deepEqual(current, expected);
  }
  assert.equal(history.canRedo, false);
});
test("new edit replaces redo branch and remote edits are protected", () => {
  const history = new AnnotationHistory();
  history.record(undefined, annotation);
  history.undo(() => annotation);
  history.record(undefined, { ...annotation, text: "Outro texto" });
  assert.equal(history.canRedo, false);
  assert.throws(
    () => history.undo(() => ({ ...annotation, text: "Texto remoto" })),
    /outra sessão/,
  );
  assert.equal(history.canUndo, true);
});
