import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import {
  isUnreferencedOriginal,
  isExpiredSnapshotTransfer,
} from "../src/infrastructure/r2/retention.mjs";
const apply = process.argv.includes("--apply");
const db = new PrismaClient();
const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
try {
  const pending = await db.storageDeletion.findMany({
    where: { notBefore: { lte: new Date() } },
    take: 100,
  });
  for (const item of pending) {
    if (!apply) {
      const replica = await db.libraryReplica.findUnique({
        where: { ownerId: item.ownerId },
      });
      console.log(
        isUnreferencedOriginal(item.ownerId, item.key, replica?.snapshot)
          ? "Candidato sem referência; nenhuma exclusão executada."
          : "Original protegido; nenhuma exclusão executada.",
      );
      continue;
    }
    await db.$transaction(
      async (tx) => {
        // The same advisory lock is held by synchronization while restoring references.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${item.ownerId}))`;
        const replica = await tx.libraryReplica.findUnique({
          where: { ownerId: item.ownerId },
        });
        if (isUnreferencedOriginal(item.ownerId, item.key, replica?.snapshot))
          await client.send(
            new DeleteObjectCommand({
              Bucket: process.env.R2_BUCKET_NAME,
              Key: item.key,
            }),
          );
        await tx.storageDeletion.delete({ where: { key: item.key } });
      },
      { timeout: 30000 },
    );
  }
  console.log(
    `${apply ? "Coleta" : "Simulação"} concluída: ${pending.length} entradas verificadas.`,
  );
  let continuation;
  do {
    const batch = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: "sync-snapshots/",
        ContinuationToken: continuation,
      }),
    );
    for (const file of batch.Contents ?? []) {
      if (!isExpiredSnapshotTransfer(file.Key, file.LastModified)) continue;
      if (apply)
        await client.send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: file.Key,
          }),
        );
      console.log(
        apply
          ? "Transferência temporária vencida removida."
          : "Transferência temporária vencida; nenhuma exclusão executada.",
      );
    }
    continuation = batch.IsTruncated ? batch.NextContinuationToken : undefined;
  } while (continuation);
} finally {
  client.destroy();
  await db.$disconnect();
}
