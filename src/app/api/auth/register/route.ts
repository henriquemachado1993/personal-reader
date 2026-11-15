import { hash } from "bcryptjs";
import { database } from "@/infrastructure/database/client";
import { registrationSchema } from "@/modules/auth/validation";
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return Response.json({ error: "Solicitação inválida." }, { status: 403 });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Formato inválido." }, { status: 415 });
  try {
    const payload = await request.text();
    if (payload.length > 4096)
      return Response.json({ error: "Dados muito longos." }, { status: 413 });
    const input = registrationSchema.safeParse(JSON.parse(payload));
    if (!input.success)
      return Response.json(
        {
          error:
            "Informe seu nome, um e-mail válido e uma senha de 10 a 128 caracteres.",
        },
        { status: 400 },
      );
    const db = database();
    if (await db.installation.findUnique({ where: { id: "owner" } }))
      return Response.json(
        {
          error:
            "Esta biblioteca já tem uma conta. Entre com seu e-mail e senha.",
        },
        { status: 403 },
      );
    const passwordHash = await hash(input.data.password, 12);
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: input.data.email, name: input.data.name, passwordHash },
      });
      await tx.installation.create({ data: { id: "owner", ownerId: user.id } });
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch {
    return Response.json(
      {
        error:
          "Não foi possível criar a conta. Verifique sua conexão ou tente entrar se ela já existe.",
      },
      { status: 503 },
    );
  }
}
