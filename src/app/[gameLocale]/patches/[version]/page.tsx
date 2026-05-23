import type { Metadata } from "next";
import {
  PatchDetailPage,
  generatePatchDetailStaticParams,
  getPatchDetailMetadata,
} from "@/components/patches/patch-detail-page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;

export const generateStaticParams = generatePatchDetailStaticParams;

type Props = {
  params: Promise<LocaleRouteParams<{ version: string }>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { version, serviceLocale } = await getLocalePairFromParams(params);
  return getPatchDetailMetadata({ version, serviceLocale });
}

export default async function LocalizedPatchDetailPage({ params }: Props) {
  const { version, serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  return <PatchDetailPage version={version} serviceLocale={serviceLocale} gameLocale={gameLocale} />;
}
