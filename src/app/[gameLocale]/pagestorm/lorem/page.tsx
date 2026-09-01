import {
  generatePagestormLoremMetadata,
  renderPagestormLoremPage,
} from "@/app/pagestorm/lorem/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generatePagestormLoremMetadata(gameLocale);
}

export default async function LocalizedPagestormLoremPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderPagestormLoremPage(gameLocale);
}
