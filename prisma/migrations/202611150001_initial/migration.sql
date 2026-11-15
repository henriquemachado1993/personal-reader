-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "reader";

-- CreateEnum
CREATE TYPE "reader"."DocumentFormat" AS ENUM ('PDF', 'EPUB', 'DOCX', 'TXT');

-- CreateEnum
CREATE TYPE "reader"."AnnotationType" AS ENUM ('HIGHLIGHT', 'UNDERLINE', 'STRIKETHROUGH', 'FREEHAND', 'TEXT', 'ARROW', 'RECTANGLE', 'CIRCLE', 'IMAGE');

-- CreateTable
CREATE TABLE "reader"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Document" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "format" "reader"."DocumentFormat" NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'want',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."DocumentFile" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."DocumentMetadata" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "isbn" TEXT,
    "publisher" TEXT,
    "language" TEXT,
    "coverKey" TEXT,
    "pageCount" INTEGER,

    CONSTRAINT "DocumentMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."ReadingProgress" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "location" JSONB NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."ReadingSession" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Bookmark" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "location" JSONB NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Highlight" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "location" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#e8bb45',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Annotation" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "type" "reader"."AnnotationType" NOT NULL,
    "location" JSONB NOT NULL,
    "color" TEXT,
    "content" TEXT,
    "geometry" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Note" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "location" JSONB NOT NULL,
    "content" TEXT NOT NULL,
    "quote" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Clipping" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "location" JSONB NOT NULL,
    "storageKey" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clipping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Collection" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."Tag" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reader"."SyncOperation" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "entityId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
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
CREATE TABLE "reader"."_DocumentToTag" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_DocumentToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "reader"."_CollectionToDocument" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CollectionToDocument_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "reader"."User"("email");

-- CreateIndex
CREATE INDEX "Document_ownerId_updatedAt_idx" ON "reader"."Document"("ownerId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFile_storageKey_key" ON "reader"."DocumentFile"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentMetadata_documentId_key" ON "reader"."DocumentMetadata"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_documentId_key" ON "reader"."ReadingProgress"("documentId");

-- CreateIndex
CREATE INDEX "ReadingSession_documentId_startedAt_idx" ON "reader"."ReadingSession"("documentId", "startedAt");

-- CreateIndex
CREATE INDEX "Bookmark_documentId_idx" ON "reader"."Bookmark"("documentId");

-- CreateIndex
CREATE INDEX "Highlight_documentId_createdAt_idx" ON "reader"."Highlight"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Annotation_documentId_createdAt_idx" ON "reader"."Annotation"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Note_documentId_createdAt_idx" ON "reader"."Note"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "Clipping_documentId_idx" ON "reader"."Clipping"("documentId");

-- CreateIndex
CREATE INDEX "Collection_ownerId_idx" ON "reader"."Collection"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "reader"."Tag"("name");

-- CreateIndex
CREATE INDEX "SyncOperation_ownerId_appliedAt_idx" ON "reader"."SyncOperation"("ownerId", "appliedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Installation_ownerId_key" ON "reader"."Installation"("ownerId");

-- CreateIndex
CREATE INDEX "_DocumentToTag_B_index" ON "reader"."_DocumentToTag"("B");

-- CreateIndex
CREATE INDEX "_CollectionToDocument_B_index" ON "reader"."_CollectionToDocument"("B");

-- AddForeignKey
ALTER TABLE "reader"."Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."DocumentFile" ADD CONSTRAINT "DocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."DocumentMetadata" ADD CONSTRAINT "DocumentMetadata_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."ReadingProgress" ADD CONSTRAINT "ReadingProgress_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."ReadingSession" ADD CONSTRAINT "ReadingSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."Bookmark" ADD CONSTRAINT "Bookmark_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."Highlight" ADD CONSTRAINT "Highlight_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."Annotation" ADD CONSTRAINT "Annotation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."Note" ADD CONSTRAINT "Note_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."Clipping" ADD CONSTRAINT "Clipping_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."Collection" ADD CONSTRAINT "Collection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "reader"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."_DocumentToTag" ADD CONSTRAINT "_DocumentToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."_DocumentToTag" ADD CONSTRAINT "_DocumentToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "reader"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."_CollectionToDocument" ADD CONSTRAINT "_CollectionToDocument_A_fkey" FOREIGN KEY ("A") REFERENCES "reader"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reader"."_CollectionToDocument" ADD CONSTRAINT "_CollectionToDocument_B_fkey" FOREIGN KEY ("B") REFERENCES "reader"."Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
