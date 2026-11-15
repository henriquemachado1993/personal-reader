import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { persistLibraryEntities } from "../src/modules/library/entity-persistence";
import { snapshotSchema } from "../src/modules/library/snapshot-schema";
async function projectExistingLibraries() {
  const db = new PrismaClient();
  try {
    const replicas = await db.libraryReplica.findMany();
    for (const replica of replicas)
      await db.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${replica.ownerId}))`;
          const current = await tx.libraryReplica.findUniqueOrThrow({
            where: { ownerId: replica.ownerId },
          });
          await persistLibraryEntities(
            tx,
            replica.ownerId,
            null,
            snapshotSchema.parse(current.snapshot),
          );
        },
        { timeout: 120000 },
      );
    console.log(`Projeção concluída: ${replicas.length} bibliotecas.`);
  } finally {
    await db.$disconnect();
  }
}
void projectExistingLibraries().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha na projeção");
  process.exitCode = 1;
});
