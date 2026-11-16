import { RecoveryForm } from "@/modules/auth/recovery-form";
import { AuthShell } from "@/modules/auth/auth-shell";
export const metadata = { title: "Recuperar acesso · Le-Books" };
export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <RecoveryForm />
    </AuthShell>
  );
}
