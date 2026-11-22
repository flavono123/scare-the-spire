import type { IndexTileProps } from "@/components/place-index/index-tile";
import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { navSeenIdForHref } from "@/lib/nav-seen";
import { PLACE_AREA_META, placeIsNew, placeLabel, type Place } from "@/lib/place-registry";
import { serviceMessages } from "@/messages/service";

export function placeTileProps(
  place: Place,
  serviceLocale: ServiceLocale,
  gameLocale: GameLocale,
): IndexTileProps {
  return {
    href: localizeHrefWithGameLocale(place.href, serviceLocale, gameLocale),
    label: placeLabel(place, serviceLocale, gameLocale),
    token: place.token,
    tokenClassName: place.tokenClassName,
    art: place.art ?? PLACE_AREA_META[place.area].art,
    isNew: placeIsNew(place),
    newLabel: serviceMessages[serviceLocale].placeIndex.newLabel,
    attentionId: navSeenIdForHref(place.href) ?? undefined,
  };
}

/** Folded services go last; the rest keep registry order. */
export function foldLast(places: readonly Place[]): Place[] {
  return [...places].sort((a, b) => Number(Boolean(a.fold)) - Number(Boolean(b.fold)));
}
