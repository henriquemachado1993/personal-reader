import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
const database = new PrismaClient();
try {
  await database.$queryRaw`SELECT 1`;
  console.log("Conexão PostgreSQL do Supabase: OK.");
  const installations = await database.installation.count();
  await database.loginAttempt.count();
  console.log(`Schema de autenticação: OK. Biblioteca ${installations ? "com proprietário" : "pronta para o primeiro cadastro"}.`);
} catch (error) {
  console.log(
    "Conexão PostgreSQL: indisponível. Código: " + (error.code ?? "connection"),
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
