import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createRecoveryToken } from "../src/modules/auth/recovery-token";
import { sendPasswordRecovery } from "../src/infrastructure/email/mailtrap";
if (!process.argv.includes("--send"))
  throw new Error("Use --send somente com autorização para enviar o e-mail.");
async function sendAuthorizedRecoveryTest() {
  const db = new PrismaClient();
  try {
    const installation = await db.installation.findUniqueOrThrow({
      where: { id: "owner" },
    });
    const user = await db.user.findUniqueOrThrow({
      where: { id: installation.ownerId },
    });
    const token = createRecoveryToken();
    const link = new URL("/reset-password", process.env.AUTH_URL);
    link.hash = token.token;
    await db.passwordReset.create({
      data: {
        tokenHash: token.tokenHash,
        userId: user.id,
        expiresAt: token.expiresAt,
      },
    });
    try {
      await sendPasswordRecovery(user.email, link.toString());
      console.log(
        "Mailtrap aceitou o e-mail de recuperação para a conta proprietária.",
      );
    } catch (error) {
      await db.passwordReset.deleteMany({
        where: { tokenHash: token.tokenHash },
      });
      throw error;
    }
  } finally {
    await db.$disconnect();
  }
}
void sendAuthorizedRecoveryTest().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha no envio");
  process.exitCode = 1;
});
