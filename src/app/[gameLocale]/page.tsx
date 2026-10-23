import type { Metadata } from "next";
import { renderHome } from "@/app/(main)/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";
import { getHomeServiceMetadata } from "@/lib/service-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<LocaleRouteParams>;
}): Promise<Metadata> {
  const { serviceLocale } = await getLocalePairFromParams(params);
  return getHomeServiceMetadata(serviceLocale);
}

export default async function LocalizedHome({
  params,
}: {
  params: Promise<LocaleRouteParams>;
}) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderHome(gameLocale);
}
