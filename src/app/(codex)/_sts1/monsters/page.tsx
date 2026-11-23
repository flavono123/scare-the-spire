export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1Bestiary } from "@/components/sts1/bestiary";
import { getSts1Intents } from "@/lib/sts1/intents";
import { getSts1Encounters } from "@/lib/sts1/encounters";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Metadata,
  getSts1MonsterRefs,
  getSts1Monsters,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";
import { getSts1RelatedMap } from "@/lib/sts1/relations";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const labels = await getSts1UiLabels(gameLocale);
  return getSts1Metadata(serviceLocale, labels.monstersTitle, sts1IndexPath("monsters"));
}

export default async function Sts1MonstersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [monsters, labels] = await Promise.all([
    getSts1Monsters(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  const [refs, related, intents, encounters] = await Promise.all([
    getSts1MonsterRefs(monsters, gameLocale),
    getSts1RelatedMap("monsters", monsters.map((monster) => monster.slug), gameLocale),
    getSts1Intents(gameLocale),
    getSts1Encounters(gameLocale),
  ]);
  const encounterRelated = await getSts1RelatedMap("encounters", encounters.map((row) => row.slug), gameLocale);

  return (
    <Suspense>
      <Sts1Bestiary intents={intents} encounters={encounters} encounterRelated={encounterRelated} monsters={monsters} refs={refs} related={related} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
