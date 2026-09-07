"use client";

import { cn } from "@/lib/utils";

export function DevViewportFrame({
  label,
  src,
  width,
  height,
  maxDisplayWidth,
}: {
  label: string;
  src: string | null;
  width: number;
  height: number;
  maxDisplayWidth: number;
}) {
  const scale = Math.min(1, maxDisplayWidth / width);
  const displayWidth = Math.round(width * scale);
  const displayHeight = Math.round(height * scale);

  return (
    <figure
      data-dev-viewport-frame
      data-dev-viewport-label={label}
      className="flex min-w-0 flex-col gap-2"
    >
      <figcaption className="flex items-baseline justify-between gap-2 text-xs text-zinc-400">
        <span className="font-semibold text-zinc-200">{label}</span>
        <span className="font-mono tabular-nums">
          {width}×{height}
          {scale < 1 ? ` · ×${scale.toFixed(2)}` : ""}
        </span>
      </figcaption>
      <div
        className={cn(
          "overflow-hidden rounded-lg border border-white/10 bg-black/40",
          !src && "flex items-center justify-center",
        )}
        style={{ width: displayWidth, height: displayHeight }}
      >
        {src ? (
          <iframe
            title={label}
            src={src}
            width={width}
            height={height}
            loading="lazy"
            className="origin-top-left border-0 bg-background"
            style={{ transform: `scale(${scale})` }}
          />
        ) : (
          <p className="px-4 text-center text-xs text-zinc-500">예시 글이 없습니다</p>
        )}
      </div>
    </figure>
  );
}
