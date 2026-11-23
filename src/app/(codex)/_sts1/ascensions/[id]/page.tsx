export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1AscensionDetail } from "@/components/sts1/ascension-list";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1Ascension, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath, sts1UiImageUrl } from "@/lib/sts1/paths";
import { getSts1Related } from "@/lib/sts1/relations";
import { generateSts1AscensionsStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1AscensionsStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [ascension, labels] = await Promise.all([getSts1Ascension(id, gameLocale), getSts1UiLabels(gameLocale)]);
  if (!ascension) return {};
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), `${labels.monsters.ascension} ${ascension.level}`, sts1DetailPath("ascensions", ascension.slug)),
    description: plainSts1Text(ascension.description),
    openGraph: { images: [sts1UiImageUrl("ascension")] },
  };
}

export default async function Sts1AscensionDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [ascension, labels, keywords] = await Promise.all([getSts1Ascension(id, gameLocale), getSts1UiLabels(gameLocale), getSts1Keywords(gameLocale)]);
  if (!ascension) notFound();
  const [refs, related] = await Promise.all([
    getSts1PageRefs({ mentions: ascension.mentions }, gameLocale),
    getSts1Related("ascensions", ascension.slug, gameLocale),
  ]);
  return <Sts1AscensionDetail keywords={keywords} ascension={ascension} refs={refs} related={related} labels={labels} serviceLocale={serviceLocale} />;
}
