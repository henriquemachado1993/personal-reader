import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";
import { readFile } from "@/infrastructure/storage/local";

const resources = new Map<
  string,
  {
    users: number;
    promise: Promise<PDFDocumentProxy>;
    task?: PDFDocumentLoadingTask;
  }
>();
export function acquirePdf(documentId: string) {
  let resource = resources.get(documentId);
  if (!resource) {
    const entry = {
      users: 0,
      promise: undefined as unknown as Promise<PDFDocumentProxy>,
      task: undefined as PDFDocumentLoadingTask | undefined,
    };
    entry.promise = (async () => {
      const file = await readFile(documentId);
      if (!file)
        throw new Error(
          "Arquivo não encontrado. Importe o documento novamente.",
        );
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      entry.task = pdfjs.getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
      });
      return entry.task.promise;
    })();
    resources.set(documentId, entry);
    resource = entry;
  }
  resource.users++;
  const acquired = resource;
  return {
    promise: acquired.promise,
    release: () => {
      acquired.users--;
      if (!acquired.users) {
        resources.delete(documentId);
        void acquired.promise
          .then(() => acquired.task?.destroy())
          .catch(() => {});
      }
    },
  };
}
