export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1BitmapPackScope } from "@/components/sts1/bitmap-pack-scope";
import { Sts1BlightLibrary } from "@/components/sts1/blight-library";
import { getSts1RelatedMap } from "@/lib/sts1/relations";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { sts1BitmapPackName } from "@/lib/sts1/bitmap-font";
import { getSts1Blights, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const labels = await getSts1UiLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), labels.listTitles.blights, sts1IndexPath("blights"));
}

export default async function Sts1BlightsPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [blights, keywords, labels] = await Promise.all([
    getSts1Blights(gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  // The detail draws the relic popup's text with the game's glyph pack.
  const [refs, related] = await Promise.all([
    getSts1PageRefs({ mentions: blights.flatMap((row) => row.mentions) }, gameLocale),
    getSts1RelatedMap("blights", blights.map((row) => row.slug), gameLocale),
  ]);
  return (
    <Sts1BitmapPackScope packs={[sts1BitmapPackName(gameLocale)]}>
      <Suspense>
        <Sts1BlightLibrary refs={refs} related={related} blights={blights} keywords={keywords} labels={labels} serviceLocale={serviceLocale} />
      </Suspense>
    </Sts1BitmapPackScope>
  );
}
