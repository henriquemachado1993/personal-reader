import { Prisma } from "@prisma/client";
import { database } from "@/infrastructure/database/client";
import { fileKey } from "@/infrastructure/r2/file-key";
import { objectMetadata } from "@/infrastructure/r2/client";
import { canonicalJson } from "./canonical-json";
import { newerReadingPosition, readingPosition } from "./reading-position";
import { assetIdSchema } from "./library-schemas";
import {
  changeKey,
  type LibraryDelta,
  type SyncBatch,
  type SyncChange,
} from "./sync-protocol";

type StoredEntity = Pick<
  Prisma.LibraryEntityGetPayload<object>,
  "kind" | "entityId" | "payload" | "deleted"
>;
class InvalidLibraryChange extends Error {}

const asChange = (row: StoredEntity): SyncChange =>
  ({
    kind: row.kind,
    id: row.entityId,
    value: row.deleted ? null : row.payload,
  }) as SyncChange;

const entityFields = {
  kind: true,
  entityId: true,
  payload: true,
  deleted: true,
} as const;

export async function readLibraryDelta(
  ownerId: string,
  since?: number,
  db = database(),
): Promise<LibraryDelta | null> {
  return db.$transaction(
    async (tx) => {
      const account = await tx.user.findUnique({
        where: { id: ownerId },
        select: { libraryRevision: { select: { revision: true } } },
      });
      if (!account) return null;
      const revision = account.libraryRevision?.revision ?? 0;
      if (since === revision) return { revision, changes: [] };
      const reset = since === undefined || since > revision;
      const rows = await tx.libraryEntity.findMany({
        where: { ownerId, revision: { gt: reset ? 0 : since, lte: revision } },
        orderBy: [{ revision: "asc" }, { kind: "asc" }, { entityId: "asc" }],
        select: entityFields,
      });
      return {
        revision,
        changes: rows.map(asChange),
        ...(reset ? { reset: true } : {}),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function commitLibraryBatch(
  ownerId: string,
  batch: SyncBatch,
  db = database(),
) {
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
        if (
          !(await tx.user.findUnique({
            where: { id: ownerId },
            select: { id: true },
          }))
        )
          return { status: 401 as const };

        const current =
          (await tx.libraryRevision.findUnique({ where: { ownerId } }))
            ?.revision ?? 0;
        const receiptKey = {
          ownerId_operationId: { ownerId, operationId: batch.operationId },
        };
        const receipt = await tx.syncOperation.findUnique({
          where: receiptKey,
          select: { revision: true },
        });
        if (receipt)
          return {
            status: 200 as const,
            delta: { revision: current, changes: [], replayed: true },
          };

        const stale = batch.baseRevision !== current;
        if (
          batch.baseRevision > current ||
          (stale && batch.changes.some((change) => change.kind !== "positions"))
        )
          return { status: 409 as const, revision: current };

        const pending = new Map<string, SyncChange>();
        const stored = new Map<string, StoredEntity | null>();
        const nextRevision = current + 1;
        const removedFiles = new Set<string>();
        const assetChecks = new Map<string, "image" | "text">();
        const lookup = async (kind: string, id: string) => {
          const key = changeKey({ kind: kind as SyncChange["kind"], id });
          if (!stored.has(key)) {
            const row = await tx.libraryEntity.findUnique({
              where: { ownerId_kind_entityId: { ownerId, kind, entityId: id } },
              select: entityFields,
            });
            stored.set(key, row);
          }
          return stored.get(key) ?? null;
        };
        const live = async (kind: "documents" | "collections", id: string) => {
          const staged = pending.get(changeKey({ kind, id }));
          if (staged) return staged.value !== null;
          // A position write only checks that its book exists. Its metadata stays in the database.
          if (kind === "documents") {
            const row = await tx.libraryEntity.findUnique({
              where: { ownerId_kind_entityId: { ownerId, kind, entityId: id } },
              select: { deleted: true },
            });
            return row?.deleted === false;
          }
          return (await lookup(kind, id))?.deleted === false;
        };
        function stage(change: SyncChange, before: StoredEntity | null) {
          const prior = before && !before.deleted ? before.payload : null;
          if (canonicalJson(prior) !== canonicalJson(change.value))
            pending.set(changeKey(change), change);
        }
        function updateAsset(
          before: unknown,
          after: unknown,
          type: "image" | "text",
        ) {
          if (before === after) return;
          const prior = assetIdSchema.safeParse(before);
          if (prior.success) removedFiles.add(fileKey(ownerId, prior.data));
          const incoming = assetIdSchema.safeParse(after);
          if (incoming.success) {
            const expected = assetChecks.get(incoming.data);
            if (expected && expected !== type) throw new InvalidLibraryChange();
            assetChecks.set(incoming.data, type);
          }
        }

        // Validate relationships against the resulting state, including collections created in this batch.
        const order = [
          "collections",
          "documents",
          "positions",
          "annotations",
          "bookmarks",
          "preferences",
        ];
        const requested = [...batch.changes].sort(
          (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
        );
        for (const change of requested) {
          const { kind, id, value } = change;
          const before = await lookup(kind, id);
          if (kind === "positions") {
            if (!value || !(await live("documents", id))) continue;
            const prior =
              before && !before.deleted
                ? (asChange(before) as typeof change).value
                : null;
            const position = prior ? newerReadingPosition(prior, value) : value;
            const lastReadAt = [prior?.lastReadAt, value.lastReadAt]
              .filter(Boolean)
              .sort()
              .at(-1);
            stage(
              {
                ...change,
                value: { ...readingPosition(position), lastReadAt },
              },
              before,
            );
            continue;
          }
          if (
            (kind === "collections" || kind === "documents") &&
            before?.deleted
          )
            continue;
          if (kind === "documents") {
            const prior =
              before && !before.deleted
                ? (asChange(before) as typeof change).value
                : null;
            updateAsset(prior?.cover, value?.cover, "image");
            updateAsset(prior?.contentAsset, value?.contentAsset, "text");
            if (value) {
              if (
                !value.demo &&
                (value.format === "TXT" || value.format === "DOCX") &&
                !value.contentAsset
              )
                throw new InvalidLibraryChange();
              const collections = await Promise.all(
                [...new Set(value.collections)].map(async (id) =>
                  (await live("collections", id)) ? id : null,
                ),
              );
              stage(
                {
                  ...change,
                  value: {
                    ...value,
                    collections: collections.filter(
                      (id): id is string => id !== null,
                    ),
                  },
                },
                before,
              );
            } else {
              stage(change, before);
              if (!prior) continue;
              removedFiles.add(fileKey(ownerId, id));
              const related = await tx.libraryEntity.findMany({
                where: { ownerId, documentId: id, deleted: false },
                select: entityFields,
              });
              for (const row of related) {
                const removed = asChange(row);
                if (removed.kind === "annotations")
                  updateAsset(removed.value?.image, undefined, "image");
                stage({ ...removed, value: null } as SyncChange, row);
              }
            }
            continue;
          }
          if (kind === "annotations" || kind === "bookmarks") {
            if (value && !(await live("documents", value.documentId))) continue;
            if (kind === "annotations") {
              const prior =
                before && !before.deleted
                  ? (asChange(before) as typeof change).value
                  : null;
              updateAsset(prior?.image, change.value?.image, "image");
            }
          }
          stage(change, before);
        }

        for (const change of pending.values()) {
          if (change.kind !== "collections" || change.value !== null) continue;
          const books = await tx.libraryEntity.findMany({
            where: {
              ownerId,
              kind: "documents",
              deleted: false,
              payload: { path: ["collections"], array_contains: [change.id] },
            },
            select: entityFields,
          });
          for (const row of books) {
            const prior = asChange(row);
            if (prior.kind !== "documents" || !prior.value) continue;
            const updated = pending.get(changeKey(prior)) ?? prior;
            if (updated.kind !== "documents" || !updated.value) continue;
            stage(
              {
                ...updated,
                value: {
                  ...updated.value,
                  collections: updated.value.collections.filter(
                    (id) => id !== change.id,
                  ),
                },
              },
              row,
            );
          }
        }

        if (batch.time) {
          const totals = [
            ["seconds", "account", batch.time.seconds] as const,
            ...Object.entries(batch.time.days).map(
              ([id, seconds]) => ["days", id, seconds] as const,
            ),
          ];
          for (const [kind, id, increment] of totals) {
            const before = await lookup(kind, id);
            const value =
              (typeof before?.payload === "number" ? before.payload : 0) +
              increment;
            if (!Number.isSafeInteger(value)) throw new InvalidLibraryChange();
            stage({ kind, id, value }, before);
          }
        }
        for (const [id, expected] of assetChecks) {
          const object = await objectMetadata(fileKey(ownerId, id));
          if (
            !object ||
            !object.size ||
            (expected === "text"
              ? object.type !== "application/json"
              : !object.type?.startsWith("image/"))
          )
            throw new InvalidLibraryChange();
        }

        const changes = [...pending.values()];
        const revision = changes.length ? nextRevision : current;
        for (const change of changes) {
          const documentId =
            change.kind === "positions"
              ? change.id
              : change.kind === "annotations" || change.kind === "bookmarks"
                ? change.value?.documentId
                : undefined;
          const data = {
            revision,
            ...(documentId && { documentId }),
            deleted: change.value === null,
            payload:
              change.value === null
                ? Prisma.DbNull
                : (JSON.parse(
                    JSON.stringify(change.value),
                  ) as Prisma.InputJsonValue),
          };
          const { kind, id: entityId } = change;
          await tx.libraryEntity.upsert({
            where: { ownerId_kind_entityId: { ownerId, kind, entityId } },
            create: { ownerId, kind, entityId, ...data },
            update: data,
          });
        }
        for (const key of removedFiles) {
          const notBefore = new Date(Date.now() + 7 * 86_400_000);
          await tx.storageDeletion.upsert({
            where: { key },
            create: { key, ownerId, notBefore },
            update: { notBefore },
          });
        }
        if (changes.length)
          await tx.libraryRevision.upsert({
            where: { ownerId },
            create: { ownerId, revision },
            update: { revision },
          });
        await tx.syncOperation.create({
          data: { ownerId, operationId: batch.operationId, revision },
        });
        const delta: LibraryDelta = {
          revision,
          changes: stale ? [] : changes,
          ...(stale && { replayed: true }),
        };
        return { status: 200 as const, delta };
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (error instanceof InvalidLibraryChange) return { status: 422 as const };
    throw error;
  }
}
