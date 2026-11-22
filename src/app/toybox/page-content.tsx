import type { Metadata } from "next";
import { IndexPageHeader } from "@/components/place-index/index-page-header";
import { IndexTileLarge, IndexTileSmall } from "@/components/place-index/index-tile";
import { NavAttentionMarkers } from "@/components/place-index/nav-attention-markers";
import { foldLast, placeTileProps } from "@/components/place-index/place-tiles";
import { DEFRAGMENT_FEED_SERVICE_META } from "@/lib/defragment";
import { getServiceLocaleForGameLocale, type GameLocale } from "@/lib/i18n";
import { DEFAULT_ROUTE_GAME_LOCALE } from "@/lib/locale-routing";
import { PLACE_AREA_META, placeLabel, placesInArea } from "@/lib/place-registry";
import { composeToyBoxIndexOgDescription, getServiceOgMetadata } from "@/lib/service-metadata";
import { TOYBOX_WIDE_SHELL_CLASS } from "@/lib/toybox-layout";
import { serviceMessages } from "@/messages/service";

export const TOYBOX_HREF = "/toybox";

export function generateToyboxMetadata(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE): Metadata {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].placeIndex;
  return getServiceOgMetadata({
    serviceLocale,
    title: copy.areas.toybox,
    description: composeToyBoxIndexOgDescription(serviceLocale, copy.toyboxDescription),
    canonicalPath: TOYBOX_HREF,
  });
}

/** Every Toy Box service, folded ones last; 조각모음 is wide and shows what its board gathers. */
export function renderToyboxPage(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE) {
  const serviceLocale = getServiceLocaleForGameLocale(gameLocale);
  const copy = serviceMessages[serviceLocale].placeIndex;
  const places = foldLast(placesInArea("toybox").filter((place) => !place.menuHidden));
  const boardHrefs = new Set(Object.values(DEFRAGMENT_FEED_SERVICE_META).map((meta) => meta.hrefBase));
  const boardKids = placesInArea("toybox")
    .filter((place) => boardHrefs.has(place.href))
    .map((place) => ({ token: place.token, label: placeLabel(place, serviceLocale, gameLocale) }));

  return (
    <div className="relative isolate min-h-[calc(100svh-3rem)]" data-place-index="toybox">
      <div className={TOYBOX_WIDE_SHELL_CLASS}>
        <IndexPageHeader
          title={copy.areas.toybox}
          token={PLACE_AREA_META.toybox.token}
          art={PLACE_AREA_META.toybox.art}
        />
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {places.map((place) => {
            const tile = placeTileProps(place, serviceLocale, gameLocale);
            return place.id === "defragment"
              ? <IndexTileLarge key={place.id} {...tile} kids={boardKids} />
              : <IndexTileSmall key={place.id} {...tile} />;
          })}
        </div>
      </div>
      <NavAttentionMarkers />
    </div>
  );
}
