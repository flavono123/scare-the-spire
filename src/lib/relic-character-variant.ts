import type { CodexRelic, RelicPool } from "@/lib/codex-types";
import { characterPoolSlug } from "@/lib/user-profile";

/** Game character order: 아이언클래드, 사일런트, 리젠트, 네크로바인더, 디펙트 */
export const RELIC_CHARACTER_VARIANT_ORDER: RelicPool[] = [
  "ironclad",
  "silent",
  "regent",
  "necrobinder",
  "defect",
];

export function relicPoolFromCharacterId(characterId: string): RelicPool {
  return characterPoolSlug(characterId);
}

export function pickRelicCharacterVariant(
  relic: Pick<CodexRelic, "variantImageUrls">,
  preferred: RelicPool | string | null | undefined,
): RelicPool | null {
  const urls = relic.variantImageUrls;
  if (!urls) return null;
  if (preferred && urls[preferred as RelicPool]) return preferred as RelicPool;
  return RELIC_CHARACTER_VARIANT_ORDER.find((pool) => urls[pool]) ?? null;
}

export function resolveRelicDisplayImage(
  relic: Pick<CodexRelic, "imageUrl" | "variantImageUrls" | "betaImageUrl">,
  preferred: RelicPool | string | null | undefined,
  options?: { showBeta?: boolean },
): string | null {
  if (options?.showBeta && relic.betaImageUrl) return relic.betaImageUrl;
  if (relic.imageUrl) return relic.imageUrl;
  const pool = pickRelicCharacterVariant(relic, preferred);
  return pool ? relic.variantImageUrls?.[pool] ?? null : null;
}
