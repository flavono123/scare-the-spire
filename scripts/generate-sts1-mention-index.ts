import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { plainSts1Text } from "../src/lib/sts1/description";
import {
  getSts1Cards,
  getSts1Characters,
  getSts1Potions,
  getSts1Powers,
  getSts1Relics,
  getSts1UiLabels,
} from "../src/lib/sts1/data";
import {
  sts1CardPortraitUrl,
  sts1CharacterIconUrl,
  sts1DetailPath,
  sts1PotionImageUrl,
  sts1PowerImageUrl,
  sts1RelicImageUrl,
} from "../src/lib/sts1/paths";
import type { Sts1MentionEntry, Sts1MentionIndex } from "../src/lib/sts1-mention-index";

function mentionId(resource: Sts1ResourceType, slug: string): string {
  return `sts1:${resource}:${slug}`;
}

async function buildIndex(): Promise<Sts1MentionIndex> {
  const [cards, relics, potions, powers, characters, kor, eng] = await Promise.all([
    getSts1Cards("kor"),
    getSts1Relics("kor"),
    getSts1Potions("kor"),
    getSts1Powers("kor"),
    getSts1Characters("kor"),
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
      description: plainSts1Text(relic.description),
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
      description: plainSts1Text(potion.description),
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
      description: plainSts1Text(power.description),
      powerType: power.type,
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
    })),
  ];
  return { labels: { kor, eng }, entries };
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
