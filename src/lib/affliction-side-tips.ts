import afflictionExtraHoverTipsJson from "../../data/sts2/affliction-extra-hover-tips.json";
import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
} from "@/lib/card-keyword-tips";
import {
  createCardSideTipPusher,
  pushCardWithCardHoverTips,
  resolveKeywordTipById,
} from "@/lib/card-keyword-tips";
import type { CodexAffliction } from "@/lib/codex-types";

export type AfflictionExtraHoverTipSpec =
  | { kind: "static"; id: string; var?: string }
  | { kind: "keyword"; id: string }
  | { kind: "power"; id: string }
  | { kind: "card"; id: string; upgrade?: boolean }
  | { kind: "card_with_tips"; id: string; upgrade?: boolean }
  | { kind: "orb"; id: string }
  | { kind: "forge" };

type AfflictionExtraHoverTipsFile = {
  tipsByAfflictionId: Record<string, AfflictionExtraHoverTipSpec[]>;
};

const AFFLICTION_EXTRA_HOVER_TIPS =
  (afflictionExtraHoverTipsJson as AfflictionExtraHoverTipsFile).tipsByAfflictionId;

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

export function getAfflictionExtraHoverTipSpecs(
  afflictionId: string,
): AfflictionExtraHoverTipSpec[] {
  return AFFLICTION_EXTRA_HOVER_TIPS[afflictionId] ?? [];
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

  for (const spec of getAfflictionExtraHoverTipSpecs(affliction.id)) {
    switch (spec.kind) {
      case "static":
      case "keyword":
      case "orb":
      case "power": {
        const tip = resolveKeywordTipById(catalog, spec.id);
        if (!tip) break;
        push(tip);
        break;
      }
      case "forge": {
        const forge = resolveKeywordTipById(catalog, "FORGE");
        if (forge) push(forge);
        break;
      }
      case "card": {
        const card = catalog.cardsById.get(spec.id);
        if (!card) break;
        push({
          kind: "card",
          id: card.id,
          card,
          upgrade: Boolean(spec.upgrade),
        });
        break;
      }
      case "card_with_tips": {
        const card = catalog.cardsById.get(spec.id);
        if (!card) break;
        pushCardWithCardHoverTips(card, catalog, push);
        break;
      }
      default:
        break;
    }
  }

  return tips;
}
