import BasePage, { generateMetadata as generateBaseMetadata } from "@/app/(codex)/_codex/keywords/page";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
  searchRecordForGameLocale,
} from "@/lib/locale-routing";

export const dynamic = "force-static";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default async function LocalizedKeywordsPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return BasePage({
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}
