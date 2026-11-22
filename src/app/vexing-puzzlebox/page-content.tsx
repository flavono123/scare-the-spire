import type { Metadata } from "next";
import { IndexPageHeader } from "@/components/place-index/index-page-header";
import { IndexTileLarge, IndexTileSmall } from "@/components/place-index/index-tile";
import { NavAttentionMarkers } from "@/components/place-index/nav-attention-markers";
import { placeTileProps } from "@/components/place-index/place-tiles";
import { getVexingPuzzleboxGameCopy } from "@/lib/borrowed-game-copy";
import { getServiceLocaleForGameLocale, localizeHrefWithGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { VEXING_PUZZLEBOX_PAGE_OG_IMAGE } from "@/lib/page-og-images";
import { PLACE_AREA_META, placesInArea } from "@/lib/place-registry";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { VEXING_PUZZLEBOX_HREF } from "@/lib/vexing-puzzlebox";
import { serviceMessages } from "@/messages/service";

export async function generateVexingPuzzleboxMetadata(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Promise<Metadata> {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const messages = serviceMessages[serviceLocale];
  return getServiceOgMetadata({
    serviceLocale,
    title: (await getVexingPuzzleboxGameCopy(gameLocale)).title,
    description: composeToyBoxIndexOgDescription(serviceLocale, messages.vexingPuzzlebox.subtitle),
    image: VEXING_PUZZLEBOX_PAGE_OG_IMAGE,
    canonicalPath: VEXING_PUZZLEBOX_HREF,
  });
}

/** The Vexing Puzzlebox hub: one tile per game, tools after them. */
export async function renderVexingPuzzleboxPage(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].placeIndex;
  const gameCopy = await getVexingPuzzleboxGameCopy(gameLocale);
  const places = placesInArea("zzapper").filter((place) => place.kind !== "hub");
  const games = places.filter((place) => place.kind === "game");
  const tools = places.filter((place) => place.kind === "tool");

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-place-index="zzapper">
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <IndexPageHeader
          title={gameCopy.title}
          token={PLACE_AREA_META.zzapper.token}
          art={PLACE_AREA_META.zzapper.art}
          homeHref={localizeHrefWithGameLocale("/", serviceLocale, gameLocale)}
          backLabel={copy.backHome}
        />
        <div className="mt-6 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {games.map((place) => (
            <IndexTileLarge key={place.id} {...placeTileProps(place, serviceLocale, gameLocale)} />
          ))}
          {tools.map((place) => (
            <IndexTileSmall key={place.id} {...placeTileProps(place, serviceLocale, gameLocale)} />
          ))}
        </div>
      </div>
      <NavAttentionMarkers />
    </div>
  );
}
