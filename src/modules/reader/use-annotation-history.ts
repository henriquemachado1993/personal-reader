"use client";
import { useCallback, useMemo, useReducer } from "react";
import { useLibrary } from "@/modules/library/store";
import type { Annotation } from "@/shared/types";
import { AnnotationHistory } from "./annotation-history";

export function useAnnotationHistory(documentId: string) {
  const history = useMemo(() => new AnnotationHistory(), [documentId]);
  const [, refresh] = useReducer((value) => value + 1, 0);
  const current = (id: string) =>
    useLibrary
      .getState()
      .annotations.find(
        (note) => note.id === id && note.documentId === documentId,
      );
  const apply = (id: string, note?: Annotation) =>
    note
      ? useLibrary.getState().addAnnotation(note)
      : useLibrary.getState().removeAnnotation(id);
  const editAnnotation = (note: Annotation) => {
    history.record(current(note.id), note);
    apply(note.id, note);
    refresh();
  };
  const eraseAnnotation = (id: string) => {
    const note = current(id);
    if (!note) return;
    history.record(note, undefined);
    apply(id);
    refresh();
  };
  const travel = useCallback(
    (direction: "undo" | "redo") => {
      try {
        const edit = history[direction]((id) =>
          useLibrary
            .getState()
            .annotations.find(
              (note) => note.id === id && note.documentId === documentId,
            ),
        );
        if (edit) {
          const note = direction === "undo" ? edit.before : edit.after;
          if (note) useLibrary.getState().addAnnotation(note);
          else useLibrary.getState().removeAnnotation(edit.id);
          refresh();
        }
      } catch (error) {
        useLibrary.getState().notify((error as Error).message);
      }
    },
    [history, documentId],
  );
  const undo = useCallback(() => travel("undo"), [travel]);
  const redoAction = useCallback(() => travel("redo"), [travel]);
  return {
    editAnnotation,
    eraseAnnotation,
    undo,
    redoAction,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
  };
}
