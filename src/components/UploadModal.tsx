"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

type UploadModalProps = {
  open: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
};

export function UploadModal({ open, onClose, onFile }: UploadModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
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

  const openPicker = useCallback(() => {
    setError(null);
    const input = inputRef.current;
    if (!input) return;
    // Reset so choosing the same file again still fires change
    input.value = "";
    input.click();
  }, []);

  if (!open) return null;

  return (
    <div className="upload-backdrop fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close upload" className="absolute inset-0" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-title"
        className="relative w-full max-w-md border-[3px] border-black bg-cream p-5 shadow-[8px_8px_0_#000] sm:p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono-label text-[10px] font-bold text-black/60">Step 01</p>
            <h2 id="upload-title" className="mt-1 font-display text-2xl text-black">
              Upload PDF
            </h2>
            <p className="mt-2 text-sm text-ink-muted">Your file stays on this device. No cloud.</p>
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

        <div
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
          className={`flex flex-col items-center justify-center border-[3px] border-dashed border-black px-6 py-12 text-center transition ${
            dragOver ? "bg-lime" : "bg-white"
          }`}
        >
          <input
            id={inputId}
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="bookly-file-input"
            onChange={(e) => {
              acceptFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <span className="mb-3 flex h-12 w-12 items-center justify-center border-[3px] border-black bg-blue font-display text-2xl text-white shadow-[3px_3px_0_#000]">
            +
          </span>
          <p className="font-display text-xl text-black">Drop your PDF here</p>
          <p className="mt-2 font-mono-label text-[10px] text-black/50">or</p>
          <button type="button" onClick={openPicker} className="nb-btn nb-btn-lime mt-4 text-sm">
            Choose PDF
          </button>
        </div>

        {error ? (
          <p className="mt-3 border-[3px] border-black bg-pink px-3 py-2 font-display text-sm text-white">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
