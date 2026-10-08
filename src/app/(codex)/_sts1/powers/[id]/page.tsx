export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1PowerDetail } from "@/components/sts1/power-detail";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Metadata,
  getSts1Power,
  getSts1PowerSourceRefs,
  getSts1UiLabels,
} from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath, sts1PowerImageUrl } from "@/lib/sts1/paths";
import { generateSts1PowerStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1PowerStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const power = await getSts1Power(id, gameLocale);
  if (!power) return {};
  return {
    ...getSts1Metadata(serviceLocale, power.name, sts1DetailPath("powers", power.slug)),
    description: plainSts1Text(power.description),
    openGraph: { images: [sts1PowerImageUrl(power)] },
  };
}

export default async function Sts1PowerDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [power, sourceRefs, labels] = await Promise.all([
    getSts1Power(id, gameLocale),
    getSts1PowerSourceRefs(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  if (!power) notFound();
  return (
    <Sts1PowerDetail
      power={power}
      sourceRefs={sourceRefs[power.id] ?? []}
      labels={labels}
      serviceLocale={serviceLocale}
    />
  );
}
