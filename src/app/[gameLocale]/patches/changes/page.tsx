import type { Metadata } from "next";
import {
  getResourcePatchIndexMetadata,
  ResourcePatchIndexPage,
} from "@/components/patches/resource-patch-index-page";
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
  const { serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  return <ResourcePatchIndexPage serviceLocale={serviceLocale} gameLocale={gameLocale} />;
}
