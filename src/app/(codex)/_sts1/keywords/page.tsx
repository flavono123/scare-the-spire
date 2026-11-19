export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1KeywordLibrary } from "@/components/sts1/keyword-library";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1CompendiumKeywords, getSts1KeywordKindLabels } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1UiLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.listTitles.keywords, sts1IndexPath("keywords"));
}

export default async function Sts1KeywordsPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [rows, kinds, keywords, labels] = await Promise.all([
    getSts1CompendiumKeywords(gameLocale),
    getSts1KeywordKindLabels(gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  return (
    <Suspense>
      <Sts1KeywordLibrary rows={rows} kinds={kinds} keywords={keywords} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
