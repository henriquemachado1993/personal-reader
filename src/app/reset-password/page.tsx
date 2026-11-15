import { RecoveryForm } from "@/modules/auth/recovery-form";
export const metadata = {
  title: "Nova senha · Personal Reader",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function ResetPasswordPage() {
  return <RecoveryForm reset />;
}
