import type { CardSideTipCatalog } from "@/lib/card-keyword-tips";
import { buildCardSideTipCatalog } from "@/lib/card-keyword-tips";
import type { GameLocalizationTable } from "@/lib/game-localization-text";
import type {
  CodexCard,
  CodexKeyword,
  CodexMonster,
  CodexPower,
} from "@/lib/codex-types";

export type CardSideTipCatalogSources = {
  keywords: CodexKeyword[];
  staticHoverTips: GameLocalizationTable;
  engStaticHoverTips: GameLocalizationTable;
  orbs: GameLocalizationTable;
  engOrbs: GameLocalizationTable;
  monsterNames: GameLocalizationTable;
  engMonsterNames: GameLocalizationTable;
};

/** Client-safe: no fs / codex-data imports. */
export function createCardSideTipCatalog(input: {
  sources: CardSideTipCatalogSources;
  powers: readonly CodexPower[];
  cards: readonly CodexCard[];
  monsters: readonly CodexMonster[];
}): CardSideTipCatalog {
  return buildCardSideTipCatalog({
    keywords: input.sources.keywords,
    powers: input.powers,
    cards: input.cards,
    monsters: input.monsters,
    staticHoverTips: input.sources.staticHoverTips,
    engStaticHoverTips: input.sources.engStaticHoverTips,
    orbs: input.sources.orbs,
    engOrbs: input.sources.engOrbs,
    monsterNames: input.sources.monsterNames,
    engMonsterNames: input.sources.engMonsterNames,
  });
}
