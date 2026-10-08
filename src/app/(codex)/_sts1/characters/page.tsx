export const dynamic = "force-static";

import type { Metadata } from "next";
import {
  Sts1CharacterSelect,
  type Sts1CharacterSelectRelic,
} from "@/components/sts1/character-select";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1CharacterSelectUi,
  getSts1Characters,
  getSts1Metadata,
  getSts1Relics,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { sts1IndexPath, sts1RelicImageUrl, sts1RelicOutlineUrl } from "@/lib/sts1/paths";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const labels = await getSts1UiLabels(gameLocale);
  return getSts1Metadata(serviceLocale, labels.charactersTitle, sts1IndexPath("characters"));
}

export default async function Sts1CharactersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [characters, relics, ui, labels] = await Promise.all([
    getSts1Characters(gameLocale),
    getSts1Relics(gameLocale),
    getSts1CharacterSelectUi(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  const starterIds = new Set(characters.flatMap((character) => character.startingRelicIds));
  const starterRelics: Record<string, Sts1CharacterSelectRelic> = Object.fromEntries(
    relics
      .filter((relic) => starterIds.has(relic.id))
      .map((relic) => [relic.id, {
        id: relic.id,
        name: relic.name,
        description: relic.description,
        imageUrl: sts1RelicImageUrl(relic),
        outlineUrl: sts1RelicOutlineUrl(relic),
      }]),
  );

  return (
    <Sts1CharacterSelect
      characters={characters}
      relics={starterRelics}
      ui={ui}
      title={labels.charactersTitle}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    />
  );
}
