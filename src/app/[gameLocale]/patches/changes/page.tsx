import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getResourcePatchIndexMetadata,
  ResourcePatchIndexPage,
} from "@/components/patches/resource-patch-index-page";
import { devToolsEnabled } from "@/lib/dev-tools";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceLocale } = await getLocalePairFromParams(params);
  return getResourcePatchIndexMetadata(serviceLocale);
}

export default async function LocalizedPatchChangesPage({ params }: Props) {
  if (!devToolsEnabled()) notFound();
  const { serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  return <ResourcePatchIndexPage serviceLocale={serviceLocale} gameLocale={gameLocale} />;
}
