import { z } from "zod";
import { createHmac } from "node:crypto";
import { database } from "@/infrastructure/database/client";
import { sendPasswordRecovery } from "@/infrastructure/email/mailtrap";
import { createRecoveryToken } from "@/modules/auth/recovery-token";
import { isSameOrigin } from "@/modules/auth/same-origin";

const accepted = () =>
  Response.json({
    message:
      "Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.",
  });
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });
  if (
    !process.env.MAILTRAP_API_TOKEN ||
    !process.env.MAILTRAP_FROM_EMAIL ||
    !process.env.AUTH_URL ||
    !process.env.AUTH_SECRET
  )
    return Response.json(
      {
        error:
          "A recuperação por e-mail ainda não está disponível. Tente novamente mais tarde.",
      },
      { status: 503 },
    );
  try {
    const body = await request.text();
    if (body.length > 1024) return new Response(null, { status: 413 });
    const { email } = z
      .object({
        email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
      })
      .parse(JSON.parse(body));
    const db = database();
    const key =
      "recovery:" +
      createHmac("sha256", process.env.AUTH_SECRET).update(email).digest("hex");
    const attempt = await db.loginAttempt.upsert({
      where: { key },
      create: { key },
      update: { count: { increment: 1 } },
    });
    if (Date.now() - attempt.windowStart.getTime() > 3600000)
      await db.loginAttempt.update({
        where: { key },
        data: { count: 1, windowStart: new Date() },
      });
    else if (attempt.count > 3) return accepted();
    const user = await db.user.findUnique({ where: { email } });
    if (!user) return accepted();
    const reset = createRecoveryToken();
    await db.passwordReset.create({
      data: {
        tokenHash: reset.tokenHash,
        expiresAt: reset.expiresAt,
        userId: user.id,
      },
    });
    const link = new URL("/reset-password", process.env.AUTH_URL);
    // The fragment stays out of server access logs and referrer headers.
    link.hash = reset.token;
    try {
      await sendPasswordRecovery(email, link.toString());
    } catch {
      await db.passwordReset.deleteMany({
        where: { tokenHash: reset.tokenHash },
      });
    }
    return accepted();
  } catch {
    return accepted();
  }
}
