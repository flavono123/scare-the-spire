import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
} from "@/lib/card-keyword-tips";
import { createCardSideTipPusher } from "@/lib/card-keyword-tips";
import { getGameTipSpecs, pushGameTipSpecs } from "@/lib/game-tip-specs";
import type { CodexAffliction } from "@/lib/codex-types";


function afflictionSelfTip(
  affliction: Pick<CodexAffliction, "id" | "name" | "description" | "imageUrl">,
): CardSideKeywordTip {
  return {
    kind: "keyword",
    id: `AFFLICTION_SELF:${affliction.id}`,
    title: affliction.name,
    description: affliction.description,
    iconUrl: affliction.imageUrl,
    variant: "default",
    source: "staticHoverTip",
  };
}

/**
 * Mirror AfflictionModel.HoverTips = [self] + ExtraHoverTips.
 * Index and detail both keep the self description tip.
 * Does not scrape gold from affliction descriptions.
 */
export function collectAfflictionSideTips(
  affliction: Pick<CodexAffliction, "id" | "name" | "description" | "imageUrl">,
  catalog: CardSideTipCatalog,
  opts?: {
    includeSelf?: boolean;
  },
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();
  const push = createCardSideTipPusher(catalog, tips, seen);

  if (opts?.includeSelf !== false) {
    push(afflictionSelfTip(affliction));
  }

  pushGameTipSpecs(getGameTipSpecs("affliction", affliction.id), catalog, tips, push, {});

  return tips;
}
