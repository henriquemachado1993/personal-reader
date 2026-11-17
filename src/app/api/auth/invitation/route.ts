import { database } from "@/infrastructure/database/client";
import {
  invitationTokenSchema,
  invitationHash,
  invitationIsActive,
} from "@/modules/auth/invitations";
import { isSameOrigin } from "@/modules/auth/same-origin";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  const body = await request.text();
  if (body.length > 1024) return new Response(null, { status: 413 });
  try {
    const token = invitationTokenSchema.parse(JSON.parse(body).token);
    const invite = await database().registrationInvite.findUnique({
      where: { tokenHash: invitationHash(token) },
    });
    if (!invitationIsActive(invite))
      return Response.json(
        {
          error:
            "Convite inválido, expirado ou já utilizado. Peça um novo link a quem convidou você.",
        },
        { status: 400 },
      );
    return Response.json(
      { email: invite!.email, expiresAt: invite!.expiresAt },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return Response.json(
      {
        error:
          "Não foi possível verificar o convite. Tente novamente ou peça um novo link.",
      },
      { status: 400 },
    );
  }
}
