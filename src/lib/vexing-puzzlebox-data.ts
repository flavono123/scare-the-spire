import betaArtPayload from "../../data/sts2-beta-art.json";
import connectionsPayload from "../../data/sts2-connections.json";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  getCodexCards,
  getCodexCharacters,
  getCodexEpochs,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import type {
  BetaArtCharacter,
  BetaArtEntry,
  BetaArtType,
  ConnectionsPuzzle,
} from "@/lib/vexing-puzzlebox-types";

const BETA_ART_CHARACTER_COLORS = ["ironclad", "silent", "regent", "necrobinder", "defect"];

type ConnectionsRef = { type: string; id: string };

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

export async function getConnectionsPuzzles(gameLocale: GameLocale): Promise<ConnectionsPuzzle[]> {
  const [cards, relics, potions] = await Promise.all([
    getCodexCards({ gameLocale, includeDeprecated: true }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
  ]);
  const cardById = byId(cards);
  const relicById = byId(relics);
  const potionById = byId(potions);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);

  const resolve = ({ type, id }: ConnectionsRef): EntityInfo => {
    if (type === "card") {
      const card = cardById.get(id);
      if (card) {
        return {
          id: card.id,
          nameEn: card.nameEn,
          nameKo: card.name,
          imageUrl: card.imageUrl ?? card.betaImageUrl,
          color: card.color,
          type: "card",
          cardData: card,
        };
      }
    }
    if (type === "relic") {
      const relic = relicById.get(id);
      if (relic) {
        return {
          id: relic.id,
          nameEn: relic.nameEn,
          nameKo: relic.name,
          imageUrl: relic.imageUrl,
          color: relic.pool,
          type: "relic",
          relicData: relic,
        };
      }
    }
    if (type === "potion") {
      const potion = potionById.get(id);
      if (potion) {
        return {
          id: potion.id,
          nameEn: potion.nameEn,
          nameKo: potion.name,
          imageUrl: potion.imageUrl,
          color: potion.pool,
          type: "potion",
          potionData: potion,
        };
      }
    }
    throw new Error(`Connections member has no game data: ${type} ${id}`);
  };

  return connectionsPayload
    .map((puzzle) => ({
      number: puzzle.number,
      issueId: puzzle.issueId,
      issueNumber: puzzle.issueNumber,
      claimId: puzzle.claimId,
      slug: puzzle.slug,
      categories: puzzle.categories.map((category) => ({
        level: category.level,
        title: serviceLocale === "ko" ? category.titleKo : category.titleEn,
        titleEn: category.titleEn,
        note: serviceLocale === "ko" ? category.noteKo : null,
        members: category.members.map((member) => {
          const entity = resolve(member.ref);
          return {
            key: `${member.ref.type}:${member.ref.id}`,
            name: entity.nameKo,
            raw: member.raw,
            entity,
          };
        }),
      })),
    }))
    .toSorted((left, right) => right.number - left.number);
}

export async function getBetaArtCatalog(gameLocale: GameLocale): Promise<{
  entries: BetaArtEntry[];
  characters: BetaArtCharacter[];
}> {
  const [cards, relics, powers, epochs, characters] = await Promise.all([
    getCodexCards({ gameLocale, includeDeprecated: true }),
    getCodexRelics({ gameLocale }),
    getCodexPowers({ gameLocale, includeDeprecated: true }),
    getCodexEpochs({ gameLocale }),
    getCodexCharacters({ gameLocale }),
  ]);
  const cardById = byId(cards);
  const relicById = byId(relics);
  const powerById = byId(powers);
  const epochById = byId(epochs);

  // Thai lacks some power titles; the Compendium hides those powers there too.
  const toEntry = (key: string, officialArtVersion: string | null): BetaArtEntry | null => {
    const [type, id] = key.split(":") as [BetaArtType, string];
    const resource = type === "card"
      ? cardById.get(id)
      : type === "relic"
        ? relicById.get(id)
        : type === "power"
          ? powerById.get(id)
          : epochById.get(id);
    if (!resource?.betaImageUrl) return null;
    return {
      key,
      type,
      id,
      name: resource.name,
      color: type === "card" ? (cardById.get(id)?.color ?? null) : null,
      betaUrl: resource.betaImageUrl,
      officialUrl: resource.imageUrl,
      href: `${buildCompendiumResourceHref(type, id)}&beta=true`,
      earlyAccess: type === "card" && officialArtVersion !== null,
    };
  };

  const betaOnly = betaArtPayload.betaOnly.flatMap((key) => {
    const entry = toEntry(key, null);
    return entry ? [{ ...entry, officialUrl: null }] : [];
  });

  return {
    entries: [
      ...betaArtPayload.pairs.flatMap((pair) => toEntry(pair.key, pair.officialArtVersion) ?? []),
      ...betaOnly,
    ],
    characters: BETA_ART_CHARACTER_COLORS.flatMap((color) => {
      const character = characters.find((item) => item.id.toLowerCase() === color);
      return character ? [{ color, name: character.name }] : [];
    }),
  };
}
