let audio: HTMLAudioElement | null = null;
let unlocked = false;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio("/sounds/page-turn.wav");
    audio.preload = "auto";
    audio.volume = 0.32;
  }
  return audio;
}

/** Browsers require a user gesture before audio can play. */
export async function unlockPageSound(): Promise<boolean> {
  try {
    const el = getAudio();
    el.muted = true;
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

export function playPageTurnSound(enabled: boolean): void {
  if (!enabled || !unlocked) return;
  try {
    const el = getAudio();
    el.pause();
    el.currentTime = 0;
    void el.play().catch(() => {
      // gesture / autoplay restrictions
    });
  } catch {
    // ignore
  }
}

export function isSoundUnlocked(): boolean {
  return unlocked;
}
