/** Music and sound effects mixed from the game's FMOD banks by scripts/extract-vexing-puzzlebox-audio.py. */
export const VEXING_PUZZLEBOX_AUDIO_ROOT = "/audio/sts2";

export type PuzzleboxSound =
  | "uiClick"
  | "uiBack"
  | "checkboxOn"
  | "checkboxOff"
  | "cardSlide"
  | "cardStack"
  | "gold"
  | "treasure"
  | "merchantThankYou"
  | "merchantDisappointment"
  | "merchantWelcome"
  | "merchantLaugh";

/** Round-robin files per FMOD event, and a volume that evens out the game mix. */
export const PUZZLEBOX_SOUNDS: Record<PuzzleboxSound, { files: string[]; volume: number; voice?: boolean }> = {
  uiClick: { files: ["ui_click_1", "ui_click_2"], volume: 0.35 },
  uiBack: { files: ["ui_back"], volume: 0.35 },
  checkboxOn: { files: ["checkbox_on"], volume: 0.5 },
  checkboxOff: { files: ["checkbox_off"], volume: 0.5 },
  cardSlide: { files: ["card_slide_1", "card_slide_2", "card_slide_3"], volume: 0.9 },
  cardStack: { files: ["card_stack"], volume: 0.9 },
  gold: { files: ["gold_few"], volume: 0.45 },
  treasure: { files: ["treasure"], volume: 0.45 },
  merchantThankYou: {
    files: ["merchant_thank_you_1", "merchant_thank_you_2", "merchant_thank_you_3"],
    volume: 0.5,
    voice: true,
  },
  merchantDisappointment: {
    files: ["merchant_disappointment_1", "merchant_disappointment_2", "merchant_disappointment_3"],
    volume: 0.5,
    voice: true,
  },
  merchantWelcome: { files: ["merchant_welcome_1", "merchant_welcome_2"], volume: 0.45, voice: true },
  merchantLaugh: { files: ["merchant_laugh_1", "merchant_laugh_2"], volume: 0.45, voice: true },
};

/** event:/music merchant room theme, Overgrowth. */
export const PUZZLEBOX_MUSIC_FILE = "merchant_act1";
export const PUZZLEBOX_MUSIC_VOLUME = 0.25;

export function puzzleboxAudioUrl(file: string): string {
  return `${VEXING_PUZZLEBOX_AUDIO_ROOT}/${file}.m4a`;
}

export type PuzzleboxAudioSettings = {
  music: boolean;
  effects: boolean;
};

const SETTINGS_STORAGE_KEY = "sts-vexing-puzzlebox-audio";
const SETTINGS_CHANGE_EVENT = "sts-vexing-puzzlebox-audio-change";
/** Music starts only when asked for; effects answer clicks, so they start on. */
export const DEFAULT_PUZZLEBOX_AUDIO_SETTINGS: PuzzleboxAudioSettings = { music: false, effects: true };

let cachedRaw: string | null | undefined;
let cachedSettings = DEFAULT_PUZZLEBOX_AUDIO_SETTINGS;

export function readPuzzleboxAudioSettings(): PuzzleboxAudioSettings {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  } catch {
    return cachedSettings;
  }
  // useSyncExternalStore needs the same object back while storage is unchanged.
  if (raw === cachedRaw) return cachedSettings;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<PuzzleboxAudioSettings>) : {};
    cachedSettings = {
      music: typeof parsed.music === "boolean" ? parsed.music : DEFAULT_PUZZLEBOX_AUDIO_SETTINGS.music,
      effects: typeof parsed.effects === "boolean" ? parsed.effects : DEFAULT_PUZZLEBOX_AUDIO_SETTINGS.effects,
    };
  } catch {
    cachedSettings = DEFAULT_PUZZLEBOX_AUDIO_SETTINGS;
  }
  return cachedSettings;
}

export function writePuzzleboxAudioSettings(next: PuzzleboxAudioSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private windows can refuse storage; the change still applies to this page.
    cachedRaw = JSON.stringify(next);
    cachedSettings = next;
  }
  window.dispatchEvent(new Event(SETTINGS_CHANGE_EVENT));
}

export function subscribePuzzleboxAudioSettings(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SETTINGS_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SETTINGS_CHANGE_EVENT, onChange);
  };
}
