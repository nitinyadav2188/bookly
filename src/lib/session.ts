const PREFIX = "bookly:page:";

export function getSavedPage(documentId: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + documentId);
    if (!raw) return null;
    const page = Number(raw);
    return Number.isFinite(page) && page >= 0 ? page : null;
  } catch {
    return null;
  }
}

export function savePage(documentId: string, pageIndex: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PREFIX + documentId, String(Math.max(0, pageIndex)));
  } catch {
    // ignore quota / private mode
  }
}

export function clearSavedPage(documentId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(PREFIX + documentId);
  } catch {
    // ignore
  }
}
