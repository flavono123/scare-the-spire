export const dynamic = "force-static";
export const dynamicParams = false;

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Sts1ModifierDetail } from "@/components/sts1/modifier-library";
import { getGameLocaleFromSearchRecord, getServiceLocaleFromSearchRecord } from "@/lib/i18n";
import { getSts1BlightRefs, getSts1EntityRefs, getSts1ModifierLabels, getSts1Modifiers } from "@/lib/sts1/compendium-extras";
import { getSts1Keywords, getSts1Metadata, getSts1UiLabels } from "@/lib/sts1/data";
import { plainSts1Text } from "@/lib/sts1/description";
import { sts1DetailPath, sts1RunModUrl } from "@/lib/sts1/paths";
import { generateSts1ModifiersStaticParams } from "@/lib/sts1/static-params";

type DetailProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateSts1ModifiersStaticParams();
}

export async function generateMetadata({ params, searchParams }: DetailProps): Promise<Metadata> {
  const { id } = await params;
  const resolved = await searchParams;
  const mod = (await getSts1Modifiers(getGameLocaleFromSearchRecord(resolved))).find((row) => row.slug === id);
  if (!mod) return {};
  return {
    ...getSts1Metadata(getServiceLocaleFromSearchRecord(resolved), mod.name, sts1DetailPath("modifiers", mod.slug)),
    description: plainSts1Text(mod.description),
    ...(mod.icon ? { openGraph: { images: [sts1RunModUrl(mod.icon)] } } : {}),
  };
}

export default async function Sts1ModifierDetailPage({ params, searchParams }: DetailProps) {
  const { id } = await params;
  const resolved = await searchParams;
  const serviceLocale = getServiceLocaleFromSearchRecord(resolved);
  const gameLocale = getGameLocaleFromSearchRecord(resolved);
  const [mods, modLabels, keywords, labels] = await Promise.all([
    getSts1Modifiers(gameLocale),
    getSts1ModifierLabels(gameLocale),
    getSts1Keywords(gameLocale),
    getSts1UiLabels(gameLocale),
  ]);
  const mod = mods.find((row) => row.slug === id);
  if (!mod) notFound();
  const [refs, blights] = await Promise.all([
    getSts1EntityRefs({ items: mod.refs }, gameLocale),
    getSts1BlightRefs(mod.blightRefs, gameLocale),
  ]);
  return (
    <Sts1ModifierDetail
      mod={mod}
      mods={mods}
      refs={{ ...refs, blight: blights }}
      keywords={keywords}
      modLabels={modLabels}
      labels={labels}
      serviceLocale={serviceLocale}
    />
  );
}
