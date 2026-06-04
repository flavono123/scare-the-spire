import {
  DEFAULT_ROUTE_GAME_LOCALE,
  searchRecordForGameLocale,
} from "@/lib/locale-routing";

export type RouteSearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function defaultRouteSearchParams(searchParams?: RouteSearchParams) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  return {
    ...resolvedSearchParams,
    ...searchRecordForGameLocale(DEFAULT_ROUTE_GAME_LOCALE),
  };
}
