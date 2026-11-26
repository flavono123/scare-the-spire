import gameTipsJson from "../../data/sts2/game-tips.json";
import type { CardSideKeywordTip, CardSideTip, CardSideTipCatalog } from "@/lib/card-keyword-tips";
import { pushCardWithCardHoverTips, resolveKeywordTipById } from "@/lib/card-keyword-tips";
import type { CodexAffliction, CodexEnchantment, CodexPotion } from "@/lib/codex-types";

/** One entry of the tip list an element's class builds in game (scripts/generate-game-tips.py). */
export type GameTipSpec =
  | { kind: "static" | "keyword" | "orb" | "power" | "potion" | "relic" | "enchantment" | "affliction"; id: string }
  | { kind: "card" | "card_with_tips"; id: string; upgrade?: boolean }
  | { kind: "forge" };

export type GameTipElementType =
  | "card" | "relic" | "potion" | "power" | "enchantment" | "affliction" | "orb" | "modifier";

const GAME_TIPS = (gameTipsJson as unknown as { tips: Record<GameTipElementType, Record<string, GameTipSpec[]>> }).tips;

export function getGameTipSpecs(type: GameTipElementType, id: string): GameTipSpec[] {
  return GAME_TIPS[type]?.[id] ?? [];
}

function applyTemplateVars(text: string, vars: Record<string, number | string> | undefined): string {
  if (!vars) return text;
  return text.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (match, key: string) => {
    const value = vars[key];
    return value == null ? match : String(value);
  });
}

export function cloneKeywordTip(tip: CardSideKeywordTip, vars?: Record<string, number | string>): CardSideKeywordTip {
  return { ...tip, title: applyTemplateVars(tip.title, vars), description: applyTemplateVars(tip.description, vars) };
}

export function entityAsKeywordTip(input: {
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

export type GameTipEntities = {
  vars?: Record<string, number | string>;
  potionsById?: ReadonlyMap<string, CodexPotion>;
  enchantmentsById?: ReadonlyMap<string, Pick<CodexEnchantment, "id" | "name" | "description" | "imageUrl">>;
  afflictionsById?: ReadonlyMap<string, CodexAffliction>;
};

/** Push an element's game tip list, in the game's order, onto a side-tip list. */
export function pushGameTipSpecs(
  specs: readonly GameTipSpec[],
  catalog: CardSideTipCatalog,
  tips: CardSideTip[],
  push: (tip: CardSideTip | null) => void,
  entities: GameTipEntities = {},
): void {
  for (const spec of specs) {
    switch (spec.kind) {
      case "static":
      case "keyword":
      case "orb":
      case "power": {
        const tip = resolveKeywordTipById(catalog, spec.id);
        if (tip) push(cloneKeywordTip(tip, entities.vars));
        break;
      }
      case "forge":
        push(resolveKeywordTipById(catalog, "FORGE"));
        break;
      case "card": {
        const card = catalog.cardsById.get(spec.id);
        if (card) push({ kind: "card", id: card.id, card, upgrade: Boolean(spec.upgrade) });
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
            if (tip?.kind === "card" && tip.id === card.id) tips[i] = { ...tip, upgrade: true };
          }
        }
        break;
      }
      case "potion": {
        const potion = entities.potionsById?.get(spec.id);
        if (potion) push(entityAsKeywordTip({ id: potion.id, title: potion.name, description: potion.description, iconUrl: potion.imageUrl }));
        break;
      }
      case "enchantment": {
        const enchantment = (entities.enchantmentsById ?? catalog.enchantmentsById).get(spec.id);
        if (enchantment) {
          push(entityAsKeywordTip({ id: enchantment.id, title: enchantment.name, description: enchantment.description, iconUrl: enchantment.imageUrl }));
        }
        break;
      }
      case "affliction": {
        const affliction = entities.afflictionsById?.get(spec.id);
        if (affliction) {
          // Prefixed so an affliction and a power sharing a model id (TAINTED) both appear.
          push(cloneKeywordTip(entityAsKeywordTip({ id: `AFFLICTION:${affliction.id}`, title: affliction.name, description: affliction.description, iconUrl: affliction.imageUrl }), entities.vars));
        }
        break;
      }
      default:
        break;
    }
  }
}
