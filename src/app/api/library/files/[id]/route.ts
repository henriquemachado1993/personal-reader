import { auth } from "@/auth";
import {
  originalExists,
  signedReadUrl,
  signedUploadUrl,
  writeOriginal,
} from "@/infrastructure/r2/client";
import { isSameOrigin } from "@/modules/auth/same-origin";

async function identity(params: Promise<{ id: string }>) {
  const ownerId = (await auth())?.user?.id;
  const { id } = await params;
  return ownerId && /^[a-zA-Z0-9-]{1,100}$/.test(id)
    ? `${ownerId}/originals/${id}`
    : null;
}
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const key = await identity(context.params);
  if (!key) return new Response(null, { status: 401 });
  if (!(await originalExists(key))) return new Response(null, { status: 404 });
  return new Response(null, {
    status: 307,
    headers: {
      Location: await signedReadUrl(key),
      "Cache-Control": "private, no-store",
    },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const key = await identity(context.params);
  if (!key) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  let size: unknown;
  try {
    size = (await request.json()).size;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0)
    return new Response(null, { status: 400 });
  if (size > 100 * 1024 * 1024) return new Response(null, { status: 413 });
  // An interrupted response or a second device must not upload the original again.
  const exists = await originalExists(key);
  return Response.json(
    exists
      ? { exists: true }
      : { url: await signedUploadUrl(key, "application/octet-stream", size) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const key = await identity(context.params);
  if (!key) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const length = Number(request.headers.get("content-length"));
  if (!length || length > 100 * 1024 * 1024)
    return new Response(null, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length !== length) return new Response(null, { status: 400 });
  await writeOriginal(key, bytes);
  return new Response(null, { status: 204 });
}
