"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useId, useRef, useState } from "react";

function initialsFor(name?: string | null, email?: string | null): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

type UserMenuProps = {
  variant?: "header" | "reader";
};

export function UserMenu({ variant = "header" }: UserMenuProps) {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (status === "loading") {
    return (
      <span
        className={
          variant === "reader"
            ? "reader-chip reader-chip-white opacity-60"
            : "hidden h-9 w-16 animate-pulse border-[3px] border-black/20 bg-black/5 sm:inline-block"
        }
        aria-hidden
      />
    );
  }

  if (!session?.user) {
    if (variant === "reader") {
      return (
        <Link href="/login" className="reader-chip reader-chip-white" title="Sign in">
          Sign in
        </Link>
      );
    }
    return null;
  }

  const label = session.user.name || session.user.email || "Account";
  const initials = initialsFor(session.user.name, session.user.email);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={
          variant === "reader"
            ? "reader-chip reader-chip-lime flex items-center gap-1.5 !px-2"
            : "flex h-9 items-center gap-2 border-[3px] border-black bg-white px-2 shadow-[3px_3px_0_#000] transition hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_#000]"
        }
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        title={label}
      >
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            className="h-6 w-6 border-2 border-black object-cover"
          />
        ) : (
          <span
            className={
              variant === "reader"
                ? "flex h-5 w-5 items-center justify-center bg-black text-[9px] font-bold text-lime"
                : "flex h-6 w-6 items-center justify-center bg-lime font-display text-[10px] text-black"
            }
            aria-hidden
          >
            {initials}
          </span>
        )}
        <span className={variant === "reader" ? "hidden sm:inline" : "hidden max-w-[7rem] truncate font-mono-label text-[10px] font-bold sm:inline"}>
          {variant === "reader" ? "You" : label.split(" ")[0]}
        </span>
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 border-[3px] border-black bg-cream p-2 shadow-[5px_5px_0_#000]"
        >
          <div className="border-b-[3px] border-black/15 px-2 pb-2 pt-1">
            <p className="truncate font-display text-sm text-black">{session.user.name || "Reader"}</p>
            <p className="truncate font-mono-label text-[9px] text-black/55">{session.user.email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            className="mt-1 block px-2 py-2 font-mono-label text-[10px] font-bold text-black hover:bg-lime"
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          <button
            type="button"
            role="menuitem"
            className="w-full px-2 py-2 text-left font-mono-label text-[10px] font-bold text-black hover:bg-pink hover:text-white"
            onClick={() => {
              setOpen(false);
              void signOut({ callbackUrl: "/" });
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
