import type { Annotation } from "@/shared/types";
import { canonicalJson } from "@/modules/library/canonical-json";

export interface AnnotationEdit {
  id: string;
  before?: Annotation;
  after?: Annotation;
}
export class AnnotationHistory {
  private past: AnnotationEdit[] = [];
  private future: AnnotationEdit[] = [];
  get canUndo() {
    return this.past.length > 0;
  }
  get canRedo() {
    return this.future.length > 0;
  }
  record(before: Annotation | undefined, after: Annotation | undefined) {
    if (canonicalJson(before) === canonicalJson(after)) return;
    this.past.push(
      structuredClone({ id: (after ?? before)!.id, before, after }),
    );
    this.past = this.past.slice(-100);
    this.future = [];
  }
  undo(current: (id: string) => Annotation | undefined) {
    const edit = this.past.at(-1);
    if (!edit) return;
    this.assertUnchanged(current(edit.id), edit.after);
    this.past.pop();
    this.future.push(edit);
    return edit;
  }
  redo(current: (id: string) => Annotation | undefined) {
    const edit = this.future.at(-1);
    if (!edit) return;
    this.assertUnchanged(current(edit.id), edit.before);
    this.future.pop();
    this.past.push(edit);
    return edit;
  }
  private assertUnchanged(
    current: Annotation | undefined,
    expected: Annotation | undefined,
  ) {
    if (canonicalJson(current) !== canonicalJson(expected))
      throw new Error(
        "Esta anotação mudou em outra sessão. O histórico local não pode substituir essa alteração.",
      );
  }
}
