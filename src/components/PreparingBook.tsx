"use client";

export function PreparingBook({
  fileName,
  phase = "preparing",
}: {
  fileName?: string;
  phase?: "preparing" | "rendering";
}) {
  const title = phase === "rendering" ? "Almost a book" : "Opening your PDF";
  const eyebrow = phase === "rendering" ? "Ink landing" : "Private · Local";

  return (
    <div className="bookly-opening fixed inset-0 z-40 flex items-center justify-center px-6">
      <div className="w-full max-w-md border-[3px] border-black bg-white p-8 text-center shadow-[8px_8px_0_#000]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center border-[3px] border-black bg-lime font-display text-2xl text-black shadow-[4px_4px_0_#000]">
          B
        </div>
        <div className="mx-auto mb-5 flex items-center justify-center gap-2">
          <span className="pulse-block" />
          <span className="pulse-block" />
          <span className="pulse-block" />
        </div>
        <p className="font-mono-label text-[10px] font-bold text-black/50">{eyebrow}</p>
        <h1 className="mt-2 font-display text-3xl leading-none text-black">{title}</h1>
        <p className="mt-4 text-sm text-ink-muted">
          {fileName ? (
            <>
              Turning <span className="font-semibold text-black">{fileName}</span> into pages —
              nothing leaves this device.
            </>
          ) : (
            "Warming the first spread for a clean open."
          )}
        </p>
        <div className="preparing-bar mt-8">
          <span />
        </div>
      </div>
    </div>
  );
}
