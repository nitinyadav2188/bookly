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
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 1200);
    fetch("/downloads/bookly.apk", { method: "HEAD", signal: controller.signal })
      .then((res) => {
        if (!cancelled) setApkAvailable(res.ok);
      })
      .catch(() => {
        if (!cancelled) setApkAvailable(false);
      })
      .finally(() => {
        window.clearTimeout(timer);
      });
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
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
        className="relative w-full max-w-lg border-[3px] border-black bg-cream p-5 shadow-[8px_8px_0_#000] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-label text-[10px] font-bold text-black/60">Install</p>
            <h2 id="install-title" className="mt-1 font-display text-2xl text-black">
              Install Bookly
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Same private reader. Fullscreen. Home screen ready.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-[3px] border-black bg-white px-2.5 py-1 font-display text-sm shadow-[3px_3px_0_#000]"
            aria-label="Close"
          >
            X
          </button>
        </div>

        <div className="space-y-4">
          <section className="border-[3px] border-black bg-white p-4 shadow-[4px_4px_0_#000]">
            <p className="font-mono-label text-[10px] font-bold text-black/60">Install on phone</p>
            {standalone ? (
              <p className="mt-2 text-sm text-ink-muted">Bookly is already installed on this device.</p>
            ) : (
              <>
                {canPrompt ? (
                  <button
                    type="button"
                    className="nb-btn nb-btn-lime mt-3 w-full text-sm"
                    onClick={async () => {
                      const outcome = await promptPwaInstall();
                      if (outcome === "accepted") {
                        setStatus("Installed. Open Bookly from your home screen.");
                      } else if (outcome === "dismissed") {
                        setStatus("Install canceled.");
                      }
                    }}
                  >
                    Add to home screen
                  </button>
                ) : (
                  <div className="mt-2 space-y-2 text-sm text-ink-muted">
                    {platform === "ios" ? (
                      <p>
                        Tap <strong className="text-black">Share</strong>, then{" "}
                        <strong className="text-black">Add to Home Screen</strong>.
                      </p>
                    ) : platform === "android" ? (
                      <p>
                        Open the browser menu →{" "}
                        <strong className="text-black">Install app</strong> /{" "}
                        <strong className="text-black">Add to Home screen</strong>.
                      </p>
                    ) : (
                      <p>Use the install icon in your address bar, or open Bookly on your phone.</p>
                    )}
                  </div>
                )}

                {apkAvailable ? (
                  <a href="/downloads/bookly.apk" className="nb-btn nb-btn-blue mt-3 w-full text-sm">
                    Download Android APK
                  </a>
                ) : (
                  <p className="mt-3 font-mono-label text-[10px] text-black/45">
                    APK via Capacitor — see README (`npm run android:build`)
                  </p>
                )}
              </>
            )}
          </section>

          <section className="border-[3px] border-black bg-lime p-4 shadow-[4px_4px_0_#000]">
            <p className="font-mono-label text-[10px] font-bold text-black/60">Use in browser</p>
            <p className="mt-2 text-sm text-black">
              No install needed. Upload a PDF and start reading — everything stays local.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="nb-btn nb-btn-white mt-3 text-sm"
            >
              Continue in browser
            </button>
          </section>

          {status ? (
            <p className="border-[3px] border-black bg-blue px-3 py-2 font-display text-sm text-white">
              {status}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
