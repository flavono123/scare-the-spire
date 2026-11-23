export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1CharacterDetail } from "@/components/sts1/character-detail";
import { Sts1BitmapPackScope } from "@/components/sts1/bitmap-pack-scope";
import { sts1BitmapPackName } from "@/lib/sts1/bitmap-font";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Cards,
  getSts1Character,
  getSts1CharacterSelectUi,
  getSts1Keywords,
  getSts1Metadata,
  getSts1Relics,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import {
  sts1CharacterPortraitUrl,
  sts1DetailPath,
} from "@/lib/sts1/paths";
import { generateSts1CharacterStaticParams } from "@/lib/sts1/static-params";
import type { Sts1Card } from "@/lib/sts1/types";
import { getSts1Related } from "@/lib/sts1/relations";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1CharacterStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const character = await getSts1Character(id, gameLocale);
  if (!character) return {};
  return {
    ...getSts1Metadata(serviceLocale, character.name, sts1DetailPath("characters", character.slug)),
    description: plainSts1Text(character.flavor),
    openGraph: { images: [sts1CharacterPortraitUrl(character.id)] },
  };
}

export default async function Sts1CharacterDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [character, cards, relics, keywords, labels, ui] = await Promise.all([
    getSts1Character(id, gameLocale),
    getSts1Cards(gameLocale),
    getSts1Relics(gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
    getSts1CharacterSelectUi(gameLocale),
  ]);
  if (!character) notFound();

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const deck: { card: Sts1Card; count: number }[] = [];
  for (const cardId of character.startingDeckIds) {
    const card = cardById.get(cardId);
    if (!card) continue;
    const entry = deck.find((item) => item.card.id === cardId);
    if (entry) entry.count += 1;
    else deck.push({ card, count: 1 });
  }

  const related = await getSts1Related("characters", character.slug, gameLocale);
  const startingRelicSlugs = relics.filter((relic) => character.startingRelicIds.includes(relic.id)).map((relic) => relic.slug);

  return (
    <Sts1BitmapPackScope packs={[sts1BitmapPackName(gameLocale)]}>
      <Sts1CharacterDetail
        character={{ ...character, startingRelicSlugs }}
        deck={deck}
        related={related}
        keywords={keywords}
        labels={labels}
        ui={ui}
        serviceLocale={serviceLocale}
        gameLocale={gameLocale}
      />
    </Sts1BitmapPackScope>
  );
}
