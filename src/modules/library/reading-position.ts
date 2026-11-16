import type { ReaderDocument, LibraryState } from "@/shared/types";
import { canonicalJson } from "./canonical-json";

export type ReadingPosition = Pick<
  ReaderDocument,
  "page" | "progress" | "location" | "readingPositionUpdatedAt"
>;

export function readingPosition(book: ReadingPosition): ReadingPosition {
  return {
    page: book.page,
    progress: book.progress,
    location: book.location,
    readingPositionUpdatedAt: book.readingPositionUpdatedAt,
  };
}

export function newerReadingPosition(
  ours: ReadingPosition,
  theirs: ReadingPosition,
): ReadingPosition {
  const localTime = Date.parse(ours.readingPositionUpdatedAt ?? "") || 0;
  const remoteTime = Date.parse(theirs.readingPositionUpdatedAt ?? "") || 0;
  if (localTime !== remoteTime) return localTime > remoteTime ? ours : theirs;
  // Equal clocks must converge regardless of which device initiates the merge.
  return canonicalJson(readingPosition(ours)) >=
    canonicalJson(readingPosition(theirs))
    ? ours
    : theirs;
}

export function nextReadingTimestamp(previous?: string): string {
  return new Date(
    Math.max(Date.now(), (previous ? Date.parse(previous) : 0) + 1),
  ).toISOString();
}

export function preserveLatestPositions(
  previous: LibraryState | null,
  incoming: LibraryState,
): LibraryState {
  if (!previous) return incoming;
  const existing = new Map(previous.documents.map((book) => [book.id, book]));
  return {
    ...incoming,
    documents: incoming.documents.map((book) => {
      const prior = existing.get(book.id);
      if (
        !prior?.readingPositionUpdatedAt ||
        newerReadingPosition(prior, book) !== prior
      )
        return book;
      return {
        ...book,
        ...readingPosition(prior),
        lastReadAt: [book.lastReadAt, prior.lastReadAt]
          .filter((value): value is string => !!value)
          .sort()
          .at(-1),
      };
    }),
  };
}
