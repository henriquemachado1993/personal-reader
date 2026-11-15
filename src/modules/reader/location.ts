import type { DocumentLocation } from "@/shared/types";
export function sameLocation(
  a: DocumentLocation,
  b: DocumentLocation,
): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "EPUB" && b.type === "EPUB") return a.cfi === b.cfi;
  if (a.type === "PDF" && b.type === "PDF") return a.pageIndex === b.pageIndex;
  if (
    (a.type === "TXT" || a.type === "DOCX") &&
    (b.type === "TXT" || b.type === "DOCX")
  )
    return a.blockIndex === b.blockIndex && a.offset === b.offset;
  return false;
}
