import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";
import { authConfig } from "@/auth";

export const metadata = {
  title: "Sign in — Página",
  description: "Sign in to your Página account. Guest reading stays available without an account.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Your books. Your notes. Your reading space."
      footer={
        <p>
          Guest reading stays free — upload and read without an account anytime.
        </p>
      }
    >
      <Suspense fallback={<p className="text-sm text-ink-muted">Loading…</p>}>
        <LoginForm googleEnabled={authConfig.googleEnabled} />
      </Suspense>
    </AuthShell>
  );
}
