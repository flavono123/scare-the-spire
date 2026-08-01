import BasePage, {
  generateMetadata as generateBaseMetadata,
  generateStaticParams as generateBaseStaticParams,
} from "@/app/(codex)/_codex/badges/[id]/page";
import { generateLocalizedStaticParams } from "@/lib/codex-static-params";
import {
  getLocalePairFromParams,
  searchRecordForGameLocale,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = { params: Promise<LocaleRouteParams<{ id: string }>> };

export function generateStaticParams() {
  return generateLocalizedStaticParams(generateBaseStaticParams);
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export async function LocalizedBadgeDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return BasePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default LocalizedBadgeDetailPage;
