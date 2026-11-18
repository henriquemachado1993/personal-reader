import { auth } from "@/auth";
import { isSameOrigin } from "@/modules/auth/same-origin";
import { replicaResponse } from "@/modules/library/replica-response";
import {
  commitLibraryBatch,
  readLibraryDelta,
} from "@/modules/library/sync-persistence";
import {
  MAX_SYNC_BYTES,
  revisionSchema,
  syncBatchSchema,
} from "@/modules/library/sync-protocol";

export async function GET(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return new Response(null, { status: 401 });
  const query = new URL(request.url).searchParams.get("since");
  const since = query === null ? undefined : Number(query);
  if (
    query !== null &&
    (!/^\d+$/.test(query) || !revisionSchema.safeParse(since).success)
  )
    return new Response(null, { status: 400 });
  const delta = await readLibraryDelta(ownerId, since);
  return delta ? replicaResponse(delta) : new Response(null, { status: 401 });
}

export async function POST(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (Number(request.headers.get("content-length")) > MAX_SYNC_BYTES)
    return new Response(null, { status: 413 });
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_SYNC_BYTES)
    return new Response(null, { status: 413 });
  const batch = syncBatchSchema.safeParse(parseJson(body));
  if (!batch.success) return new Response(null, { status: 400 });

  const result = await commitLibraryBatch(ownerId, batch.data);
  if (result.status === 200) return replicaResponse(result.delta);
  if (result.status === 409)
    return replicaResponse({ revision: result.revision }, 409);
  return new Response(null, { status: result.status });
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}
