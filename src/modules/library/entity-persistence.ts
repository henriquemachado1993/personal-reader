import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { LibraryState } from "@/shared/types";
import { canonicalJson } from "./canonical-json";

export function scopedEntityId(owner: string, kind: string, id: string) {
  const hex = createHash("sha256")
    .update(`${owner}/${kind}/${id}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function persistLibraryEntities(
  tx: Prisma.TransactionClient,
  ownerId: string,
  previous: LibraryState | null,
  next: LibraryState,
) {
  const groups = [
    "documents",
    "collections",
    "annotations",
    "bookmarks",
  ] as const;
  const existingEntities = await tx.libraryEntity.findMany({
    where: { ownerId, kind: { in: [...groups] } },
    select: { kind: true, entityId: true, payload: true },
  });
  const existingByKind = new Map(
    groups.map((kind) => [
      kind,
      new Map(
        existingEntities
          .filter((entity) => entity.kind === kind)
          .map((entity) => [entity.entityId, entity]),
      ),
    ]),
  );
  for (const kind of groups) {
    for (const item of next[kind]) {
      const where = {
        ownerId_kind_entityId: { ownerId, kind, entityId: item.id },
      };
      const existing = existingByKind.get(kind)?.get(item.id);
      if (
        !existing ||
        canonicalJson(existing.payload) !== canonicalJson(item)
      ) {
        await tx.libraryEntity.upsert({
          where,
          create: { ownerId, kind, entityId: item.id, payload: json(item) },
          update: {
            payload: json(item),
            deleted: false,
            version: { increment: 1 },
          },
        });
        existingByKind.get(kind)?.set(item.id, {
          kind,
          entityId: item.id,
          payload: json(item) as Prisma.JsonValue,
        });
      }
    }
    const nextIds = new Set(next[kind].map((item) => item.id));
    for (const item of previous?.[kind] ?? [])
      if (!nextIds.has(item.id)) {
        await tx.libraryEntity.upsert({
          where: {
            ownerId_kind_entityId: { ownerId, kind, entityId: item.id },
          },
          create: { ownerId, kind, entityId: item.id, deleted: true },
          update: {
            deleted: true,
            payload: Prisma.DbNull,
            version: { increment: 1 },
          },
        });
        if (kind === "documents")
          await tx.storageDeletion.upsert({
            where: { key: `${ownerId}/originals/${item.id}` },
            create: {
              key: `${ownerId}/originals/${item.id}`,
              ownerId,
              notBefore: new Date(Date.now() + 7 * 86400000),
            },
            update: {},
          });
      }
  }
  // Legacy snapshots can be projected without changing their public IDs.
  if (!(await tx.user.findUnique({ where: { id: ownerId } }))) return;
  const docId = (id: string) => scopedEntityId(ownerId, "document", id);
  const collectionId = (id: string) =>
    scopedEntityId(ownerId, "collection", id);
  for (const item of next.collections)
    await tx.collection.upsert({
      where: { id: collectionId(item.id) },
      create: {
        id: collectionId(item.id),
        ownerId,
        name: item.name,
        color: item.color,
      },
      update: { name: item.name, color: item.color },
    });
  const previousDocuments = new Map(
    previous?.documents.map((item) => [item.id, item]),
  );
  const nextCollectionIds = new Set(next.collections.map((item) => item.id));
  function byDocument<T extends { documentId: string }>(items: readonly T[]) {
    const grouped = new Map<string, T[]>();
    for (const item of items) {
      const group = grouped.get(item.documentId);
      if (group) group.push(item);
      else grouped.set(item.documentId, [item]);
    }
    return grouped;
  }
  const previousNotes = byDocument(previous?.annotations ?? []);
  const nextNotes = byDocument(next.annotations);
  const previousMarks = byDocument(previous?.bookmarks ?? []);
  const nextMarks = byDocument(next.bookmarks);
  for (const item of next.documents) {
    const unchanged =
      previous &&
      canonicalJson(previousDocuments.get(item.id)) === canonicalJson(item) &&
      canonicalJson(previousNotes.get(item.id) ?? []) ===
        canonicalJson(nextNotes.get(item.id) ?? []) &&
      canonicalJson(previousMarks.get(item.id) ?? []) ===
        canonicalJson(nextMarks.get(item.id) ?? []);
    if (unchanged) continue;
    const id = docId(item.id);
    const fields = {
      title: item.title,
      author: item.author,
      format: item.format,
      status: item.status,
      collections: {
        set: item.collections
          .filter((c) => nextCollectionIds.has(c))
          .map((c) => ({ id: collectionId(c) })),
      },
    };
    await tx.document.upsert({
      where: { id },
      create: {
        id,
        ownerId,
        title: item.title,
        author: item.author,
        format: item.format,
        status: item.status,
      },
      update: fields,
    });
    await tx.document.update({ where: { id }, data: fields });
    await tx.readingProgress.upsert({
      where: { documentId: id },
      create: {
        documentId: id,
        location: json(
          item.location ?? { type: item.format, pageIndex: item.page },
        ),
        percentage: item.progress,
      },
      update: {
        location: json(
          item.location ?? { type: item.format, pageIndex: item.page },
        ),
        percentage: item.progress,
        version: { increment: 1 },
      },
    });
    await tx.documentMetadata.upsert({
      where: { documentId: id },
      create: { documentId: id, pageCount: item.pages, coverKey: item.cover },
      update: { pageCount: item.pages, coverKey: item.cover },
    });
    if (!item.demo)
      await tx.documentFile.upsert({
        where: { storageKey: `${ownerId}/originals/${item.id}` },
        create: {
          documentId: id,
          storageKey: `${ownerId}/originals/${item.id}`,
          filename: item.filename ?? item.title,
          mimeType: "application/octet-stream",
          size: BigInt(item.size),
        },
        update: {},
      });
    await tx.bookmark.deleteMany({ where: { documentId: id } });
    for (const mark of nextMarks.get(item.id) ?? [])
      await tx.bookmark.create({
        data: {
          id: scopedEntityId(ownerId, "bookmark", mark.id),
          documentId: id,
          location: json(mark.location),
          createdAt: new Date(mark.createdAt),
        },
      });
    await tx.annotation.deleteMany({ where: { documentId: id } });
    await tx.note.deleteMany({ where: { documentId: id } });
    await tx.highlight.deleteMany({ where: { documentId: id } });
    for (const note of nextNotes.get(item.id) ?? []) {
      if (note.kind === "note")
        await tx.note.create({
          data: {
            id: scopedEntityId(ownerId, "note", note.id),
            documentId: id,
            location: json(note.location),
            content: note.text,
            quote: note.quote,
          },
        });
      else if (note.kind === "highlight")
        await tx.highlight.create({
          data: {
            id: scopedEntityId(ownerId, "highlight", note.id),
            documentId: id,
            location: json(note.location),
            text: note.text,
            color: note.color,
          },
        });
      else
        await tx.annotation.create({
          data: {
            id: scopedEntityId(ownerId, "annotation", note.id),
            documentId: id,
            location: json(note.location),
            type: (
              {
                pen: "FREEHAND",
                rectangle: "RECTANGLE",
                circle: "CIRCLE",
                arrow: "ARROW",
                image: "IMAGE",
                clipping: "IMAGE",
                text: "TEXT",
                underline: "UNDERLINE",
                pencil: "FREEHAND",
              } as const
            )[note.kind],
            color: note.color,
            content: note.text,
            geometry: json(note),
          },
        });
    }
  }
  await tx.document.deleteMany({
    where: { ownerId, id: { notIn: next.documents.map((x) => docId(x.id)) } },
  });
  await tx.collection.deleteMany({
    where: {
      ownerId,
      id: { notIn: next.collections.map((x) => collectionId(x.id)) },
    },
  });
}
