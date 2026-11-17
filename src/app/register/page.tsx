import { AuthShell } from "@/modules/auth/auth-shell";
import { InvitedRegistration } from "@/modules/auth/invited-registration";
export const metadata = {
  title: "Cadastro por convite · Le-Books",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function RegisterPage() {
  return (
    <AuthShell>
      <InvitedRegistration />
    </AuthShell>
  );
}
