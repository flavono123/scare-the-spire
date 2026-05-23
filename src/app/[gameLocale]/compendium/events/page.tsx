import BasePage, { dynamic, generateMetadata as generateBaseMetadata } from "@/app/(codex)/codex/events/page";
import { getLocalePairFromParams, searchRecordForGameLocale, type LocaleRouteParams } from "@/lib/locale-routing";

export { dynamic };

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default async function LocalizedPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return BasePage({
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}
