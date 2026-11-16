import { RecoveryForm } from "@/modules/auth/recovery-form";
import { AuthShell } from "@/modules/auth/auth-shell";
export const metadata = {
  title: "Nova senha · Le-Books",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <RecoveryForm reset />
    </AuthShell>
  );
}
