import type { SVGProps } from "react";
import Image from "@/components/ui/static-image";
import { ASCENSION_TOKEN_IMAGE_URL, BLITZ_ASCENSION_TOKEN_IMAGE_URL } from "@/lib/codex-types";
import { cn } from "@/lib/utils";

// Matches a Godot 4.5.1 render of the game's own top bar resources (scenes/ui/top_bar.tscn) to about
// 1/8px per level: the icon is a 42px keep-aspect square, AscensionLabel spans x 9..31 of it, Kreon Bold
// at 20px (MegaLabel max; every level fits) with 2px glyph spacing, outline 12 (a 3px round ring),
// shadow (5, 4) at 1/8 black. Units below are icon pixels.
const PX = 20 / 1024;
// Kreon Bold digit advances and left bearings, font units.
const DIGIT_ADVANCE = [604, 373, 550, 534, 551, 529, 567, 465, 558, 556];
const DIGIT_LSB = [38, 20, 14, 17, -5, 11, 37, 25, 34, 28];
// The game draws Kreon as MSDF, which comes out wider and taller than the outline: each glyph grows from
// its left ink edge, bottom sitting at y 33.5.
const MSDF_SCALE_X = 1.065;
const MSDF_SCALE_Y = 1.085;
const BASELINE = 33.52;

// Label centering: the line width counts spacing after every glyph and rounds up, the leftover is
// halved and floored, never below the box's left edge.
function layoutDigits(text: string) {
  const width = [...text].reduce((sum, digit) => sum + DIGIT_ADVANCE[Number(digit)] * PX + 2, 0);
  let x = 9 + Math.max(0, Math.floor((22 - Math.ceil(width)) / 2));
  return [...text].map((digit) => {
    const glyph = { digit, x, ink: x + DIGIT_LSB[Number(digit)] * PX };
    x += DIGIT_ADVANCE[Number(digit)] * PX + 2;
    return glyph;
  });
}

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
  const glyphs = layoutDigits(String(level));
  // Godot paints every glyph's shadow, then every outline, then every fill.
  const pass = (key: string, dx: number, dy: number, paint: SVGProps<SVGTextElement>) => glyphs.map((glyph, index) => {
    const x = glyph.ink + dx;
    const y = BASELINE + dy;
    return (
      <text
        key={`${key}${index}`}
        x={glyph.x + dx}
        y={y}
        transform={`translate(${x} ${y}) scale(${MSDF_SCALE_X} ${MSDF_SCALE_Y}) translate(${-x} ${-y})`}
        fontSize={20}
        fontWeight={700}
        style={{ fontFamily: "var(--font-kreon), serif" }}
        {...paint}
      >
        {glyph.digit}
      </text>
    );
  });
  const fill = blitz ? "#7fff00" : "#fff6e2";
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
        className="h-full w-full object-contain"
        aria-hidden
      />
      {!(blitz && level === 0) && (
        <svg viewBox="0 0 42 42" className="absolute inset-0 h-full w-full overflow-visible" aria-label={String(level)} role="img">
          {pass("s", 5, 4, { fill: "rgba(0,0,0,0.125)" })}
          {/* The ring is 3px outside the glyph; divide out the MSDF growth the transform puts on the stroke. */}
          {pass("o", 0, 0, { fill: outline, stroke: outline, strokeWidth: 6 / ((MSDF_SCALE_X + MSDF_SCALE_Y) / 2), strokeLinejoin: "round" })}
          {pass("f", 0, 0, { fill })}
        </svg>
      )}
    </span>
  );
}
