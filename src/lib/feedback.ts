/** Experience feedback — local snooze, visit tracking, IndexedDB log. */

export const PAGE_FLIP_EVENT = "bookly:page-flip";
export const READER_OPEN_EVENT = "bookly:reader-open";
export const READER_CLOSE_EVENT = "bookly:reader-close";

const SNOOZE_KEY = "bookly-feedback-snooze-until";
const VISIT_KEY = "bookly-feedback-visits";
const SESSION_DONE_KEY = "bookly-feedback-session-done";
const SESSION_VISIT_KEY = "bookly-feedback-visit-counted";

/** Hide again for ~10 days after dismiss or submit. */
export const FEEDBACK_SNOOZE_MS = 10 * 24 * 60 * 60 * 1000;

const DB_NAME = "bookly-feedback";
const DB_VERSION = 1;
const STORE = "submissions";

export type FeedbackTrigger = "flip" | "dwell" | "return-visit";

export type FeedbackSubmission = {
  id: string;
  rating: number;
  comment: string;
  createdAt: number;
  trigger: FeedbackTrigger;
};

function canUseStorage(storage: Storage | undefined): storage is Storage {
  return typeof storage !== "undefined";
}

export function isFeedbackBlocked(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (canUseStorage(sessionStorage) && sessionStorage.getItem(SESSION_DONE_KEY) === "1") {
      return true;
    }
    if (canUseStorage(localStorage)) {
      const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
      if (Number.isFinite(until) && until > Date.now()) return true;
    }
  } catch {
    // private mode / blocked storage
  }
  return false;
}

export function snoozeFeedback(): void {
  try {
    if (canUseStorage(sessionStorage)) {
      sessionStorage.setItem(SESSION_DONE_KEY, "1");
    }
    if (canUseStorage(localStorage)) {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + FEEDBACK_SNOOZE_MS));
    }
  } catch {
    // ignore
  }
}

/** Count at most one visit per browser tab session. Returns total visit count. */
export function bumpFeedbackVisit(): number {
  try {
    if (!canUseStorage(sessionStorage) || !canUseStorage(localStorage)) return 1;
    if (sessionStorage.getItem(SESSION_VISIT_KEY) === "1") {
      return getFeedbackVisitCount();
    }
    sessionStorage.setItem(SESSION_VISIT_KEY, "1");
    const next = getFeedbackVisitCount() + 1;
    localStorage.setItem(VISIT_KEY, String(next));
    return next;
  } catch {
    return 1;
  }
}

export function getFeedbackVisitCount(): number {
  try {
    if (!canUseStorage(localStorage)) return 0;
    const n = Number(localStorage.getItem(VISIT_KEY) || 0);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function emitPageFlipSignal(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PAGE_FLIP_EVENT));
}

export function emitReaderOpen(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(READER_OPEN_EVENT));
}

export function emitReaderClose(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(READER_CLOSE_EVENT));
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open feedback DB"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

const LOCAL_LOG_KEY = "bookly-feedback-log";

function appendLocalLog(entry: FeedbackSubmission): void {
  try {
    if (!canUseStorage(localStorage)) return;
    const raw = localStorage.getItem(LOCAL_LOG_KEY);
    const list: FeedbackSubmission[] = raw ? (JSON.parse(raw) as FeedbackSubmission[]) : [];
    list.push(entry);
    // Cap so storage stays tiny
    const trimmed = list.slice(-40);
    localStorage.setItem(LOCAL_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

/** Persist a submission locally (IndexedDB + localStorage fallback). No network required. */
export async function saveFeedbackSubmission(
  rating: number,
  comment: string,
  trigger: FeedbackTrigger,
): Promise<FeedbackSubmission> {
  const entry: FeedbackSubmission = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    rating,
    comment: comment.trim().slice(0, 500),
    createdAt: Date.now(),
    trigger,
  };

  appendLocalLog(entry);

  try {
    const db = await openDb();
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    await txDone(tx);
    db.close();
  } catch {
    // localStorage already has a copy
  }

  return entry;
}
