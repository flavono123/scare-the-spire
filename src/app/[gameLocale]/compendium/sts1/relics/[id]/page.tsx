import BasePage, { generateMetadata as generateBaseMetadata } from "@/app/(codex)/_sts1/relics/[id]/page";
import { generateSts1LocalizedRelicStaticParams } from "@/lib/sts1/static-params";
import { getLocalePairFromParams, searchRecordForGameLocale, type LocaleRouteParams } from "@/lib/locale-routing";

export const dynamic = "force-static";
export const dynamicParams = false;

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateStaticParams() {
  return generateSts1LocalizedRelicStaticParams();
}

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateBaseMetadata({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}

export default async function LocalizedSts1RelicDetailPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return BasePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(searchRecordForGameLocale(gameLocale)),
  });
}
