import { auth } from "@/auth";
import { database } from "@/infrastructure/database/client";
import {
  objectMetadata,
  signedReadUrl,
  signedUploadUrl,
} from "@/infrastructure/r2/client";
import {
  assetIdPattern,
  fileKey,
  uploadType,
} from "@/infrastructure/r2/file-key";
import { isSameOrigin } from "@/modules/auth/same-origin";
import { entityId } from "@/modules/library/library-schemas";

async function fileIdentity(params: Promise<{ id: string }>) {
  const ownerId = (await auth())?.user?.id;
  const { id } = await params;
  if (!ownerId || !entityId.safeParse(id).success) return null;
  if (
    !(await database().user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    }))
  )
    return null;
  return { id, key: fileKey(ownerId, id) };
}

const privateHeaders = { "Cache-Control": "private, no-store" };

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const file = await fileIdentity(context.params);
  if (!file) return new Response(null, { status: 401 });
  const object = await objectMetadata(file.key);
  if (!object) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 307,
    headers: { ...privateHeaders, Location: await signedReadUrl(file.key) },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const file = await fileIdentity(context.params);
  if (!file) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const size: unknown = body?.size;
  const type = uploadType(file.id, body?.type);
  if (
    !type ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size <= 0
  )
    return new Response(null, { status: 400 });
  const limit = assetIdPattern.test(file.id)
    ? 25 * 1024 * 1024
    : 100 * 1024 * 1024;
  if (size > limit) return new Response(null, { status: 413 });
  const object = await objectMetadata(file.key);
  if (object && (object.type !== type || object.size !== size))
    return new Response(null, { status: 409 });
  return Response.json(
    object
      ? { exists: true }
      : { url: await signedUploadUrl(file.key, type, size) },
    { headers: privateHeaders },
  );
}
