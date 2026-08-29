import { permanentRedirect } from "next/navigation";
import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";
import { pathPrefixForGameLocale } from "@/lib/i18n";
import { getLocalePairFromParams, type LocaleRouteParams } from "@/lib/locale-routing";

type Props = {
  params: Promise<LocaleRouteParams>;
};

export default async function LocalizedLegacyFavoriteTournamentPage({ params }: Props) {
  const { gameLocale } = await getLocalePairFromParams(params);
  permanentRedirect(`${pathPrefixForGameLocale(gameLocale)}${FAVORITE_TOURNAMENT_HREF}`);
}
