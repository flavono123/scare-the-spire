"use client";

import { Music, Volume2, VolumeX } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  DEFAULT_PUZZLEBOX_AUDIO_SETTINGS,
  PUZZLEBOX_MUSIC_FILE,
  PUZZLEBOX_MUSIC_VOLUME,
  PUZZLEBOX_SOUNDS,
  puzzleboxAudioUrl,
  readPuzzleboxAudioSettings,
  subscribePuzzleboxAudioSettings,
  writePuzzleboxAudioSettings,
  type PuzzleboxSound,
} from "@/lib/vexing-puzzlebox-audio";

/** Merchant voice lines share one mouth, as SfxCmd voices do in the shop. */
const VOICE_GAP_MS = 2500;
/** The music picks up where the other tab left it. */
const MUSIC_POSITION_KEY = "sts-vexing-puzzlebox-music-position";

type PlaySound = (sound: PuzzleboxSound) => void;

const PuzzleboxSoundContext = createContext<PlaySound>(() => {});

export function usePuzzleboxSound(): PlaySound {
  return useContext(PuzzleboxSoundContext);
}

function useAudioSettings() {
  return useSyncExternalStore(
    subscribePuzzleboxAudioSettings,
    readPuzzleboxAudioSettings,
    () => DEFAULT_PUZZLEBOX_AUDIO_SETTINGS,
  );
}

export function PuzzleboxAudioProvider({ children }: { children: ReactNode }) {
  const settings = useAudioSettings();
  const cache = useRef(new Map<string, HTMLAudioElement>());
  const rotation = useRef(new Map<PuzzleboxSound, number>());
  const lastVoiceAt = useRef(0);
  const music = useRef<HTMLAudioElement | null>(null);

  const play = useCallback<PlaySound>((sound) => {
    if (!readPuzzleboxAudioSettings().effects) return;
    const spec = PUZZLEBOX_SOUNDS[sound];
    if (spec.voice) {
      const now = performance.now();
      if (now - lastVoiceAt.current < VOICE_GAP_MS) return;
      lastVoiceAt.current = now;
    }
    const turn = rotation.current.get(sound) ?? Math.floor(Math.random() * spec.files.length);
    rotation.current.set(sound, (turn + 1) % spec.files.length);
    const file = spec.files[turn % spec.files.length];
    let base = cache.current.get(file);
    if (!base) {
      base = new Audio(puzzleboxAudioUrl(file));
      base.preload = "auto";
      cache.current.set(file, base);
    }
    const audio = base.cloneNode() as HTMLAudioElement;
    audio.volume = spec.volume;
    void audio.play().catch(() => undefined);
  }, []);

  const musicWasOn = useRef<boolean | null>(null);
  useEffect(() => {
    // Turning the music on opens the shop: NMerchantInventory greets with merchant_welcome.
    if (musicWasOn.current === false && settings.music) play("merchantWelcome");
    musicWasOn.current = settings.music;
  }, [settings.music, play]);

  useEffect(() => {
    if (!settings.music) {
      const current = music.current;
      if (current) {
        current.pause();
        try {
          window.sessionStorage.setItem(MUSIC_POSITION_KEY, String(current.currentTime));
        } catch {
          // The position is a nicety.
        }
      }
      return;
    }
    if (!music.current) {
      const track = new Audio(puzzleboxAudioUrl(PUZZLEBOX_MUSIC_FILE));
      track.loop = true;
      track.volume = PUZZLEBOX_MUSIC_VOLUME;
      try {
        track.currentTime = Number(window.sessionStorage.getItem(MUSIC_POSITION_KEY)) || 0;
      } catch {
        // Start from the top.
      }
      music.current = track;
    }
    const track = music.current;
    // Browsers hold music until the first gesture on a page.
    const start = () => {
      void track.play().catch(() => undefined);
    };
    start();
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
    };
  }, [settings.music]);

  useEffect(() => () => {
    const track = music.current;
    if (!track) return;
    track.pause();
    try {
      window.sessionStorage.setItem(MUSIC_POSITION_KEY, String(track.currentTime));
    } catch {
      // The position is a nicety.
    }
  }, []);

  return <PuzzleboxSoundContext.Provider value={play}>{children}</PuzzleboxSoundContext.Provider>;
}

export function PuzzleboxAudioToggles({
  musicLabel,
  effectsLabel,
}: {
  musicLabel: string;
  effectsLabel: string;
}) {
  const settings = useAudioSettings();
  const buttonClass = (on: boolean) => `inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
    on ? "border-primary/60 text-primary" : "border-border text-muted-foreground hover:text-foreground"
  }`;
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={musicLabel}
        aria-pressed={settings.music}
        title={musicLabel}
        onClick={() => writePuzzleboxAudioSettings({ ...readPuzzleboxAudioSettings(), music: !settings.music })}
        className={buttonClass(settings.music)}
      >
        <Music className={`h-4 w-4 ${settings.music ? "" : "opacity-60"}`} aria-hidden />
      </button>
      <button
        type="button"
        aria-label={effectsLabel}
        aria-pressed={settings.effects}
        title={effectsLabel}
        onClick={() => writePuzzleboxAudioSettings({ ...readPuzzleboxAudioSettings(), effects: !settings.effects })}
        className={buttonClass(settings.effects)}
      >
        {settings.effects ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
}
