import { PrismaClient } from "@prisma/client";
const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };
export function database() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Configure DATABASE_URL do Supabase antes de usar a persistência remota.",
    );
  const client = globalDatabase.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalDatabase.prisma = client;
  return client;
}
