export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1MonsterLibrary } from "@/components/sts1/monster-library";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Metadata,
  getSts1Monsters,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

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

  return (
    <Suspense>
      <Sts1MonsterLibrary monsters={monsters} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
