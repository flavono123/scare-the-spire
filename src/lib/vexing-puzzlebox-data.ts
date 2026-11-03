import betaArtPayload from "../../data/sts2-beta-art.json";
import sts1ExtrasPayload from "../../data/sts1/connections-extras.json";
import connectionsPayload from "../../data/sts2-connections.json";
import neowsletterIssues from "../../data/sts2-neowsletters.json";
import type { EntityInfo } from "@/components/patch-note-renderer";
import {
  getCodexCards,
  getCodexCharacters,
  getCodexEpochs,
  getCodexEvents,
  getCodexPotions,
  getCodexPowers,
  getCodexRelics,
} from "@/lib/codex-data";
import type { CodexCard, CodexEvent, CodexPotion, CodexRelic } from "@/lib/codex-types";
import { buildCompendiumResourceHref } from "@/lib/compendium-resource-links";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { getSts1Cards, getSts1Monsters, getSts1Potions, getSts1Powers, getSts1Relics } from "@/lib/sts1/data";
import { sts1GameLocale } from "@/lib/sts1/locale";
import {
  sts1CardPortraitUrl,
  sts1MonsterImageUrl,
  sts1PotionImageUrl,
  sts1PowerImageUrl,
  sts1RelicImageUrl,
} from "@/lib/sts1/paths";
import type {
  BetaArtCharacter,
  BetaArtEntry,
  BetaArtType,
  ConnectionsMember,
  ConnectionsPuzzle,
} from "@/lib/vexing-puzzlebox-types";

const BETA_ART_CHARACTER_COLORS = ["ironclad", "silent", "regent", "necrobinder", "defect"];

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

/** Potion-Shaped Rock fills the Connections potion belt. */
const BELT_POTION_ID = "POTION_SHAPED_ROCK";

export async function getConnectionsBeltPotion(
  gameLocale: GameLocale,
): Promise<{ name: string; description: string; imageUrl: string }> {
  const potion = (await getCodexPotions({ gameLocale })).find((item) => item.id === BELT_POTION_ID);
  if (!potion) throw new Error(`Connections belt potion is missing: ${BELT_POTION_ID}`);
  return { name: potion.name, description: potion.description, imageUrl: potion.imageUrl };
}

type ConnectionsRef = { game: "sts1" | "sts2"; type: string; id: string };

type ResolvedMember = Pick<ConnectionsMember, "name" | "imageUrl" | "entity" | "sts1MentionId" | "note">;

function sts2Entity(ref: ConnectionsRef, data: {
  cards: Map<string, CodexCard>;
  relics: Map<string, CodexRelic>;
  potions: Map<string, CodexPotion>;
  events: Map<string, CodexEvent>;
}): EntityInfo | null {
  if (ref.type === "card") {
    const card = data.cards.get(ref.id);
    return card ? {
      id: card.id,
      nameEn: card.nameEn,
      nameKo: card.name,
      imageUrl: card.imageUrl ?? card.betaImageUrl,
      color: card.color,
      type: "card",
      cardData: card,
    } : null;
  }
  if (ref.type === "relic") {
    const relic = data.relics.get(ref.id);
    return relic ? {
      id: relic.id,
      nameEn: relic.nameEn,
      nameKo: relic.name,
      // Yummy Cookie has only character variants; the site's default character stands in.
      imageUrl: relic.imageUrl
        ?? relic.variantImageUrls?.necrobinder
        ?? Object.values(relic.variantImageUrls ?? {})[0]
        ?? null,
      color: relic.pool,
      type: "relic",
      relicData: relic,
    } : null;
  }
  if (ref.type === "potion") {
    const potion = data.potions.get(ref.id);
    return potion ? {
      id: potion.id,
      nameEn: potion.nameEn,
      nameKo: potion.name,
      imageUrl: potion.imageUrl,
      color: potion.pool,
      type: "potion",
      potionData: potion,
    } : null;
  }
  if (ref.type === "event") {
    const event = data.events.get(ref.id);
    return event ? {
      id: event.id,
      nameEn: event.nameEn,
      nameKo: event.name,
      imageUrl: event.imageUrl,
      color: event.act ?? "none",
      type: "event",
      eventData: event,
    } : null;
  }
  return null;
}

/**
 * Every puzzle, newest first. STS1-era puzzles name STS1 things: those the STS1
 * Compendium carries get its hover tips, and the few it does not (events, blights,
 * the Circlet, a cut card) come from the jar extract in data/sts1/connections-extras.json.
 * A member with no game data at all keeps its puzzle spelling.
 */
export async function getConnectionsPuzzles(gameLocale: GameLocale): Promise<ConnectionsPuzzle[]> {
  const [cards, relics, potions, events, sts1Cards, sts1Relics, sts1Potions, sts1Powers, sts1Monsters] = await Promise.all([
    getCodexCards({ gameLocale, includeDeprecated: true }),
    getCodexRelics({ gameLocale }),
    getCodexPotions({ gameLocale }),
    getCodexEvents({ gameLocale }),
    getSts1Cards(gameLocale),
    getSts1Relics(gameLocale),
    getSts1Potions(gameLocale),
    getSts1Powers(gameLocale),
    getSts1Monsters(gameLocale),
  ]);
  const sts2 = { cards: byId(cards), relics: byId(relics), potions: byId(potions), events: byId(events) };
  const sts1 = {
    card: new Map(sts1Cards.map((item) => [item.slug, item])),
    relic: new Map(sts1Relics.map((item) => [item.slug, item])),
    potion: new Map(sts1Potions.map((item) => [item.slug, item])),
    power: new Map(sts1Powers.map((item) => [item.slug, item])),
    monster: new Map(sts1Monsters.map((item) => [item.slug, item])),
  };
  const extras = new Map(sts1ExtrasPayload.entries.map((entry) => [`${entry.type}:${entry.id}`, entry]));
  const extraLocale = sts1GameLocale(gameLocale);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const issueDates = new Map(neowsletterIssues.map((issue) => [issue.id, issue.date]));

  const resolveSts1 = (ref: ConnectionsRef): ResolvedMember | null => {
    const mention = (resource: string, slug: string) => `sts1:${resource}:${slug}`;
    const none = { entity: null, note: null };
    if (ref.type === "card" && sts1.card.has(ref.id)) {
      const card = sts1.card.get(ref.id)!;
      return { ...none, name: card.name, imageUrl: sts1CardPortraitUrl(card), sts1MentionId: mention("cards", card.slug) };
    }
    if (ref.type === "relic" && sts1.relic.has(ref.id)) {
      const relic = sts1.relic.get(ref.id)!;
      return { ...none, name: relic.name, imageUrl: sts1RelicImageUrl(relic), sts1MentionId: mention("relics", relic.slug) };
    }
    if (ref.type === "potion" && sts1.potion.has(ref.id)) {
      const potion = sts1.potion.get(ref.id)!;
      return { ...none, name: potion.name, imageUrl: sts1PotionImageUrl(potion), sts1MentionId: mention("potions", potion.slug) };
    }
    if (ref.type === "power" && sts1.power.has(ref.id)) {
      const power = sts1.power.get(ref.id)!;
      return { ...none, name: power.name, imageUrl: sts1PowerImageUrl(power), sts1MentionId: mention("powers", power.slug) };
    }
    if (ref.type === "monster" && sts1.monster.has(ref.id)) {
      const monster = sts1.monster.get(ref.id)!;
      return { ...none, name: monster.name, imageUrl: sts1MonsterImageUrl(monster), sts1MentionId: mention("monsters", monster.slug) };
    }
    const extra = extras.get(`${ref.type}:${ref.id}`);
    if (!extra) return null;
    const names = extra.names as Record<string, string>;
    const descriptions = extra.descriptions as Record<string, string>;
    return {
      name: names[extraLocale] || names.eng,
      imageUrl: extra.image,
      entity: null,
      sts1MentionId: null,
      note: { description: descriptions[extraLocale] || descriptions.eng || "" },
    };
  };

  const resolve = (number: number, raw: string, ref: ConnectionsRef | null): ResolvedMember => {
    if (!ref) return { name: raw, imageUrl: null, entity: null, sts1MentionId: null, note: null };
    if (ref.game === "sts1") {
      const resolved = resolveSts1(ref);
      if (!resolved) throw new Error(`Connections #${number}: no STS1 ${ref.type} ${ref.id}`);
      return resolved;
    }
    const entity = sts2Entity(ref, sts2);
    if (!entity) throw new Error(`Connections #${number}: no STS2 ${ref.type} ${ref.id}`);
    return { name: entity.nameKo, imageUrl: entity.imageUrl, entity, sts1MentionId: null, note: null };
  };

  return connectionsPayload
    .map((puzzle) => ({
      number: puzzle.number,
      issueId: puzzle.issueId,
      issueNumber: puzzle.issueNumber,
      issueDate: issueDates.get(puzzle.issueId) ?? null,
      claimId: puzzle.claimId,
      slug: puzzle.slug,
      era: puzzle.era as ConnectionsPuzzle["era"],
      categories: puzzle.categories.map((category) => ({
        level: category.level,
        title: serviceLocale === "ko" ? category.titleKo : category.titleEn,
        titleEn: category.titleEn,
        note: serviceLocale === "ko" ? category.noteKo : null,
        members: category.members.map((member) => {
          const ref = member.ref as ConnectionsRef | null;
          return {
            key: ref ? `${ref.game}:${ref.type}:${ref.id}` : `raw:${member.raw}`,
            raw: member.raw,
            ...resolve(puzzle.number, member.raw, ref),
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
  const toEntry = (
    key: string,
    officialArtVersion: string | null,
    episode: number | null = null,
    episodeOrder: number | null = null,
  ): BetaArtEntry | null => {
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
      nameEn: resource.nameEn,
      color: type === "card" ? (cardById.get(id)?.color ?? null) : null,
      betaUrl: resource.betaImageUrl,
      officialUrl: resource.imageUrl,
      href: `${buildCompendiumResourceHref(type, id)}&beta=true`,
      earlyAccess: type === "card" && officialArtVersion !== null,
      episode,
      episodeOrder,
    };
  };

  const betaOnly = betaArtPayload.betaOnly.flatMap((key) => {
    const entry = toEntry(key, null);
    return entry ? [{ ...entry, officialUrl: null }] : [];
  });

  return {
    entries: [
      ...betaArtPayload.pairs.flatMap((pair) => (
        toEntry(pair.key, pair.officialArtVersion, pair.episode, pair.episodeOrder) ?? []
      )),
      ...betaOnly,
    ],
    characters: BETA_ART_CHARACTER_COLORS.flatMap((color) => {
      const character = characters.find((item) => item.id.toLowerCase() === color);
      return character ? [{ color, name: character.name }] : [];
    }),
  };
}
