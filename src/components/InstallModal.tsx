"use client";

import { useEffect, useState } from "react";
import {
  getPlatformHint,
  isStandaloneDisplay,
  promptPwaInstall,
  subscribeInstallPrompt,
} from "@/lib/install";

type InstallModalProps = {
  open: boolean;
  onClose: () => void;
};

export function InstallModal({ open, onClose }: InstallModalProps) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [apkAvailable, setApkAvailable] = useState(false);
  const platform = getPlatformHint();
  const standalone = typeof window !== "undefined" ? isStandaloneDisplay() : false;

  useEffect(() => {
    if (!open) return;
    return subscribeInstallPrompt((event) => setCanPrompt(Boolean(event)));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/downloads/bookly.apk", { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setApkAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setApkAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="upload-backdrop fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close install" className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="relative w-full max-w-lg rounded-2xl border border-black/5 bg-[color:var(--surface)] p-6 shadow-[0_30px_60px_-28px_var(--shadow-deep)]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="install-title" className="font-display text-2xl text-ink">
              Install Bookly
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              Read like a native app — same private, on-device experience.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-ink-soft transition hover:bg-black/[0.05] hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-black/8 bg-paper/80 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
              Install on phone
            </p>
            {standalone ? (
              <p className="mt-2 text-sm text-ink-soft">Bookly is already installed on this device.</p>
            ) : (
              <>
                {canPrompt ? (
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md bg-ink px-4 py-3 text-sm text-paper transition hover:bg-accent"
                    onClick={async () => {
                      const outcome = await promptPwaInstall();
                      if (outcome === "accepted") {
                        setStatus("Installed — you can open Bookly from your home screen.");
                      } else if (outcome === "dismissed") {
                        setStatus("Install canceled.");
                      }
                    }}
                  >
                    Add Bookly to home screen
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 text-sm text-ink-soft">
                    {platform === "ios" ? (
                      <p>
                        Tap <strong className="font-medium text-ink">Share</strong>, then{" "}
                        <strong className="font-medium text-ink">Add to Home Screen</strong>.
                      </p>
                    ) : platform === "android" ? (
                      <p>
                        Open the browser menu and choose{" "}
                        <strong className="font-medium text-ink">Install app</strong> or{" "}
                        <strong className="font-medium text-ink">Add to Home screen</strong>.
                      </p>
                    ) : (
                      <p>
                        Use your browser&apos;s install icon in the address bar, or open Bookly on
                        your phone to install.
                      </p>
                    )}
                  </div>
                )}

                {apkAvailable ? (
                  <a
                    href="/downloads/bookly.apk"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-md border border-black/10 bg-white/50 px-4 py-3 text-sm text-ink transition hover:bg-white"
                  >
                    Download Android APK
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-ink-faint">
                    APK builds ship from Capacitor — see README for `npm run android:build`.
                  </p>
                )}
              </>
            )}
          </section>

          <section className="rounded-xl border border-black/8 bg-transparent p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-faint">
              Use in browser
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              No install needed. Upload a PDF and start reading — everything stays local.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              Continue in browser
            </button>
          </section>

          {status ? <p className="text-sm text-ink-soft">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
