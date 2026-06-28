import BasePage, { generateMetadata as generateBaseMetadata } from "@/app/(codex)/_codex/cards/[id]/page";
import { generateCardStaticParams, generateLocalizedStaticParams } from "@/lib/codex-static-params";
import { getLocalePairFromParams, searchRecordForGameLocale, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;
type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateStaticParams() {
  return generateLocalizedStaticParams(generateCardStaticParams);
}

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
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    params: Promise.resolve({ id }),
    searchParams: localizedSearchParams(gameLocale, searchParams),
  });
}

export default async function LocalizedDetailPage({ params, searchParams }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return BasePage({
    params: Promise.resolve({ id }),
    searchParams: localizedSearchParams(gameLocale, searchParams),
  });
}
