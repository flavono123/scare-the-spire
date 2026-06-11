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
import type { GameLocale, ServiceLocale } from "@/lib/i18n";

export const COMPENDIUM_DETAIL_PAYLOAD_PATH = "/generated/compendium-detail-kor.json";

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
};
