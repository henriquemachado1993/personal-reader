import { z } from "zod";
const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9-]+$/);
const text = z.string().max(100000);
const point = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  pressure: z.number().optional(),
});
const location = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("PDF"),
      pageIndex: z.number().int().nonnegative(),
    })
    .passthrough(),
  z.object({
    type: z.literal("EPUB"),
    cfi: text,
    href: text,
    progression: z.number().optional(),
  }),
  z.object({
    type: z.enum(["TXT", "DOCX"]),
    blockIndex: z.number().int().nonnegative(),
    offset: z.number().nonnegative(),
  }),
]);
export const snapshotSchema = z.object({
  documents: z
    .array(
      z.object({
        id,
        title: text,
        author: text,
        format: z.enum(["PDF", "EPUB", "DOCX", "TXT"]),
        cover: z.string().max(10000000),
        color: z.string().max(30),
        status: z.enum(["want", "reading", "finished"]),
        progress: z.number().min(0).max(100),
        page: z.number().int().nonnegative(),
        pages: z.number().int().positive(),
        location: location.optional(),
        collections: z.array(id),
        addedAt: z.iso.datetime(),
        lastReadAt: z.iso.datetime().optional(),
        size: z.number().nonnegative(),
        demo: z.boolean().optional(),
        content: z.array(text).optional(),
        filename: text.optional(),
      }),
    )
    .max(10000),
  collections: z
    .array(z.object({ id, name: text, color: z.string().max(30) }))
    .max(10000),
  annotations: z
    .array(
      z.object({
        id,
        documentId: id,
        kind: z.enum([
          "underline",
          "pencil",
          "highlight",
          "note",
          "pen",
          "rectangle",
          "circle",
          "arrow",
          "clipping",
          "text",
          "image",
        ]),
        page: z.number().int().nonnegative(),
        location,
        text,
        quote: text.optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        points: z.array(point).max(100000).optional(),
        image: z.string().max(10000000).optional(),
        thickness: z.number().min(1).max(12).optional(),
        opacity: z.number().min(0.1).max(1).optional(),
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
      }),
    )
    .max(100000),
  bookmarks: z
    .array(
      z.object({
        id,
        documentId: id,
        page: z.number().int().nonnegative(),
        location,
        createdAt: z.iso.datetime(),
      }),
    )
    .max(100000),
  preferences: z.object({
    theme: z.enum(["light", "dark", "system"]),
    fontSize: z.number().min(10).max(48),
    readerTheme: z.enum(["white", "paper", "night"]),
    dailyGoal: z.number().positive(),
  }),
  readingSeconds: z.number().nonnegative(),
  readingDays: z
    .record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.number().nonnegative())
    .optional(),
});
