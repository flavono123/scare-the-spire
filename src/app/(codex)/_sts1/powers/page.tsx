export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1PowerLibrary } from "@/components/sts1/power-library";
import { Sts1BitmapPackScope } from "@/components/sts1/bitmap-pack-scope";
import {
  getGameLocaleFromSearchRecord,
  getServiceLocaleFromSearchRecord,
} from "@/lib/i18n";
import {
  getSts1Metadata,
  getSts1PowerSourceRefs,
  getSts1Powers,
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
  return getSts1Metadata(serviceLocale, labels.powersTitle, sts1IndexPath("powers"));
}

export default async function Sts1PowersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [powers, sourceRefs, labels] = await Promise.all([
    getSts1Powers(gameLocale),
    getSts1PowerSourceRefs(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);

  // Sts1CardText draws relic, potion, and power text with the kor glyph pack.
  return (
    <Sts1BitmapPackScope packs={["kor"]}>
      <Suspense>
        <Sts1PowerLibrary
          powers={powers}
          sourceRefs={sourceRefs}
          labels={labels}
          serviceLocale={serviceLocale}
        />
      </Suspense>
    </Sts1BitmapPackScope>
  );
}
