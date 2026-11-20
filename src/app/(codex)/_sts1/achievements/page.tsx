export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1AchievementGrid } from "@/components/sts1/achievement-grid";
import { getSts1Achievements, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1UiLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.listTitles["achievements"], sts1IndexPath("achievements"));
}

export default async function Sts1AchievementsPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [achievements, labels] = await Promise.all([getSts1Achievements(gameLocale), getSts1UiLabels(gameLocale)]);
  const refs = await getSts1PageRefs({
    mentions: achievements.flatMap((row) => row.refs.flatMap((ref) => (ref.type === "character" ? [] : [{ type: ref.type, id: ref.id }]))),
  }, gameLocale);
  return (
    <Suspense>
      <Sts1AchievementGrid achievements={achievements} refs={refs} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
