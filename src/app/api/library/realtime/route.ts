import { SignJWT } from "jose";
import { importRealtimeSigningKey } from "@/modules/library/realtime-signing";
import { auth } from "@/auth";
import { database } from "@/infrastructure/database/client";
import { isSameOrigin } from "@/modules/auth/same-origin";

const lifetime = 10 * 60;

function localRealtime(url: string | undefined) {
  if (!url) return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const ownerId = (await auth())?.user?.id;
  if (!ownerId) return new Response(null, { status: 401 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (
    !(await database().user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    }))
  )
    return new Response(null, { status: 401 });

  const privateKey = process.env.SUPABASE_REALTIME_SIGNING_JWK;
  const localSecret = process.env.SUPABASE_REALTIME_LOCAL_JWT_SECRET;
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({ role: "authenticated", reader_realtime: true })
    .setSubject(ownerId)
    .setAudience("authenticated")
    .setIssuedAt(now)
    .setExpirationTime(now + lifetime);

  let token: string;
  if (privateKey) {
    try {
      const { kid, key } = await importRealtimeSigningKey(privateKey);
      token = await jwt
        .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
        .sign(key);
    } catch {
      console.error(
        "Não foi possível usar SUPABASE_REALTIME_SIGNING_JWK para assinar o token.",
      );
      return new Response(null, { status: 503 });
    }
  } else if (
    localSecret &&
    localRealtime(process.env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    token = await jwt
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(new TextEncoder().encode(localSecret));
  } else {
    return new Response(null, { status: 503 });
  }
  return Response.json(
    { token, expiresIn: lifetime },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
