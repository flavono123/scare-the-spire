import type { Metadata } from "next";
import { isPublicBestiaryMonster } from "@/lib/bestiary-monster-policy";
import {
  getCodexAfflictions,
  getCodexAncients,
  getCodexCards,
  getCodexCharacters,
  getCodexEnchantments,
  getCodexEncounters,
  getCodexEpochs,
  getCodexEvents,
  getCodexKeywords,
  getCodexMonsters,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";
import {
  findCardByCodexRouteId,
  getCodexCardOgMetadata,
} from "@/lib/codex-card-og";
import { getCodexGameUiLabels } from "@/lib/codex-game-ui";
import {
  findCodexResourceByRouteId,
  firstCodexImageUrl,
  getCodexEncounterOgResource,
  getCodexMonsterOgResource,
  getCodexResourceOgMetadata,
} from "@/lib/codex-resource-og";
import { getCodexServiceMessages } from "@/lib/codex-service";
import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  DEFAULT_SERVICE_LOCALE,
} from "@/lib/i18n";

const SERVICE_LOCALE = DEFAULT_SERVICE_LOCALE;
const GAME_LOCALE = DEFAULT_GAME_LOCALE_BY_SERVICE[SERVICE_LOCALE];

export async function generateCompendiumCardMetadata(id: string): Promise<Metadata> {
  const [cards, gameUi] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const card = findCardByCodexRouteId(cards, id);
  if (!card) return {};
  return getCodexCardOgMetadata(SERVICE_LOCALE, gameUi.cardLibraryTitle, card);
}

export async function generateCompendiumCharacterMetadata(id: string): Promise<Metadata> {
  const [characters, gameUi] = await Promise.all([
    getCodexCharacters({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const character = findCodexResourceByRouteId(characters, id);
  if (!character) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.charactersTitle, {
    name: character.name,
    description: character.description,
    imageUrl: firstCodexImageUrl(
      character.combatImageUrl,
      character.selectImageUrl,
      character.imageUrl,
      character.iconUrl,
    ),
  });
}

export async function generateCompendiumRelicMetadata(id: string): Promise<Metadata> {
  const [relics, gameUi] = await Promise.all([
    getCodexRelics({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const relic = findCodexResourceByRouteId(relics, id);
  if (!relic) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.relicCollectionTitle, {
    name: relic.name,
    description: relic.description,
    imageUrl: firstCodexImageUrl(
      relic.imageUrl,
      ...(relic.variantImageUrls ? Object.values(relic.variantImageUrls) : []),
      ...(relic.iconVariants ? relic.iconVariants.map((variant) => variant.imageUrl) : []),
      relic.betaImageUrl,
    ),
  });
}

export async function generateCompendiumPotionMetadata(id: string): Promise<Metadata> {
  const [potions, gameUi] = await Promise.all([
    getCodexPotions({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const potion = findCodexResourceByRouteId(potions, id);
  if (!potion) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.potionLabTitle, potion);
}

export async function generateCompendiumPowerMetadata(id: string): Promise<Metadata> {
  const [powers, gameUi] = await Promise.all([
    getCodexPowers({ includeDeprecated: true, gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const power = findCodexResourceByRouteId(powers, id);
  if (!power) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.nav.powers, power);
}

export async function generateCompendiumEnchantmentMetadata(id: string): Promise<Metadata> {
  const serviceText = getCodexServiceMessages(SERVICE_LOCALE);
  const [enchantments, afflictions] = await Promise.all([
    getCodexEnchantments({ gameLocale: GAME_LOCALE }),
    getCodexAfflictions({ gameLocale: GAME_LOCALE }),
  ]);
  const resource = findCodexResourceByRouteId(enchantments, id)
    ?? findCodexResourceByRouteId(afflictions, id);
  if (!resource) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, serviceText.enchantmentsView.title, resource);
}

export async function generateCompendiumAncientMetadata(id: string): Promise<Metadata> {
  const [ancients, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const ancient = findCodexResourceByRouteId(ancients, id);
  if (!ancient) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.ancientsTitle, ancient);
}

export async function generateCompendiumEventMetadata(id: string): Promise<Metadata> {
  const [events, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const event = findCodexResourceByRouteId(events, id);
  if (!event) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.eventsTitle, event);
}

export async function generateCompendiumKeywordMetadata(id: string): Promise<Metadata> {
  const [keywords, gameUi] = await Promise.all([
    getCodexKeywords({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const keyword = findCodexResourceByRouteId(keywords, id);
  if (!keyword) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.nav.keywords, keyword);
}

export async function generateCompendiumMonsterMetadata(id: string): Promise<Metadata> {
  const [monsters, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const monster = monsters.find((candidate) => (
    candidate.id.toLowerCase() === id.toLowerCase() &&
    candidate.showInCompendium &&
    isPublicBestiaryMonster(candidate.id)
  ));
  if (!monster) return {};
  return getCodexResourceOgMetadata(
    SERVICE_LOCALE,
    gameUi.bestiaryTitle,
    getCodexMonsterOgResource(monster, gameUi),
  );
}

export async function generateCompendiumEncounterMetadata(id: string): Promise<Metadata> {
  const serviceText = getCodexServiceMessages(SERVICE_LOCALE);
  const [encounters, monsters] = await Promise.all([
    getCodexEncounters({ gameLocale: GAME_LOCALE }),
    getCodexMonsters({ gameLocale: GAME_LOCALE }),
  ]);
  const encounter = findCodexResourceByRouteId(encounters, id);
  if (!encounter) return {};
  return getCodexResourceOgMetadata(
    SERVICE_LOCALE,
    serviceText.encountersView.title,
    getCodexEncounterOgResource(encounter, monsters, GAME_LOCALE),
  );
}

export async function generateCompendiumEpochMetadata(id: string): Promise<Metadata> {
  const [epochs, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale: GAME_LOCALE }),
    getCodexGameUiLabels(GAME_LOCALE),
  ]);
  const epoch = findCodexResourceByRouteId(epochs, id);
  if (!epoch) return {};
  return getCodexResourceOgMetadata(SERVICE_LOCALE, gameUi.epochsTitle, epoch);
}
