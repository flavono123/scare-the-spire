import type { Metadata } from "next";
import {
  getNeowsletterListMetadata,
  NeowsletterListPage,
} from "@/components/patches/neowsletter-list-page";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceLocale } = await getLocalePairFromParams(params);
  return getNeowsletterListMetadata(serviceLocale);
}

export default async function LocalizedNeowsletterListPage({ params }: Props) {
  const { serviceLocale, gameLocale } = await getLocalePairFromParams(params);
  return <NeowsletterListPage serviceLocale={serviceLocale} gameLocale={gameLocale} />;
}
