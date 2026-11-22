import { localizeHrefWithGameLocale, type GameLocale, type ServiceLocale } from "@/lib/i18n";
import { navSeenIdForHref } from "@/lib/nav-seen";
import { PLACE_AREA_META, placeIsNew, placeLabel, placesInArea, type PlaceArea } from "@/lib/place-registry";
import { serviceMessages } from "@/messages/service";

export type TopBarLink = {
  id: string;
  href: string;
  label: string;
  token: string;
  tokenClassName?: string;
  isNew: boolean;
  fold: boolean;
  /** nav-seen surface id; its dot shows when the surface has new posts. */
  attentionId?: string;
};

export type TopBarMenuRow = {
  area: PlaceArea;
  title: string;
  href: string;
  token: string;
  items: TopBarLink[];
};

const MENU_AREAS = ["sts2", "sts1", "zzapper", "toybox"] as const satisfies readonly PlaceArea[];

function areaLinks(area: PlaceArea, serviceLocale: ServiceLocale, gameLocale: GameLocale): TopBarLink[] {
  return placesInArea(area)
    .filter((place) => place.kind !== "hub" && !place.menuHidden)
    .map((place) => ({
      id: place.id,
      href: localizeHrefWithGameLocale(place.href, serviceLocale, gameLocale),
      label: placeLabel(place, serviceLocale, gameLocale),
      token: place.token,
      tokenClassName: place.tokenClassName,
      isNew: placeIsNew(place),
      fold: Boolean(place.fold),
      attentionId: navSeenIdForHref(place.href) ?? undefined,
    }));
}

/** One row per area for the menu panel, in registry order (the controller sorts on open). */
export function topBarMenuRows(serviceLocale: ServiceLocale, gameLocale: GameLocale): TopBarMenuRow[] {
  const copy = serviceMessages[serviceLocale].placeIndex;
  return MENU_AREAS.map((area) => ({
    area,
    title: copy.areas[area],
    href: localizeHrefWithGameLocale(PLACE_AREA_META[area].href, serviceLocale, gameLocale),
    token: PLACE_AREA_META[area].token,
    items: areaLinks(area, serviceLocale, gameLocale),
  }));
}

export function topBarPatchLinks(serviceLocale: ServiceLocale, gameLocale: GameLocale): TopBarLink[] {
  return areaLinks("patches", serviceLocale, gameLocale);
}
