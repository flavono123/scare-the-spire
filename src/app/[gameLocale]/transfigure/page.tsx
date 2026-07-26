import {
  generateTransfigureMetadata,
  renderTransfigurePage,
} from "@/app/transfigure/page-content";
import {
  getLocalePairFromParams,
  type LocaleRouteParams,
} from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateTransfigureMetadata(gameLocale);
}

export default async function LocalizedTransfigurePage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderTransfigurePage(gameLocale);
}
