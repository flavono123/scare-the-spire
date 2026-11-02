import {
  generateBetaArtMetadata,
  renderBetaArtPage,
} from "@/app/vexing-puzzlebox/beta-art/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateBetaArtMetadata(gameLocale);
}

export default async function LocalizedBetaArtPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderBetaArtPage(gameLocale);
}
