import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { readFile } from "node:fs/promises";

// Recovery runs on the trusted server; never expose an owner reset through an unauthenticated API.
const email = process.argv[2];
const passwordFile = process.argv[3];
if (!email || !passwordFile)
  throw new Error(
    "Uso: node scripts/reset-password.mjs EMAIL ARQUIVO_PRIVADO_COM_NOVA_SENHA",
  );
const password = (await readFile(passwordFile, "utf8")).trim();
if (password.length < 10 || password.length > 128)
  throw new Error("A senha deve ter entre 10 e 128 caracteres.");
const db = new PrismaClient();
try {
  await db.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { passwordHash: await hash(password, 12), passwordChangedAt: new Date() },
  });
  console.log("Senha atualizada. Entre novamente na biblioteca.");
} finally {
  await db.$disconnect();
}
