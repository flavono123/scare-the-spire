import { generateMenuMetadata, renderMenuPage } from "@/app/menu/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateMenuMetadata(gameLocale);
}

export default async function LocalizedMenuPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderMenuPage(gameLocale);
}
