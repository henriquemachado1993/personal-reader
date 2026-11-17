import { auth } from "@/auth";
import { database } from "@/infrastructure/database/client";
export async function administratorId() {
  const userId = (await auth())?.user?.id;
  if (!userId) return null;
  const installation = await database().installation.findUnique({
    where: { id: "owner" },
  });
  return installation?.ownerId === userId ? userId : null;
}
