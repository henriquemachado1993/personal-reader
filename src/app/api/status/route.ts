import { auth } from "@/auth";
export async function GET() {
  if (!(await auth())?.user?.id)
    return Response.json(
      { error: "Entre para acessar sua biblioteca." },
      { status: 401 },
    );
  return Response.json({
    mode: "remote",
    database: Boolean(process.env.DATABASE_URL && process.env.DIRECT_URL),
    storage: Boolean(
      process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
    ),
    synchronization: true,
  });
}
