import type { Metadata } from "next";
import { PatchListPage, getPatchListMetadata } from "@/components/patches/patch-list-page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceLocale } = await getLocalePairFromParams(params);
  return getPatchListMetadata(serviceLocale);
}

export default async function LocalizedPatchesPage({ params }: Props) {
  const { serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  return <PatchListPage serviceLocale={serviceLocale} gameLocale={gameLocale} />;
}
