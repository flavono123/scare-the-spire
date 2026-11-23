export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1AchievementDetail } from "@/components/sts1/achievement-grid";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1Achievement, getSts1PageRefs } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1AchievementImageUrl, sts1DetailPath } from "@/lib/sts1/paths";
import { getSts1Related } from "@/lib/sts1/relations";
import { generateSts1AchievementsStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1AchievementsStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const achievement = await getSts1Achievement(id, getGameLocaleFromSearchRecord(resolved));
  if (!achievement) return {};
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), achievement.name, sts1DetailPath("achievements", achievement.slug)),
    description: plainSts1Text(achievement.description),
    openGraph: { images: [sts1AchievementImageUrl(achievement.image)] },
  };
}

export default async function Sts1AchievementDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [achievement, labels, keywords] = await Promise.all([getSts1Achievement(id, gameLocale), getSts1UiLabels(gameLocale), getSts1Keywords(gameLocale)]);
  if (!achievement) notFound();
  const [refs, related] = await Promise.all([
    getSts1PageRefs({
      mentions: achievement.refs.flatMap((ref) => (ref.type === "character" ? [] : [{ type: ref.type, id: ref.id }])),
    }, gameLocale),
    getSts1Related("achievements", achievement.slug, gameLocale),
  ]);
  return <Sts1AchievementDetail keywords={keywords} achievement={achievement} refs={refs} related={related} labels={labels} serviceLocale={serviceLocale} />;
}
