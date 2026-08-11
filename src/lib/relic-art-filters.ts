/**
 * STS2 relic icon preview filters.
 *
 * Use plain CSS filter functions only. SVG `url(#id)` filters on <img> are
 * unreliable here (especially when composed with drop-shadow), which made
 * "melted" look like the untouched bright-red original.
 *
 * Targets (from game):
 * - wax: relic.gdshader is_wax → luminance * (1, 0.8, 0.8)
 * - melted: wax + SelfModulate DarkRed + Disabled Modulate #808080 → near-black
 * - gray: is_used + #808080
 */

export type RelicArtFilterMode = "none" | "wax" | "melted" | "gray";

const FILTERS: Record<Exclude<RelicArtFilterMode, "none">, string> = {
  // Desaturate then slight warm/pink wax cast.
  wax: "grayscale(1) brightness(1.05) contrast(0.95) sepia(0.35) saturate(0.55) hue-rotate(-20deg)",
  // Near-black melted wax (no high saturate — that reads as bright red on ironclad relics).
  melted: "grayscale(1) brightness(0.22)",
  gray: "grayscale(1) brightness(0.5)",
};

export function relicArtFilterCss(mode: RelicArtFilterMode): string | undefined {
  if (mode === "none") return undefined;
  return FILTERS[mode];
}

/** Join art + outline CSS filters (all functions — safe to compose). */
export function composeRelicDetailFilters(
  artMode: RelicArtFilterMode,
  outlineFilter: string | undefined,
): string | undefined {
  const parts = [relicArtFilterCss(artMode), outlineFilter].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : undefined;
}

export type RelicArtFilterSource = "wax" | "status" | null;

/** Last-clicked family wins when wax and used-up/disabled are both active. */
export function resolveRelicArtFilterMode(opts: {
  betaOverrides: boolean;
  source: RelicArtFilterSource;
  waxCycle: "off" | "wax" | "melted";
  statusOn: boolean;
}): RelicArtFilterMode {
  if (opts.betaOverrides) return "none";
  if (opts.source === "wax" && opts.waxCycle !== "off") return opts.waxCycle;
  if (opts.source === "status" && opts.statusOn) return "gray";
  if (opts.waxCycle !== "off") return opts.waxCycle;
  if (opts.statusOn) return "gray";
  return "none";
}
