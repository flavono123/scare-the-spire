export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1KeywordDetail } from "@/components/sts1/keyword-library";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1CompendiumKeyword, getSts1KeywordKindLabels, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath } from "@/lib/sts1/paths";
import { generateSts1KeywordsStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1KeywordsStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const keyword = await getSts1CompendiumKeyword(id, getGameLocaleFromSearchRecord(resolved));
  if (!keyword) return {};
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), keyword.name, sts1DetailPath("keywords", keyword.slug)),
    description: plainSts1Text(keyword.description),
  };
}

export default async function Sts1KeywordDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [keyword, kinds, keywords, labels] = await Promise.all([
    getSts1CompendiumKeyword(id, gameLocale),
    getSts1KeywordKindLabels(gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!keyword) notFound();
  const refs = await getSts1PageRefs({ mentions: keyword.mentions }, gameLocale);
  return <Sts1KeywordDetail refs={refs} keyword={keyword} kinds={kinds} keywords={keywords} labels={labels} serviceLocale={serviceLocale} />;
}
