import Image from "@/components/ui/static-image";
import { ASCENSION_TOKEN_IMAGE_URL, BLITZ_ASCENSION_TOKEN_IMAGE_URL } from "@/lib/codex-types";
import { cn } from "@/lib/utils";

// scenes/ui/top_bar.tscn: AscensionIcon is a 42px square (keep-aspect, centered). AscensionLabel spans it
// inset 9 left / 11 right and grown 3 up / 15 down, so the number sits 6px below the icon's middle.
// Kreon Bold, outline 12, shadow (5, 4) at 1/8 black.
const ICON = 42;

export function AscensionToken({
  level,
  className,
  size = 80,
  blitz = false,
}: {
  level: number;
  className?: string;
  size?: number;
  /** Blitz run look (BlitzIconConfig): green bolt, green label, no label at 0. */
  blitz?: boolean;
}) {
  const unit = size / ICON;
  const outline = blitz ? "#054f22" : "#593400";
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={blitz ? BLITZ_ASCENSION_TOKEN_IMAGE_URL : ASCENSION_TOKEN_IMAGE_URL}
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-contain drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
        aria-hidden
      />
      {!(blitz && level === 0) && (
        <span
          className={cn("absolute flex items-center justify-center font-bold leading-none", blitz ? "text-[#7fff00]" : "text-[#fff6e2]")}
          style={{
            left: 9 * unit,
            right: 11 * unit,
            top: -3 * unit,
            bottom: -15 * unit,
            fontFamily: "var(--font-kreon), serif",
            // shortcut: the scene's 20 (MegaLabel then autosizes) read too big against the game; 16 matches by eye, recheck with a game capture.
            fontSize: 16 * unit,
            // Godot strokes outline_size / 4 out from the glyph (FreeType radius size * 16 in 26.6); a centered
            // stroke under the fill shows half its width outside.
            WebkitTextStroke: `${6 * unit}px ${outline}`,
            paintOrder: "stroke fill",
            textShadow: `${5 * unit}px ${4 * unit}px 0 rgba(0,0,0,0.125)`,
          }}
        >
          {level}
        </span>
      )}
    </span>
  );
}
