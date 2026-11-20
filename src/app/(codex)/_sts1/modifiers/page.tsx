export const dynamic = "force-static";

import { Suspense } from "react";
import type { Metadata } from "next";
import { Sts1ModifierLibrary } from "@/components/sts1/modifier-library";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1PageRefs, getSts1ModifierLabels, getSts1Modifiers } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata } from "@/lib/sts1/data";
import { sts1IndexPath } from "@/lib/sts1/paths";

type ListProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: ListProps): Promise<Metadata> {
  const resolved = await searchParams;
  const modLabels = await getSts1ModifierLabels(getGameLocaleFromSearchRecord(resolved));
  return getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), modLabels.title, sts1IndexPath("modifiers"));
}

export default async function Sts1ModifiersPage({ searchParams }: ListProps) {
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [mods, modLabels, keywords] = await Promise.all([
    getSts1Modifiers(gameLocale),
    getSts1ModifierLabels(gameLocale),
    getSts1Keywords(gameLocale),
  ]);
  const refs = await getSts1PageRefs({
    items: mods.flatMap((mod) => mod.refs),
    mentions: mods.flatMap((row) => [...row.mentions, ...row.blightRefs.map((id) => ({ type: "blight" as const, id }))]),
  }, gameLocale);
  return (
    <Suspense>
      <Sts1ModifierLibrary
        mods={mods}
        refs={refs}
        keywords={keywords}
        modLabels={modLabels}
        serviceLocale={serviceLocale}
      />
    </Suspense>
  );
}
