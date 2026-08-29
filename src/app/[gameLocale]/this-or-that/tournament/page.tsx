import {
  generateFavoriteTournamentMetadata,
  renderFavoriteTournamentPage,
} from "@/app/this-or-that/tournament/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return generateFavoriteTournamentMetadata(gameLocale);
}

export default async function LocalizedFavoriteTournamentPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  return renderFavoriteTournamentPage(gameLocale);
}
