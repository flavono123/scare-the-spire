import powerExtraHoverTipsJson from "../../data/sts2/power-extra-hover-tips.json";
import type {
  CardSideKeywordTip,
  CardSideTip,
  CardSideTipCatalog,
  CardSideTipVariant,
} from "@/lib/card-keyword-tips";
import {
  createCardSideTipPusher,
  pushCardWithCardHoverTips,
  resolveKeywordTipById,
} from "@/lib/card-keyword-tips";
import type { CodexAffliction, CodexPower } from "@/lib/codex-types";

export type PowerExtraHoverTipSpec =
  | { kind: "static"; id: string; var?: string }
  | { kind: "keyword"; id: string }
  | { kind: "power"; id: string }
  | { kind: "card"; id: string; upgrade?: boolean }
  | { kind: "card_with_tips"; id: string; upgrade?: boolean }
  | { kind: "orb"; id: string }
  | { kind: "affliction"; id: string }
  | { kind: "forge" };

type PowerExtraHoverTipsFile = {
  tipsByPowerId: Record<string, PowerExtraHoverTipSpec[]>;
};

const POWER_EXTRA_HOVER_TIPS =
  (powerExtraHoverTipsJson as PowerExtraHoverTipsFile).tipsByPowerId;

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

function afflictionAsKeywordTip(
  affliction: Pick<CodexAffliction, "id" | "name" | "description" | "imageUrl">,
): CardSideKeywordTip {
  // Prefix so Affliction + Power that share a model id (e.g. TAINTED) both appear.
  return {
    kind: "keyword",
    id: `AFFLICTION:${affliction.id}`,
    title: affliction.name,
    description: affliction.description,
    iconUrl: affliction.imageUrl,
    variant: "default",
    source: "staticHoverTip",
  };
}

export function getPowerExtraHoverTipSpecs(powerId: string): PowerExtraHoverTipSpec[] {
  return POWER_EXTRA_HOVER_TIPS[powerId] ?? [];
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

  for (const spec of getPowerExtraHoverTipSpecs(power.id)) {
    switch (spec.kind) {
      case "static":
      case "keyword":
      case "orb":
      case "power": {
        const tip = resolveKeywordTipById(catalog, spec.id);
        if (!tip) break;
        push(cloneKeywordTip(tip, power.vars));
        break;
      }
      case "affliction": {
        const affliction = opts?.afflictionsById?.get(spec.id);
        if (!affliction) break;
        push(cloneKeywordTip(afflictionAsKeywordTip(affliction), power.vars));
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
