import {
  readOriginal,
  removeSnapshotTransfer,
} from "@/infrastructure/r2/client";
import { replicaResponse } from "@/modules/library/replica-response";
import { auth } from "@/auth";
import { database } from "@/infrastructure/database/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isSameOrigin } from "@/modules/auth/same-origin";
import { snapshotSchema } from "@/modules/library/snapshot-schema";
import { persistLibraryEntities } from "@/modules/library/entity-persistence";
import { removeDeletedCollections } from "@/modules/library/collection-deletions";
import { removeDeletedDocuments } from "@/modules/library/document-deletions";
import { preserveLatestPositions } from "@/modules/library/reading-position";
import type { LibraryState } from "@/shared/types";

export async function GET(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return Response.json({}, { status: 401 });
  const replica = await database().libraryReplica.findUnique({
    where: { ownerId },
  });
  const operationId = new URL(request.url).searchParams.get("operationId");
  const receipt =
    operationId && z.uuid().safeParse(operationId).success
      ? await database().libraryEntity.findUnique({
          where: {
            ownerId_kind_entityId: {
              ownerId,
              kind: "sync-operation",
              entityId: operationId,
            },
          },
          select: { entityId: true },
        })
      : null;
  const deleted = replica
    ? await database().libraryEntity.findMany({
        where: {
          ownerId,
          kind: { in: ["collections", "documents"] },
          deleted: true,
        },
        select: { entityId: true, kind: true },
      })
    : [];
  return replicaResponse(
    replica
      ? {
          ...replica,
          acknowledgedOperationId: receipt?.entityId,
          deletedCollectionIds: deleted
            .filter((item) => item.kind === "collections")
            .map((item) => item.entityId),
          deletedDocumentIds: deleted
            .filter((item) => item.kind === "documents")
            .map((item) => item.entityId),
        }
      : null,
  );
}
export async function PUT(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return Response.json({}, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({}, { status: 403 });
  const body = await request.text();
  if (body.length > 25_000_000) return Response.json({}, { status: 413 });
  let parsed: { revision: number; operationId: string; snapshot: LibraryState };
  let transferKey: string | undefined;
  try {
    const envelope = z
      .object({
        revision: z.number().int().nonnegative(),
        operationId: z.uuid(),
        snapshot: snapshotSchema.optional(),
        snapshotId: z.uuid().optional(),
      })
      .parse(JSON.parse(body));
    if (envelope.snapshotId) {
      if (envelope.snapshot || envelope.snapshotId !== envelope.operationId)
        return Response.json({}, { status: 400 });
      const receipt = await database().libraryEntity.findUnique({
        where: {
          ownerId_kind_entityId: {
            ownerId,
            kind: "sync-operation",
            entityId: envelope.operationId,
          },
        },
      });
      if (receipt)
        return replicaResponse(
          await database().libraryReplica.findUnique({ where: { ownerId } }),
        );
      transferKey = `sync-snapshots/${ownerId}/${envelope.snapshotId}`;
      const bytes = await readOriginal(transferKey, 25_000_000);
      parsed = {
        ...envelope,
        snapshot: snapshotSchema.parse(
          JSON.parse(new TextDecoder().decode(bytes)),
        ) as LibraryState,
      };
    } else {
      if (!envelope.snapshot) return Response.json({}, { status: 400 });
      parsed = { ...envelope, snapshot: envelope.snapshot as LibraryState };
    }
  } catch {
    if (transferKey) await removeSnapshotTransfer(transferKey).catch(() => {});
    return Response.json({}, { status: 400 });
  }
  try {
    const result = await database().$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
        const prior = await tx.libraryReplica.findUnique({
          where: { ownerId },
        });
        const receipt = await tx.libraryEntity.findUnique({
          where: {
            ownerId_kind_entityId: {
              ownerId,
              kind: "sync-operation",
              entityId: parsed.operationId,
            },
          },
        });
        if (prior?.operationId === parsed.operationId || receipt) return prior;
        if ((prior?.revision ?? 0) !== parsed.revision) return null;
        const deleted = await tx.libraryEntity.findMany({
          where: {
            ownerId,
            kind: { in: ["collections", "documents"] },
            deleted: true,
          },
          select: { entityId: true, kind: true },
        });
        // Older clients may upload collections deleted before their first sync.
        const incoming = preserveLatestPositions(
          (prior?.snapshot as LibraryState | undefined) ?? null,
          removeDeletedDocuments(
            removeDeletedCollections(
              parsed.snapshot as LibraryState,
              deleted
                .filter((item) => item.kind === "collections")
                .map((item) => item.entityId),
            ),
            deleted
              .filter((item) => item.kind === "documents")
              .map((item) => item.entityId),
          ),
        );
        const snapshot = incoming as unknown as Prisma.InputJsonValue;
        if (!prior) {
          const created = await tx.libraryReplica.create({
            data: {
              ownerId,
              revision: 1,
              operationId: parsed.operationId,
              snapshot,
            },
          });
          await persistLibraryEntities(tx, ownerId, null, incoming);
          await tx.libraryEntity.create({
            data: {
              ownerId,
              kind: "sync-operation",
              entityId: parsed.operationId,
              payload: { revision: created.revision },
            },
          });
          return created;
        }
        const changed = await tx.libraryReplica.updateMany({
          where: { ownerId, revision: parsed.revision },
          data: {
            revision: { increment: 1 },
            snapshot,
            operationId: parsed.operationId,
          },
        });
        if (changed.count) {
          await persistLibraryEntities(
            tx,
            ownerId,
            prior.snapshot as unknown as LibraryState,
            incoming,
          );
          await tx.libraryEntity.create({
            data: {
              ownerId,
              kind: "sync-operation",
              entityId: parsed.operationId,
              payload: { revision: prior.revision + 1 },
            },
          });
        }
        return changed.count
          ? tx.libraryReplica.findUnique({ where: { ownerId } })
          : null;
      },
      { timeout: 60000 },
    );
    return replicaResponse(result, result ? 200 : 409);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return Response.json({}, { status: 409 });
    throw error;
  } finally {
    if (transferKey) await removeSnapshotTransfer(transferKey).catch(() => {});
  }
}
