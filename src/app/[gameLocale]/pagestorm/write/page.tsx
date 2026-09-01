import {
  generatePagestormWriteMetadata,
  renderPagestormWritePage,
} from "@/app/pagestorm/write/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generatePagestormWriteMetadata(gameLocale);
}

export default async function LocalizedPagestormWritePage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderPagestormWritePage(gameLocale);
}
