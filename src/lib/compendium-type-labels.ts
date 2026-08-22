import type { EntityType } from "@/components/patch-note-renderer";
import type { ServiceLocale } from "@/lib/i18n";
import { serviceMessages } from "@/messages/service";

/** Back-encyclopedia type labels. Prefer this over per-picker copies of `codex.*`. */
export function compendiumTypeLabels(
  serviceLocale: ServiceLocale,
): Record<EntityType, string> {
  const { codex, globalSearch } = serviceMessages[serviceLocale];
  return {
    character: codex.characters,
    card: codex.cards,
    keyword: codex.keywords,
    relic: codex.relics,
    potion: codex.potions,
    power: codex.powers,
    enchantment: codex.enchantments,
    affliction: codex.afflictions,
    event: codex.events,
    monster: codex.monsters,
    monsterMove: globalSearch.labels.monsterMove,
    encounter: codex.encounters,
    ancient: codex.ancients,
    epoch: codex.epochs,
  };
}
