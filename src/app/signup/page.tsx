import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";
import { authConfig } from "@/auth";

export const metadata = {
  title: "Create account — Página",
  description: "Create a Página account. Reading as a guest still works without signing up.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create account"
      subtitle="Your books. Your notes. Your reading space."
      footer={
        <p>
          No phone, address, or birthday required. Guest mode remains available.
        </p>
      }
    >
      <SignupForm googleEnabled={authConfig.googleEnabled} />
    </AuthShell>
  );
}
