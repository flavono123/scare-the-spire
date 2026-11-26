import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
} from "@/lib/card-keyword-tips";
import { createCardSideTipPusher } from "@/lib/card-keyword-tips";
import { getGameTipSpecs, pushGameTipSpecs } from "@/lib/game-tip-specs";
import type { CodexEnchantment } from "@/lib/codex-types";


function enchantmentSelfTip(
  enchantment: Pick<CodexEnchantment, "id" | "name" | "description" | "imageUrl">,
): CardSideKeywordTip {
  return {
    kind: "keyword",
    id: `ENCHANTMENT_SELF:${enchantment.id}`,
    title: enchantment.name,
    description: enchantment.description,
    iconUrl: enchantment.imageUrl,
    variant: "default",
    source: "staticHoverTip",
  };
}

/**
 * Mirror EnchantmentModel.HoverTips = [self] + ExtraHoverTips.
 * Index and detail both keep the self description tip.
 * Does not scrape gold from enchantment descriptions.
 */
export function collectEnchantmentSideTips(
  enchantment: Pick<CodexEnchantment, "id" | "name" | "description" | "imageUrl" | "vars">,
  catalog: CardSideTipCatalog,
  opts?: {
    includeSelf?: boolean;
  },
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();
  const push = createCardSideTipPusher(catalog, tips, seen);

  if (opts?.includeSelf !== false) {
    push(enchantmentSelfTip(enchantment));
  }

  pushGameTipSpecs(getGameTipSpecs("enchantment", enchantment.id), catalog, tips, push, { vars: enchantment.vars });

  return tips;
}
