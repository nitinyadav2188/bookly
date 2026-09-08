export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export type InstallFlowResult = "prompted" | "downloaded" | "fallback" | "standalone";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(event: BeforeInstallPromptEvent | null) => void>();

/** Cached APK probe so Install never waits on a cold HEAD. */
let apkStatus: "unknown" | "yes" | "no" = "unknown";
let apkCheckPromise: Promise<boolean> | null = null;
const apkListeners = new Set<(available: boolean) => void>();

export function captureInstallPrompt(event: BeforeInstallPromptEvent): void {
  deferredPrompt = event;
  listeners.forEach((fn) => fn(event));
}

export function clearInstallPrompt(): void {
  deferredPrompt = null;
  listeners.forEach((fn) => fn(null));
}

export function getInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function subscribeInstallPrompt(
  fn: (event: BeforeInstallPromptEvent | null) => void,
): () => void {
  listeners.add(fn);
  fn(deferredPrompt);
  return () => listeners.delete(fn);
}

export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  clearInstallPrompt();
  return choice.outcome;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

export function getPlatformHint(): "android" | "ios" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

export function getApkAvailableCached(): boolean | null {
  if (apkStatus === "yes") return true;
  if (apkStatus === "no") return false;
  return null;
}

export function subscribeApkAvailable(fn: (available: boolean) => void): () => void {
  apkListeners.add(fn);
  if (apkStatus !== "unknown") fn(apkStatus === "yes");
  return () => apkListeners.delete(fn);
}

function setApkStatus(available: boolean): void {
  apkStatus = available ? "yes" : "no";
  apkListeners.forEach((fn) => fn(available));
}

/** Background / short-timeout probe for `/downloads/bookly.apk`. */
export async function checkApkAvailable(timeoutMs = 800): Promise<boolean> {
  if (apkStatus === "yes") return true;
  if (apkStatus === "no") return false;
  if (apkCheckPromise) return apkCheckPromise;

  apkCheckPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch("/downloads/bookly.apk", {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      });
      window.clearTimeout(timer);
      setApkStatus(res.ok);
      return res.ok;
    } catch {
      setApkStatus(false);
      return false;
    } finally {
      apkCheckPromise = null;
    }
  })();

  return apkCheckPromise;
}

/** Fire-and-forget warm-up so Install clicks stay instant. */
export function warmApkCheck(): void {
  if (typeof window === "undefined") return;
  if (apkStatus !== "unknown") return;
  void checkApkAvailable(1200);
}

export function triggerApkDownload(): void {
  const a = document.createElement("a");
  a.href = "/downloads/bookly.apk";
  a.download = "bookly.apk";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Primary Install CTA: start the useful action immediately.
 * PWA prompt → APK download (non-iOS) → caller shows short A2HS fallback.
 */
export async function startInstallFlow(): Promise<InstallFlowResult> {
  if (isStandaloneDisplay()) return "standalone";

  if (getInstallPrompt()) {
    await promptPwaInstall();
    return "prompted";
  }

  // iOS can't install APKs — go straight to Add to Home Screen steps.
  if (getPlatformHint() === "ios") {
    return "fallback";
  }

  const cached = getApkAvailableCached();
  if (cached === true) {
    triggerApkDownload();
    return "downloaded";
  }
  if (cached === false) {
    return "fallback";
  }

  // Unknown: brief probe only — never leave the button hanging.
  const hasApk = await checkApkAvailable(400);
  if (hasApk) {
    triggerApkDownload();
    return "downloaded";
  }
  return "fallback";
}
