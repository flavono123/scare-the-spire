import catalog from "@/generated/history-course-catalog.json";
import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import { createCardSideTipCatalog } from "@/lib/card-side-tip-catalog";
import type { CardSideTipCatalog } from "@/lib/card-keyword-tips";
import type {
  CodexCard,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
} from "@/lib/codex-types";

const raw = catalog as unknown as {
  cards: CodexCard[];
  relics: CodexRelic[];
  potions?: CodexPotion[];
  powers?: CodexPower[];
  monsters?: CodexMonster[];
  tipSources?: CardSideTipCatalogSources;
};

/**
 * Cards + relics + hover-tip sources for History Course run playback.
 * Generated at lint/dev/build time from extracted STS2 data.
 * Import only from the client run-detail loader — do not load this
 * from a Worker/RSC request path.
 */
export function getHistoryCourseCatalog(): {
  allCards: CodexCard[];
  allRelics: CodexRelic[];
  allPotions: CodexPotion[];
  allPowers: CodexPower[];
  allMonsters: CodexMonster[];
  tipSources: CardSideTipCatalogSources | null;
} {
  return {
    allCards: raw.cards as CodexCard[],
    allRelics: raw.relics as CodexRelic[],
    allPotions: (raw.potions ?? []) as CodexPotion[],
    allPowers: (raw.powers ?? []) as CodexPower[],
    allMonsters: (raw.monsters ?? []) as CodexMonster[],
    tipSources: raw.tipSources ?? null,
  };
}

export function createHistoryCourseSideTipCatalog(): CardSideTipCatalog | null {
  const { allCards, allPowers, allMonsters, tipSources } = getHistoryCourseCatalog();
  if (!tipSources) return null;
  return createCardSideTipCatalog({
    sources: tipSources,
    cards: allCards,
    powers: allPowers,
    monsters: allMonsters,
  });
}
