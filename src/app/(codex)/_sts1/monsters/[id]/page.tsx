export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1MonsterDetail } from "@/components/sts1/monster-detail";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Metadata,
  getSts1Monster,
  getSts1MonsterRefs,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { sts1DetailPath, sts1MonsterImageUrl } from "@/lib/sts1/paths";
import { generateSts1MonsterStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1MonsterStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const monster = await getSts1Monster(id, gameLocale);
  if (!monster) return {};
  return {
    ...getSts1Metadata(serviceLocale, monster.name, sts1DetailPath("monsters", monster.slug)),
    openGraph: { images: [sts1MonsterImageUrl(monster)] },
  };
}

export default async function Sts1MonsterDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [monster, labels] = await Promise.all([
    getSts1Monster(id, gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!monster) notFound();
  const refs = await getSts1MonsterRefs([monster], gameLocale);
  return <Sts1MonsterDetail monster={monster} refs={refs} labels={labels} serviceLocale={serviceLocale} />;
}
