import { auth } from "@/auth";
import { database } from "@/infrastructure/database/client";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isSameOrigin } from "@/modules/auth/same-origin";
import { snapshotSchema } from "@/modules/library/snapshot-schema";

export async function GET() {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return Response.json({}, { status: 401 });
  const replica = await database().libraryReplica.findUnique({
    where: { ownerId },
  });
  return Response.json(replica, { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return Response.json({}, { status: 401 });
  if (!isSameOrigin(request)) return Response.json({}, { status: 403 });
  const body = await request.text();
  if (body.length > 25_000_000) return Response.json({}, { status: 413 });
  let parsed;
  try {
    parsed = z
      .object({
        revision: z.number().int().nonnegative(),
        operationId: z.uuid(),
        snapshot: snapshotSchema,
      })
      .parse(JSON.parse(body));
  } catch {
    return Response.json({}, { status: 400 });
  }
  try {
    const result = await database().$transaction(async (tx) => {
      const prior = await tx.libraryReplica.findUnique({ where: { ownerId } });
      if (prior?.operationId === parsed.operationId) return prior;
      if ((prior?.revision ?? 0) !== parsed.revision) return null;
      const snapshot = parsed.snapshot as Prisma.InputJsonValue;
      if (!prior)
        return tx.libraryReplica.create({
          data: {
            ownerId,
            revision: 1,
            operationId: parsed.operationId,
            snapshot,
          },
        });
      const changed = await tx.libraryReplica.updateMany({
        where: { ownerId, revision: parsed.revision },
        data: {
          revision: { increment: 1 },
          snapshot,
          operationId: parsed.operationId,
        },
      });
      return changed.count
        ? tx.libraryReplica.findUnique({ where: { ownerId } })
        : null;
    });
    return Response.json(result, { status: result ? 200 : 409 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return Response.json({}, { status: 409 });
    throw error;
  }
}
