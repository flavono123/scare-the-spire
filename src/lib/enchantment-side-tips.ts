import enchantmentExtraHoverTipsJson from "../../data/sts2/enchantment-extra-hover-tips.json";
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
import type { CodexEnchantment } from "@/lib/codex-types";

export type EnchantmentExtraHoverTipSpec =
  | { kind: "static"; id: string; var?: string }
  | { kind: "keyword"; id: string }
  | { kind: "power"; id: string }
  | { kind: "card"; id: string; upgrade?: boolean }
  | { kind: "card_with_tips"; id: string; upgrade?: boolean }
  | { kind: "orb"; id: string }
  | { kind: "forge" };

type EnchantmentExtraHoverTipsFile = {
  tipsByEnchantmentId: Record<string, EnchantmentExtraHoverTipSpec[]>;
};

const ENCHANTMENT_EXTRA_HOVER_TIPS =
  (enchantmentExtraHoverTipsJson as EnchantmentExtraHoverTipsFile).tipsByEnchantmentId;

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

export function getEnchantmentExtraHoverTipSpecs(
  enchantmentId: string,
): EnchantmentExtraHoverTipSpec[] {
  return ENCHANTMENT_EXTRA_HOVER_TIPS[enchantmentId] ?? [];
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

  for (const spec of getEnchantmentExtraHoverTipSpecs(enchantment.id)) {
    switch (spec.kind) {
      case "static":
      case "keyword":
      case "orb":
      case "power": {
        const tip = resolveKeywordTipById(catalog, spec.id);
        if (!tip) break;
        push(cloneKeywordTip(tip, enchantment.vars));
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
