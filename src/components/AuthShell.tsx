import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="auth-shell min-h-screen">
      <header className="border-b-[3px] border-black bg-cream">
        <div className="bookly-container flex h-14 items-center justify-between sm:h-[68px]">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center border-[3px] border-black bg-lime text-lg font-black text-black shadow-[3px_3px_0_#000]"
              aria-hidden
            >
              P
            </span>
            <span className="font-display text-xl text-black sm:text-2xl">Página</span>
          </Link>
          <Link
            href="/"
            className="font-mono-label text-[10px] font-bold text-black/60 underline-offset-4 hover:text-black hover:underline"
          >
            Back to reading
          </Link>
        </div>
      </header>

      <main className="bookly-container flex flex-1 justify-center py-10 sm:py-14">
        <div className="auth-panel w-full max-w-md border-[3px] border-black bg-white p-5 shadow-[8px_8px_0_#000] sm:p-7">
          <p className="font-mono-label text-[10px] font-bold text-black/50">Account</p>
          <h1 className="mt-2 font-display text-3xl leading-none text-black sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
          <div className="mt-6 border-t-[3px] border-black/10 pt-4 text-sm text-ink-muted">{footer}</div>
        </div>
      </main>
    </div>
  );
}
