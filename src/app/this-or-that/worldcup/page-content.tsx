import type { Metadata } from "next";
import { FavoriteTournamentClient } from "@/components/this-or-that/favorite-tournament-client";
import { ServiceBackground } from "@/components/service-background";
import {
  getDecisionsDecisionsGameCopy,
  getThisOrThatGameCopy,
} from "@/lib/borrowed-game-copy";
import {
  FAVORITE_TOURNAMENT_BACKGROUND_SRC,
  FAVORITE_TOURNAMENT_HREF,
} from "@/lib/favorite-tournament";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { THIS_OR_THAT_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export async function generateFavoriteTournamentMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  return getServiceOgMetadata({
    serviceLocale,
    title: serviceMessages[serviceLocale].nav.favoriteTournament,
    description: composeToyBoxIndexOgDescription(
      serviceLocale,
      serviceMessages[serviceLocale].favoriteTournament.subtitle,
    ),
    image: THIS_OR_THAT_PAGE_OG_IMAGE,
    canonicalPath: FAVORITE_TOURNAMENT_HREF,
  });
}

export async function renderFavoriteTournamentPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const [totCopy, decisionsCopy] = await Promise.all([
    getThisOrThatGameCopy(gameLocale),
    getDecisionsDecisionsGameCopy(gameLocale),
  ]);
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const title = serviceMessages[serviceLocale].nav.favoriteTournament;

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]">
      <ServiceBackground
        src={FAVORITE_TOURNAMENT_BACKGROUND_SRC}
        imageClassName="object-[38%_center] sm:object-center"
      />
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <FavoriteTournamentClient
          gameLocale={gameLocale}
          title={title}
          hero={totCopy.prompt}
          presetLabels={decisionsCopy.presetLabels}
        />
      </div>
    </div>
  );
}
