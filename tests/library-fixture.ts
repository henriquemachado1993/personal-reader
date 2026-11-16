import { initialState as emptyState } from "../src/modules/library/initial-state";
import type { ReaderDocument } from "../src/shared/types";
export function initialState() {
  return {
    ...emptyState(),
    documents: Array.from({ length: 3 }, (_, index): ReaderDocument => ({
      id: `fixture-${index}`,
      title: `Documento ${index}`,
      author: "Autor",
      format: "TXT",
      cover: "",
      color: "#252525",
      status: "reading",
      progress: 0,
      page: 1,
      pages: 3,
      collections: [],
      addedAt: "2026-11-15T12:00:00.000Z",
      size: 10,
      content: ["Página um", "Página dois", "Página três"],
    })),
  };
}
