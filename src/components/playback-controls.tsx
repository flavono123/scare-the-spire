import { cn } from "@/lib/utils";

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.5 L12 7 L3 12.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="1.5" width="3.2" height="11" />
      <rect x="8.3" y="1.5" width="3.2" height="11" />
    </svg>
  );
}

/** The History Course playback play/pause button. */
export function PlaybackToggle({
  playing,
  playLabel,
  pauseLabel,
  onToggle,
  className,
}: {
  playing: boolean;
  playLabel: string;
  pauseLabel: string;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-history-play-toggle=""
      onClick={onToggle}
      className={cn(
        "flex h-7 w-12 items-center justify-center rounded-md border border-white/20 bg-black/40 transition hover:bg-white/10",
        className,
      )}
      aria-label={playing ? pauseLabel : playLabel}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

/** The History Course playback rate group. */
export function PlaybackRateGroup<T extends string | number>({
  rates,
  rate,
  onChange,
  label,
  isDisabled,
}: {
  rates: readonly T[];
  rate: T;
  onChange: (rate: T) => void;
  label: (rate: T) => string;
  isDisabled?: (rate: T) => boolean;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-md border border-white/15 bg-black/30">
      {rates.map((r) => {
        const disabled = isDisabled?.(r) ?? false;
        return (
          <button
            key={String(r)}
            type="button"
            onClick={() => onChange(r)}
            disabled={disabled}
            className={cn(
              "px-2 py-1 transition",
              rate === r
                ? "bg-amber-500/30 text-amber-100"
                : "text-zinc-300 hover:bg-white/10",
              disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
            )}
            aria-pressed={rate === r}
          >
            {label(r)}
          </button>
        );
      })}
    </div>
  );
}
