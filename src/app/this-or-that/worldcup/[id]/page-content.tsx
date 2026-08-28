import type { Metadata } from "next";
import { FavoriteTournamentPostView } from "@/components/this-or-that/favorite-tournament-post-view";
import { getThisOrThatGameCopy } from "@/lib/borrowed-game-copy";
import { FAVORITE_TOURNAMENT_HREF } from "@/lib/favorite-tournament";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { THIS_OR_THAT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import {
  composeToyBoxPostOgDescription,
  getServiceOgMetadata,
} from "@/lib/service-metadata";
import { serviceMessages } from "@/messages/service";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";

export async function generateFavoriteTournamentPostMetadata(
  id?: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].favoriteTournament;
  const title = serviceMessages[serviceLocale].nav.favoriteTournament;
  const description = composeToyBoxPostOgDescription({
    serviceLocale,
    serviceName: title,
    serviceDescription: copy.subtitle,
  });
  return getServiceOgMetadata({
    serviceLocale,
    title,
    description,
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: id ? `${FAVORITE_TOURNAMENT_HREF}/${id}` : FAVORITE_TOURNAMENT_HREF,
  });
}

export async function renderFavoriteTournamentPostPage(
  id: string,
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const totCopy = await getThisOrThatGameCopy(gameLocale);

  return (
    <div className={TOYBOX_WIDE_SHELL_CLASS}>
      <FavoriteTournamentPostView
        postId={id}
        gameLocale={gameLocale}
        votePrompt={totCopy.votePrompt}
      />
    </div>
  );
}
