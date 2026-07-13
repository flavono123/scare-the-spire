import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  generateLocaleStaticParams,
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";
import { gameLocaleFromPathSegment } from "@/lib/i18n";
import { getDefaultServiceMetadata } from "@/lib/service-metadata";

export const generateStaticParams = generateLocaleStaticParams;

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceLocale } = await getLocalePairFromParams(params);
  return getDefaultServiceMetadata(serviceLocale);
}

export default async function GameLocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ gameLocale: string }> }>) {
  const { gameLocale } = await params;
  if (!gameLocaleFromPathSegment(gameLocale)) notFound();

  return <>{children}</>;
}
