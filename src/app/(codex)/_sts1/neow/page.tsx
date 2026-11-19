export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1NeowPage } from "@/components/sts1/neow-page";
import { getSts1EntityRefs, getSts1Neow, getSts1NeowLabels, getSts1NeowStage } from "@/lib/sts1/compendium-extras";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1UiLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.listTitles["neow"], sts1IndexPath("neow"));
}

export default async function Sts1NeowListPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [neow, stage, neowLabels, labels] = await Promise.all([
    getSts1Neow(gameLocale),
    getSts1NeowStage(gameLocale),
    getSts1NeowLabels(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  const items = [...neow.categories.flatMap((category) => [...category.rewards, ...category.drawbacks]), ...neow.mini].flatMap((reward) => reward.refs);
  const refs = await getSts1EntityRefs({ items }, gameLocale);
  return (
    <Suspense>
      <Sts1NeowPage neow={neow} stage={stage} refs={refs} neowLabels={neowLabels} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
