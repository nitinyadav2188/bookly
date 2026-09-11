"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { type FormEvent, useState } from "react";

type SignupFormProps = {
  googleEnabled: boolean;
};

export function SignupForm({ googleEnabled }: SignupFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Could not create account.");
        setPending(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl: "/",
      });
      if (result?.error) {
        setError("Account created, but sign-in failed. Try logging in.");
        setPending(false);
        window.location.assign("/login");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Could not create account. Try again.");
      setPending(false);
    }
  }

  return (
    <form className="auth-form flex flex-col gap-3" onSubmit={onSubmit}>
      <label className="block">
        <span className="font-mono-label text-[10px] font-bold text-black/55">Name</span>
        <input
          type="text"
          autoComplete="name"
          required
          minLength={2}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full border-[3px] border-black bg-cream px-3 py-2.5 text-sm outline-none focus:bg-white"
        />
      </label>
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
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border-[3px] border-black bg-cream px-3 py-2.5 text-sm outline-none focus:bg-white"
        />
      </label>
      <label className="block">
        <span className="font-mono-label text-[10px] font-bold text-black/55">Confirm password</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="mt-1 w-full border-[3px] border-black bg-cream px-3 py-2.5 text-sm outline-none focus:bg-white"
        />
      </label>

      {error ? (
        <p className="border-[3px] border-black bg-pink px-3 py-2 text-sm font-semibold text-white">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="nb-btn nb-btn-lime mt-1 w-full text-sm">
        {pending ? "Creating…" : "Create my Página account"}
      </button>

      <div className="relative my-1 text-center">
        <span className="font-mono-label bg-white px-2 text-[9px] font-bold text-black/40">or</span>
      </div>

      {googleEnabled ? (
        <button
          type="button"
          className="nb-btn nb-btn-white w-full text-sm"
          onClick={() => void signIn("google", { callbackUrl: "/" })}
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
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-black underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}
