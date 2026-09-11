"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { type FormEvent, useEffect, useState } from "react";

export default function AccountClient() {
  const { data: session, status, update } = useSession();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
  }, [session?.user?.name]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await res.json()) as { error?: string; user?: { name: string } };
      if (!res.ok) {
        setError(data.error || "Could not save.");
        setPending(false);
        return;
      }
      await update({ name: data.user?.name });
      setMessage("Saved.");
      setPending(false);
    } catch {
      setError("Could not save.");
      setPending(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="bookly-container py-16">
        <p className="font-mono-label text-sm text-black/50">Loading account…</p>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b-[3px] border-black bg-cream">
        <div className="bookly-container flex h-14 items-center justify-between sm:h-[68px]">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center border-[3px] border-black bg-lime text-lg font-black shadow-[3px_3px_0_#000]"
              aria-hidden
            >
              P
            </span>
            <span className="font-display text-xl sm:text-2xl">Página</span>
          </Link>
          <Link href="/" className="font-mono-label text-[10px] font-bold text-black/60 hover:underline">
            Back home
          </Link>
        </div>
      </header>

      <main className="bookly-container max-w-lg py-10 sm:py-14">
        <p className="font-mono-label text-[10px] font-bold text-black/50">Account</p>
        <h1 className="mt-2 font-display text-3xl">Your profile</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Identity only for now — library sync is not part of this pass.
        </p>

        <form
          onSubmit={onSave}
          className="mt-8 border-[3px] border-black bg-white p-5 shadow-[6px_6px_0_#000]"
        >
          <label className="block">
            <span className="font-mono-label text-[10px] font-bold text-black/55">Display name</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              className="mt-1 w-full border-[3px] border-black bg-cream px-3 py-2.5 text-sm outline-none focus:bg-white"
            />
          </label>
          <label className="mt-4 block">
            <span className="font-mono-label text-[10px] font-bold text-black/55">Email</span>
            <input
              type="email"
              value={session.user.email || ""}
              disabled
              className="mt-1 w-full border-[3px] border-black bg-black/5 px-3 py-2.5 text-sm text-black/60"
            />
          </label>

          {error ? (
            <p className="mt-3 border-[3px] border-black bg-pink px-3 py-2 text-sm text-white">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-3 border-[3px] border-black bg-lime px-3 py-2 text-sm text-black">{message}</p>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            <button type="submit" disabled={pending} className="nb-btn nb-btn-lime text-sm">
              {pending ? "Saving…" : "Save name"}
            </button>
            <button
              type="button"
              className="nb-btn nb-btn-white text-sm"
              onClick={() => void signOut({ callbackUrl: "/" })}
            >
              Sign out
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
