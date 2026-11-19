import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { plainSts1Text } from "../src/lib/sts1/description";
import {
  getSts1Cards,
  getSts1Characters,
  getSts1Keywords,
  getSts1Monsters,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
  getSts1UiLabels,
} from "../src/lib/sts1/data";
import {
  sts1CardPortraitUrl,
  sts1CharacterIconUrl,
  sts1CharacterPortraitUrl,
  sts1DetailPath,
  sts1MonsterImageUrl,
  sts1PotionImageUrl,
  sts1PowerImageUrl,
  sts1RelicImageUrl,
} from "../src/lib/sts1/paths";
import {
  getSts1Achievements,
  getSts1Ascensions,
  getSts1Blights,
  getSts1CompendiumKeywords,
  getSts1Modifiers,
  getSts1Neow,
  getSts1ScoreBonuses,
} from "../src/lib/sts1/compendium-extras";
import { getSts1Events } from "../src/lib/sts1/events";
import {
  sts1AchievementImageUrl,
  sts1EventImageUrl,
  sts1IndexPath,
  sts1NpcImageUrl,
  sts1OrbImageUrl,
  sts1RunModUrl,
  sts1ScoreIconUrl,
  sts1UiImageUrl,
} from "../src/lib/sts1/paths";
import type { Sts1MentionEntry, Sts1MentionIndex } from "../src/lib/sts1-mention-index";
import type { Sts1ResourceType } from "../src/lib/sts1/types";

function mentionId(resource: Sts1ResourceType, slug: string): string {
  return `sts1:${resource}:${slug}`;
}

async function buildIndex(): Promise<Sts1MentionIndex> {
  const [cards, relics, potions, powers, monsters, characters, keywords, kor, eng] = await Promise.all([
    getSts1Cards("kor"),
    getSts1Relics("kor"),
    getSts1Potions("kor"),
    getSts1Powers("kor"),
    getSts1Monsters("kor"),
    getSts1Characters("kor"),
    getSts1Keywords("kor"),
    getSts1UiLabels("kor"),
    getSts1UiLabels("eng"),
  ]);
  const entries: Sts1MentionEntry[] = [
    ...cards.map((card): Sts1MentionEntry => ({
      id: mentionId("cards", card.slug),
      slug: card.slug,
      nameKo: card.name,
      nameEn: card.nameEn,
      resource: "cards",
      entityType: "card",
      imageUrl: sts1CardPortraitUrl(card),
      href: sts1DetailPath("cards", card.slug),
      description: plainSts1Text(card.description),
      color: card.color,
      cardType: card.type,
      rarity: card.rarity,
      cost: card.cost,
      card,
    })),
    ...relics.map((relic): Sts1MentionEntry => ({
      id: mentionId("relics", relic.slug),
      slug: relic.slug,
      nameKo: relic.name,
      nameEn: relic.nameEn,
      resource: "relics",
      entityType: "relic",
      imageUrl: sts1RelicImageUrl(relic),
      href: sts1DetailPath("relics", relic.slug),
      description: relic.description,
      flavor: relic.flavor,
      largeImageUrl: relic.hasLargeArt ? sts1RelicImageUrl(relic, true) : undefined,
      pool: relic.pool,
      tier: relic.tier,
      rarity: relic.tier,
    })),
    ...potions.map((potion): Sts1MentionEntry => ({
      id: mentionId("potions", potion.slug),
      slug: potion.slug,
      nameKo: potion.name,
      nameEn: potion.nameEn,
      resource: "potions",
      entityType: "potion",
      imageUrl: sts1PotionImageUrl(potion),
      href: sts1DetailPath("potions", potion.slug),
      description: potion.description,
      pool: potion.pool,
      rarity: potion.rarity,
    })),
    ...powers.map((power): Sts1MentionEntry => ({
      id: mentionId("powers", power.slug),
      slug: power.slug,
      nameKo: power.name,
      nameEn: power.nameEn,
      resource: "powers",
      entityType: "power",
      imageUrl: sts1PowerImageUrl(power),
      href: sts1DetailPath("powers", power.slug),
      description: power.description,
      powerType: power.type,
    })),
    ...monsters.map((monster): Sts1MentionEntry => ({
      id: mentionId("monsters", monster.slug),
      slug: monster.slug,
      nameKo: monster.name,
      nameEn: monster.nameEn,
      resource: "monsters",
      entityType: "monster",
      imageUrl: sts1MonsterImageUrl(monster),
      href: sts1DetailPath("monsters", monster.slug),
      description: "",
    })),
    ...characters.map((character): Sts1MentionEntry => ({
      id: mentionId("characters", character.slug),
      slug: character.slug,
      nameKo: character.name,
      nameEn: character.nameEn,
      resource: "characters",
      entityType: "character",
      imageUrl: sts1CharacterIconUrl(character.id),
      href: sts1DetailPath("characters", character.slug),
      description: plainSts1Text(character.flavor),
      largeImageUrl: sts1CharacterPortraitUrl(character.id),
    })),
  ];
  entries.push(...await extraEntries(kor.monsters.ascension));
  const suffix = async (locale: "kor" | "eng") => {
    const ui = JSON.parse(await readFile(
      path.join(process.cwd(), "data/sts1/localization", locale, "ui.json"),
      "utf8",
    )) as { SingleViewRelicPopup?: { TEXT?: string[] } };
    return ui.SingleViewRelicPopup?.TEXT?.[10] ?? "";
  };
  return {
    labels: { kor, eng },
    keywords,
    relicPopupSuffix: { kor: await suffix("kor"), eng: await suffix("eng") },
    entries,
  };
}

/** Events, keywords, modifiers, blights and the single-list types (anchored on their list). */
async function extraEntries(ascensionLabel: string): Promise<Sts1MentionEntry[]> {
  const [events, keywords, mods, blights, ascensions, neow, achievements, scores, engEvents] = await Promise.all([
    getSts1Events("kor"),
    getSts1CompendiumKeywords("kor"),
    getSts1Modifiers("kor"),
    getSts1Blights("kor"),
    getSts1Ascensions("kor"),
    getSts1Neow("kor"),
    getSts1Achievements("kor"),
    getSts1ScoreBonuses("kor"),
    getSts1Events("eng"),
  ]);
  const engAchievements = new Map((await getSts1Achievements("eng")).map((row) => [row.key, row.name]));
  const engScores = new Map((await getSts1ScoreBonuses("eng")).map((row) => [row.id, row.name]));
  const engEventName = new Map(engEvents.map((event) => [event.id, event.name]));
  const listEntry = (
    resource: Sts1MentionEntry["resource"],
    entityType: Sts1MentionEntry["entityType"],
    slug: string,
    row: { nameKo: string; nameEn: string; imageUrl: string; description: string },
  ): Sts1MentionEntry => ({
    id: mentionId(resource, slug),
    slug,
    resource,
    entityType,
    href: `${sts1IndexPath(resource)}#${slug}`,
    ...row,
  });
  return [
    ...events.map((event): Sts1MentionEntry => ({
      id: mentionId("events", event.slug),
      slug: event.slug,
      nameKo: event.name,
      nameEn: engEventName.get(event.id) ?? event.nameEn,
      resource: "events",
      entityType: "event",
      imageUrl: event.image ? sts1EventImageUrl(event.image) : "",
      href: sts1DetailPath("events", event.slug),
      description: plainSts1Text(
        (event.scenes[event.start]?.body ?? []).filter((part): part is string => typeof part === "string").join("").replace(/[~@]/g, ""),
      ),
    })),
    ...keywords.map((keyword): Sts1MentionEntry => ({
      id: mentionId("keywords", keyword.slug),
      slug: keyword.slug,
      nameKo: keyword.name,
      nameEn: keyword.nameEn,
      resource: "keywords",
      entityType: "keyword",
      imageUrl: keyword.image ? sts1OrbImageUrl(keyword.image) : "",
      href: sts1DetailPath("keywords", keyword.slug),
      description: keyword.description,
    })),
    ...mods.map((mod): Sts1MentionEntry => ({
      id: mentionId("modifiers", mod.slug),
      slug: mod.slug,
      nameKo: mod.name,
      nameEn: mod.nameEn,
      resource: "modifiers",
      entityType: "modifier",
      imageUrl: mod.icon ? sts1RunModUrl(mod.icon) : "",
      href: sts1DetailPath("modifiers", mod.slug),
      description: mod.description,
    })),
    ...blights.map((blight): Sts1MentionEntry => ({
      id: mentionId("blights", blight.slug),
      slug: blight.slug,
      nameKo: blight.name,
      nameEn: blight.nameEn,
      resource: "blights",
      entityType: "blight",
      imageUrl: blight.image,
      href: sts1DetailPath("blights", blight.slug),
      description: blight.description,
    })),
    ...ascensions.map((row) => listEntry("ascensions", "ascension", `ascension-${row.level}`, {
      nameKo: `${ascensionLabel} ${row.level}`,
      nameEn: `Ascension ${row.level}`,
      imageUrl: sts1UiImageUrl("ascension"),
      description: row.description,
    })),
    listEntry("neow", "neow", "neow", {
      nameKo: neow.name,
      nameEn: "Neow",
      imageUrl: sts1NpcImageUrl("neow"),
      description: neow.greeting.replace(/[~@]/g, ""),
    }),
    ...achievements.map((row) => listEntry("achievements", "achievement", row.slug, {
      nameKo: row.name,
      nameEn: engAchievements.get(row.key) ?? row.name,
      imageUrl: sts1AchievementImageUrl(row.image),
      description: row.description,
    })),
    ...scores.filter((row) => !row.total).map((row) => listEntry("score-bonuses", "score-bonus", row.slug, {
      nameKo: row.name,
      nameEn: engScores.get(row.id) ?? row.name,
      imageUrl: sts1ScoreIconUrl(),
      description: [row.description, row.points].filter(Boolean).join(" "),
    })),
  ];
}

async function main() {
  const index = await buildIndex();
  const destination = path.join(process.cwd(), "public/generated/sts1-mention-index.json");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(index));
  console.log(`Wrote ${index.entries.length} STS1 mention entries`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
