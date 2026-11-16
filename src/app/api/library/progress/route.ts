import { auth } from "@/auth";
import { database } from "@/infrastructure/database/client";
import { isSameOrigin } from "@/modules/auth/same-origin";
import { snapshotSchema } from "@/modules/library/snapshot-schema";
import {
  newerReadingPosition,
  readingPosition,
} from "@/modules/library/reading-position";
import { canonicalJson } from "@/modules/library/canonical-json";
import { persistLibraryEntities } from "@/modules/library/entity-persistence";
import type { LibraryState } from "@/shared/types";
import { Prisma } from "@prisma/client";
import { z } from "zod";

const positionSchema = snapshotSchema.shape.documents.element
  .pick({
    id: true,
    page: true,
    progress: true,
    location: true,
    readingPositionUpdatedAt: true,
    lastReadAt: true,
  })
  .required({ readingPositionUpdatedAt: true });

export async function POST(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > 60_000)
    return new Response(null, { status: 413 });
  let positions: z.infer<typeof positionSchema>[];
  try {
    positions = z
      .object({ positions: z.array(positionSchema).min(1).max(100) })
      .parse(JSON.parse(body)).positions;
  } catch {
    return new Response(null, { status: 400 });
  }
  await database().$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownerId}))`;
      const prior = await tx.libraryReplica.findUnique({ where: { ownerId } });
      if (!prior) return;
      const before = prior.snapshot as unknown as LibraryState;
      const incoming = new Map(
        positions.map((position) => [position.id, position]),
      );
      const snapshot: LibraryState = {
        ...before,
        documents: before.documents.map((book) => {
          const position = incoming.get(book.id);
          if (!position || newerReadingPosition(book, position) !== position)
            return book;
          return {
            ...book,
            ...readingPosition(position),
            lastReadAt: [book.lastReadAt, position.lastReadAt]
              .filter((value): value is string => !!value)
              .sort()
              .at(-1),
          };
        }),
      };
      if (canonicalJson(snapshot) === canonicalJson(before)) return;
      await tx.libraryReplica.update({
        where: { ownerId },
        data: {
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          revision: { increment: 1 },
          operationId: crypto.randomUUID(),
        },
      });
      await persistLibraryEntities(tx, ownerId, before, snapshot);
    },
    { timeout: 60000 },
  );
  return new Response(null, { status: 204 });
}
