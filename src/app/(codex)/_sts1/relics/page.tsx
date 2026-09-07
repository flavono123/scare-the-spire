export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1RelicLibrary } from "@/components/sts1/relic-library";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import { getSts1Metadata, getSts1Relics, getSts1UiLabels } from "@/lib/sts1/data";
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
  return getSts1Metadata(serviceLocale, labels.relicCollectionTitle, sts1IndexPath("relics"));
}

export default async function Sts1RelicsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [relics, labels] = await Promise.all([
    getSts1Relics(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);

  return (
    <Suspense>
      <Sts1RelicLibrary relics={relics} labels={labels} serviceLocale={serviceLocale} />
    </Suspense>
  );
}
