import {
  generateFavoriteTournamentPostMetadata,
  renderFavoriteTournamentPostPage,
} from "@/app/this-or-that/tournament/[id]/page-content";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams<{ id: string }>>;
};

export async function generateMetadata({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return generateFavoriteTournamentPostMetadata(id, gameLocale);
}

export default async function LocalizedFavoriteTournamentPostPage({ params }: Props) {
  const { gameLocale, id } = await getLocalePairFromParams(params);
  return renderFavoriteTournamentPostPage(id, gameLocale);
}
