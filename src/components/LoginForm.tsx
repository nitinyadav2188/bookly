"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

type LoginFormProps = {
  googleEnabled: boolean;
};

export function LoginForm({ googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [forgotNote, setForgotNote] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("Invalid email or password.");
        setPending(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Could not sign in. Try again.");
      setPending(false);
    }
  }

  return (
    <form className="auth-form flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="block">
        <span className="font-mono-label text-[10px] font-bold text-black/55">Email</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full border-[3px] border-black bg-cream px-3 py-2.5 text-sm outline-none focus:bg-white"
        />
      </label>
      <label className="block">
        <span className="font-mono-label text-[10px] font-bold text-black/55">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border-[3px] border-black bg-cream px-3 py-2.5 text-sm outline-none focus:bg-white"
        />
      </label>

      <button
        type="button"
        className="self-start font-mono-label text-[9px] font-bold text-black/50 underline-offset-2 hover:text-black hover:underline"
        onClick={() => setForgotNote(true)}
      >
        Forgot password?
      </button>
      {forgotNote ? (
        <p className="border-[3px] border-black bg-orange/30 px-3 py-2 text-xs text-black">
          Password reset email is coming soon. For now, create a new account or contact support.
        </p>
      ) : null}

      {error ? (
        <p className="border-[3px] border-black bg-pink px-3 py-2 text-sm font-semibold text-white">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="nb-btn nb-btn-lime mt-1 w-full text-sm">
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <div className="relative my-1 text-center">
        <span className="font-mono-label bg-white px-2 text-[9px] font-bold text-black/40">or</span>
      </div>

      {googleEnabled ? (
        <button
          type="button"
          className="nb-btn nb-btn-white w-full text-sm"
          onClick={() => void signIn("google", { callbackUrl })}
        >
          Continue with Google
        </button>
      ) : (
        <button
          type="button"
          disabled
          className="nb-btn nb-btn-white w-full cursor-not-allowed text-sm opacity-50"
          title="Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable"
        >
          Continue with Google
        </button>
      )}
      {!googleEnabled ? (
        <p className="text-center text-xs text-ink-muted">
          Google sign-in is disabled until OAuth keys are configured.
        </p>
      ) : null}

      <p className="mt-2 text-center text-sm text-ink-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-black underline underline-offset-2">
          Create account
        </Link>
      </p>
    </form>
  );
}
