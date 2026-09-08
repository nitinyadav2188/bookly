"use client";

export function PreparingBook({ fileName }: { fileName?: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[color:var(--paper)] px-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-6 flex items-center justify-center gap-2">
          <span className="pulse-dot" />
          <span className="pulse-dot [animation-delay:150ms]" />
          <span className="pulse-dot [animation-delay:300ms]" />
        </div>
        <h1 className="font-display text-3xl text-ink">Preparing your book...</h1>
        <p className="mt-3 text-sm text-ink-soft">
          {fileName ? (
            <>
              Opening <span className="text-ink">{fileName}</span> privately on this device.
            </>
          ) : (
            "Rendering the first pages for a smooth turn."
          )}
        </p>
        <div className="preparing-bar mt-8">
          <span />
        </div>
      </div>
    </div>
  );
}
