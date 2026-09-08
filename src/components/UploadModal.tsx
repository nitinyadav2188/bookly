"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UploadModalProps = {
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
};

export function UploadModal({ open, onClose, onFile }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setDragOver(false);
      setError(null);
    }
  }, [open]);

  const acceptFile = useCallback(
    (file: File | undefined | null) => {
      if (!file) return;
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setError("Please choose a PDF file.");
        return;
      }
      setError(null);
      onFile(file);
    },
    [onFile],
  );

  if (!open) return null;

  return (
    <div className="upload-backdrop fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Close upload"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="relative w-full max-w-md rounded-2xl border border-black/5 bg-[color:var(--surface)] p-6 shadow-[0_30px_60px_-28px_var(--shadow-deep)]"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="upload-title" className="font-display text-2xl text-ink">
              Upload PDF
            </h2>
            <p className="mt-1 text-sm text-ink-soft">Your file stays on this device.</p>
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

        <label
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition ${
            dragOver
              ? "border-ink bg-paper-deep/70"
              : "border-black/15 bg-paper/70 hover:border-black/30"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
          <p className="font-display text-xl text-ink">Drop your PDF here</p>
          <p className="mt-2 text-sm text-ink-soft">or</p>
          <span className="mt-3 inline-flex rounded-md bg-ink px-4 py-2 text-sm text-paper">
            Choose PDF
          </span>
        </label>

        {error ? <p className="mt-3 text-sm text-[color:var(--danger)]">{error}</p> : null}
      </div>
    </div>
  );
}
