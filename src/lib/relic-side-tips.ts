import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
} from "@/lib/card-keyword-tips";
import { createCardSideTipPusher } from "@/lib/card-keyword-tips";
import { entityAsKeywordTip, getGameTipSpecs, pushGameTipSpecs } from "@/lib/game-tip-specs";
import type {
  CodexEnchantment,
  CodexPotion,
  CodexRelic,
} from "@/lib/codex-types";


export function collectRelicSelfTip(
  relic: Pick<CodexRelic, "id" | "name" | "description" | "imageUrl">,
): CardSideKeywordTip {
  return entityAsKeywordTip({
    id: `RELIC_SELF:${relic.id}`,
    title: relic.name,
    description: relic.description,
    iconUrl: relic.imageUrl,
  });
}

/**
 * Mirror RelicModel.HoverTips / HoverTipsExcludingRelic.
 * - includeSelf=true → collection hover (self + ExtraHoverTips)
 * - includeSelf=false → inspect screen (ExtraHoverTips only; description is on the slab)
 * Does not scrape gold from relic descriptions.
 */
export function collectRelicSideTips(
  relic: Pick<CodexRelic, "id" | "name" | "description" | "imageUrl" | "vars">,
  catalog: CardSideTipCatalog,
  opts?: {
    includeSelf?: boolean;
    potionsById?: ReadonlyMap<string, CodexPotion>;
    enchantmentsById?: ReadonlyMap<string, CodexEnchantment>;
  },
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();
  const push = createCardSideTipPusher(catalog, tips, seen);

  if (opts?.includeSelf) {
    push(collectRelicSelfTip(relic));
  }

  pushGameTipSpecs(getGameTipSpecs("relic", relic.id), catalog, tips, push, { vars: relic.vars, potionsById: opts?.potionsById, enchantmentsById: opts?.enchantmentsById });

  return tips;
}
