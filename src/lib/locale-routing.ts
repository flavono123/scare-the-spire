import {
  DEFAULT_GAME_LOCALE_BY_SERVICE,
  GAME_LOCALE_PATH_SEGMENTS,
  gameLocaleFromPathSegment,
  getServiceLocaleForGameLocale,
  type GameLocale,
  type GameLocalePathSegment,
  type ServiceLocale,
} from "@/lib/i18n";

export const DEFAULT_ROUTE_GAME_LOCALE = DEFAULT_GAME_LOCALE_BY_SERVICE.ko;
const PRERENDERED_GAME_LOCALE_PATH_SEGMENTS = GAME_LOCALE_PATH_SEGMENTS;

export type LocaleRouteParams<T extends Record<string, string> = Record<string, never>> = T & {
  gameLocale?: GameLocalePathSegment;
};

export type LocalePair = {
  gameLocale: GameLocale;
  serviceLocale: ServiceLocale;
};

export function getLocalePair(gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE): LocalePair {
  return {
    gameLocale,
    serviceLocale: getServiceLocaleForGameLocale(gameLocale),
  };
}

export function getGameLocaleFromRouteParam(segment: string | undefined): GameLocale {
  return gameLocaleFromPathSegment(segment) ?? DEFAULT_ROUTE_GAME_LOCALE;
}

export function searchRecordForGameLocale(
  gameLocale: GameLocale = DEFAULT_ROUTE_GAME_LOCALE,
): Record<string, string> {
  const { serviceLocale } = getLocalePair(gameLocale);
  return {
    gl: gameLocale,
    _sl: serviceLocale,
  };
}

export async function getLocalePairFromParams<T extends Record<string, string>>(
  params: Promise<LocaleRouteParams<T>>,
): Promise<LocalePair & T> {
  const resolvedParams = await params;
  const gameLocale = getGameLocaleFromRouteParam(resolvedParams.gameLocale);
  return {
    ...resolvedParams,
    ...getLocalePair(gameLocale),
  };
}

export function generateLocaleStaticParams() {
  return PRERENDERED_GAME_LOCALE_PATH_SEGMENTS.map((gameLocale) => ({ gameLocale }));
}
