import "dotenv/config";
import { PrismaClient, type Prisma } from "@prisma/client";
import { deleteStoredFile } from "../src/infrastructure/r2/client";
import { assetIdPattern, fileKey } from "../src/infrastructure/r2/file-key";
import { entityId } from "../src/modules/library/library-schemas";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function isUnreferenced(
  tx: Prisma.TransactionClient,
  ownerId: string,
  key: string,
) {
  const id = key.split("/").at(-1);
  if (!id || !entityId.safeParse(id).success || key !== fileKey(ownerId, id))
    return false;
  if (!assetIdPattern.test(id)) {
    const document = await tx.libraryEntity.findUnique({
      where: {
        ownerId_kind_entityId: { ownerId, kind: "documents", entityId: id },
      },
      select: { deleted: true },
    });
    return document?.deleted === true;
  }
  const reference = await tx.libraryEntity.findFirst({
    where: {
      ownerId,
      deleted: false,
      OR: [
        { kind: "documents", payload: { path: ["cover"], equals: id } },
        { kind: "documents", payload: { path: ["contentAsset"], equals: id } },
        { kind: "annotations", payload: { path: ["image"], equals: id } },
      ],
    },
    select: { entityId: true },
  });
  return !reference;
}

async function collect() {
  const pending = await db.storageDeletion.findMany({
    where: { notBefore: { lte: new Date() } },
    orderBy: { notBefore: "asc" },
    take: 100,
  });
  for (const item of pending) {
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${item.ownerId}))`;
        const current = await tx.storageDeletion.findUnique({
          where: { key: item.key },
        });
        if (!current || current.notBefore > new Date()) return;
        const unreferenced = await isUnreferenced(
          tx,
          current.ownerId,
          current.key,
        );
        if (apply && unreferenced) await deleteStoredFile(current.key);
        if (
          apply &&
          current.key ===
            fileKey(current.ownerId, current.key.split("/").at(-1) ?? "")
        )
          await tx.storageDeletion.delete({ where: { key: current.key } });
        console.log(
          unreferenced
            ? apply
              ? "Arquivo sem referência removido."
              : "Arquivo sem referência encontrado."
            : "Arquivo protegido.",
        );
      },
      { timeout: 30_000 },
    );
  }
  console.log(
    `${apply ? "Coleta" : "Simulação"} concluída. ${pending.length} entradas verificadas.`,
  );
}
void collect()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Falha na coleta.");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
