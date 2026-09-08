const SESSION_PREFIX = "bookly:page:";
const LOCAL_PREFIX = "bookly:page:v1:";

function readStorage(storage: Storage, key: string): number | null {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const page = Number(raw);
    return Number.isFinite(page) && page >= 0 ? page : null;
  } catch {
    return null;
  }
}

export function getSavedPage(documentId: string): number | null {
  if (typeof window === "undefined") return null;
  // Prefer durable localStorage (long-period resume), then session fallback.
  const local = readStorage(localStorage, LOCAL_PREFIX + documentId);
  if (local != null) return local;
  return readStorage(sessionStorage, SESSION_PREFIX + documentId);
}

export function savePage(documentId: string, pageIndex: number): void {
  if (typeof window === "undefined") return;
  const value = String(Math.max(0, pageIndex));
  try {
    localStorage.setItem(LOCAL_PREFIX + documentId, value);
  } catch {
    // quota / private mode
  }
  try {
    sessionStorage.setItem(SESSION_PREFIX + documentId, value);
  } catch {
    // ignore
  }
}

export function clearSavedPage(documentId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_PREFIX + documentId);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(LOCAL_PREFIX + documentId);
  } catch {
    // ignore
  }
}
