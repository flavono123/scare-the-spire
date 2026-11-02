import {
  generateVexingPuzzleboxMetadata,
  renderVexingPuzzleboxPage,
} from "@/app/vexing-puzzlebox/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateVexingPuzzleboxMetadata(gameLocale);
}

export default async function LocalizedVexingPuzzleboxPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderVexingPuzzleboxPage(gameLocale);
}
