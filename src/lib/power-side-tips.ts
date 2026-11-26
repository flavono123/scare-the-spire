import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
  CardSideTipVariant,
} from "@/lib/card-keyword-tips";
import { createCardSideTipPusher } from "@/lib/card-keyword-tips";
import { getGameTipSpecs, pushGameTipSpecs } from "@/lib/game-tip-specs";
import type { CodexAffliction, CodexPower } from "@/lib/codex-types";


function powerTipVariant(power: Pick<CodexPower, "type">): CardSideTipVariant {
  if (power.type === "Buff") return "buff";
  if (power.type === "Debuff") return "debuff";
  return "default";
}

function powerSelfTip(
  power: Pick<CodexPower, "id" | "name" | "description" | "imageUrl" | "type">,
): CardSideKeywordTip {
  return {
    kind: "keyword",
    id: `POWER_SELF:${power.id}`,
    title: power.name,
    description: power.description,
    iconUrl: power.imageUrl,
    variant: powerTipVariant(power),
    source: "power",
  };
}

/**
 * Mirror PowerModel.HoverTips = [self] + ExtraHoverTips.
 * Index and detail both keep the self description tip (no dedicated inspect slab).
 * Does not scrape gold from power descriptions.
 */
export function collectPowerSideTips(
  power: Pick<CodexPower, "id" | "name" | "description" | "imageUrl" | "type" | "vars">,
  catalog: CardSideTipCatalog,
  opts?: {
    includeSelf?: boolean;
    afflictionsById?: ReadonlyMap<string, CodexAffliction>;
  },
): CardSideTip[] {
  const tips: CardSideTip[] = [];
  const seen = new Set<string>();
  const push = createCardSideTipPusher(catalog, tips, seen);

  if (opts?.includeSelf !== false) {
    push(powerSelfTip(power));
  }

  pushGameTipSpecs(getGameTipSpecs("power", power.id), catalog, tips, push, { vars: power.vars, afflictionsById: opts?.afflictionsById });

  return tips;
}
