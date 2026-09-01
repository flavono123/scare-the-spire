import {
  generatePagestormMetadata,
  renderPagestormPage,
} from "@/app/pagestorm/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generatePagestormMetadata(gameLocale);
}

export default async function LocalizedPagestormPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderPagestormPage(gameLocale);
}
