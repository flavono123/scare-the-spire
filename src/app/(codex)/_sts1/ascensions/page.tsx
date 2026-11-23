export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1AscensionList } from "@/components/sts1/ascension-list";
import { getSts1Ascensions, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";
import { getSts1RelatedMap } from "@/lib/sts1/relations";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1UiLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.listTitles["ascensions"], sts1IndexPath("ascensions"));
}

export default async function Sts1AscensionsPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [ascensions, labels, keywords] = await Promise.all([getSts1Ascensions(gameLocale), getSts1UiLabels(gameLocale), getSts1Keywords(gameLocale)]);
  const [refs, related] = await Promise.all([
    getSts1PageRefs({ mentions: ascensions.flatMap((row) => row.mentions) }, gameLocale),
    getSts1RelatedMap("ascensions", ascensions.map((row) => row.slug), gameLocale),
  ]);
  return (
    <Suspense>
      <Sts1AscensionList keywords={keywords} refs={refs} related={related} ascensions={ascensions} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
