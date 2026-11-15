import { auth } from "@/auth";
import { readOriginal, writeOriginal } from "@/infrastructure/r2/client";
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
  try {
    const file = await readOriginal(key);
    return new Response(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "application/octet-stream",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
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
