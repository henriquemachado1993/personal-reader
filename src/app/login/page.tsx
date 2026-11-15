import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { database } from "@/infrastructure/database/client";
import { LoginForm } from "@/modules/auth/login-form";
import { AuthShell } from "@/modules/auth/auth-shell";
export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/library");
  let firstRun = false,
    available = true;
  try {
    firstRun = !(await database().installation.findUnique({
      where: { id: "owner" },
    }));
  } catch {
    available = false;
  }
  return (
    <AuthShell>
      <LoginForm firstRun={firstRun} available={available} />
    </AuthShell>
  );
}
