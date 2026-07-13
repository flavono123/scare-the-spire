import type { Metadata } from "next";
import {
  generateLocaleStaticParams,
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";
import { getDefaultServiceMetadata } from "@/lib/service-metadata";

export const generateStaticParams = generateLocaleStaticParams;
export const dynamicParams = false;

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { serviceLocale } = await getLocalePairFromParams(params);
  return getDefaultServiceMetadata(serviceLocale);
}

export default function GameLocaleLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
