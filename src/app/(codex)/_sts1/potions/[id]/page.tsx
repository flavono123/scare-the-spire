export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1PotionDetail } from "@/components/sts1/potion-detail";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getSts1Metadata, getSts1Potion, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1DetailPath, sts1PotionImageUrl } from "@/lib/sts1/paths";
import { generateSts1PotionStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1PotionStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const potion = await getSts1Potion(id, gameLocale);
  if (!potion) return {};
  return {
    ...getSts1Metadata(serviceLocale, potion.name, sts1DetailPath("potions", potion.slug)),
    description: potion.description,
    openGraph: { images: [sts1PotionImageUrl(potion)] },
  };
}

export default async function Sts1PotionDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [potion, labels] = await Promise.all([
    getSts1Potion(id, gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!potion) notFound();
  return <Sts1PotionDetail potion={potion} labels={labels} serviceLocale={serviceLocale} />;
}
