export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1CardLibrary } from "@/components/sts1/card-library";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Cards,
  getSts1Keywords,
  getSts1Metadata,
  getSts1UiLabels,
} from "@/lib/sts1/data";
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
  return getSts1Metadata(serviceLocale, labels.cardLibraryTitle, sts1IndexPath("cards"));
}

export default async function Sts1CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [cards, labels, keywords] = await Promise.all([
    getSts1Cards(gameLocale),
    getSts1UiLabels(gameLocale),
    getSts1Keywords(gameLocale),
  ]);

  return (
    <Suspense>
      <Sts1CardLibrary
        cards={cards}
        labels={labels}
        keywords={keywords}
        serviceLocale={serviceLocale}
      />
    </Suspense>
  );
}
