import BasePage, { generateMetadata as generateBaseMetadata } from "@/app/(codex)/codex/enchantments/page";
import {
  getLocalePairFromParams,
  searchRecordForGameLocaleWithParams,
  type LocaleRouteParams,
  type RouteSearchParams,
} from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
  searchParams: RouteSearchParams;
};

export async function generateMetadata({ params, searchParams }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    searchParams: searchRecordForGameLocaleWithParams(gameLocale, searchParams),
  });
}

export default async function LocalizedPage({ params, searchParams }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return BasePage({
    searchParams: searchRecordForGameLocaleWithParams(gameLocale, searchParams),
  });
}
