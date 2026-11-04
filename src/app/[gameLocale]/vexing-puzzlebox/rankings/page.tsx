import {
  generateRankingsMetadata,
  renderRankingsPage,
} from "@/app/vexing-puzzlebox/rankings/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateRankingsMetadata(gameLocale);
}

export default async function LocalizedRankingsPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderRankingsPage(gameLocale);
}
