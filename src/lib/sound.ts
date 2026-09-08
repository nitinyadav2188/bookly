let audio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;
let unlocked = false;

const SOUND_PATH = "/sounds/page-turn.wav";

type WebkitWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

/** Absolute URL so static export + trailingSlash never resolve to `/foo/sounds/...`. */
function soundUrl(): string {
  if (typeof window === "undefined") return SOUND_PATH;
  try {
    return new URL(SOUND_PATH, window.location.origin).href;
  } catch {
    return SOUND_PATH;
  }
}

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(soundUrl());
    audio.preload = "auto";
    // Source wav is a soft paper rustle; keep audible without clipping.
    audio.volume = 0.72;
    // iOS Safari / WebView: inline playback, no fullscreen takeover.
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
  }
  return audio;
}

function waitForAudioData(el: HTMLAudioElement, timeoutMs = 2500): Promise<void> {
  if (el.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) return Promise.resolve();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.removeEventListener("canplay", finish);
      el.removeEventListener("loadeddata", finish);
      el.removeEventListener("error", finish);
      resolve();
    };
    el.addEventListener("canplay", finish);
    el.addEventListener("loadeddata", finish);
    el.addEventListener("error", finish);
    window.setTimeout(finish, timeoutMs);
    try {
      el.load();
    } catch {
      // ignore
    }
  });
}

/** Resume AudioContext + silent tick — required on many mobile browsers. */
async function unlockAudioContext(): Promise<void> {
  const AC = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
  try {
    const buffer = audioCtx.createBuffer(1, 1, 22050);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start(0);
  } catch {
    // ignore — resume alone is enough on most engines
  }
}

/**
 * Call from a user gesture (sound toggle). Unlocks AudioContext + HTMLAudio
 * so later page-flip plays are allowed under autoplay policies.
 * Does not leave audible sound playing.
 */
export async function unlockPageSound(): Promise<boolean> {
  try {
    await unlockAudioContext();
    const el = getAudio();
    // Ensure src is still the origin-absolute export path (trailingSlash-safe).
    if (!el.src || !el.src.endsWith(SOUND_PATH)) {
      el.src = soundUrl();
    }
    await waitForAudioData(el);

    el.muted = true;
    el.currentTime = 0;
    await el.play();
    el.pause();
    el.currentTime = 0;
    el.muted = false;
    unlocked = true;
    return true;
  } catch {
    unlocked = false;
    return false;
  }
}

/** Play page-turn on a successful flip. No-op until unlocked + enabled. */
export function playPageTurnSound(enabled: boolean): void {
  if (!enabled || !unlocked) return;
  try {
    if (audioCtx && audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => {});
    }

    const base = getAudio();
    // Clone avoids aborting an in-flight play when flipping quickly.
    const el = base.cloneNode(true) as HTMLAudioElement;
    el.muted = false;
    el.volume = base.volume;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    try {
      el.currentTime = 0;
    } catch {
      // ignore seek errors before metadata
    }
    void el.play().catch(() => {
      // Last resort: reuse the shared element (still gesture-unlocked).
      try {
        base.muted = false;
        base.pause();
        base.currentTime = 0;
        void base.play().catch(() => {});
      } catch {
        // gesture / autoplay restrictions
      }
    });
  } catch {
    // ignore
  }
}

export function isSoundUnlocked(): boolean {
  return unlocked;
}
