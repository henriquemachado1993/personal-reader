import { z } from "zod";

export const entityId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9-]+$/);
export const assetIdSchema = z.templateLiteral(["asset-", z.uuid()]);
const text = z.string().max(100000);
const point = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  pressure: z.number().optional(),
});
const location = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("PDF"),
    pageIndex: z.number().int().nonnegative(),
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
  }),
  z.strictObject({
    type: z.literal("EPUB"),
    cfi: text,
    href: text,
    progression: z.number().optional(),
  }),
  z.strictObject({
    type: z.enum(["TXT", "DOCX"]),
    blockIndex: z.number().int().nonnegative(),
    offset: z.number().nonnegative(),
  }),
]);

export const documentMetadataSchema = z.strictObject({
  id: entityId,
  title: text,
  author: text,
  format: z.enum(["PDF", "EPUB", "DOCX", "TXT"]),
  cover: z.union([
    z.literal(""),
    assetIdSchema,
    z.string().regex(/^\/covers\/[\w-]+\.svg$/),
  ]),
  color: z.string().max(30),
  status: z.enum(["want", "reading", "finished"]),
  pages: z.number().int().positive(),
  collections: z.array(entityId).max(10000),
  addedAt: z.iso.datetime(),
  size: z.number().int().nonnegative(),
  demo: z.boolean().optional(),
  filename: text.optional(),
  contentAsset: assetIdSchema.optional(),
});

export const positionSchema = z.strictObject({
  page: z.number().int().nonnegative(),
  progress: z.number().min(0).max(100),
  location: location.optional(),
  readingPositionUpdatedAt: z.iso.datetime().optional(),
  lastReadAt: z.iso.datetime().optional(),
});

export const annotationSchema = z.strictObject({
  id: entityId,
  documentId: entityId,
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
  points: z.array(point).max(20000).optional(),
  image: assetIdSchema.optional(),
  thickness: z.number().min(1).max(12).optional(),
  opacity: z.number().min(0.1).max(1).optional(),
  fontSize: z.number().min(1).max(500).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const collectionSchema = z.strictObject({
  id: entityId,
  name: text,
  color: z.string().max(30),
});
export const bookmarkSchema = z.strictObject({
  id: entityId,
  documentId: entityId,
  page: z.number().int().nonnegative(),
  location,
  createdAt: z.iso.datetime(),
});
export const preferencesSchema = z.strictObject({
  theme: z.enum(["light", "dark", "system"]),
  fontSize: z.number().min(10).max(48),
  readerTheme: z.enum(["white", "paper", "night"]),
  dailyGoal: z.number().positive(),
});
