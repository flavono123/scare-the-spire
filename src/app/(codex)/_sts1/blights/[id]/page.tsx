export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1BitmapPackScope } from "@/components/sts1/bitmap-pack-scope";
import { Sts1BlightDetail } from "@/components/sts1/blight-library";
import { getSts1Related } from "@/lib/sts1/relations";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { sts1BitmapPackName } from "@/lib/sts1/bitmap-font";
import { getSts1Blight, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath } from "@/lib/sts1/paths";
import { generateSts1BlightsStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1BlightsStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const blight = await getSts1Blight(id, getGameLocaleFromSearchRecord(resolved));
  if (!blight) return {};
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), blight.name, sts1DetailPath("blights", blight.slug)),
    description: plainSts1Text(blight.description),
    openGraph: { images: [blight.image] },
  };
}

export default async function Sts1BlightDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [blight, keywords, labels] = await Promise.all([
    getSts1Blight(id, gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!blight) notFound();
  const [refs, related] = await Promise.all([
    getSts1PageRefs({ mentions: blight.mentions }, gameLocale),
    getSts1Related("blights", blight.slug, gameLocale),
  ]);
  return (
    <Sts1BitmapPackScope packs={[sts1BitmapPackName(gameLocale)]}>
      <Sts1BlightDetail refs={refs} related={related} blight={blight} keywords={keywords} labels={labels} serviceLocale={serviceLocale} />
    </Sts1BitmapPackScope>
  );
}
