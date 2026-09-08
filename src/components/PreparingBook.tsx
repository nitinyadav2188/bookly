"use client";

export function PreparingBook({
  fileName,
  phase = "preparing",
}: {
  fileName?: string;
  phase?: "preparing" | "rendering";
}) {
  const title = phase === "rendering" ? "Rendering pages..." : "Preparing your book...";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-cream px-6">
      <div className="w-full max-w-md border-[3px] border-black bg-white p-8 text-center shadow-[8px_8px_0_#000]">
        <div className="mx-auto mb-6 flex items-center justify-center gap-2">
          <span className="pulse-block" />
          <span className="pulse-block" />
          <span className="pulse-block" />
        </div>
        <p className="font-mono-label text-[10px] font-bold text-black/50">
          {phase === "rendering" ? "Almost ready" : "Working"}
        </p>
        <h1 className="mt-2 font-display text-3xl leading-none text-black">{title}</h1>
        <p className="mt-4 text-sm text-ink-muted">
          {fileName ? (
            <>
              Opening <span className="font-semibold text-black">{fileName}</span> privately on
              this device.
            </>
          ) : (
            "Loading nearby pages for a smooth turn."
          )}
        </p>
        <div className="preparing-bar mt-8">
          <span />
        </div>
      </div>
    </div>
  );
}
