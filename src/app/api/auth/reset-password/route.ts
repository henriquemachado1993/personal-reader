import { z } from "zod";
import { hash } from "bcryptjs";
import { database } from "@/infrastructure/database/client";
import { resetTokenHash } from "@/modules/auth/recovery-token";
import { isSameOrigin } from "@/modules/auth/same-origin";
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  try {
    const body = await request.text();
    if (body.length > 2048) return new Response(null, { status: 413 });
    const input = z
      .object({
        token: z.string().regex(/^[a-f0-9]{64}$/),
        password: z.string().min(10).max(128),
      })
      .parse(JSON.parse(body));
    const tokenHash = resetTokenHash(input.token);
    const db = database();
    const reset = await db.passwordReset.findUnique({ where: { tokenHash } });
    if (!reset || reset.expiresAt <= new Date()) throw new Error("expired");
    const passwordHash = await hash(input.password, 12);
    await db.$transaction(async (tx) => {
      const consumed = await tx.passwordReset.deleteMany({
        where: { tokenHash, expiresAt: { gt: new Date() } },
      });
      if (consumed.count !== 1) throw new Error("used");
      await tx.user.update({
        where: { id: reset.userId },
        data: { passwordHash, passwordChangedAt: new Date() },
      });
      await tx.passwordReset.deleteMany({ where: { userId: reset.userId } });
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error:
          "Link inválido ou expirado. Solicite outro link e use uma senha de 10 a 128 caracteres.",
      },
      { status: 400 },
    );
  }
}
