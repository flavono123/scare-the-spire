import relicArtVariantsCatalog from "../../data/sts2/relic-art-variants.json";
import type { RelicArtVariants } from "@/lib/codex-types";

const WAX_ELIGIBLE_IDS = new Set(relicArtVariantsCatalog.waxEligibleIds as string[]);
const USED_UP_IDS = new Set(relicArtVariantsCatalog.usedUpIds as string[]);
const DISABLED_IDS = new Set(relicArtVariantsCatalog.disabledIds as string[]);

/** Catalog lookup only — no rarity inference. Client-safe (static JSON, no fs). */
export function getRelicArtVariants(id: string): RelicArtVariants {
  return {
    wax: WAX_ELIGIBLE_IDS.has(id),
    usedUp: USED_UP_IDS.has(id),
    disabled: DISABLED_IDS.has(id),
  };
}
