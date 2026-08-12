import potionExtraHoverTipsJson from "../../data/sts2/potion-extra-hover-tips.json";
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
import type { CodexPotion } from "@/lib/codex-types";

export type PotionExtraHoverTipSpec =
  | { kind: "static"; id: string; var?: string }
  | { kind: "keyword"; id: string }
  | { kind: "power"; id: string }
  | { kind: "card"; id: string; upgrade?: boolean }
  | { kind: "card_with_tips"; id: string; upgrade?: boolean }
  | { kind: "orb"; id: string }
  | { kind: "forge" };

type PotionExtraHoverTipsFile = {
  tipsByPotionId: Record<string, PotionExtraHoverTipSpec[]>;
};

const POTION_EXTRA_HOVER_TIPS =
  (potionExtraHoverTipsJson as PotionExtraHoverTipsFile).tipsByPotionId;

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

export function getPotionExtraHoverTipSpecs(potionId: string): PotionExtraHoverTipSpec[] {
  return POTION_EXTRA_HOVER_TIPS[potionId] ?? [];
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

  for (const spec of getPotionExtraHoverTipSpecs(potion.id)) {
    switch (spec.kind) {
      case "static":
      case "keyword":
      case "orb":
      case "power": {
        const tip = resolveKeywordTipById(catalog, spec.id);
        if (!tip) break;
        push(cloneKeywordTip(tip, potion.vars));
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
        // pushCardWithCardHoverTips always pushes base card tip first; mark upgrade after.
        const before = tips.length;
        pushCardWithCardHoverTips(card, catalog, push);
        if (spec.upgrade) {
          for (let i = before; i < tips.length; i += 1) {
            const tip = tips[i];
            if (tip?.kind === "card" && tip.id === card.id) {
              tips[i] = { ...tip, upgrade: true };
            }
          }
        }
        break;
      }
      default:
        break;
    }
  }

  return tips;
}
