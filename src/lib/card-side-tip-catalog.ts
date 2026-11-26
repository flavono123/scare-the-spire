import type { CardSideTipCatalog } from "@/lib/card-keyword-tips";
import { buildCardSideTipCatalog } from "@/lib/card-keyword-tips";
import type { GameLocalizationTable } from "@/lib/game-localization-text";
import type {
  CodexCard,
  CodexEnchantment,
  CodexKeyword,
  CodexPower,
} from "@/lib/codex-types";

export type CardSideTipCatalogSources = {
  keywords: CodexKeyword[];
  staticHoverTips: GameLocalizationTable;
  engStaticHoverTips: GameLocalizationTable;
  orbs: GameLocalizationTable;
  engOrbs: GameLocalizationTable;
  enchantments?: Pick<CodexEnchantment, "id" | "name" | "description" | "imageUrl">[];
};

/** Client-safe: no fs / codex-data imports. */
export function createCardSideTipCatalog(input: {
  sources: CardSideTipCatalogSources;
  powers: readonly CodexPower[];
  cards: readonly CodexCard[];
}): CardSideTipCatalog {
  return buildCardSideTipCatalog({
    keywords: input.sources.keywords,
    powers: input.powers,
    cards: input.cards,
    staticHoverTips: input.sources.staticHoverTips,
    engStaticHoverTips: input.sources.engStaticHoverTips,
    orbs: input.sources.orbs,
    engOrbs: input.sources.engOrbs,
    enchantments: input.sources.enchantments,
  });
}
