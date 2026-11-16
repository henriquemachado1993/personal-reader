import { auth } from "@/auth";
import { isSameOrigin } from "@/modules/auth/same-origin";
import { signedUploadUrl } from "@/infrastructure/r2/client";
import { z } from "zod";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success)
    return new Response(null, { status: 400 });
  let size: number;
  try {
    size = z
      .object({ size: z.number().int().positive().max(25_000_000) })
      .parse(await request.json()).size;
  } catch {
    return new Response(null, { status: 400 });
  }
  return Response.json(
    {
      url: await signedUploadUrl(
        `sync-snapshots/${ownerId}/${id}`,
        "application/octet-stream",
        size,
      ),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
