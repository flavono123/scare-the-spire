export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1CardDetail } from "@/components/sts1/card-detail";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Card,
  getSts1Keywords,
  getSts1Metadata,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1CardPortraitUrl, sts1DetailPath } from "@/lib/sts1/paths";
import { sts1CardStats } from "@/lib/sts1/stats";
import { generateSts1CardStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1CardStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [card, labels] = await Promise.all([
    getSts1Card(id, gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!card) return {};
  const stats = sts1CardStats(card);
  return {
    ...getSts1Metadata(serviceLocale, card.name, sts1DetailPath("cards", card.slug)),
    description: plainSts1Text(card.description, stats) || labels.cardLibraryTitle,
    openGraph: {
      images: [sts1CardPortraitUrl(card)],
    },
  };
}

export default async function Sts1CardDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [card, labels, keywords] = await Promise.all([
    getSts1Card(id, gameLocale),
    getSts1UiLabels(gameLocale),
    getSts1Keywords(gameLocale),
  ]);
  if (!card) notFound();

  return (
    <Sts1CardDetail
      card={card}
      labels={labels}
      keywords={keywords}
      serviceLocale={serviceLocale}
      gameLocale={gameLocale}
    />
  );
}
