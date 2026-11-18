import { z } from "zod";
import type { LibraryState, ReaderDocument } from "@/shared/types";
import { canonicalJson } from "./canonical-json";
import { removeDeletedCollections } from "./collection-deletions";
import { removeDeletedDocuments } from "./document-deletions";
import { readingPosition } from "./reading-position";
import {
  annotationSchema,
  assetIdSchema,
  bookmarkSchema,
  collectionSchema,
  documentMetadataSchema,
  entityId,
  positionSchema,
  preferencesSchema,
} from "./library-schemas";

const changeSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("documents"),
    id: entityId,
    value: documentMetadataSchema.nullable(),
  }),
  z.object({
    kind: z.literal("positions"),
    id: entityId,
    value: positionSchema.nullable(),
  }),
  z.object({
    kind: z.literal("collections"),
    id: entityId,
    value: collectionSchema.nullable(),
  }),
  z.object({
    kind: z.literal("annotations"),
    id: entityId,
    value: annotationSchema.nullable(),
  }),
  z.object({
    kind: z.literal("bookmarks"),
    id: entityId,
    value: bookmarkSchema.nullable(),
  }),
  z.object({
    kind: z.literal("preferences"),
    id: z.literal("account"),
    value: preferencesSchema,
  }),
]);
export const revisionSchema = z.number().int().min(0).max(2147483647);
export const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeSchema = z
  .object({
    seconds: z.number().int().positive(),
    days: z.record(dateKeySchema, z.number().int().positive()),
  })
  .strict();
export const syncBatchSchema = z
  .object({
    baseRevision: revisionSchema,
    operationId: z.uuid(),
    changes: z.array(changeSchema).max(250),
    time: timeSchema.optional(),
  })
  .strict()
  .superRefine(({ changes, time }, ctx) => {
    const keys = new Set<string>();
    for (const change of changes) {
      const key = changeKey(change);
      if (
        keys.has(key) ||
        (change.value &&
          "id" in change.value &&
          change.id !== change.value.id) ||
        ((change.kind === "documents" || change.kind === "positions") &&
          assetIdSchema.safeParse(change.id).success)
      )
        ctx.addIssue({
          code: "custom",
          message: "Identificador de alteração inválido",
        });
      keys.add(key);
    }
    if (
      time &&
      Object.values(time.days).reduce((sum, seconds) => sum + seconds, 0) !==
        time.seconds
    )
      ctx.addIssue({
        code: "custom",
        message: "Totais de leitura inconsistentes",
      });
  });

export type LibraryChange = z.infer<typeof changeSchema>;
export type SyncBatch = z.infer<typeof syncBatchSchema>;
export type ReadingTime = z.infer<typeof timeSchema>;
export type SyncChange =
  LibraryChange | { kind: "seconds" | "days"; id: string; value: number };
export type LibraryDelta = {
  revision: number;
  changes: SyncChange[];
  reset?: boolean;
  replayed?: boolean;
};
export type LibraryDeletions = { documents: string[]; collections: string[] };

export const MAX_SYNC_BYTES = 4_000_000;
export const MAX_KEEPALIVE_BYTES = 60_000;
export const noDeletions = (): LibraryDeletions => ({
  documents: [],
  collections: [],
});
export const changeKey = (change: Pick<SyncChange, "kind" | "id">) =>
  `${change.kind}/${change.id}`;
export const listKinds = [
  "documents",
  "collections",
  "annotations",
  "bookmarks",
] as const;

function metadataOf(document: ReaderDocument) {
  const {
    page,
    progress,
    location,
    readingPositionUpdatedAt,
    lastReadAt,
    content,
    ...metadata
  } = document;
  return metadata as z.infer<typeof documentMetadataSchema>;
}

function positionOf(document: ReaderDocument) {
  return { ...readingPosition(document), lastReadAt: document.lastReadAt };
}

export function diffLibrary(base: LibraryState, next: LibraryState) {
  const changes: LibraryChange[] = [];
  for (const kind of listKinds) {
    const previous = new Map(base[kind].map((item) => [item.id, item]));
    const current = new Set(next[kind].map((item) => item.id));
    for (const item of next[kind]) {
      const before = previous.get(item.id);
      if (before === item) continue;
      if (kind === "documents") {
        const document = item as ReaderDocument;
        const prior = before as ReaderDocument | undefined;
        const metadata = metadataOf(document);
        const position = positionOf(document);
        if (
          !prior ||
          canonicalJson(metadataOf(prior)) !== canonicalJson(metadata)
        )
          changes.push({ kind, id: item.id, value: metadata });
        if (
          !prior ||
          canonicalJson(positionOf(prior)) !== canonicalJson(position)
        )
          changes.push({ kind: "positions", id: item.id, value: position });
      } else if (canonicalJson(before) !== canonicalJson(item)) {
        changes.push({ kind, id: item.id, value: item } as LibraryChange);
      }
    }
    for (const id of previous.keys()) {
      if (!current.has(id)) changes.push({ kind, id, value: null });
    }
  }
  if (canonicalJson(base.preferences) !== canonicalJson(next.preferences))
    changes.push({
      kind: "preferences",
      id: "account",
      value: next.preferences,
    });
  const days = Object.fromEntries(
    Object.entries(next.readingDays ?? {})
      .map(
        ([day, seconds]) =>
          [day, seconds - (base.readingDays?.[day] ?? 0)] as const,
      )
      .filter(([, seconds]) => seconds > 0),
  );
  const seconds = Object.values(days).reduce(
    (sum, duration) => sum + duration,
    0,
  );
  return { changes, time: seconds ? { seconds, days } : undefined };
}

export function applyDelta(
  base: LibraryState,
  deletions: LibraryDeletions,
  changes: SyncChange[],
) {
  const documents = new Map(base.documents.map((item) => [item.id, item]));
  const collections = new Map(base.collections.map((item) => [item.id, item]));
  const annotations = new Map(base.annotations.map((item) => [item.id, item]));
  const bookmarks = new Map(base.bookmarks.map((item) => [item.id, item]));
  const deletedDocuments = new Set(deletions.documents);
  const deletedCollections = new Set(deletions.collections);
  const days = { ...base.readingDays };
  let readingSeconds = base.readingSeconds;
  let preferences = base.preferences;
  const update = <T>(items: Map<string, T>, id: string, value: T | null) =>
    value === null ? items.delete(id) : items.set(id, value);

  for (const { kind, id, value } of changes) {
    switch (kind) {
      case "documents":
        if (value) {
          const prior = documents.get(id);
          documents.set(id, {
            ...(prior ? positionOf(prior) : { page: 0, progress: 0 }),
            ...(prior?.content && !value.contentAsset
              ? { content: prior.content }
              : {}),
            ...value,
          });
        } else deletedDocuments.add(id);
        break;
      case "collections":
        if (value) update(collections, id, value);
        else deletedCollections.add(id);
        break;
      case "annotations":
        update(annotations, id, value);
        break;
      case "bookmarks":
        update(bookmarks, id, value);
        break;
      case "preferences":
        preferences = value;
        break;
      case "seconds":
        readingSeconds = value;
        break;
      case "days":
        days[id] = value;
        break;
    }
  }
  // A bootstrap can return a position whose document was last changed at an older revision.
  for (const change of changes) {
    if (change.kind !== "positions" || !change.value) continue;
    const document = documents.get(change.id);
    if (document) documents.set(change.id, { ...document, ...change.value });
  }

  const deleted = {
    documents: [...deletedDocuments],
    collections: [...deletedCollections],
  };
  const state = removeDeletedCollections(
    removeDeletedDocuments(
      {
        documents: [...documents.values()].sort(
          (a, b) =>
            b.addedAt.localeCompare(a.addedAt) || a.id.localeCompare(b.id),
        ),
        collections: [...collections.values()],
        annotations: [...annotations.values()],
        bookmarks: [...bookmarks.values()],
        preferences,
        readingSeconds,
        readingDays: days,
      },
      deleted.documents,
    ),
    deleted.collections,
  );
  return { state, deleted };
}

export function intendedChanges(
  base: LibraryState,
  batch: SyncBatch,
): SyncChange[] {
  if (!batch.time) return batch.changes;
  return [
    ...batch.changes,
    {
      kind: "seconds",
      id: "account",
      value: base.readingSeconds + batch.time.seconds,
    },
    ...Object.entries(batch.time.days).map(([id, seconds]) => ({
      kind: "days" as const,
      id,
      value: (base.readingDays?.[id] ?? 0) + seconds,
    })),
  ];
}
