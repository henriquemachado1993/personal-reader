import { administratorId } from "@/modules/auth/administrator";
import { database } from "@/infrastructure/database/client";
import { isSameOrigin } from "@/modules/auth/same-origin";
import {
  createInvitation,
  invitationEmailSchema,
} from "@/modules/auth/invitations";
import { z } from "zod";
const selection = {
  id: true,
  email: true,
  createdAt: true,
  expiresAt: true,
  usedAt: true,
  revokedAt: true,
} as const;
export async function GET() {
  const issuerId = await administratorId();
  if (!issuerId) return new Response(null, { status: 403 });
  const invitations = await database().registrationInvite.findMany({
    where: { issuerId },
    select: selection,
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return Response.json(
    { invitations },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  const issuerId = await administratorId();
  if (!issuerId) return new Response(null, { status: 403 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.text();
  if (body.length > 1024) return new Response(null, { status: 413 });
  let email: string;
  try {
    email = invitationEmailSchema.parse(JSON.parse(body).email);
  } catch {
    return Response.json(
      { error: "Informe um e-mail válido." },
      { status: 400 },
    );
  }
  const invite = createInvitation();
  const saved = await database().$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"reader-registration"}))`;
    if (await tx.user.findUnique({ where: { email } })) return null;
    await tx.registrationInvite.updateMany({
      where: { email, usedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.registrationInvite.create({
      data: {
        email,
        issuerId,
        tokenHash: invite.tokenHash,
        expiresAt: invite.expiresAt,
      },
      select: selection,
    });
  });
  if (!saved)
    return Response.json(
      {
        error:
          "Este e-mail já tem uma conta. A pessoa pode entrar ou recuperar a senha.",
      },
      { status: 409 },
    );
  return Response.json(
    { invitation: saved, token: invite.token },
    { status: 201, headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function DELETE(request: Request) {
  const issuerId = await administratorId();
  if (!issuerId) return new Response(null, { status: 403 });
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.text();
  if (body.length > 1024) return new Response(null, { status: 413 });
  let id: string;
  try {
    id = z.uuid().parse(JSON.parse(body).id);
  } catch {
    return new Response(null, { status: 400 });
  }
  await database().registrationInvite.updateMany({
    where: { id, issuerId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return new Response(null, { status: 204 });
}
