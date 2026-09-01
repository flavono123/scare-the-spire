import {
  CHARACTER_PALETTE_PAIRS,
  resolveDuotoneColors,
  type CharacterPalettePair,
} from "@/lib/dev-character-palettes";

/** Public profile excludes 아이보리/연하늘색 from the video 16. */
export const PROFILE_EXCLUDED_PALETTE_ID = "ivory-sky";

export const PROFILE_PALETTE_PAIRS: readonly CharacterPalettePair[] =
  CHARACTER_PALETTE_PAIRS.filter((pair) => pair.id !== PROFILE_EXCLUDED_PALETTE_ID);

const PROFILE_PALETTE_BY_ID = new Map(
  PROFILE_PALETTE_PAIRS.map((pair) => [pair.id, pair] as const),
);

export function isProfilePaletteId(id: string | null | undefined): id is string {
  return Boolean(id && PROFILE_PALETTE_BY_ID.has(id));
}

export function profilePaletteById(id: string | null | undefined): CharacterPalettePair | null {
  if (!id) return null;
  return PROFILE_PALETTE_BY_ID.get(id) ?? null;
}

export function resolveProfileDuotone(profile: {
  paletteId: string | null;
  paletteSwapped: boolean;
}): { shadow: string; highlight: string } | null {
  const pair = profilePaletteById(profile.paletteId);
  if (!pair) return null;
  return resolveDuotoneColors(pair.colorA, pair.colorB, profile.paletteSwapped);
}

/** Hard diagonal: top-right → bottom-left. */
export function profilePaletteDiagonalStyle(
  colorA: string,
  colorB: string,
  swapped = false,
): { backgroundImage: string } {
  const topRight = swapped ? colorB : colorA;
  const bottomLeft = swapped ? colorA : colorB;
  return {
    backgroundImage: `linear-gradient(to bottom left, ${topRight} 50%, ${bottomLeft} 50%)`,
  };
}
