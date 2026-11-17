import { registrationSchema } from "@/modules/auth/validation";
import { invitationTokenSchema } from "@/modules/auth/invitations";
import {
  registerAccount,
  RegistrationError,
} from "@/modules/auth/register-account";
import { isSameOrigin } from "@/modules/auth/same-origin";
export async function POST(request: Request) {
  if (!isSameOrigin(request))
    return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Formato inválido." }, { status: 415 });
  try {
    const payload = await request.text();
    if (payload.length > 4096)
      return Response.json({ error: "Dados muito longos." }, { status: 413 });
    const parsed = registrationSchema
      .extend({ inviteToken: invitationTokenSchema.optional() })
      .safeParse(JSON.parse(payload));
    if (!parsed.success)
      return Response.json(
        {
          error:
            "Informe seu nome, um e-mail válido e uma senha de 10 a 128 caracteres.",
        },
        { status: 400 },
      );
    await registerAccount(parsed.data);
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof RegistrationError
            ? error.message
            : "Não foi possível criar a conta. Verifique sua conexão e tente novamente.",
      },
      { status: error instanceof RegistrationError ? error.status : 503 },
    );
  }
}
