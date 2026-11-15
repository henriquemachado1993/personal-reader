CREATE TABLE "reader"."LibraryReplica" (
  "ownerId" UUID NOT NULL PRIMARY KEY,
  "revision" INTEGER NOT NULL DEFAULT 0,
  "snapshot" JSONB NOT NULL,
  "operationId" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
