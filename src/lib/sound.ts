/**
 * Page-turn sound via Web Audio (primary) + HTMLAudio fallback.
 * Must be unlocked from a user gesture before play works under autoplay policies.
 */

const SOUND_PATH = "/sounds/page-turn.wav";

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let audioCtx: AudioContext | null = null;
let pageBuffer: AudioBuffer | null = null;
let htmlAudio: HTMLAudioElement | null = null;
let unlocked = false;
let loadPromise: Promise<AudioBuffer | null> | null = null;

function soundUrl(): string {
  if (typeof window === "undefined") return SOUND_PATH;
  try {
    return new URL(SOUND_PATH, window.location.origin).href;
  } catch {
    return SOUND_PATH;
  }
}

function getCtx(): AudioContext | null {
  const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

async function ensureBuffer(): Promise<AudioBuffer | null> {
  if (pageBuffer) return pageBuffer;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const ctx = getCtx();
    if (!ctx) return null;
    try {
      const res = await fetch(soundUrl(), { cache: "force-cache", credentials: "same-origin" });
      if (!res.ok) return null;
      const raw = await res.arrayBuffer();
      pageBuffer = await ctx.decodeAudioData(raw.slice(0));
      return pageBuffer;
    } catch {
      return null;
    }
  })();

  return loadPromise;
}

function getHtmlAudio(): HTMLAudioElement {
  if (!htmlAudio) {
    htmlAudio = new Audio(soundUrl());
    htmlAudio.preload = "auto";
    htmlAudio.volume = 1;
    htmlAudio.setAttribute("playsinline", "true");
    htmlAudio.setAttribute("webkit-playsinline", "true");
  }
  return htmlAudio;
}

/** Resume AudioContext — required on many mobile browsers. */
async function resumeCtx(): Promise<AudioContext | null> {
  const ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch {
      // ignore
    }
  }
  return ctx;
}

/**
 * Call from a user gesture (sound toggle). Unlocks AudioContext + buffers the WAV
 * so later page-flip plays are allowed under autoplay policies.
 */
export async function unlockPageSound(): Promise<boolean> {
  try {
    const ctx = await resumeCtx();
    await ensureBuffer();

    // Silent tick proves the context can output after a gesture.
    if (ctx) {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }

    // Also unlock HTMLAudio for the fallback path.
    const el = getHtmlAudio();
    if (!el.src || !el.src.includes("page-turn.wav")) {
      el.src = soundUrl();
    }
    el.muted = true;
    el.currentTime = 0;
    try {
      await el.play();
    } catch {
      // Context path may still work
    }
    el.pause();
    el.currentTime = 0;
    el.muted = false;

    unlocked = true;

    // Audible confirmation that sound is on.
    playPageTurnSound(true);
    return true;
  } catch {
    unlocked = false;
    return false;
  }
}

function playViaWebAudio(): boolean {
  const ctx = getCtx();
  if (!ctx || !pageBuffer || ctx.state === "closed") return false;
  if (ctx.state === "suspended") {
    void ctx.resume().catch(() => {});
  }

  try {
    const source = ctx.createBufferSource();
    source.buffer = pageBuffer;
    const gain = ctx.createGain();
    // WAV is already strong; slight lift for laptop speakers.
    gain.gain.value = 1.15;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start(0);
    return true;
  } catch {
    return false;
  }
}

function playViaHtmlAudio(): void {
  try {
    const base = getHtmlAudio();
    const el = base.cloneNode(true) as HTMLAudioElement;
    el.muted = false;
    el.volume = 1;
    el.setAttribute("playsinline", "true");
    try {
      el.currentTime = 0;
    } catch {
      // ignore
    }
    void el.play().catch(() => {
      try {
        base.muted = false;
        base.pause();
        base.currentTime = 0;
        void base.play().catch(() => {});
      } catch {
        // autoplay blocked
      }
    });
  } catch {
    // ignore
  }
}

/** Play page-turn on a successful flip. No-op until unlocked + enabled. */
export function playPageTurnSound(enabled: boolean): void {
  if (!enabled || !unlocked) return;
  // Prefer Web Audio (reliable after unlock); fall back to HTMLAudio.
  if (!playViaWebAudio()) {
    // Kick buffer load for next flip if decode was slow.
    void ensureBuffer();
    playViaHtmlAudio();
  }
}

export function isSoundUnlocked(): boolean {
  return unlocked;
}

/** Prefetch decode without unlocking (safe before gesture). */
export function warmPageSound(): void {
  if (typeof window === "undefined") return;
  void ensureBuffer().catch(() => {});
}
