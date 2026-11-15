CREATE TABLE "reader"."LibraryEntity" (
 "ownerId" UUID NOT NULL, "kind" TEXT NOT NULL, "entityId" TEXT NOT NULL,
 "version" INTEGER NOT NULL DEFAULT 1, "payload" JSONB, "deleted" BOOLEAN NOT NULL DEFAULT FALSE,
 "updatedAt" TIMESTAMP(3) NOT NULL, PRIMARY KEY ("ownerId", "kind", "entityId")
);
CREATE TABLE "reader"."StorageDeletion" ("key" TEXT PRIMARY KEY, "ownerId" UUID NOT NULL, "notBefore" TIMESTAMP(3) NOT NULL);
