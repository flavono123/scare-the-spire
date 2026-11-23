export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1RelicDetail } from "@/components/sts1/relic-detail";
import { Sts1BitmapPackScope } from "@/components/sts1/bitmap-pack-scope";
import { sts1BitmapPackName } from "@/lib/sts1/bitmap-font";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getSts1Keywords, getSts1Metadata, getSts1Relic, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1DetailPath, sts1RelicImageUrl } from "@/lib/sts1/paths";
import { getSts1Related } from "@/lib/sts1/relations";
import { generateSts1RelicStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1RelicStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const relic = await getSts1Relic(id, gameLocale);
  if (!relic) return {};
  return {
    ...getSts1Metadata(serviceLocale, relic.name, sts1DetailPath("relics", relic.slug)),
    description: relic.description,
    openGraph: { images: [sts1RelicImageUrl(relic)] },
  };
}

export default async function Sts1RelicDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [relic, keywords, labels] = await Promise.all([
    getSts1Relic(id, gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!relic) notFound();
  const related = await getSts1Related("relics", relic.slug, gameLocale);
  // The relic popup draws its text with the game locale's glyph pack.
  return (
    <Sts1BitmapPackScope packs={[sts1BitmapPackName(gameLocale)]}>
      <Sts1RelicDetail keywords={keywords} relic={relic} related={related} labels={labels} serviceLocale={serviceLocale} />
    </Sts1BitmapPackScope>
  );
}
