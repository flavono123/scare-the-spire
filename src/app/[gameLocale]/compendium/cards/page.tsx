import BasePage, { generateMetadata as generateBaseMetadata } from "@/app/(codex)/_codex/cards/page";
import { getLocalePairFromParams, searchRecordForGameLocale, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function localizedSearchParams(
  gameLocale: Parameters<typeof searchRecordForGameLocale>[0],
  searchParams: Props["searchParams"],
) {
  const resolvedSearchParams = await searchParams;
  return {
    ...resolvedSearchParams,
    ...searchRecordForGameLocale(gameLocale),
  };
}

export async function generateMetadata({ params, searchParams }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    searchParams: localizedSearchParams(gameLocale, searchParams),
  });
}

export default async function LocalizedPage({ params, searchParams }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return BasePage({
    searchParams: localizedSearchParams(gameLocale, searchParams),
  });
}
