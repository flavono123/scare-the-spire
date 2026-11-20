export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1ScoreBonusList } from "@/components/sts1/score-bonus-list";
import { getSts1PageRefs, getSts1ScoreBonuses, getSts1ScoreLabels } from "@/lib/sts1/compendium-extras";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1UiLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.listTitles["score-bonuses"], sts1IndexPath("score-bonuses"));
}

export default async function Sts1ScoreBonusesPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [rows, scoreLabels, labels] = await Promise.all([
    getSts1ScoreBonuses(gameLocale),
    getSts1ScoreLabels(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  const refs = await getSts1PageRefs({ mentions: rows.flatMap((row) => row.refs) }, gameLocale);
  return (
    <Suspense>
      <Sts1ScoreBonusList rows={rows} refs={refs} scoreLabels={scoreLabels} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
