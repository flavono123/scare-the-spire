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
  type GameLocale,
  type ServiceLocale,
} from "@/lib/i18n";

type CompendiumMetadataLocale = {
  gameLocale?: GameLocale;
  serviceLocale?: ServiceLocale;
};

function resolveMetadataLocale(locale: CompendiumMetadataLocale = {}) {
  const serviceLocale = locale.serviceLocale ?? DEFAULT_SERVICE_LOCALE;
  const gameLocale = locale.gameLocale ?? DEFAULT_GAME_LOCALE_BY_SERVICE[serviceLocale];
  return { gameLocale, serviceLocale };
}

export async function generateCompendiumCardMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [cards, gameUi] = await Promise.all([
    getCodexCards({ includeDeprecated: true, gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const card = findCardByCodexRouteId(cards, id);
  if (!card) return {};
  return getCodexCardOgMetadata(serviceLocale, gameUi.cardLibraryTitle, card);
}

export async function generateCompendiumCharacterMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [characters, gameUi] = await Promise.all([
    getCodexCharacters({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const character = findCodexResourceByRouteId(characters, id);
  if (!character) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.charactersTitle, {
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

export async function generateCompendiumRelicMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [relics, gameUi] = await Promise.all([
    getCodexRelics({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const relic = findCodexResourceByRouteId(relics, id);
  if (!relic) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.relicCollectionTitle, {
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

export async function generateCompendiumPotionMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [potions, gameUi] = await Promise.all([
    getCodexPotions({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const potion = findCodexResourceByRouteId(potions, id);
  if (!potion) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.potionLabTitle, potion);
}

export async function generateCompendiumPowerMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [powers, gameUi] = await Promise.all([
    getCodexPowers({ includeDeprecated: true, gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const power = findCodexResourceByRouteId(powers, id);
  if (!power) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.powers, power);
}

export async function generateCompendiumEnchantmentMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [enchantments, afflictions] = await Promise.all([
    getCodexEnchantments({ gameLocale }),
    getCodexAfflictions({ gameLocale }),
  ]);
  const resource = findCodexResourceByRouteId(enchantments, id)
    ?? findCodexResourceByRouteId(afflictions, id);
  if (!resource) return {};
  return getCodexResourceOgMetadata(serviceLocale, serviceText.enchantmentsView.title, resource);
}

export async function generateCompendiumAncientMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [ancients, gameUi] = await Promise.all([
    getCodexAncients({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const ancient = findCodexResourceByRouteId(ancients, id);
  if (!ancient) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.ancientsTitle, ancient);
}

export async function generateCompendiumEventMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [events, gameUi] = await Promise.all([
    getCodexEvents({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const event = findCodexResourceByRouteId(events, id);
  if (!event) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.eventsTitle, event);
}

export async function generateCompendiumKeywordMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [keywords, gameUi] = await Promise.all([
    getCodexKeywords({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const keyword = findCodexResourceByRouteId(keywords, id);
  if (!keyword) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.nav.keywords, keyword);
}

export async function generateCompendiumMonsterMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [monsters, gameUi] = await Promise.all([
    getCodexMonsters({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const monster = monsters.find((candidate) => (
    candidate.id.toLowerCase() === id.toLowerCase() &&
    candidate.showInCompendium &&
    isPublicBestiaryMonster(candidate.id)
  ));
  if (!monster) return {};
  return getCodexResourceOgMetadata(
    serviceLocale,
    gameUi.bestiaryTitle,
    getCodexMonsterOgResource(monster, gameUi),
  );
}

export async function generateCompendiumEncounterMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const serviceText = getCodexServiceMessages(serviceLocale);
  const [encounters, monsters] = await Promise.all([
    getCodexEncounters({ gameLocale }),
    getCodexMonsters({ gameLocale }),
  ]);
  const encounter = findCodexResourceByRouteId(encounters, id);
  if (!encounter) return {};
  return getCodexResourceOgMetadata(
    serviceLocale,
    serviceText.encountersView.title,
    getCodexEncounterOgResource(encounter, monsters, gameLocale),
  );
}

export async function generateCompendiumEpochMetadata(
  id: string,
  locale?: CompendiumMetadataLocale,
): Promise<Metadata> {
  const { gameLocale, serviceLocale } = resolveMetadataLocale(locale);
  const [epochs, gameUi] = await Promise.all([
    getCodexEpochs({ gameLocale }),
    getCodexGameUiLabels(gameLocale),
  ]);
  const epoch = findCodexResourceByRouteId(epochs, id);
  if (!epoch) return {};
  return getCodexResourceOgMetadata(serviceLocale, gameUi.epochsTitle, epoch);
}
