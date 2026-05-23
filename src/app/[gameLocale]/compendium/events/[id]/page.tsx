import BasePage, {
  dynamic,
  dynamicParams,
  generateMetadata as generateBaseMetadata,
  generateStaticParams,
} from "@/app/(codex)/codex/events/[id]/page";
import { getLocalePairFromParams, searchRecordForGameLocale, type LocaleRouteParams } from "@/lib/locale-routing";

export { dynamic, dynamicParams, generateStaticParams };

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default async function LocalizedDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return BasePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}
