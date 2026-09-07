export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1PotionLibrary } from "@/components/sts1/potion-library";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getSts1Metadata, getSts1Potions, getSts1UiLabels } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const labels = await getSts1UiLabels(gameLocale);
  return getSts1Metadata(serviceLocale, labels.potionLabTitle, sts1IndexPath("potions"));
}

export default async function Sts1PotionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [potions, labels] = await Promise.all([
    getSts1Potions(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <Sts1PotionLibrary potions={potions} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
