import type { EntityVersionDiff, STS2Change, STS2Patch } from "@/lib/types";
import type {
  CodexAffliction,
  CodexAncient,
  CodexCard,
  CodexCharacter,
  CodexEnchantment,
  CodexEncounter,
  CodexEpoch,
  CodexEvent,
  CodexKeyword,
  CodexMonster,
  CodexPotion,
  CodexPower,
  CodexRelic,
} from "@/lib/codex-types";
import type { CodexGameUiLabels } from "@/lib/codex-game-ui";
import type { CardSideTipCatalogSources } from "@/lib/card-side-tip-catalog";
import type { GameLocale, ServiceLocale } from "@/lib/i18n";
import {
  loadCompendiumData,
  type CompendiumDataKey,
  type CompendiumDataResources,
} from "@/lib/compendium-data-chunks";

export type CompendiumDetailResourceType =
  | "ancients"
  | "cards"
  | "characters"
  | "enchantments"
  | "encounters"
  | "epochs"
  | "events"
  | "keywords"
  | "monsters"
  | "potions"
  | "powers"
  | "relics";

export type CompendiumDetailPayload = {
  serviceLocale: ServiceLocale;
  gameLocale: GameLocale;
  gameUi: CodexGameUiLabels;
  resources: {
    afflictions: CodexAffliction[];
    ancients: CodexAncient[];
    cards: CodexCard[];
    characters: CodexCharacter[];
    enchantments: CodexEnchantment[];
    encounters: CodexEncounter[];
    epochs: CodexEpoch[];
    events: CodexEvent[];
    keywords: CodexKeyword[];
    monsters: CodexMonster[];
    potions: CodexPotion[];
    powers: CodexPower[];
    relics: CodexRelic[];
    madScienceBaseCard: CodexCard | null;
  };
  history: {
    patches: STS2Patch[];
    changes: STS2Change[];
    versionDiffs: EntityVersionDiff[];
  };
  cardSideTipSources?: CardSideTipCatalogSources;
};

const COMPENDIUM_DETAIL_DATA_KEYS = [
  "afflictions",
  "ancients",
  "cardSideTipSources",
  "cards",
  "changes",
  "characters",
  "enchantments",
  "encounters",
  "epochs",
  "events",
  "gameUi",
  "keywords",
  "madScienceBaseCard",
  "monsters",
  "patches",
  "potions",
  "powers",
  "relics",
  "versionDiffs",
] as const satisfies readonly CompendiumDataKey[];

type CompendiumDetailData = Pick<
  CompendiumDataResources,
  (typeof COMPENDIUM_DETAIL_DATA_KEYS)[number]
>;

export function assembleCompendiumDetailPayload(
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
  data: CompendiumDetailData,
): CompendiumDetailPayload {
  return {
    serviceLocale,
    gameLocale,
    gameUi: data.gameUi,
    resources: {
      afflictions: data.afflictions,
      ancients: data.ancients,
      cards: data.cards,
      characters: data.characters,
      enchantments: data.enchantments,
      encounters: data.encounters,
      epochs: data.epochs,
      events: data.events,
      keywords: data.keywords,
      monsters: data.monsters,
      potions: data.potions,
      powers: data.powers,
      relics: data.relics,
      madScienceBaseCard: data.madScienceBaseCard,
    },
    history: {
      patches: data.patches,
      changes: data.changes,
      versionDiffs: data.versionDiffs,
    },
    cardSideTipSources: data.cardSideTipSources,
  };
}

/** Client loader: assembles the detail payload from the small per-resource chunks. */
export async function loadCompendiumDetailPayload(
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): Promise<CompendiumDetailPayload> {
  const data = await loadCompendiumData(gameLocale, COMPENDIUM_DETAIL_DATA_KEYS);
  return assembleCompendiumDetailPayload(serviceLocale, gameLocale, data);
}
