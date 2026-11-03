"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import Image from "@/components/ui/static-image";
import {
  DEFAULT_PUZZLEBOX_AUDIO_SETTINGS,
  PUZZLEBOX_MUSIC_FILE,
  PUZZLEBOX_MUSIC_VOLUME,
  PUZZLEBOX_SOUNDS,
  puzzleboxAudioUrl,
  readPuzzleboxAudioSettings,
  subscribePuzzleboxAudioSettings,
  writePuzzleboxAudioSettings,
  type PuzzleboxAudioSettings,
  type PuzzleboxSound,
} from "@/lib/vexing-puzzlebox-audio";

/** Merchant voice lines share one mouth, as SfxCmd voices do in the shop. */
const VOICE_GAP_MS = 2500;
/** The music picks up where the other tab left it. */
const MUSIC_POSITION_KEY = "sts-vexing-puzzlebox-music-position";
const MUSIC_STATE_EVENT = "sts-vexing-puzzlebox-music-state";
const SLIDER_STEP = 5;

/** off: volume 0; waiting: the browser holds the music until the first click or key on the page. */
export type MusicState = "off" | "waiting" | "playing";

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

let musicState: MusicState = "off";

function setMusicState(next: MusicState) {
  if (musicState === next) return;
  musicState = next;
  window.dispatchEvent(new Event(MUSIC_STATE_EVENT));
}

function useMusicState(): MusicState {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(MUSIC_STATE_EVENT, onChange);
      return () => window.removeEventListener(MUSIC_STATE_EVENT, onChange);
    },
    () => musicState,
    () => "off",
  );
}

function saveMusicPosition(track: HTMLAudioElement) {
  try {
    window.sessionStorage.setItem(MUSIC_POSITION_KEY, String(track.currentTime));
  } catch {
    // The position is a nicety.
  }
}

export function PuzzleboxAudioProvider({ children }: { children: ReactNode }) {
  const settings = useAudioSettings();
  const cache = useRef(new Map<string, HTMLAudioElement>());
  const rotation = useRef(new Map<PuzzleboxSound, number>());
  const lastVoiceAt = useRef(0);
  const music = useRef<HTMLAudioElement | null>(null);

  const play = useCallback<PlaySound>((sound) => {
    const effects = readPuzzleboxAudioSettings().effects;
    if (effects <= 0) return;
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
    audio.volume = spec.volume * (effects / 100);
    void audio.play().catch(() => undefined);
  }, []);

  const musicOn = settings.music > 0;
  const musicWasOn = useRef<boolean | null>(null);
  useEffect(() => {
    // Turning the music on opens the shop: NMerchantInventory greets with merchant_welcome.
    if (musicWasOn.current === false && musicOn) play("merchantWelcome");
    musicWasOn.current = musicOn;
  }, [musicOn, play]);

  useEffect(() => {
    if (music.current) music.current.volume = PUZZLEBOX_MUSIC_VOLUME * (settings.music / 100);
  }, [settings.music]);

  useEffect(() => {
    if (!musicOn) {
      if (music.current) {
        music.current.pause();
        saveMusicPosition(music.current);
      }
      setMusicState("off");
      return;
    }
    if (!music.current) {
      const track = new Audio(puzzleboxAudioUrl(PUZZLEBOX_MUSIC_FILE));
      track.loop = true;
      track.volume = PUZZLEBOX_MUSIC_VOLUME * (readPuzzleboxAudioSettings().music / 100);
      try {
        track.currentTime = Number(window.sessionStorage.getItem(MUSIC_POSITION_KEY)) || 0;
      } catch {
        // Start from the top.
      }
      track.addEventListener("playing", () => setMusicState("playing"));
      music.current = track;
    }
    const track = music.current;
    // A reload or a fresh tab has no user activation yet, so the browser refuses
    // to start sound until the first click or key press anywhere on the page.
    const start = () => {
      track.play().then(() => setMusicState("playing"), () => setMusicState("waiting"));
    };
    start();
    const events = ["pointerdown", "keydown", "touchend"] as const;
    for (const type of events) window.addEventListener(type, start, { once: true, capture: true });
    return () => {
      for (const type of events) window.removeEventListener(type, start, { capture: true });
    };
  }, [musicOn]);

  useEffect(() => () => {
    const track = music.current;
    if (!track) return;
    track.pause();
    saveMusicPosition(track);
    setMusicState("off");
  }, []);

  return <PuzzleboxSoundContext.Provider value={play}>{children}</PuzzleboxSoundContext.Provider>;
}

/**
 * settings_slider.tscn: a dark health bar track at 36% black, a teal-grey health bar
 * fill (0.36, 0.45, 0.46), the scrollbar train as the handle, and the value in cream.
 */
function GameVolumeSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const valueAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return value;
    return Math.round(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)) * 100);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? SLIDER_STEP
      : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -SLIDER_STEP : 0;
    if (event.key === "Home") onChange(0);
    else if (event.key === "End") onChange(100);
    else if (step) onChange(Math.min(100, Math.max(0, value + step)));
    else return;
    event.preventDefault();
  };
  return (
    <div className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3">
      <span className="font-game-title text-sm font-bold text-[#efc851]">{label}</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          dragging.current = true;
          onChange(valueAt(event));
        }}
        onPointerMove={(event) => {
          if (dragging.current) onChange(valueAt(event));
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        className="relative h-6 cursor-pointer touch-none rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#efc851]"
      >
        <span
          className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 opacity-40"
          style={{
            borderImage: "url(/images/sts2/combat-ui/ui/health_bar_bg.webp) 0 9 fill / 0 9px stretch",
            borderStyle: "solid",
            borderWidth: "0 9px",
            filter: "brightness(0)",
          }}
        />
        <span
          className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-sm"
          style={{ width: `${value}%`, backgroundColor: "rgb(92, 115, 117)" }}
        />
        <Image
          src="/images/sts2/ui/scrollbar/train.png"
          alt=""
          width={58}
          height={89}
          className="pointer-events-none absolute top-1/2 h-7 w-auto -translate-x-1/2 -translate-y-1/2 drop-shadow"
          style={{ left: `${value}%` }}
        />
      </div>
      <span className="text-right font-game-title text-sm tabular-nums text-[#fff6e2]">{value}</span>
    </div>
  );
}

/** The top bar settings button, opening the game's sound tab as a popover. */
export function PuzzleboxSoundSettings({
  title,
  musicLabel,
  effectsLabel,
  waitingLabel,
}: {
  title: string;
  musicLabel: string;
  effectsLabel: string;
  /** Shown while the music waits for the first click on the page. */
  waitingLabel: string;
}) {
  const settings = useAudioSettings();
  const state = useMusicState();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const update = (next: Partial<PuzzleboxAudioSettings>) => (
    writePuzzleboxAudioSettings({ ...readPuzzleboxAudioSettings(), ...next })
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={title}
        aria-expanded={open}
        title={state === "waiting" ? waitingLabel : title}
        data-music-state={state}
        onClick={() => setOpen(!open)}
        className={`relative flex h-9 w-9 items-center justify-center transition-transform hover:scale-110 ${
          state === "waiting" ? "puzzlebox-music-waiting" : ""
        }`}
      >
        <Image
          src="/images/sts2/ui/topbar/top_bar_settings.png"
          alt=""
          width={64}
          height={64}
          className="h-8 w-8 object-contain drop-shadow"
        />
      </button>
      {open && (
        <div
          role="group"
          aria-label={title}
          data-sound-settings
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-[#3d5a63] bg-[#14232a]/95 p-4 shadow-xl"
        >
          <p className="mb-3 font-game-title text-base font-bold text-[#fff6e2]">{title}</p>
          <div className="space-y-3">
            <GameVolumeSlider label={musicLabel} value={settings.music} onChange={(music) => update({ music })} />
            <GameVolumeSlider label={effectsLabel} value={settings.effects} onChange={(effects) => update({ effects })} />
          </div>
          {state === "waiting" && <p className="mt-3 text-xs text-muted-foreground">{waitingLabel}</p>}
        </div>
      )}
    </div>
  );
}
