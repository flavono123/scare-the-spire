import relicExtraHoverTipsJson from "../../data/sts2/relic-extra-hover-tips.json";
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
import type {
  CodexEnchantment,
  CodexPotion,
  CodexRelic,
} from "@/lib/codex-types";

export type RelicExtraHoverTipSpec =
  | { kind: "static"; id: string; var?: string }
  | { kind: "keyword"; id: string }
  | { kind: "power"; id: string }
  | { kind: "card"; id: string }
  | { kind: "card_with_tips"; id: string }
  | { kind: "potion"; id: string }
  | { kind: "enchantment"; id: string }
  | { kind: "orb"; id: string }
  | { kind: "forge" };

type RelicExtraHoverTipsFile = {
  tipsByRelicId: Record<string, RelicExtraHoverTipSpec[]>;
};

const RELIC_EXTRA_HOVER_TIPS =
  (relicExtraHoverTipsJson as RelicExtraHoverTipsFile).tipsByRelicId;

function applyTemplateVars(
  text: string,
  vars: Record<string, number | string> | undefined,
): string {
  if (!vars) return text;
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) => {
    const value = vars[key];
    return value == null ? match : String(value);
  });
}

function cloneKeywordTip(
  tip: CardSideKeywordTip,
  vars?: Record<string, number | string>,
): CardSideKeywordTip {
  return {
    ...tip,
    title: applyTemplateVars(tip.title, vars),
    description: applyTemplateVars(tip.description, vars),
  };
}

function entityAsKeywordTip(input: {
  id: string;
  title: string;
  description: string;
  iconUrl?: string | null;
}): CardSideKeywordTip {
  return {
    kind: "keyword",
    id: input.id,
    title: input.title,
    description: input.description,
    iconUrl: input.iconUrl ?? null,
    variant: "default",
    source: "staticHoverTip",
  };
}

export function getRelicExtraHoverTipSpecs(relicId: string): RelicExtraHoverTipSpec[] {
  return RELIC_EXTRA_HOVER_TIPS[relicId] ?? [];
}

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

  for (const spec of getRelicExtraHoverTipSpecs(relic.id)) {
    switch (spec.kind) {
      case "static":
      case "keyword":
      case "orb":
      case "power": {
        const tip = resolveKeywordTipById(catalog, spec.id);
        if (!tip) break;
        push(cloneKeywordTip(tip, relic.vars));
        break;
      }
      case "forge": {
        const forge = resolveKeywordTipById(catalog, "FORGE");
        if (forge) push(forge);
        break;
      }
      case "card": {
        const card = catalog.cardsById.get(spec.id);
        if (card) push({ kind: "card", id: card.id, card });
        break;
      }
      case "card_with_tips": {
        const card = catalog.cardsById.get(spec.id);
        if (card) pushCardWithCardHoverTips(card, catalog, push);
        break;
      }
      case "potion": {
        const potion = opts?.potionsById?.get(spec.id);
        if (!potion) break;
        push(entityAsKeywordTip({
          id: potion.id,
          title: potion.name,
          description: potion.description,
          iconUrl: potion.imageUrl,
        }));
        break;
      }
      case "enchantment": {
        const enchantment = opts?.enchantmentsById?.get(spec.id);
        if (!enchantment) break;
        push(entityAsKeywordTip({
          id: enchantment.id,
          title: enchantment.name,
          description: enchantment.description,
          iconUrl: enchantment.imageUrl,
        }));
        break;
      }
      default:
        break;
    }
  }

  return tips;
}
