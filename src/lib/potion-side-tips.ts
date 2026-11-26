import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
} from "@/lib/card-keyword-tips";
import { createCardSideTipPusher } from "@/lib/card-keyword-tips";
import { getGameTipSpecs, pushGameTipSpecs } from "@/lib/game-tip-specs";
import type { CodexPotion } from "@/lib/codex-types";


function potionSelfTip(
  potion: Pick<CodexPotion, "id" | "name" | "description" | "imageUrl">,
): CardSideKeywordTip {
  return {
    kind: "keyword",
    id: `POTION_SELF:${potion.id}`,
    title: potion.name,
    description: potion.description,
    iconUrl: potion.imageUrl,
    variant: "default",
    source: "staticHoverTip",
  };
}

/**
 * Mirror PotionModel.HoverTips = [self] + ExtraHoverTips.
 * Index and detail both keep the self description tip (no dedicated inspect slab).
 * Does not scrape gold from potion descriptions.
 */
export function collectPotionSideTips(
  potion: Pick<CodexPotion, "id" | "name" | "description" | "imageUrl" | "vars">,
  catalog: CardSideTipCatalog,
  opts?: {
    includeSelf?: boolean;
  },
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();
  const push = createCardSideTipPusher(catalog, tips, seen);

  if (opts?.includeSelf !== false) {
    push(potionSelfTip(potion));
  }

  pushGameTipSpecs(getGameTipSpecs("potion", potion.id), catalog, tips, push, { vars: potion.vars });

  return tips;
}
