export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1ScoreBonusDetail } from "@/components/sts1/score-bonus-list";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1PageRefs, getSts1ScoreBonus, getSts1ScoreLabels } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath, sts1ScoreIconUrl } from "@/lib/sts1/paths";
import { getSts1Related } from "@/lib/sts1/relations";
import { generateSts1ScoreBonusesStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1ScoreBonusesStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const row = await getSts1ScoreBonus(id, getGameLocaleFromSearchRecord(resolved));
  if (!row) return {};
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), row.name, sts1DetailPath("score-bonuses", row.slug)),
    description: plainSts1Text([row.description, row.points].filter(Boolean).join(" ")),
    openGraph: { images: [sts1ScoreIconUrl()] },
  };
}

export default async function Sts1ScoreBonusDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [row, scoreLabels, labels, keywords] = await Promise.all([
    getSts1ScoreBonus(id, gameLocale),
    getSts1ScoreLabels(gameLocale),
    getSts1UiLabels(gameLocale),
    getSts1Keywords(gameLocale),
  ]);
  if (!row) notFound();
  const [refs, related] = await Promise.all([
    getSts1PageRefs({ mentions: row.refs }, gameLocale),
    getSts1Related("score-bonuses", row.slug, gameLocale),
  ]);
  return (
    <Sts1ScoreBonusDetail
      row={row}
      refs={refs}
      related={related}
      keywords={keywords}
      scoreLabels={scoreLabels}
      labels={labels}
      serviceLocale={serviceLocale}
    />
  );
}
