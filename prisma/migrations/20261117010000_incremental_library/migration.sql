-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reader";

-- CreateTable
CREATE TABLE "reader"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."LibraryRevision" (
    "ownerId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LibraryRevision_pkey" PRIMARY KEY ("ownerId")
);

-- CreateTable
CREATE TABLE "reader"."SyncOperation" (
    "ownerId" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("ownerId","operationId")
);

-- CreateTable
CREATE TABLE "reader"."Installation" (
    "id" TEXT NOT NULL DEFAULT 'owner',
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Installation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."LoginAttempt" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "reader"."PasswordReset" (
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "reader"."LibraryEntity" (
    "ownerId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "documentId" TEXT,
    "payload" JSONB,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryEntity_pkey" PRIMARY KEY ("ownerId","kind","entityId")
);

-- CreateTable
CREATE TABLE "reader"."StorageDeletion" (
    "key" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "notBefore" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorageDeletion_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "reader"."RegistrationInvite" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "issuerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RegistrationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "reader"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_ownerId_key" ON "reader"."Installation"("ownerId");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "reader"."PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "LibraryEntity_ownerId_revision_idx" ON "reader"."LibraryEntity"("ownerId", "revision");

-- CreateIndex
CREATE INDEX "LibraryEntity_ownerId_documentId_idx" ON "reader"."LibraryEntity"("ownerId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationInvite_tokenHash_key" ON "reader"."RegistrationInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "RegistrationInvite_issuerId_createdAt_idx" ON "reader"."RegistrationInvite"("issuerId", "createdAt");

-- CreateIndex
CREATE INDEX "RegistrationInvite_email_idx" ON "reader"."RegistrationInvite"("email");

-- AddForeignKey
ALTER TABLE "reader"."LibraryRevision" ADD CONSTRAINT "LibraryRevision_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."SyncOperation" ADD CONSTRAINT "SyncOperation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."LibraryEntity" ADD CONSTRAINT "LibraryEntity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."RegistrationInvite" ADD CONSTRAINT "RegistrationInvite_issuerId_fkey" FOREIGN KEY ("issuerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- The app schema is accessed through Prisma. Realtime only exposes an account's revision.
REVOKE ALL ON SCHEMA "reader" FROM PUBLIC;

DO $$
BEGIN
  IF to_regclass('realtime.messages') IS NOT NULL THEN
    EXECUTE $policy$
      CREATE POLICY "reader accounts receive their library revision"
      ON realtime.messages
      FOR SELECT TO authenticated
      USING (
        extension = 'broadcast'
        AND (auth.jwt() ->> 'reader_realtime') = 'true'
        AND realtime.topic() = 'library:' || auth.uid()::text
      )
    $policy$;
  END IF;
END
$$;

CREATE FUNCTION "reader"."broadcast_library_revision"() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF to_regprocedure('realtime.send(jsonb,text,text,boolean)') IS NOT NULL THEN
    PERFORM realtime.send(
      jsonb_build_object('revision', NEW."revision"),
      'revision',
      'library:' || NEW."ownerId"::text,
      true
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Library revision broadcast failed (%)', SQLSTATE;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION "reader"."broadcast_library_revision"() FROM PUBLIC;

CREATE TRIGGER "library_revision_broadcast"
AFTER INSERT OR UPDATE OF "revision" ON "reader"."LibraryRevision"
FOR EACH ROW EXECUTE FUNCTION "reader"."broadcast_library_revision"();
