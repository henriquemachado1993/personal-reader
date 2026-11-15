import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LibraryIdentity } from "@/components/layout/library-identity";
export async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return (
    <LibraryIdentity
      userId={session.user.id}
      name={session.user.name ?? "Leitor"}
    >
      {children}
    </LibraryIdentity>
  );
}
