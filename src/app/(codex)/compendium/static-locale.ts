import {
  DEFAULT_ROUTE_GAME_LOCALE,
  searchRecordForGameLocale,
} from "@/lib/locale-routing";

export function defaultRouteSearchParams() {
  return Promise.resolve(searchRecordForGameLocale(DEFAULT_ROUTE_GAME_LOCALE));
}
